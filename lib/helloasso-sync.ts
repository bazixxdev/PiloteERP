import { prisma } from "./db";
import { HelloAssoError, helloAssoReportText, itemStatus, itemStructure, itemYear, listForms, listOrders, type HelloAssoConfig, type HelloAssoOrder, type HelloAssoReport } from "./helloasso";
import { findOrCreateOrganisation, hasKind, kindsOf, serializeKinds } from "./organisations";
import { fieldKey, parseFields, parseValues, serializeFields, type ListField } from "./contacts";

// Synchronisation HelloAsso → outil (18/09). Les commandes du compte : un item « Membership » devient une adhésion (structure
// = organisation de l'annuaire, genre « member », référent = le payeur ; sans structure = personne physique, contact de
// l'annuaire) ; un item d'un formulaire d'événement suivi devient une ligne de la liste miroir « HelloAsso · <événement> »
// (tarif en rôle, champs personnalisés en colonnes). Idempotente (identifiant d'item) ; HelloAsso fait foi pour ses
// propres items (montant, règlement), le reste ne s'écrase pas.

const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s || null; };
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function ensureMemberKind(orgId: string) {
  const o = await prisma.organisation.findUnique({ where: { id: orgId } });
  if (o && !hasKind(o, "member")) await prisma.organisation.update({ where: { id: orgId }, data: { kinds: serializeKinds([...kindsOf(o), "member"]) } });
}

// Le contact d'une commande (payeur, ou participant d'une inscription) : par e-mail, sinon par nom ; créé au besoin.
async function resolveContact(p: { firstName?: string | null; lastName?: string | null; email?: string | null; city?: string | null; zipCode?: string | null; address?: string | null }, organisationId: string | null, byId: string, report: HelloAssoReport) {
  const email = clean(p.email)?.toLowerCase() ?? null;
  const lastName = clean(p.lastName); const firstName = clean(p.firstName);
  if (!email && !lastName) return null;
  let c = email && validEmail(email) ? await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null;
  if (!c && lastName) c = await prisma.contact.findFirst({ where: { lastName: { equals: lastName, mode: "insensitive" }, firstName: firstName ? { equals: firstName, mode: "insensitive" } : null } });
  if (c) {
    const data: Record<string, unknown> = {};
    if (!c.organisationId && organisationId) { data.organisationId = organisationId; data.organisationName = null; }
    if (!c.email && email && validEmail(email)) data.email = email;
    if (!c.city && p.city) data.city = clean(p.city);
    if (!c.postcode && p.zipCode) data.postcode = clean(p.zipCode);
    if (Object.keys(data).length) await prisma.contact.update({ where: { id: c.id }, data });
    return c.id;
  }
  const created = await prisma.contact.create({ data: { lastName: lastName ?? email!, firstName, email: email && validEmail(email) ? email : null, organisationId, city: clean(p.city), postcode: clean(p.zipCode), address: clean(p.address), createdById: byId } });
  report.contacts++;
  return created.id;
}

