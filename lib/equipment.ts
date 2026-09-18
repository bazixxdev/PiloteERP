import { prisma } from "./db";
import { contactName } from "./contacts";

// Matériel et prêts (module « materiel », 18/09) : l'inventaire (quantité, état, rangement) et le registre des prêts. La
// disponibilité se calcule : quantité − ce qui est sorti et pas rendu.

export const EQUIPMENT_STATES: { value: string; label: string; color: string }[] = [
  { value: "ok", label: "En état", color: "mint" },
  { value: "worn", label: "Fatigué", color: "warning" },
  { value: "broken", label: "En panne", color: "danger" },
  { value: "retired", label: "Sorti de l'inventaire", color: "muted" },
];
export const EQUIPMENT_CATEGORIES = ["Audiovisuel", "Signalétique", "Mobilier", "Informatique", "Animation", "Papeterie et fournitures", "Autre"];
export const stateOf = (v: string) => EQUIPMENT_STATES.find((s) => s.value === v) ?? EQUIPMENT_STATES[0];

const loanInclude = {
  person: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true, organisation: { select: { name: true } }, organisationName: true } },
  organisation: { select: { id: true, name: true } },
  edition: { select: { id: true, year: true, project: { select: { name: true } } } },
} as const;

export type LoanRow = Awaited<ReturnType<typeof loadOpenLoans>>[number];
export const borrowerName = (l: { person: { name: string } | null; contact: { firstName: string | null; lastName: string; organisation: { name: string } | null; organisationName: string | null } | null; organisation: { name: string } | null }) =>
  l.person?.name ?? (l.contact ? `${contactName(l.contact)}${l.contact.organisation?.name ?? l.contact.organisationName ? ` (${l.contact.organisation?.name ?? l.contact.organisationName})` : ""}` : l.organisation?.name ?? "—");
export const isLate = (l: { dueAt: Date | null; returnedAt: Date | null }, now = new Date()) => !l.returnedAt && Boolean(l.dueAt && l.dueAt.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());

// L'inventaire avec, par matériel, ce qui est sorti.
export async function loadEquipment(opts: { q?: string; category?: string; onlyAvailable?: boolean; includeRetired?: boolean } = {}) {
  const rows = await prisma.equipment.findMany({ where: { active: true, ...(opts.includeRetired ? {} : { state: { not: "retired" } }) }, include: { loans: { where: { returnedAt: null }, include: loanInclude, orderBy: { outAt: "asc" } } }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = opts.q ? norm(opts.q) : "";
  return rows
    .map((e) => { const out = e.loans.reduce((n, l) => n + l.quantity, 0); return { ...e, out, available: Math.max(0, e.quantity - out), late: e.loans.some((l) => isLate(l)) }; })
    .filter((e) => (!q || norm(`${e.name} ${e.category ?? ""} ${e.reference ?? ""} ${e.location ?? ""}`).includes(q)) && (!opts.category || e.category === opts.category) && (!opts.onlyAvailable || e.available > 0));
}
export type EquipmentRow = Awaited<ReturnType<typeof loadEquipment>>[number];

export async function loadOpenLoans() {
  return prisma.loan.findMany({ where: { returnedAt: null }, include: { ...loanInclude, equipment: { select: { id: true, name: true, category: true } } }, orderBy: [{ dueAt: "asc" }, { outAt: "asc" }] });
}

export async function loadEquipmentOne(id: string) {
  return prisma.equipment.findUnique({ where: { id }, include: { loans: { include: loanInclude, orderBy: { outAt: "desc" }, take: 30 } } });
}

// Les catégories en usage, plus celles proposées.
export async function equipmentCategories(): Promise<string[]> {
  const used = await prisma.equipment.findMany({ where: { active: true }, select: { category: true }, distinct: ["category"] });
  return Array.from(new Set([...EQUIPMENT_CATEGORIES, ...used.map((u) => u.category).filter((c): c is string => Boolean(c))])).sort((a, b) => a.localeCompare(b, "fr"));
}
