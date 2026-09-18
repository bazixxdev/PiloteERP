import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exportAllowed } from "@/lib/export-auth";
import { budgetOf } from "@/lib/budget";

// Export CSV par table, ou JSON complet (ENF-5).
function csv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

export async function GET(req: Request) {
  if (!(await exportAllowed(req))) return new NextResponse("Jeton d'API requis", { status: 401 });
  const url = new URL(req.url);
  const table = url.searchParams.get("table") ?? "tout";
  const format = url.searchParams.get("format") ?? "csv";

  const loaders: Record<string, () => Promise<Record<string, unknown>[]>> = {
    personnes: async () => (await prisma.person.findMany({ include: { pole: true } })).map((p) => ({ nom: p.name, pole: p.pole?.name ?? "", role: p.role, rythme: p.workRhythm, jours: p.availableDays, actif: p.active })),
    projets: async () => (await prisma.project.findMany({ include: { pole: true, pilot: true, mission: true } })).map((p) => ({ nom: p.name, code: p.analyticCode, pole: p.pole.name, pilote: p.pilot.name, mission: p.mission.name, recurrent: p.recurring })),
    editions: async () => (await prisma.edition.findMany({ include: { project: true, expenses: true } })).map((e) => ({ projet: e.project.name, annee: e.year, statut: e.status, decision: e.decisionDate, enveloppe: e.budgetEnvelope, realise: budgetOf(e).realized, engagements_restants: budgetOf(e).remainingCommitments, disponible: budgetOf(e).available, enjeux: e.stakes, objectifs: e.operationalObjectives, bilan: e.report })),
    actions: async () => (await prisma.action.findMany({ include: { edition: { include: { project: true } }, owner: true } })).map((a) => ({ projet: a.edition.project.name, annee: a.edition.year, action: a.name, responsable: a.owner?.name ?? "", jalon: a.milestoneDate, objectif_h: a.timeTarget, etat: a.state })),
    financements: async () => (await prisma.fundingLine.findMany({ include: { edition: { include: { project: true } }, funder: true } })).map((f) => ({ projet: f.edition.project.name, annee: f.edition.year, financeur: f.funder.name, dispositif: f.scheme, statut: f.status, demande: f.amountRequested, obtenu: f.amountGranted, depot: f.submittedAt, reponse: f.answeredAt, convention: f.contractedAt, code: f.analyticCode, cle: f.allocationKeyRef, pluriannuel: f.multiYear })),
    livrables: async () => (await prisma.deliverable.findMany({ include: { fundingLine: { include: { funder: true, edition: { include: { project: true } } } } } })).map((d) => ({ projet: d.fundingLine.edition.project.name, annee: d.fundingLine.edition.year, financeur: d.fundingLine.funder.name, livrable: d.label, echeance: d.dueDate, remis: d.done })),
    temps: async () => (await prisma.timeEntry.findMany({ include: { person: true, project: true, action: true, timeCode: true } })).map((t) => ({ personne: t.person.name, date: t.date, projet: t.project?.name ?? "", action: t.action?.name ?? "", code: t.timeCode?.code ?? "", heures: t.hours, commentaire: t.comment, verrouille: t.locked })),
    depenses: async () => (await prisma.expense.findMany({ include: { edition: { include: { project: true } } } })).map((x) => ({ projet: x.edition.project.name, annee: x.edition.year, depense: x.label, fournisseur: x.supplier, engage: x.committed, realise: x.spent, engagement_restant: x.status === "open" ? Math.max(0, x.committed - x.spent) : 0, statut: x.status, reference: x.reference })),
    validations: async () => (await prisma.validationRequest.findMany({ include: { edition: { include: { project: true } }, requester: true, decider: true } })).map((v) => ({ projet: v.edition.project.name, annee: v.edition.year, nature: v.kind, objet: v.label, montant: v.amount, niveau: v.requiredLevel, statut: v.status, demandeur: v.requester.name, demande_le: v.createdAt, decideur: v.decider?.name ?? "", decide_le: v.decidedAt })),
  };

  if (table === "tout" || format === "json") {
    const all: Record<string, unknown> = {};
    for (const [k, fn] of Object.entries(loaders)) all[k] = await fn();
    return new NextResponse(JSON.stringify(all, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="pilote-export.json"` } }); // vocab-ok : nom de fichier
  }
  const fn = loaders[table];
  if (!fn) return new NextResponse("Table inconnue", { status: 400 });
  return new NextResponse("﻿" + csv(await fn()), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${table}.csv"` } });
}
