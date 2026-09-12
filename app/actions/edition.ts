"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { canDecideValidation, canEditActions, canEditFunding, canWriteLayer, requiredLevelFor } from "@/lib/rights";
import { dayjs } from "@/lib/format";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function ctx(editionId: string) {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: true, team: true } });
  if (!e) throw new Error("Édition introuvable");
  return { me, e, isPilot: e.project.pilotId === me.id, isTeam: e.team.some((t) => t.personId === me.id), samePole: e.project.poleId === me.poleId };
}

const path = (id: string) => `/edition/${id}`;

export async function addAction(editionId: string, name: string): Promise<Result<{ id: string }>> {
  const c = await ctx(editionId);
  if (!canEditActions(c.me.role, c.isPilot, c.isTeam, c.samePole)) return { ok: false, error: "Vous ne pouvez pas ajouter d'action ici." };
  const count = await prisma.action.count({ where: { editionId } });
  const a = await prisma.action.create({ data: { editionId, name: name.trim() || "Nouvelle action", ownerId: c.isPilot ? c.me.id : c.e.project.pilotId, order: count } });
  revalidatePath(path(editionId));
  return { ok: true, data: { id: a.id } };
}

export async function addFundingLine(editionId: string, funderId: string): Promise<Result> {
  const c = await ctx(editionId);
  if (!canEditFunding(c.me.role)) return { ok: false, error: "Seule la RAF (ou la direction) ajoute une ligne de financement." };
  await prisma.fundingLine.create({ data: { editionId, funderId } });
  revalidatePath(path(editionId));
  return { ok: true };
}

export async function addDeliverable(fundingLineId: string, label: string, dueDate: string): Promise<Result> {
  const line = await prisma.fundingLine.findUnique({ where: { id: fundingLineId } });
  if (!line) return { ok: false, error: "Ligne introuvable" };
  const c = await ctx(line.editionId);
  if (!canEditFunding(c.me.role)) return { ok: false, error: "Seule la RAF (ou la direction) ajoute un livrable." };
  await prisma.deliverable.create({ data: { fundingLineId, label: label.trim() || "Livrable", dueDate: new Date(dueDate) } });
  revalidatePath(path(line.editionId));
  return { ok: true };
}

export async function addIndicator(editionId: string, label: string, imposed: boolean): Promise<Result> {
  const c = await ctx(editionId);
  if (!canWriteLayer(c.me.role, "year", c.isPilot, c.isTeam, c.samePole)) return { ok: false, error: "Vous ne pouvez pas ajouter d'indicateur." };
  const count = await prisma.indicator.count({ where: { editionId } });
  await prisma.indicator.create({ data: { editionId, label: label.trim() || "Indicateur", imposed, order: count } });
  revalidatePath(path(editionId));
  return { ok: true };
}

export async function addDocLink(editionId: string, label: string, url: string, codirOnly: boolean): Promise<Result> {
  const c = await ctx(editionId);
  if (!canWriteLayer(c.me.role, "year", c.isPilot, c.isTeam, c.samePole)) return { ok: false, error: "Vous ne pouvez pas ajouter de lien." };
  await prisma.docLink.create({ data: { editionId, label: label.trim() || "Lien", url: url.trim(), codirOnly: codirOnly && ["director", "raf", "pole_lead"].includes(c.me.role) } });
  revalidatePath(path(editionId));
  return { ok: true };
}

export async function addComment(editionId: string, body: string): Promise<Result> {
  const c = await ctx(editionId);
  if (!body.trim()) return { ok: false, error: "Message vide" };
  await prisma.comment.create({ data: { editionId, authorId: c.me.id, body: body.trim() } });
  revalidatePath(path(editionId));
  return { ok: true };
}

