import { prisma } from "./db";
import { canReadShared } from "./modules";
import type { Viewer } from "./scope";

// Contacts et listes (18/09). Un contact = une personne extérieure ; une liste = une sélection de contacts à son auteur,
// avec ses propres colonnes. Les colonnes propres sont bornées à quatre types : ce qui couvre les Excel de l'équipe
// (« Charte », « Séminaire 2025 », « Territoire »…) sans refaire un tableur.

export type ListFieldType = "bool" | "text" | "date" | "select";
// `brevo` : colonne posée par la synchronisation Brevo (un attribut du compte) — en lecture, ne se retire pas.
export type ListField = { key: string; label: string; type: ListFieldType; options?: string[]; brevo?: boolean };
export const FIELD_TYPES: { value: ListFieldType; label: string }[] = [
  { value: "bool", label: "Case à cocher" },
  { value: "text", label: "Texte court" },
  { value: "date", label: "Date" },
  { value: "select", label: "Liste de valeurs" },
];

export function parseFields(s: string | null | undefined): ListField[] {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v.filter((f) => f && typeof f.key === "string" && typeof f.label === "string" && ["bool", "text", "date", "select"].includes(f.type)).map((f) => ({ key: f.key, label: f.label, type: f.type, options: Array.isArray(f.options) ? f.options.map(String) : undefined, ...(f.brevo ? { brevo: true } : {}) })) : [];
  } catch { return []; }
}
export const serializeFields = (fields: ListField[]) => JSON.stringify(fields);
export function parseValues(s: string | null | undefined): Record<string, string | boolean | null> {
  try { const v = JSON.parse(s || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
export const fieldKey = (label: string) => label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "champ";

// Statut Brevo d'un contact (null = hors Brevo).
export const BREVO_STATUS: Record<string, { label: string; hint: string }> = {
  active: { label: "Dans Brevo", hint: "Contact présent dans Brevo, abonné." },
  unsubscribed: { label: "Désinscrit·e", hint: "S'est désinscrit·e dans Brevo (RGPD) : il ou elle n'est plus renvoyé·e vers Brevo, mais reste dans l'annuaire — à vous de trancher." },
  deleted: { label: "Supprimé·e de Brevo", hint: "N'apparaît plus dans Brevo : gardé·e ici, pas renvoyé·e." },
};
export const brevoAttributesOf = (c: { brevoAttributes: string }): Record<string, string> => { try { const v = JSON.parse(c.brevoAttributes || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };

export const contactName = (c: { firstName?: string | null; lastName: string }) => [c.firstName, c.lastName].filter(Boolean).join(" ");
export const tagsOf = (c: { tags: string }) => c.tags.split(",").map((t) => t.trim()).filter(Boolean);
export const serializeTags = (tags: string[]) => Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).join(",");

// Colonnes communes à tous les contacts (l'annuaire) : ce que l'import reconnaît et ce que l'export écrit.
export const CONTACT_COLUMNS: { key: string; label: string; aliases: string[] }[] = [
  { key: "lastName", label: "Nom", aliases: ["nom", "name", "last name", "lastname", "nom de famille"] },
  { key: "firstName", label: "Prénom", aliases: ["prenom", "prénom", "first name", "firstname"] },
  { key: "email", label: "E-mail", aliases: ["mail", "email", "e-mail", "courriel", "adresse mail", "adresse e-mail"] },
  { key: "phone", label: "Téléphone", aliases: ["telephone", "téléphone", "tel", "tél", "phone", "portable", "mobile"] },
  { key: "role", label: "Fonction", aliases: ["fonction", "role", "rôle", "poste", "titre"] },
  { key: "organisationName", label: "Structure", aliases: ["structure", "organisation", "organisme", "société", "societe", "entreprise", "asso", "association", "employeur"] },
  { key: "address", label: "Adresse", aliases: ["adresse", "adresse 1", "address", "rue"] },
  { key: "postcode", label: "Code postal", aliases: ["cp", "code postal", "postcode", "zip"] },
  { key: "city", label: "Ville", aliases: ["ville", "city", "commune"] },
  { key: "tags", label: "Mots-clés", aliases: ["mots cles", "mots-clés", "mots clés", "tags", "etiquettes", "étiquettes", "thematiques", "thématiques"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "commentaire", "remarques", "observations"] },
];

// Qui lit une liste : son auteur, et qui la visibilité désigne (même règle que les listes de tâches et les notes).
export function canReadList(me: Viewer, list: { ownerId: string; visibility: string; owner: { id: string; poleId: string | null } }): boolean {
  return list.ownerId === me.id || canReadShared(me, list.owner, list.visibility);
}

const listInclude = { owner: { select: { id: true, name: true, poleId: true } }, edition: { select: { id: true, year: true, project: { select: { name: true } } } }, _count: { select: { items: true } } };

// Mes listes, celles que d'autres partagent avec moi, et les miroirs de listes Brevo (à part, quel que soit leur auteur).
export async function loadContactLists(me: Viewer) {
  const rows = await prisma.contactList.findMany({ include: listInclude, orderBy: [{ name: "asc" }] });
  const brevo = rows.filter((l) => l.source === "brevo" && canReadList(me, l));
  const own = rows.filter((l) => l.source !== "brevo");
  const mine = own.filter((l) => l.ownerId === me.id);
  const shared = own.filter((l) => l.ownerId !== me.id && canReadList(me, l));
  return { mine, shared, brevo };
}

export type ContactRow = Awaited<ReturnType<typeof loadContacts>>[number];

// L'annuaire : tous les contacts, filtrés par texte (nom, e-mail, structure) et par mot-clé.
export async function loadContacts(opts: { q?: string; tag?: string } = {}) {
  const rows = await prisma.contact.findMany({ include: { organisation: { select: { id: true, name: true } }, _count: { select: { listItems: true, lines: true, conventions: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = opts.q ? norm(opts.q) : "";
  return rows.filter((c) => (!q || norm(`${contactName(c)} ${c.email ?? ""} ${c.organisation?.name ?? c.organisationName ?? ""} ${c.city ?? ""}`).includes(q)) && (!opts.tag || tagsOf(c).includes(opts.tag)));
}

// Une liste avec ses lignes (contact + valeurs propres), prête pour l'écran.
export async function loadContactList(id: string) {
  const list = await prisma.contactList.findUnique({ where: { id }, include: { ...listInclude, items: { include: { contact: { include: { organisation: { select: { id: true, name: true } } } } }, orderBy: [{ contact: { lastName: "asc" } }, { contact: { firstName: "asc" } }] } } });
  if (!list) return null;
  return { ...list, fields: parseFields(list.fields), items: list.items.map((i) => ({ ...i, values: parseValues(i.values) })) };
}

export type ContactListFull = NonNullable<Awaited<ReturnType<typeof loadContactList>>>;

// Export CSV (point-virgule, UTF-8 avec BOM : Excel l'ouvre tel quel) : colonnes communes puis colonnes propres.
export function listToCsv(list: ContactListFull): string {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["Nom", "Prénom", "E-mail", "Téléphone", "Fonction", "Structure", "Adresse", "Code postal", "Ville", "Mots-clés", "Rôle dans la liste", ...list.fields.map((f) => f.label)];
  const rows = list.items.map((i) => {
    const c = i.contact;
    return [c.lastName, c.firstName, c.email, c.phone, c.role, c.organisation?.name ?? c.organisationName, c.address, c.postcode, c.city, c.tags, i.role, ...list.fields.map((f) => { const v = i.values[f.key]; return f.type === "bool" ? (v ? "oui" : "") : v ?? ""; })].map(esc).join(";");
  });
  return "﻿" + [head.map(esc).join(";"), ...rows].join("\n");
}
