"use server";

import { revalidatePath } from "next/cache";
import { readSpreadsheet } from "@/lib/spreadsheet";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin, type Actor } from "@/lib/rights";
import { VISIBILITIES } from "@/lib/modules";
import { NOTE_COLORS } from "@/lib/notes";
import { CONTACT_COLUMNS, canReadList, fieldKey, parseFields, parseValues, serializeFields, serializeTags, type ListField, type ListFieldType } from "@/lib/contacts";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s || null; };
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ——— Contacts (annuaire commun : chacun le tient à jour) ———

export type ContactInput = { firstName?: string | null; lastName: string; email?: string | null; phone?: string | null; role?: string | null; organisationId?: string | null; organisationName?: string | null; address?: string | null; postcode?: string | null; city?: string | null; tags?: string | null; notes?: string | null };

export async function createContact(input: ContactInput): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const lastName = clean(input.lastName);
  if (!lastName) return { ok: false, error: "Le nom est obligatoire." };
  const email = clean(input.email)?.toLowerCase() ?? null;
  if (email && !validEmail(email)) return { ok: false, error: "Adresse e-mail invalide." };
  if (email) {
    const dup = await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (dup) return { ok: false, error: `Un contact a déjà cette adresse (${[dup.firstName, dup.lastName].filter(Boolean).join(" ")}).` };
  }
  const c = await prisma.contact.create({ data: { lastName, firstName: clean(input.firstName), email, phone: clean(input.phone), role: clean(input.role), organisationId: input.organisationId || null, organisationName: clean(input.organisationName), address: clean(input.address), postcode: clean(input.postcode), city: clean(input.city), tags: serializeTags((input.tags ?? "").split(",")), notes: clean(input.notes), createdById: me.id } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: c.id } };
}