export async function syncHelloAsso(cfg: HelloAssoConfig, byId: string, f: typeof fetch = fetch): Promise<HelloAssoReport> {
  const report: HelloAssoReport = { orders: 0, memberships: 0, created: 0, updated: 0, organisations: 0, contacts: 0, lists: 0, added: 0, removed: 0 };
  const [forms, orders] = await Promise.all([listForms(cfg, f), listOrders(cfg, f)]);
  report.orders = orders.length;
  const titleOf = new Map(forms.map((x) => [x.formSlug, x.title]));

  // ——— 1. Adhésions ———
  for (const order of orders) {
    for (const item of order.items ?? []) {
      if (item.type !== "Membership") continue;
      report.memberships++;
      const itemId = String(item.id);
      const status = itemStatus(item);
      const amount = (item.amount ?? 0) / 100;
      const existing = await prisma.membership.findUnique({ where: { helloAssoItemId: itemId } });
      if (existing) {
        const data: Record<string, unknown> = {};
        if (existing.status !== status && existing.status !== "exempt") data.status = status;
        if (existing.amount !== amount) data.amount = amount;
        if (status === "paid" && !existing.paidAt) data.paidAt = new Date(order.date);
        if (Object.keys(data).length) { await prisma.membership.update({ where: { id: existing.id }, data }); report.updated++; }
        continue;
      }
      const structure = itemStructure(order, item);
      let organisationId: string | null = null;
      if (structure) {
        const before = await prisma.organisation.count({ where: { name: { equals: structure, mode: "insensitive" } } });
        const o = await findOrCreateOrganisation(structure, "member", { email: null });
        if (!before) report.organisations++;
        organisationId = o.id;
      }
      const contactId = await resolveContact({ ...(item.user?.lastName ? item.user : order.payer), email: order.payer?.email, city: order.payer?.city, zipCode: order.payer?.zipCode, address: order.payer?.address }, organisationId, byId, report);
      const year = itemYear(order, item, titleOf.get(order.formSlug));
      // Une adhésion déjà préparée à la main pour ce membre et cette année (reconduction « à régler ») : c'est elle que
      // HelloAsso règle — on la complète au lieu d'en créer une seconde.
      const prepared = await prisma.membership.findFirst({ where: { year, helloAssoItemId: null, status: { not: "cancelled" }, ...(organisationId ? { organisationId } : { contactId: contactId ?? "-" }) } });
      if (prepared) {
        await prisma.membership.update({ where: { id: prepared.id }, data: { status: prepared.status === "exempt" ? "exempt" : status, amount: amount || prepared.amount, paidAt: status === "paid" ? prepared.paidAt ?? new Date(order.date) : prepared.paidAt, method: "helloasso", helloAssoItemId: itemId, helloAssoForm: order.formSlug, college: prepared.college ?? clean(item.name), contactId: prepared.contactId ?? contactId } });
        report.updated++;
        continue;
      }
      await prisma.membership.create({ data: { organisationId, contactId, year, college: clean(item.name), amount, status, paidAt: status === "paid" ? new Date(order.date) : null, method: "helloasso", helloAssoItemId: itemId, helloAssoForm: order.formSlug, createdById: byId } });
      report.created++;
    }
  }

  // ——— 2. Formulaires d'événement suivis : inscrits en miroir ———
  const lists = await prisma.contactList.findMany({ where: { source: "helloasso", helloAssoForm: { not: null } }, include: { items: { select: { contactId: true, values: true, role: true } } } });
  for (const list of lists) {
    const relevant = orders.filter((o) => o.formSlug === list.helloAssoForm);
    const fields = parseFields(list.fields);
    const wanted = new Set<string>();
    for (const o of relevant) for (const it of o.items ?? []) for (const c of it.customFields ?? []) if (clean(c.answer)) wanted.add(c.name);
    const next: ListField[] = fields.filter((x) => !x.synced || wanted.has(x.label));
    for (const name of wanted) if (!next.some((x) => x.synced && x.label === name)) next.push({ key: `ha_${fieldKey(name)}`, label: name, type: "text", synced: true });
    const keyOf = new Map(next.filter((x) => x.synced).map((x) => [x.label, x.key]));
    const current = new Map(list.items.map((i) => [i.contactId, i]));
    const kept = new Set<string>();
    for (const o of relevant) {
      for (const it of o.items ?? []) {
        if (itemStatus(it) === "cancelled") continue;
        if (!["Registration", "Membership", "Payment", "Donation"].includes(it.type) && it.type) continue;
        const participant = it.user?.lastName ? { ...it.user, email: (it.user.lastName?.toLowerCase() === o.payer?.lastName?.toLowerCase() && it.user.firstName?.toLowerCase() === o.payer?.firstName?.toLowerCase()) ? o.payer?.email : null } : { ...o.payer };
        const contactId = await resolveContact({ ...participant, city: o.payer?.city, zipCode: o.payer?.zipCode }, null, byId, report);
        if (!contactId || kept.has(contactId)) continue;
        kept.add(contactId);
        const item = current.get(contactId);
        const values = item ? parseValues(item.values) : {};
        for (const [name, key] of keyOf) values[key] = clean((it.customFields ?? []).find((c) => c.name === name)?.answer) ?? values[key] ?? null;
        const role = clean(it.name);
        if (item) { const s = JSON.stringify(values); if (s !== item.values || (role && role !== item.role)) await prisma.contactListItem.update({ where: { listId_contactId: { listId: list.id, contactId } }, data: { values: s, ...(role ? { role } : {}) } }); }
        else { await prisma.contactListItem.create({ data: { listId: list.id, contactId, role, values: JSON.stringify(values) } }); report.added++; }
      }
    }
    const out = list.items.filter((i) => !kept.has(i.contactId)).map((i) => i.contactId);
    if (out.length) { await prisma.contactListItem.deleteMany({ where: { listId: list.id, contactId: { in: out } } }); report.removed += out.length; }
    await prisma.contactList.update({ where: { id: list.id }, data: { fields: serializeFields(next), brevoSyncedAt: new Date() } });
    report.lists++;
  }
  await prisma.settings.update({ where: { id: 1 }, data: { helloAssoSyncedAt: new Date(), helloAssoSyncReport: helloAssoReportText(report) } });
  return report;
}

// Suivre un formulaire d'événement : un miroir ici (visible de tous, en lecture), rempli par la synchronisation.
export async function followHelloAssoForm(cfg: HelloAssoConfig, formSlug: string, byId: string, f: typeof fetch = fetch): Promise<string> {
  const existing = await prisma.contactList.findUnique({ where: { helloAssoForm: formSlug } });
  if (existing) return existing.id;
  const form = (await listForms(cfg, f)).find((x) => x.formSlug === formSlug);
  if (!form) throw new HelloAssoError("Ce formulaire n'existe pas (ou plus) dans HelloAsso.");
  const l = await prisma.contactList.create({ data: { ownerId: byId, name: form.title, description: `Inscrits HelloAsso${form.startDate ? ` · ${new Date(form.startDate).toLocaleDateString("fr-FR")}` : ""}`, visibility: "all", source: "helloasso", helloAssoForm: formSlug } });
  return l.id;
}

export { ensureMemberKind };
export type { HelloAssoOrder };
