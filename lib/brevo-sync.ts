import { prisma } from "./db";
import { BrevoError, createFolder, createList, getContact, listAllContacts, listAttributeNames, listContactsOfList, listFolders, listLists, readAttributes, removeFromList, syncReportText, upsertContact, writeAttributes, type BrevoConfig, type SyncReport } from "./brevo";
import { fieldKey, parseFields, parseValues, serializeFields, type ListField } from "./contacts";

// Synchronisation Brevo → outil (18/09). Tous les contacts du compte entrent dans l'annuaire avec leurs attributs (les colonnes
// communes reconnues, le reste gardé tel quel) ; les listes Brevo suivies sont tenues en miroir (membres, attributs en
// colonnes). Rapprochement par identifiant Brevo, sinon par e-mail ; un contact connu est complété, jamais écrasé. Les
// désinscrits et disparus sont marqués, jamais supprimés : l'humain tranche (RGPD). Idempotente.

export type { SyncReport };

export async function syncBrevo(cfg: BrevoConfig, byId: string, f: typeof fetch = fetch): Promise<SyncReport> {
  const report: SyncReport = { contacts: 0, created: 0, updated: 0, unsubscribed: 0, deleted: 0, lists: 0, added: 0, removed: 0 };
  const remote = await listAllContacts(cfg, f);
  report.contacts = remote.length;

  // ——— 1. L'annuaire : un contact Brevo → un contact ici ———
  const local = await prisma.contact.findMany({ select: { id: true, email: true, brevoContactId: true, brevoStatus: true, brevoAttributes: true, firstName: true, lastName: true, phone: true, organisationName: true, organisationId: true, role: true, city: true, postcode: true, address: true } });
  const byBrevoId = new Map(local.filter((c) => c.brevoContactId).map((c) => [c.brevoContactId!, c]));
  const byEmail = new Map(local.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));
  const idOf = new Map<number, string>(); // id Brevo → id contact
  const seen = new Set<string>();
  for (const rc of remote) {
    const bid = String(rc.id);
    seen.add(bid);
    const email = rc.email?.trim().toLowerCase() || null;
    const status = rc.emailBlacklisted ? "unsubscribed" : "active";
    const { common, others } = readAttributes(rc.attributes);
    const attributes = JSON.stringify(others);
    const existing = byBrevoId.get(bid) ?? (email ? byEmail.get(email) : undefined);
    if (existing) {
      const data: Record<string, unknown> = {};
      if (!existing.brevoContactId) data.brevoContactId = bid;
      if (existing.brevoStatus !== status) data.brevoStatus = status;
      if (existing.brevoAttributes !== attributes) data.brevoAttributes = attributes;
      if (!existing.email && email) data.email = email;
      for (const [k, v] of Object.entries(common)) {
        if (k === "organisationName" && existing.organisationId) continue;
        if (!(existing as Record<string, unknown>)[k]) data[k] = v;
      }
      if (Object.keys(data).length) { await prisma.contact.update({ where: { id: existing.id }, data: { ...data, brevoSyncedAt: new Date() } }); report.updated++; }
      idOf.set(rc.id, existing.id);
    } else {
      const c = await prisma.contact.create({ data: { lastName: common.lastName ?? email ?? `Contact Brevo ${bid}`, firstName: common.firstName ?? null, email, phone: common.phone ?? null, organisationName: common.organisationName ?? null, role: common.role ?? null, city: common.city ?? null, postcode: common.postcode ?? null, address: common.address ?? null, brevoContactId: bid, brevoStatus: status, brevoAttributes: attributes, brevoSyncedAt: new Date(), createdById: byId } });
      idOf.set(rc.id, c.id);
      if (email) byEmail.set(email, { ...c });
      report.created++;
    }
    if (status === "unsubscribed") report.unsubscribed++;
  }
  // Disparus de Brevo : marqués, gardés.
  const gone = local.filter((c) => c.brevoContactId && !seen.has(c.brevoContactId) && c.brevoStatus !== "deleted");
  for (const c of gone) await prisma.contact.update({ where: { id: c.id }, data: { brevoStatus: "deleted", brevoSyncedAt: new Date() } });
  report.deleted = gone.length;

  // ——— 2. Les listes suivies : membres et colonnes en miroir ———
  const lists = await prisma.contactList.findMany({ where: { source: "brevo", brevoListId: { not: null } }, include: { items: { select: { contactId: true, values: true } } } });
  for (const list of lists) {
    const members = remote.filter((c) => c.listIds?.includes(list.brevoListId!));
    // Colonnes = attributs (hors colonnes communes) portés par au moins un membre ; les colonnes ajoutées à la main restent.
    const fields = parseFields(list.fields);
    const wanted = new Map<string, string>();
    for (const m of members) for (const name of Object.keys(readAttributes(m.attributes).others)) wanted.set(name, name);
    const next: ListField[] = fields.filter((x) => !x.synced || wanted.has(x.label));
    for (const name of wanted.keys()) if (!next.some((x) => x.synced && x.label === name)) next.push({ key: `brevo_${fieldKey(name)}`, label: name, type: "text", synced: true });
    const keyOf = new Map(next.filter((x) => x.synced).map((x) => [x.label, x.key]));
    const memberIds = new Set(members.map((m) => idOf.get(m.id)).filter(Boolean) as string[]);
    const current = new Map(list.items.map((i) => [i.contactId, i]));
    for (const m of members) {
      const contactId = idOf.get(m.id); if (!contactId) continue;
      const item = current.get(contactId);
      const values = item ? parseValues(item.values) : {};
      for (const [name, key] of keyOf) values[key] = readAttributes(m.attributes).others[name] ?? null;
      if (item) { const s = JSON.stringify(values); if (s !== item.values) await prisma.contactListItem.update({ where: { listId_contactId: { listId: list.id, contactId } }, data: { values: s } }); }
      else { await prisma.contactListItem.create({ data: { listId: list.id, contactId, values: JSON.stringify(values) } }); report.added++; }
    }
    const out = list.items.filter((i) => !memberIds.has(i.contactId)).map((i) => i.contactId);
    if (out.length) { await prisma.contactListItem.deleteMany({ where: { listId: list.id, contactId: { in: out } } }); report.removed += out.length; }
    await prisma.contactList.update({ where: { id: list.id }, data: { fields: serializeFields(next), brevoSyncedAt: new Date() } });
    report.lists++;
  }
  await prisma.settings.update({ where: { id: 1 }, data: { brevoSyncedAt: new Date(), brevoSyncReport: syncReportText(report) } });
  return report;
}

