import { prisma } from "./db";
import { canReadShared } from "./modules";
import type { Viewer } from "./scope";
import { kindFilter, ORGANISATION_KINDS, type OrganisationKind } from "./organisations";

// Contacts et listes (18/09). Un contact = une personne extérieure ; une liste = une sélection de contacts à son auteur,
// avec ses propres colonnes. Les colonnes propres sont bornées à quatre types : ce qui couvre les Excel de l'équipe
// (« Charte », « Séminaire 2025 », « Territoire »…) sans refaire un tableur.

export type ListFieldType = "bool" | "text" | "date" | "select";
// `synced` : colonne posée par une synchronisation (attribut Brevo, champ HelloAsso) — en lecture, ne se retire pas.
export type ListField = { key: string; label: string; type: ListFieldType; options?: string[]; synced?: boolean };
export const FIELD_TYPES: { value: ListFieldType; label: string }[] = [
  { value: "bool", label: "Case à cocher" },
  { value: "text", label: "Texte court" },
  { value: "date", label: "Date" },
  { value: "select", label: "Liste de valeurs" },
];

export function parseFields(s: string | null | undefined): ListField[] {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v.filter((f) => f && typeof f.key === "string" && typeof f.label === "string" && ["bool", "text", "date", "select"].includes(f.type)).map((f) => ({ key: f.key, label: f.label, type: f.type, options: Array.isArray(f.options) ? f.options.map(String) : undefined, ...(f.synced || f.brevo ? { synced: true } : {}) })) : [];
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

// Listes de base (18/09, Gaël : « une liste non supprimable des financeurs, par souci de logique ») : une par genre
// d'organisation, calculée — les interlocuteurs en poste des organisations de ce genre. Pas de ligne en base, pas d'auteur,
// lisible de tous, exportable ; on la complète en rattachant un contact à son organisation.
export const BASE_LIST_PREFIX = "base:";
export const BASE_LISTS = ORGANISATION_KINDS.map((k) => ({ id: `${BASE_LIST_PREFIX}${k.key}`, kind: k.key as OrganisationKind, name: `Interlocuteurs · ${k.plural.toLowerCase()}`, description: `Les contacts en poste des organisations de genre « ${k.label} », à jour automatiquement.` }));
// Une liste de base de plus, calculée sur le module Adhérents : les interlocuteurs des adhérents à jour (réglés ou exonérés)
// de l'année, et les personnes physiques adhérentes à jour.
export const MEMBERS_CURRENT_ID = `${BASE_LIST_PREFIX}members_current`;
export const MEMBERS_CURRENT_LIST = (year: number) => ({ id: MEMBERS_CURRENT_ID, kind: "member" as OrganisationKind, name: `Adhérents à jour · ${year}`, description: `Les interlocuteurs des structures à jour de cotisation ${year} (réglée ou exonérée), et les personnes adhérentes à jour.` });
export const isBaseListId = (id: string) => id.startsWith(BASE_LIST_PREFIX);
export const baseListFor = (kind: string) => BASE_LISTS.find((b) => b.kind === kind) ?? null;

// Qui lit une liste : son auteur, et qui la visibilité désigne (même règle que les listes de tâches et les notes). Une liste de
// base se lit de tous.
export function canReadList(me: Viewer, list: { ownerId: string; visibility: string; owner: { id: string; poleId: string | null }; source?: string }): boolean {
  return list.source === "base" || list.ownerId === me.id || canReadShared(me, list.owner, list.visibility);
}

const listInclude = { owner: { select: { id: true, name: true, poleId: true } }, edition: { select: { id: true, year: true, project: { select: { name: true } } } }, _count: { select: { items: true } } };

// Mes listes, celles que d'autres partagent avec moi, et les miroirs de listes Brevo (à part, quel que soit leur auteur).
export async function loadContactLists(me: Viewer) {
  const rows = await prisma.contactList.findMany({ include: listInclude, orderBy: [{ name: "asc" }] });
  const brevo = rows.filter((l) => l.source === "brevo" && canReadList(me, l));
  const helloasso = rows.filter((l) => l.source === "helloasso" && canReadList(me, l));
  const own = rows.filter((l) => l.source !== "brevo" && l.source !== "helloasso");
  const mine = own.filter((l) => l.ownerId === me.id);
  const shared = own.filter((l) => l.ownerId !== me.id && canReadList(me, l));
  const orgs = await prisma.organisation.findMany({ where: { active: true }, select: { kinds: true, _count: { select: { contacts: { where: { leftAt: null } } } } } });
  const base = BASE_LISTS.map((b) => ({ ...b, count: orgs.filter((o) => o.kinds.split(",").includes(b.kind)).reduce((n, o) => n + o._count.contacts, 0) }));
  const currentYear = new Date().getFullYear();
  const current = await prisma.membership.findMany({ where: { year: currentYear, status: { in: ["paid", "exempt"] } }, select: { organisationId: true, contactId: true } });
  const currentOrgIds = new Set(current.map((m) => m.organisationId).filter(Boolean));
  const currentContacts = new Set(current.filter((m) => !m.organisationId && m.contactId).map((m) => m.contactId));
  const orgContacts = await prisma.contact.count({ where: { leftAt: null, organisationId: { in: Array.from(currentOrgIds) as string[] } } });
  base.push({ ...MEMBERS_CURRENT_LIST(currentYear), count: orgContacts + currentContacts.size });
  return { mine, shared, brevo, helloasso, base };
}

export type ContactRow = Awaited<ReturnType<typeof loadContacts>>[number];

// L'annuaire : tous les contacts, filtrés par texte (nom, e-mail, structure) et par mot-clé.
export async function loadContacts(opts: { q?: string; tag?: string } = {}) {
  const rows = await prisma.contact.findMany({ include: { organisation: { select: { id: true, name: true } }, _count: { select: { listItems: true, lines: true, conventions: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = opts.q ? norm(opts.q) : "";
  return rows.filter((c) => (!q || norm(`${contactName(c)} ${c.email ?? ""} ${c.organisation?.name ?? c.organisationName ?? ""} ${c.city ?? ""}`).includes(q)) && (!opts.tag || tagsOf(c).includes(opts.tag)));
}

// Une liste avec ses lignes (contact + valeurs propres), prête pour l'écran. Une liste de base est calculée à la volée.
export async function loadContactList(id: string) {
  if (isBaseListId(id)) return loadBaseList(id);
  const list = await prisma.contactList.findUnique({ where: { id }, include: { ...listInclude, items: { include: { contact: { include: { organisation: { select: { id: true, name: true } } } } }, orderBy: [{ contact: { lastName: "asc" } }, { contact: { firstName: "asc" } }] } } });
  if (!list) return null;
  return { ...list, fields: parseFields(list.fields), items: list.items.map((i) => ({ ...i, values: parseValues(i.values) })) };
}

async function loadBaseList(id: string) {
  const year = new Date().getFullYear();
  const b = id === MEMBERS_CURRENT_ID ? MEMBERS_CURRENT_LIST(year) : BASE_LISTS.find((x) => x.id === id);
  if (!b) return null;
  const include = { organisation: { select: { id: true, name: true } } };
  const orderBy = [{ organisation: { name: "asc" as const } }, { lastName: "asc" as const }, { firstName: "asc" as const }];
  let contacts;
  if (id === MEMBERS_CURRENT_ID) {
    const current = await prisma.membership.findMany({ where: { year, status: { in: ["paid", "exempt"] } }, select: { organisationId: true, contactId: true } });
    const orgIds = Array.from(new Set(current.map((m) => m.organisationId).filter((x): x is string => Boolean(x))));
    const personIds = Array.from(new Set(current.filter((m) => !m.organisationId && m.contactId).map((m) => m.contactId as string)));
    contacts = await prisma.contact.findMany({ where: { leftAt: null, OR: [{ organisationId: { in: orgIds } }, { id: { in: personIds } }] }, include, orderBy });
  } else {
    contacts = await prisma.contact.findMany({ where: { leftAt: null, organisation: { active: true, ...kindFilter(b.kind) } }, include, orderBy });
  }
  const now = new Date();
  return {
    id: b.id, ownerId: "", name: b.name, description: b.description, visibility: "all", color: null, editionId: null, fields: [] as ListField[], source: "base", brevoListId: null, brevoSyncedAt: null, createdAt: now, updatedAt: now,
    owner: { id: "", name: "Outil", poleId: null }, edition: null, _count: { items: contacts.length },
    items: contacts.map((c) => ({ listId: b.id, contactId: c.id, role: null, values: {} as Record<string, string | boolean | null>, addedAt: c.createdAt, contact: c })),
  };
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