export async function setContactOrganisation(id: string, organisationId: string | null): Promise<Result> {
  await getCurrentPerson();
  if (organisationId && !(await prisma.organisation.findUnique({ where: { id: organisationId } }))) return { ok: false, error: "Organisation introuvable." };
  await prisma.contact.update({ where: { id }, data: { organisationId, ...(organisationId ? { organisationName: null } : {}) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Politique centrale : les références métier protègent l'historique, et un contact
// importé/historique sans créateur n'est jamais supprimable par défaut.
export async function contactDeletionError(id: string, me: Actor & { id: string }): Promise<string | null> {
  const c = await prisma.contact.findUnique({ where: { id }, include: { _count: { select: { lines: true, conventions: true, memberships: true, loans: true } } } });
  if (!c) return "Contact introuvable.";
  if (c._count.lines || c._count.conventions || c._count.memberships || c._count.loans) return "Ce contact est cité par des données métier : détachez-le ou archivez-le plutôt que de le supprimer.";
  if (!c.createdById && !canAdmin(me)) return "Ce contact historique ne peut être supprimé que par l'administration.";
  if (c.createdById && c.createdById !== me.id && !canAdmin(me)) return "Ce contact a été créé par quelqu'un d'autre : l'administration peut le supprimer.";
  return null;
}

// Supprimer un contact : seulement s'il n'est cité par aucune donnée métier.
export async function deleteContact(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const denied = await contactDeletionError(id, me as Actor & { id: string });
  if (denied) return { ok: false, error: denied };
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// ——— Listes ———

async function myList(id: string) {
  const me = await getCurrentPerson();
  const l = await prisma.contactList.findUnique({ where: { id } });
  if (!l) return { me, list: null, error: "Liste introuvable." };
  if (l.ownerId !== me.id && !canAdmin(me)) return { me, list: null, error: "Seul l'auteur de la liste la modifie." };
  return { me, list: l, error: null };
}

export async function createContactList(input: { name: string; visibility?: string; editionId?: string | null; color?: string | null; description?: string | null }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const name = clean(input.name);
  if (!name) return { ok: false, error: "Donnez un nom à la liste." };
  const visibility = VISIBILITIES.some((v) => v.value === input.visibility) ? input.visibility! : "private";
  if (input.color && !NOTE_COLORS.some((c) => c.value === input.color)) return { ok: false, error: "Couleur inconnue." };
  const l = await prisma.contactList.create({ data: { ownerId: me.id, name, visibility, editionId: input.editionId || null, color: input.color || null, description: clean(input.description) } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: l.id } };
}

export async function updateContactList(id: string, patch: { name?: string; visibility?: string; editionId?: string | null; color?: string | null; description?: string | null }): Promise<Result> {
  const { list, error } = await myList(id); if (!list) return { ok: false, error: error! };
  if (patch.name !== undefined && !clean(patch.name)) return { ok: false, error: "Le nom est obligatoire." };
  if (patch.visibility !== undefined && !VISIBILITIES.some((v) => v.value === patch.visibility)) return { ok: false, error: "Visibilité inconnue." };
  await prisma.contactList.update({ where: { id }, data: { ...(patch.name !== undefined ? { name: patch.name.trim() } : {}), ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}), ...(patch.editionId !== undefined ? { editionId: patch.editionId || null } : {}), ...(patch.color !== undefined ? { color: patch.color || null } : {}), ...(patch.description !== undefined ? { description: clean(patch.description) } : {}) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteContactList(id: string): Promise<Result> {
  const { list, error } = await myList(id); if (!list) return { ok: false, error: error! };
  await prisma.contactList.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Colonnes propres à la liste : ajouter, renommer, retirer (les valeurs de la colonne retirée restent dans le JSON, inertes).
export async function addListField(id: string, input: { label: string; type: ListFieldType; options?: string | null }): Promise<Result<{ key: string }>> {
  const { list, error } = await myList(id); if (!list) return { ok: false, error: error! };
  const label = clean(input.label);
  if (!label) return { ok: false, error: "Nommez la colonne." };
  const fields = parseFields(list.fields);
  let key = fieldKey(label);
  if (fields.some((f) => f.key === key)) key = `${key}_${fields.length + 1}`;
  const options = input.type === "select" ? (input.options ?? "").split(/[;,\n]/).map((o) => o.trim()).filter(Boolean) : undefined;
  if (input.type === "select" && (!options || options.length === 0)) return { ok: false, error: "Donnez les valeurs possibles, séparées par des virgules." };
  const next: ListField[] = [...fields, { key, label, type: input.type, ...(options ? { options } : {}) }];
  await prisma.contactList.update({ where: { id }, data: { fields: serializeFields(next) } });
  revalidatePath("/", "layout");
  return { ok: true, data: { key } };
}

export async function removeListField(id: string, key: string): Promise<Result> {
  const { list, error } = await myList(id); if (!list) return { ok: false, error: error! };
  await prisma.contactList.update({ where: { id }, data: { fields: serializeFields(parseFields(list.fields).filter((f) => f.key !== key)) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Une ligne de la liste : un contact existant, ou un nouveau créé au passage.
export async function addToList(id: string, input: { contactId?: string | null; contact?: ContactInput | null; role?: string | null }): Promise<Result<{ contactId: string }>> {
  const { list, error } = await myList(id); if (!list) return { ok: false, error: error! };
  let contactId = input.contactId ?? null;
  if (!contactId) {
    if (!input.contact) return { ok: false, error: "Choisissez un contact ou créez-le." };
    const r = await createContact(input.contact);
    if (!r.ok) return r;
    contactId = r.data!.id;
  } else if (!(await prisma.contact.findUnique({ where: { id: contactId } }))) return { ok: false, error: "Contact introuvable." };
  await prisma.contactListItem.upsert({ where: { listId_contactId: { listId: id, contactId } }, create: { listId: id, contactId, role: clean(input.role) }, update: { ...(input.role !== undefined ? { role: clean(input.role) } : {}) } });
  revalidatePath("/", "layout");
  return { ok: true, data: { contactId } };
}

export async function removeFromList(id: string, contactId: string): Promise<Result> {
  const { list, error } = await myList(id); if (!list) return { ok: false, error: error! };
  await prisma.contactListItem.deleteMany({ where: { listId: id, contactId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setItemValue(id: string, contactId: string, key: string, value: string | boolean | null): Promise<Result> {
  const { list, error } = await myList(id); if (!list) return { ok: false, error: error! };
  const field = parseFields(list.fields).find((f) => f.key === key);
  if (key !== "role" && !field) return { ok: false, error: "Colonne inconnue." };
  const item = await prisma.contactListItem.findUnique({ where: { listId_contactId: { listId: id, contactId } } });
  if (!item) return { ok: false, error: "Ligne introuvable." };
  if (key === "role") { await prisma.contactListItem.update({ where: { listId_contactId: { listId: id, contactId } }, data: { role: clean(value) } }); }
  else {
    const values = parseValues(item.values);
    let v: string | boolean | null = value;
    if (field!.type === "bool") v = Boolean(value);
    else if (field!.type === "select") { const s = clean(value); if (s && !field!.options?.includes(s)) return { ok: false, error: "Valeur hors liste." }; v = s; }
    else v = clean(value);
    values[key] = v;
    await prisma.contactListItem.update({ where: { listId_contactId: { listId: id, contactId } }, data: { values: JSON.stringify(values) } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ——— Import (csv / xlsx) en deux temps : aperçu des colonnes, puis import avec la correspondance choisie ———

export type ImportPreview = { headers: string[]; rows: string[][]; total: number; guesses: Record<string, string> };
export type ImportMapping = Record<string, string>; // en-tête → clé de colonne commune, « field:<key> » (colonne propre), « role », ou « » (ignorer)

// L'en-tête est la première ligne qui contient au moins deux cellules connues (nom, mail…) : les titres et logos au-dessus sont sautés.
function findHeader(rows: string[][]): number {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const hits = rows[i].filter((cell) => CONTACT_COLUMNS.some((c) => c.aliases.includes(norm(cell)))).length;
    if (hits >= 2) return i;
  }
  return 0;
}

const guessColumn = (header: string, fields: ListField[]): string => {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const h = norm(header);
  const common = CONTACT_COLUMNS.find((c) => c.aliases.includes(h) || norm(c.label) === h);
  if (common) return common.key;
  const own = fields.find((f) => norm(f.label) === h);
  if (own) return `field:${own.key}`;
  if (["role dans la liste", "statut", "statut dans la liste"].includes(h)) return "role:list";
  return "";
};

export async function previewImport(form: FormData): Promise<Result<ImportPreview>> {
  const listId = String(form.get("listId") ?? "");
  const { list, error } = await myList(listId); if (!list) return { ok: false, error: error! };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choisissez un fichier .csv ou .xlsx." };
  const rows = await readSpreadsheet(await file.arrayBuffer(), file.name);
  if (rows.length < 2) return { ok: false, error: "Le fichier est vide." };
  const h = findHeader(rows);
  const headers = rows[h].map((x, i) => x || `Colonne ${i + 1}`);
  const data = rows.slice(h + 1).filter((r) => r.some((c) => c));
  const fields = parseFields(list.fields);
  const guesses = Object.fromEntries(headers.map((x) => [x, guessColumn(x, fields)]));
  return { ok: true, data: { headers, rows: data.slice(0, 5), total: data.length, guesses } };
}

// Import : une ligne = un contact, rapproché par e-mail (sinon nom + prénom) ; existant → mis à jour sur les cellules non vides
// et ajouté à la liste ; nouveau → créé. Les colonnes propres et le rôle vont sur la ligne de la liste.
export async function runImport(form: FormData, mapping: ImportMapping): Promise<Result<{ created: number; updated: number; added: number; skipped: number }>> {
  const listId = String(form.get("listId") ?? "");
  const { me, list, error } = await myList(listId); if (!list) return { ok: false, error: error! };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Fichier manquant." };
  const rows = await readSpreadsheet(await file.arrayBuffer(), file.name);
  const h = findHeader(rows);
  const headers = rows[h].map((x, i) => x || `Colonne ${i + 1}`);
  const fields = parseFields(list.fields);
  let created = 0, updated = 0, added = 0, skipped = 0;
  for (const r of rows.slice(h + 1)) {
    if (!r.some((c) => c)) continue;
    const cell = (target: string) => { const idx = headers.findIndex((x) => mapping[x] === target); return idx >= 0 ? clean(r[idx]) : null; };
    const lastName = cell("lastName"); const firstName = cell("firstName");
    const email = cell("email")?.toLowerCase() ?? null;
    if (!lastName && !email) { skipped++; continue; }
    const patch = { firstName, phone: cell("phone"), role: cell("role"), organisationName: cell("organisationName"), address: cell("address"), postcode: cell("postcode"), city: cell("city"), notes: cell("notes") };
    const tags = cell("tags");
    let contact = email && validEmail(email) ? await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null;
    if (!contact && lastName) contact = await prisma.contact.findFirst({ where: { lastName: { equals: lastName, mode: "insensitive" }, firstName: firstName ? { equals: firstName, mode: "insensitive" } : null } });
    if (contact) {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) if (v && !(contact as unknown as Record<string, unknown>)[k]) data[k] = v;
      if (tags) data.tags = serializeTags([...contact.tags.split(","), ...tags.split(/[;,]/)]);
      if (!contact.email && email && validEmail(email)) data.email = email;
      if (Object.keys(data).length) { await prisma.contact.update({ where: { id: contact.id }, data }); updated++; }
    } else {
      contact = await prisma.contact.create({ data: { lastName: lastName ?? email!, email: email && validEmail(email) ? email : null, ...patch, tags: serializeTags((tags ?? "").split(/[;,]/)), createdById: me.id } });
      created++;
    }
    const values: Record<string, string | boolean | null> = {};
    for (const f of fields) {
      const v = cell(`field:${f.key}`);
      if (v == null) continue;
      values[f.key] = f.type === "bool" ? /^(1|oui|yes|x|true|vrai|ok)$/i.test(v) : f.type === "select" ? (f.options?.find((o) => o.toLowerCase() === v.toLowerCase()) ?? v) : v;
    }
    const existing = await prisma.contactListItem.findUnique({ where: { listId_contactId: { listId, contactId: contact.id } } });
    const itemRole = cell("role:list");
    if (existing) await prisma.contactListItem.update({ where: { listId_contactId: { listId, contactId: contact.id } }, data: { values: JSON.stringify({ ...parseValues(existing.values), ...values }), ...(itemRole ? { role: itemRole } : {}) } });
    else { await prisma.contactListItem.create({ data: { listId, contactId: contact.id, role: itemRole, values: JSON.stringify(values) } }); added++; }
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { created, updated, added, skipped } };
}

// Lecture (pages) : la liste si je peux la lire, sinon null.
export async function canISeeList(id: string): Promise<boolean> {
  const me = await getCurrentPerson();
  const l = await prisma.contactList.findUnique({ where: { id }, include: { owner: { select: { id: true, poleId: true } } } });
  return Boolean(l && canReadList(me, l));
}

// ——— Actions groupées (19/09) : sur une sélection de contacts, dans l'annuaire ou dans une liste ———
// Les listes se modifient par leur auteur (ou l'admin) ; les contacts eux-mêmes (modifier, supprimer) par l'administration.

const MAX_BULK = 2000;
const ids = (contactIds: string[]) => Array.from(new Set(contactIds.filter((x) => typeof x === "string" && x))).slice(0, MAX_BULK);

// Ajouter à une liste ; `fromListId` = déplacer (retirer de la liste d'origine, si elle est à moi).
export async function bulkAddToList(listId: string, contactIds: string[], fromListId?: string | null): Promise<Result<{ added: number; skipped: number; removed: number }>> {
  const { list, error } = await myList(listId); if (!list) return { ok: false, error: error! };
  if (list.source === "brevo" || list.source === "helloasso") return { ok: false, error: "Une liste miroir est tenue par la synchronisation : ajoutez les contacts dans Brevo ou HelloAsso." };
  const wanted = ids(contactIds);
  if (!wanted.length) return { ok: false, error: "Aucun contact sélectionné." };
  const existing = new Set((await prisma.contactListItem.findMany({ where: { listId, contactId: { in: wanted } }, select: { contactId: true } })).map((x) => x.contactId));
  const known = new Set((await prisma.contact.findMany({ where: { id: { in: wanted } }, select: { id: true } })).map((x) => x.id));
  const toAdd = wanted.filter((id) => known.has(id) && !existing.has(id));
  if (toAdd.length) await prisma.contactListItem.createMany({ data: toAdd.map((contactId) => ({ listId, contactId, values: "{}" })) });
  let removed = 0;
  if (fromListId && fromListId !== listId) {
    const from = await myList(fromListId);
    if (!from.list) return { ok: false, error: from.error! };
    if (from.list.source === "brevo" || from.list.source === "helloasso") return { ok: false, error: "On ne retire pas d'une liste miroir : elle est tenue par la synchronisation." };
    removed = (await prisma.contactListItem.deleteMany({ where: { listId: fromListId, contactId: { in: wanted } } })).count;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { added: toAdd.length, skipped: wanted.length - toAdd.length, removed } };
}

export async function bulkRemoveFromList(listId: string, contactIds: string[]): Promise<Result<{ removed: number }>> {
  const { list, error } = await myList(listId); if (!list) return { ok: false, error: error! };
  if (list.source === "brevo" || list.source === "helloasso") return { ok: false, error: "Une liste miroir est tenue par la synchronisation : retirez les contacts dans Brevo ou HelloAsso." };
  const removed = (await prisma.contactListItem.deleteMany({ where: { listId, contactId: { in: ids(contactIds) } } })).count;
  revalidatePath("/", "layout");
  return { ok: true, data: { removed } };
}

// Une même valeur pour tous : un champ commun du contact (structure, fonction, ville, mots-clés à ajouter ou retirer, « parti·e »)
// ou, dans une liste, le rôle ou une colonne propre.
export type BulkPatch =
  | { kind: "contact"; field: "role" | "city" | "postcode" | "address" | "organisationName"; value: string | null }
  | { kind: "contact"; field: "organisationId"; value: string | null }
  | { kind: "contact"; field: "leftAt"; value: boolean }
  | { kind: "tags"; mode: "add" | "remove"; value: string }
  | { kind: "item"; listId: string; key: string; value: string | boolean | null };

export async function bulkUpdateContacts(contactIds: string[], patch: BulkPatch): Promise<Result<{ updated: number }>> {
  const me = await getCurrentPerson();
  const wanted = ids(contactIds);
  if (!wanted.length) return { ok: false, error: "Aucun contact sélectionné." };
  if (patch.kind === "item") {
    const { list, error } = await myList(patch.listId); if (!list) return { ok: false, error: error! };
    const field = parseFields(list.fields).find((f) => f.key === patch.key);
    if (patch.key !== "role" && !field) return { ok: false, error: "Colonne inconnue." };
    if (field?.synced) return { ok: false, error: "Colonne synchronisée, en lecture." };
    const items = await prisma.contactListItem.findMany({ where: { listId: patch.listId, contactId: { in: wanted } } });
    for (const item of items) {
      if (patch.key === "role") { await prisma.contactListItem.update({ where: { listId_contactId: { listId: patch.listId, contactId: item.contactId } }, data: { role: clean(patch.value) } }); continue; }
      const values = parseValues(item.values);
      let v: string | boolean | null = patch.value;
      if (field!.type === "bool") v = Boolean(patch.value);
      else if (field!.type === "select") { const s = clean(patch.value); if (s && !field!.options?.includes(s)) return { ok: false, error: "Valeur hors liste." }; v = s; }
      else v = clean(patch.value);
      values[patch.key] = v;
      await prisma.contactListItem.update({ where: { listId_contactId: { listId: patch.listId, contactId: item.contactId } }, data: { values: JSON.stringify(values) } });
    }
    revalidatePath("/", "layout");
    return { ok: true, data: { updated: items.length } };
  }
  if (!canAdmin(me)) return { ok: false, error: "Modifier plusieurs contacts d'un coup est réservé à l'administration." };
  let updated = 0;
  if (patch.kind === "tags") {
    const tag = clean(patch.value); if (!tag) return { ok: false, error: "Indiquez un mot-clé." };
    const rows = await prisma.contact.findMany({ where: { id: { in: wanted } }, select: { id: true, tags: true } });
    for (const c of rows) {
      const tags = c.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const next = patch.mode === "add" ? [...tags, tag] : tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
      const s = serializeTags(next);
      if (s !== c.tags) { await prisma.contact.update({ where: { id: c.id }, data: { tags: s } }); updated++; }
    }
  } else if (patch.field === "leftAt") {
    updated = (await prisma.contact.updateMany({ where: { id: { in: wanted } }, data: { leftAt: patch.value ? new Date() : null } })).count;
  } else if (patch.field === "organisationId") {
    if (patch.value && !(await prisma.organisation.findUnique({ where: { id: patch.value } }))) return { ok: false, error: "Organisation introuvable." };
    updated = (await prisma.contact.updateMany({ where: { id: { in: wanted } }, data: { organisationId: patch.value, ...(patch.value ? { organisationName: null } : {}) } })).count;
  } else {
    updated = (await prisma.contact.updateMany({ where: { id: { in: wanted } }, data: { [patch.field]: clean(patch.value) } })).count;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { updated } };
}

// Suppression définitive : hors de l'annuaire et de toutes les listes. Refusée pour un contact cité par un financement ou une
// adhésion (on le marque « parti·e » à la place). Venu de Brevo : son identifiant est gardé (BrevoIgnored) pour que la synchro ne le
// recrée pas ; « aussi dans Brevo » le supprime chez eux (irréversible), au choix de la personne, jamais par défaut.
export async function bulkDeleteContacts(contactIds: string[], alsoBrevo: boolean): Promise<Result<{ deleted: number; kept: number; brevoDeleted: number }>> {
  const me = await getCurrentPerson();
  if (!canAdmin(me)) return { ok: false, error: "Supprimer définitivement des contacts est réservé à l'administration." };
  const wanted = ids(contactIds);
  if (!wanted.length) return { ok: false, error: "Aucun contact sélectionné." };
  const rows = await prisma.contact.findMany({ where: { id: { in: wanted } }, select: { id: true, email: true, brevoContactId: true, _count: { select: { lines: true, conventions: true, memberships: true, loans: true } } } });
  const deletable = rows.filter((c) => !c._count.lines && !c._count.conventions && !c._count.memberships && !c._count.loans);
  let brevoDeleted = 0;
  if (alsoBrevo) {
    const { brevoConfig, deleteContact: deleteInBrevo } = await import("@/lib/brevo");
    const cfg = brevoConfig();
    if (!cfg) return { ok: false, error: "Brevo n'est pas configuré sur cette installation." };
    for (const c of deletable) if (c.brevoContactId) { if (await deleteInBrevo(cfg, c.brevoContactId)) brevoDeleted++; }
  }
  const fromBrevo = deletable.filter((c) => c.brevoContactId);
  if (fromBrevo.length) await prisma.brevoIgnored.createMany({ data: fromBrevo.map((c) => ({ brevoContactId: c.brevoContactId!, email: c.email, byId: me.id })), skipDuplicates: true });
  const deleted = (await prisma.contact.deleteMany({ where: { id: { in: deletable.map((c) => c.id) } } })).count;
  revalidatePath("/", "layout");
  return { ok: true, data: { deleted, kept: rows.length - deletable.length, brevoDeleted } };
}

// Export CSV d'une sélection (mêmes colonnes que l'export de liste ; sans les colonnes propres hors d'une liste).
export async function exportContactsCsv(contactIds: string[], listId?: string | null): Promise<Result<{ csv: string; name: string }>> {
  const me = await getCurrentPerson();
  const wanted = ids(contactIds);
  if (!wanted.length) return { ok: false, error: "Aucun contact sélectionné." };
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const list = listId ? await prisma.contactList.findUnique({ where: { id: listId }, include: { owner: { select: { id: true, poleId: true } } } }) : null;
  if (listId && (!list || !canReadList(me, list))) return { ok: false, error: "Liste introuvable." };
  const fields = list ? parseFields(list.fields) : [];
  const items = list ? new Map((await prisma.contactListItem.findMany({ where: { listId: list.id, contactId: { in: wanted } } })).map((i) => [i.contactId, { role: i.role, values: parseValues(i.values) }])) : new Map<string, { role: string | null; values: Record<string, string | boolean | null> }>();
  const contacts = await prisma.contact.findMany({ where: { id: { in: wanted } }, include: { organisation: { select: { name: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  const head = ["Nom", "Prénom", "E-mail", "Téléphone", "Fonction", "Structure", "Adresse", "Code postal", "Ville", "Mots-clés", ...(list ? ["Rôle dans la liste", ...fields.map((f) => f.label)] : [])];
  const lines = contacts.map((c) => {
    const it = items.get(c.id);
    return [c.lastName, c.firstName, c.email, c.phone, c.role, c.organisation?.name ?? c.organisationName, c.address, c.postcode, c.city, c.tags, ...(list ? [it?.role ?? "", ...fields.map((f) => { const v = it?.values[f.key]; return v === true ? "oui" : v === false || v == null ? "" : String(v); })] : [])].map(esc).join(";");
  });
  return { ok: true, data: { csv: "﻿" + [head.map(esc).join(";"), ...lines].join("\n"), name: `${list ? list.name : "contacts"}-selection.csv` } };
}
