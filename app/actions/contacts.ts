"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
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

// Supprimer un contact : seulement s'il n'est cité par aucun dossier (ligne, convention) ; les listes le lâchent.
export async function deleteContact(id: string): Promise<Result> {
  const me = await getCurrentPerson();
  const c = await prisma.contact.findUnique({ where: { id }, include: { _count: { select: { lines: true, conventions: true } } } });
  if (!c) return { ok: false, error: "Contact introuvable." };
  if (c._count.lines || c._count.conventions) return { ok: false, error: "Ce contact est cité par des financements : détachez-le (« parti·e ») plutôt que de le supprimer." };
  if (c.createdById && c.createdById !== me.id && !canAdmin(me)) return { ok: false, error: "Ce contact a été créé par quelqu'un d'autre : l'administration peut le supprimer." };
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

function readSheet(buf: ArrayBuffer): string[][] {
  const wb = XLSX.read(buf, { type: "array", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false }) as unknown[][];
  return rows.map((r) => r.map((v) => (v == null ? "" : String(v).trim())));
}

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
  const rows = readSheet(await file.arrayBuffer());
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
  const rows = readSheet(await file.arrayBuffer());
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