export async function setTeam(editionId: string, personIds: string[]): Promise<Result> {
  const c = await ctx(editionId);
  if (!canWriteLayer(c.me.role, "proposal", c.isPilot, c.isTeam)) return { ok: false, error: "Seul le pilote (ou la direction) compose l'équipe." };
  await prisma.editionTeam.deleteMany({ where: { editionId, personId: { notIn: personIds } } });
  for (const personId of personIds) {
    await prisma.editionTeam.upsert({ where: { editionId_personId: { editionId, personId } }, create: { editionId, personId }, update: {} });
    await prisma.editionPersonDays.upsert({ where: { editionId_personId: { editionId, personId } }, create: { editionId, personId, soldDays: 0 }, update: {} });
  }
  revalidatePath(path(editionId));
  return { ok: true };
}

// Demande de validation (EF-F1). Le niveau requis est calculé puis modifiable à la main (EF-F2).
export async function requestValidation(input: { editionId: string; actionId?: string | null; kind: string; label: string; amount?: number | null; attachmentUrl?: string | null; requiredLevel?: number | null; targetDelayDays?: number }): Promise<Result<{ id: string; requiredLevel: number }>> {
  const c = await ctx(input.editionId);
  const settings = await getSettings();
  const remaining = c.e.budgetEnvelope == null ? null : c.e.budgetEnvelope - c.e.committed - c.e.spent;
  const computed = requiredLevelFor(input.amount, settings, remaining);
  const level = input.requiredLevel ?? computed;
  const v = await prisma.validationRequest.create({
    data: {
      editionId: input.editionId,
      actionId: input.actionId || null,
      kind: input.kind,
      label: input.label.trim() || "Demande",
      requesterId: c.me.id,
      amount: input.amount ?? null,
      attachmentUrl: input.attachmentUrl || null,
      requiredLevel: level,
      targetDelayDays: input.targetDelayDays ?? 5,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: v.id, requiredLevel: level } };
}

export async function computeRequiredLevel(editionId: string, amount: number | null): Promise<number> {
  const settings = await getSettings();
  const e = await prisma.edition.findUnique({ where: { id: editionId } });
  const remaining = !e || e.budgetEnvelope == null ? null : e.budgetEnvelope - e.committed - e.spent;
  return requiredLevelFor(amount, settings, remaining);
}

// Décision : le devis approuvé remonte dans l'engagé de l'édition (EF-E2).
export async function decideValidation(id: string, decision: "approved" | "refused", comment: string): Promise<Result> {
  const me = await getCurrentPerson();
  const v = await prisma.validationRequest.findUnique({ where: { id }, include: { edition: { include: { project: true } } } });
  if (!v) return { ok: false, error: "Demande introuvable" };
  if (v.status !== "pending") return { ok: false, error: "Cette demande est déjà traitée." };
  if (!canDecideValidation(me, v)) return { ok: false, error: `Cette demande requiert le niveau ${v.requiredLevel} sur ce projet : vous ne pouvez pas la décider.` };
  await prisma.validationRequest.update({ where: { id }, data: { status: decision, deciderId: me.id, decidedAt: new Date(), decisionComment: comment.trim() || null } });
  if (decision === "approved" && (v.kind === "quote" || v.kind === "expense") && v.amount) {
    await prisma.edition.update({ where: { id: v.editionId }, data: { committed: { increment: v.amount } } });
    await prisma.changeLog.create({ data: { editionId: v.editionId, field: "committed", before: null, after: `+${v.amount} (${v.label})`, authorId: me.id } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Reconduction N → N+1 (EF-A2) : couches 1 à 3, actions, financements, équipe ; couche 4, budget, temps et bilan vidés.
export async function renewEdition(editionId: string): Promise<Result<{ id: string }>> {
  const c = await ctx(editionId);
  if (!["director", "raf", "pole_lead"].includes(c.me.role) && !c.isPilot) return { ok: false, error: "Seuls le pilote, le responsable de pôle, la RAF et la direction reconduisent une édition." };
  const src = await prisma.edition.findUnique({ where: { id: editionId }, include: { actions: true, fundingLines: true, team: true, personDays: true, indicators: true, docLinks: true } });
  if (!src) return { ok: false, error: "Édition introuvable" };
  const year = src.year + 1;
  const exists = await prisma.edition.findUnique({ where: { projectId_year: { projectId: src.projectId, year } } });
  if (exists) return { ok: false, error: `L'édition ${year} existe déjà.` };

  const created = await prisma.edition.create({
    data: {
      projectId: src.projectId,
      year,
      status: "proposed",
      stakes: src.stakes, axis: src.axis, sressMeasure: src.sressMeasure, yearPriorities: src.yearPriorities, expectedOutcome: src.expectedOutcome,
      plannedFunders: src.plannedFunders, directExpenseEnvelope: src.directExpenseEnvelope, fte: src.fte, imposedIndicators: src.imposedIndicators,
      operationalObjectives: src.operationalObjectives, calendar: src.calendar, partners: src.partners, method: src.method, governance: src.governance,
      ownIndicators: src.ownIndicators, timeNeed: src.timeNeed, budgetNeed: src.budgetNeed,
      team: { create: src.team.map((t) => ({ personId: t.personId })) },
      personDays: { create: src.personDays.map((p) => ({ personId: p.personId, soldDays: p.soldDays })) },
      indicators: { create: src.indicators.map((i) => ({ label: i.label, target: i.target, imposed: i.imposed, order: i.order })) },
      docLinks: { create: src.docLinks.map((d) => ({ label: d.label, url: d.url, codirOnly: d.codirOnly })) },
      actions: {
        create: src.actions.map((a) => ({
          name: a.name, ownerId: a.ownerId, timeTarget: a.timeTarget, order: a.order, state: "todo",
          milestoneDate: a.milestoneDate ? dayjs(a.milestoneDate).add(1, "year").toDate() : null,
        })),
      },
      fundingLines: {
        create: src.fundingLines.map((f) => ({
          funderId: f.funderId, scheme: f.scheme, status: "to_submit", analyticCode: f.analyticCode, allocationKeyRef: f.allocationKeyRef, multiYear: f.multiYear, notes: f.notes,
        })),
      },
    },
  });
  await prisma.changeLog.create({ data: { editionId: created.id, field: "création", before: null, after: `Reconduite depuis ${src.year}`, authorId: c.me.id } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: created.id } };
}

export async function markDeliverableDone(id: string, done: boolean): Promise<Result> {
  const d = await prisma.deliverable.findUnique({ where: { id }, include: { fundingLine: true } });
  if (!d) return { ok: false, error: "Livrable introuvable" };
  const c = await ctx(d.fundingLine.editionId);
  if (!canEditFunding(c.me.role) && !c.isPilot) return { ok: false, error: "Réservé au pilote et à la RAF." };
  await prisma.deliverable.update({ where: { id }, data: { done, doneAt: done ? new Date() : null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Séminaire (EF-A5, EF-H4) : création en série des éditions N+1 selon la décision prise sur chaque projet.
export async function batchCreateEditions(year: number, decisions: { editionId: string; decision: "renew" | "adjust" | "stop" }[]): Promise<Result<{ created: number; stopped: number; skipped: string[] }>> {
  const me = await getCurrentPerson();
  if (!["director", "raf", "pole_lead"].includes(me.role)) return { ok: false, error: "La création en série est réservée au CODIR." };
  let created = 0, stopped = 0;
  const skipped: string[] = [];
  for (const d of decisions) {
    const src = await prisma.edition.findUnique({ where: { id: d.editionId }, include: { project: true } });
    if (!src) continue;
    await prisma.edition.update({ where: { id: src.id }, data: { codirDecision: d.decision, codirDate: new Date() } });
    if (d.decision === "stop") { stopped++; continue; }
    const res = await renewEdition(src.id);
    if (!res.ok) { skipped.push(`${src.project.name} : ${res.error}`); continue; }
    await prisma.edition.update({ where: { id: res.data!.id }, data: { year, status: d.decision === "adjust" ? "rechallenged" : "proposed" } });
    created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { created, stopped, skipped } };
}
