import { prisma } from "./db";
import { contactName } from "./contacts";

// Adhérents (module « adherents », 18/09). Le membre est une organisation de l'annuaire (genre « member ») ou une personne
// (contact) ; l'adhésion est l'objet typé : année, collège, cotisation, règlement. Ce qui a des règles ou de l'argent est
// typé ici ; la présentation en liste (interlocuteurs des adhérents, adhérents à jour) est une liste de base calculée.

export const MEMBERSHIP_STATUS: { value: string; label: string; color: string; hint: string }[] = [
  { value: "due", label: "À régler", color: "warning", hint: "Adhésion enregistrée, cotisation attendue." },
  { value: "paid", label: "Réglée", color: "mint", hint: "Cotisation encaissée." },
  { value: "exempt", label: "Exonérée", color: "info", hint: "Adhésion sans cotisation (décision du CA, partenariat…)." },
  { value: "cancelled", label: "Annulée", color: "muted", hint: "Adhésion retirée ou remboursée : ne compte pas." },
];
export const MEMBERSHIP_METHODS: { value: string; label: string }[] = [
  { value: "helloasso", label: "HelloAsso" },
  { value: "transfer", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "cash", label: "Espèces" },
  { value: "other", label: "Autre" },
];
export const statusOf = (v: string) => MEMBERSHIP_STATUS.find((s) => s.value === v) ?? MEMBERSHIP_STATUS[0];
export const methodLabel = (v: string | null) => MEMBERSHIP_METHODS.find((m) => m.value === v)?.label ?? (v ?? "");
// « À jour » : réglée ou exonérée.
export const isCurrent = (m: { status: string }) => m.status === "paid" || m.status === "exempt";

const include = {
  organisation: { select: { id: true, name: true, kinds: true, active: true, address: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, organisationId: true } },
} as const;

export type MembershipRow = Awaited<ReturnType<typeof loadMemberships>>[number];

// Les adhésions d'une année (ou toutes), avec leur membre.
export async function loadMemberships(year?: number) {
  return prisma.membership.findMany({ where: year ? { year } : undefined, include, orderBy: [{ organisation: { name: "asc" } }, { contact: { lastName: "asc" } }] });
}

export const memberName = (m: { organisation: { name: string } | null; contact: { firstName: string | null; lastName: string } | null }) => m.organisation?.name ?? (m.contact ? contactName(m.contact) : "(adhérent inconnu)");
export const memberKey = (m: { organisationId: string | null; contactId: string | null }) => m.organisationId ? `o:${m.organisationId}` : `c:${m.contactId}`;

// Les années connues (adhésions enregistrées), plus l'année courante et la suivante pour préparer une campagne.
export async function membershipYears(): Promise<number[]> {
  const rows = await prisma.membership.groupBy({ by: ["year"], _count: { _all: true } });
  const now = new Date().getFullYear();
  return Array.from(new Set([...rows.map((r) => r.year), now, now + 1])).sort((a, b) => b - a);
}

// Résumé d'une année : adhérents (hors annulées), à jour, à régler, encaissé.
export function summarize(rows: { status: string; amount: number }[]) {
  const live = rows.filter((r) => r.status !== "cancelled");
  return {
    members: live.length,
    current: live.filter(isCurrent).length,
    due: live.filter((r) => r.status === "due").length,
    dueAmount: live.filter((r) => r.status === "due").reduce((n, r) => n + r.amount, 0),
    paidAmount: live.filter((r) => r.status === "paid").reduce((n, r) => n + r.amount, 0),
  };
}

// Export CSV (point-virgule, BOM) d'une année.
export function membershipsToCsv(rows: MembershipRow[]): string {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["Adhérent", "Type", "Année", "Collège", "Cotisation", "Statut", "Réglée le", "Moyen", "Référent", "E-mail", "Téléphone", "Ville", "Notes"];
  const lines = rows.map((m) => [memberName(m), m.organisation ? "Structure" : "Personne", m.year, m.college, m.amount.toFixed(2).replace(".", ","), statusOf(m.status).label, m.paidAt ? m.paidAt.toLocaleDateString("fr-FR") : "", methodLabel(m.method), m.organisation && m.contact ? contactName(m.contact) : "", m.contact?.email, m.contact?.phone, m.organisation?.address, m.notes].map(esc).join(";"));
  return "﻿" + [head.map(esc).join(";"), ...lines].join("\n");
}