// Envoi d'une liste vers Brevo : la liste y est créée (dossier « Pilote ») la première fois, puis tenue à jour — contacts
// créés ou complétés là-bas et inscrits, sortis de la liste Brevo s'ils ne sont plus ici. Sans e-mail : ignoré ; désinscrit ou
// supprimé dans Brevo : jamais renvoyé.
export type PushReport = { sent: number; noEmail: number; unsubscribed: number; removed: number; brevoListId: number };

export async function pushListToBrevo(cfg: BrevoConfig, listId: string, f: typeof fetch = fetch, pauseMs = 120): Promise<PushReport> {
  const list = await prisma.contactList.findUnique({ where: { id: listId }, include: { items: { include: { contact: { include: { organisation: { select: { name: true } } } } } } } });
  if (!list) throw new BrevoError("Liste introuvable.");
  if (list.source === "brevo") throw new BrevoError("Cette liste vient de Brevo : elle se met à jour depuis Brevo, pas l'inverse.");
  let brevoListId = list.brevoListId;
  if (!brevoListId) {
    const folders = await listFolders(cfg, f);
    const folderId = folders.find((x) => x.name === "Pilote")?.id ?? (await createFolder(cfg, "Pilote", f));
    brevoListId = await createList(cfg, list.name, folderId, f);
    await prisma.contactList.update({ where: { id: listId }, data: { brevoListId } });
  }
  const known = await listAttributeNames(cfg, f);
  const report: PushReport = { sent: 0, noEmail: 0, unsubscribed: 0, removed: 0, brevoListId };
  const kept = new Set<string>();
  for (const { contact: c } of list.items) {
    const email = c.email?.trim().toLowerCase();
    if (!email) { report.noEmail++; continue; }
    if (c.brevoStatus === "unsubscribed" || c.brevoStatus === "deleted") { report.unsubscribed++; continue; }
    const id = await upsertContact(cfg, { email, attributes: writeAttributes(c, known), listIds: [brevoListId] }, f);
    let brevoContactId = c.brevoContactId ?? (id != null ? String(id) : null);
    if (!brevoContactId) { const rc = await getContact(cfg, email, f); brevoContactId = rc ? String(rc.id) : null; }
    await prisma.contact.update({ where: { id: c.id }, data: { brevoStatus: "active", brevoSyncedAt: new Date(), ...(brevoContactId && !c.brevoContactId ? { brevoContactId } : {}) } }).catch(() => undefined); // identifiant déjà pris : on n'écrase pas
    kept.add(email);
    report.sent++;
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  const members = await listContactsOfList(cfg, brevoListId, f);
  const out = members.map((m) => m.email?.toLowerCase()).filter((e): e is string => Boolean(e) && !kept.has(e!));
  if (out.length) { await removeFromList(cfg, brevoListId, out, f); report.removed = out.length; }
  await prisma.contactList.update({ where: { id: listId }, data: { brevoSyncedAt: new Date() } });
  return report;
}

// Suivre une liste Brevo : un miroir ici (visible de tous, en lecture ; l'auteur = qui l'a suivie), rempli par la synchronisation.
export async function followBrevoList(cfg: BrevoConfig, brevoListId: number, byId: string, f: typeof fetch = fetch): Promise<string> {
  const existing = await prisma.contactList.findUnique({ where: { brevoListId } });
  if (existing) return existing.id;
  const remote = (await listLists(cfg, f)).find((l) => l.id === brevoListId);
  if (!remote) throw new BrevoError("Cette liste n'existe pas (ou plus) dans Brevo.");
  const l = await prisma.contactList.create({ data: { ownerId: byId, name: remote.name, description: `Liste Brevo${remote.folderName ? ` · dossier ${remote.folderName}` : ""}`, visibility: "all", source: "brevo", brevoListId } });
  return l.id;
}
