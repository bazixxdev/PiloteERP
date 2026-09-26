"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { findOrCreateOrganisation } from "@/lib/organisations";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { canConsignDecision, canDecideValidation, canEditFunding, canWriteLayer, isCodir, requiredLevelFor, validationLevelOf } from "@/lib/rights";
import { budgetOf } from "@/lib/budget";
import { inMyPole } from "@/lib/scope";
import { attachLedgerSpent } from "@/lib/ledger-db";
import { allocationCheck, conventionCovers, detachedLineIsEmpty, reusableLine } from "@/lib/conventions";
import { actionsOfYear, renewedLineIds, renewSelection, shiftDate, shiftYear } from "@/lib/actions";
import { isPrepareChoice, prepareDecisionBody, prepareInstance, type PrepareChoice } from "@/lib/preparer";
import { reportInternalError } from "@/lib/errors";
import { actionRunsInEdition } from "@/lib/actions-db";
import { linkNewLineToRunningActions } from "@/lib/actions-funding-db";
import { V, cap, le, un, du, de, au, ce, seul } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function ctx(editionId: string) {
  const me = await getCurrentPerson();
  const raw = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true, expenses: true } });
  if (!raw) throw new Error(`${cap(V.edition)} introuvable`);
  const [e] = await attachLedgerSpent([raw], await getSettings());
  return { me, e, isPilot: e.project.pilotId === me.id, isTeam: e.team.some((t) => t.personId === me.id), samePole: inMyPole(me, e.project) };
}

const path = (id: string) => `/edition/${id}`;

export async function addFundingLine(editionId: string, funderId: string): Promise<Result> {
  const c = await ctx(editionId);
  if (!canEditFunding(c.me)) return { ok: false, error: `${cap(seul(V.raf))} (ou ${le(V.direction)}) ajoute une ligne de financement.` };
  await prisma.fundingLine.create({ data: { editionId, funderId } });
  revalidatePath(path(editionId));
  return { ok: true };
}

export async function addDeliverable(fundingLineId: string, label: string, dueDate: string): Promise<Result> {
  const line = await prisma.fundingLine.findUnique({ where: { id: fundingLineId } });
  if (!line) return { ok: false, error: "Ligne introuvable" };
  const c = await ctx(line.editionId);
  if (!canEditFunding(c.me)) return { ok: false, error: `${cap(seul(V.raf))} (ou ${le(V.direction)}) ajoute un livrable.` };
  await prisma.deliverable.create({ data: { fundingLineId, label: label.trim() || "Livrable", dueDate: new Date(dueDate) } });
  revalidatePath(path(line.editionId));
  return { ok: true };
}

export async function addIndicator(editionId: string, label: string, imposed: boolean): Promise<Result> {
  const c = await ctx(editionId);
  if (!canWriteLayer(c.me, "year", c.isPilot, c.isTeam, c.samePole)) return { ok: false, error: "Vous ne pouvez pas ajouter d'indicateur." };
  const count = await prisma.indicator.count({ where: { editionId } });
  await prisma.indicator.create({ data: { editionId, label: label.trim() || "Indicateur", imposed, order: count } });
  revalidatePath(path(editionId));
  return { ok: true };
}

export async function addDocLink(editionId: string, label: string, url: string, codirOnly: boolean): Promise<Result> {
  const c = await ctx(editionId);
  if (!canWriteLayer(c.me, "year", c.isPilot, c.isTeam, c.samePole)) return { ok: false, error: "Vous ne pouvez pas ajouter de lien." };
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
  if (!canWriteLayer(c.me, "proposal", c.isPilot, c.isTeam)) return { ok: false, error: `${cap(seul(V.pilote))} (ou ${le(V.direction)}) compose l'équipe.` };
  await prisma.editionTeam.deleteMany({ where: { editionId, personId: { notIn: personIds } } });
  for (const personId of personIds) {
    await prisma.editionTeam.upsert({ where: { editionId_personId: { editionId, personId } }, create: { editionId, personId }, update: {} });
    await prisma.editionPersonDays.upsert({ where: { editionId_personId: { editionId, personId } }, create: { editionId, personId, soldDays: 0 }, update: {} });
  }
  revalidatePath(path(editionId));
  return { ok: true };
}

// Demande de validation (EF-F1). Le niveau requis est une décision serveur : le client
// peut afficher une suggestion, mais ne peut pas diminuer le circuit calculé.
export async function requestValidation(input: { editionId: string; actionId?: string | null; kind: string; label: string; amount?: number | null; attachmentUrl?: string | null; requiredLevel?: number | null; targetDelayDays?: number; supplier?: string | null; supplierEmail?: string | null; supplierId?: string | null; saveSupplier?: boolean }): Promise<Result<{ id: string; requiredLevel: number }>> {
  const c = await ctx(input.editionId);
  if (input.actionId && !(await actionRunsInEdition(input.actionId, input.editionId))) return { ok: false, error: `${cap(V.action)} introuvable sur ${ce(V.edition)}.` };
  const settings = await getSettings();
  const remaining = budgetOf(c.e).available;
  const computed = requiredLevelFor(input.amount, settings, remaining);
  const level = computed;
  // Base fournisseurs (15/09) : fournisseur choisi dans la base, ou nouveau nom ajouté si demandé ; le nom et l'adresse restent copiés sur la demande.
  let supplierId = input.supplierId || null;
  const supplierName = input.supplier?.trim() || null;
  if (!supplierId && supplierName && input.saveSupplier) {
    supplierId = (await findOrCreateOrganisation(supplierName, "supplier", { email: input.supplierEmail?.trim() || null })).id;
  }
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
      supplier: supplierName,
      supplierEmail: input.supplierEmail?.trim() || null,
      supplierId,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: v.id, requiredLevel: level } };
}

export async function computeRequiredLevel(editionId: string, amount: number | null): Promise<number> {
  return (await explainRequiredLevel(editionId, amount)).level;
}

async function assertEditionReadable(editionId: string) {
  const me = await getCurrentPerson();
  const edition = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true } });
  if (!edition) throw new Error(`${cap(V.edition)} introuvable`);
  const isPilot = edition.project.pilotId === me.id;
  const isTeam = edition.team.some((member) => member.personId === me.id);
  const samePole = inMyPole(me, edition.project);
  if (!isPilot && !isTeam && !samePole && !isCodir(me)) throw new Error("Accès refusé.");
  return edition.id;
}

// Niveau requis et sa raison, en clair, pour que le demandeur sache à qui part sa demande et pourquoi.
export async function explainRequiredLevel(editionId: string, amount: number | null): Promise<{ level: number; reason: string }> {
  await assertEditionReadable(editionId);
  const settings = await getSettings();
  const raw = await prisma.edition.findUnique({ where: { id: editionId }, include: { expenses: true } });
  const e = raw ? (await attachLedgerSpent([raw], settings))[0] : null;
  const remaining = e ? budgetOf(e).available : null;
  const level = requiredLevelFor(amount, settings, remaining);
  const euro = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const a = amount ?? 0;
  const reason =
    remaining !== null && remaining < 0 ? `enveloppe déjà dépassée de ${euro(-remaining)} : toute dépense passe par ${le(V.direction)}`
    : remaining !== null && a > remaining ? `montant supérieur au reste de l'enveloppe (${euro(remaining)})`
    : a > settings.validationThresholdLevel2 ? `montant supérieur au seuil de niveau 3 (${euro(settings.validationThresholdLevel2)})`
    : a > settings.validationThresholdLevel1 ? `montant supérieur au seuil de niveau 2 (${euro(settings.validationThresholdLevel1)})`
    : a > 0 ? `montant sous le seuil de niveau 2 (${euro(settings.validationThresholdLevel1)})` : `sans montant : validation ${du(V.pilote)}`;
  return { level, reason };
}

// Décision : le devis approuvé remonte dans l'engagé de l'édition (EF-E2).
export async function decideValidation(id: string, decision: "approved" | "refused", comment: string): Promise<Result> {
  const me = await getCurrentPerson();
  const v = await prisma.validationRequest.findUnique({ where: { id }, include: { edition: { include: { project: { include: { secondaryPoles: true } } } } } });
  if (!v) return { ok: false, error: "Demande introuvable" };
  if (v.status !== "pending") return { ok: false, error: "Cette demande est déjà traitée." };
  if (!Number.isInteger(v.requiredLevel) || v.requiredLevel < 1 || v.requiredLevel > 3) return { ok: false, error: "Niveau de validation invalide." };
  if (!canDecideValidation(me, v)) return { ok: false, error: `Cette demande requiert le niveau ${v.requiredLevel} sur ce projet : vous ne pouvez pas la décider.` };
  // Une seule décision, même en cas de double clic : la mise à jour ne passe que si la demande est encore en attente.
  const changed = await prisma.validationRequest.updateMany({ where: { id, status: "pending" }, data: { status: decision, deciderId: me.id, decidedAt: new Date(), decisionComment: comment.trim() || null } });
  if (changed.count === 0) return { ok: false, error: "Cette demande vient d'être traitée par quelqu'un d'autre." };
  if (decision === "approved" && (v.kind === "quote" || v.kind === "expense") && v.amount) {
    // Le devis approuvé crée l'engagement une seule fois (validationId unique) ; le réalisé viendra s'y rattacher. L'action
    // de la demande (vérifiée à la demande : même projet, période sur l'année) devient celle de la dépense.
    // Pas revérifiée ici, exprès : la décision ne doit pas tomber parce que l'action a changé depuis ; attachOptions l'affiche quand même.
    await prisma.expense.upsert({ where: { validationId: v.id }, create: { editionId: v.editionId, label: v.label, supplier: v.supplier, committed: v.amount, validationId: v.id, actionId: v.actionId }, update: {} });
    await prisma.changeLog.create({ data: { editionId: v.editionId, field: "engagement", before: null, after: `+${v.amount} € (${v.label})`, authorId: me.id } });
  }
  // Lot 3 : le demandeur est prévenu ; pour un devis approuvé, le « bon pour accord » est prêt à envoyer (plus d'impression ni de tampon).
  const isQuote = v.kind === "quote" || v.kind === "expense";
  if (v.requesterId !== me.id) {
    await prisma.notification.create({ data: { personId: v.requesterId, senderId: me.id, kind: "info", title: `${decision === "approved" ? "Approuvée" : "Refusée"} : ${v.label}`, body: decision === "approved" && isQuote ? "Bon pour accord prêt à envoyer au fournisseur." : comment.trim() || null, link: decision === "approved" && isQuote ? `/validations/${v.id}/bon-pour-accord` : `/edition/${v.editionId}?onglet=apercu` } });
  }
  // La directrice voit tout ce qui s'engage sans elle : information, pas validation (retour du 14/09).
  if (decision === "approved" && validationLevelOf(me) < 3 && v.amount) {
    const director = await prisma.person.findFirst({ where: { role: "director", active: true } });
    if (director && director.id !== v.requesterId) await prisma.notification.create({ data: { personId: director.id, senderId: me.id, kind: "info", title: `Pour information · ${v.label} approuvé (${v.amount} €)`, body: `Par ${me.name}, niveau ${v.requiredLevel}.`, link: `/edition/${v.editionId}?onglet=budget` } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Reconduction N → N+1 (EF-A2) : couches 1 à 3, financements, équipe ; couche 4, budget, temps et bilan vidés. Les actions
// qui continuent l'année suivante y sont déjà (leur période la couvre) : seules celles qui finissent dans l'année source
// (toRenew), cochées dans le dialogue, sont recopiées (spec actions § 2). Qui : le pilote ou un membre du CODIR.
export async function renewEdition(editionId: string, opts?: { actionIds?: string[] }): Promise<Result<{ id: string }>> {
  const c = await ctx(editionId);
  if (!isCodir(c.me) && !c.isPilot) return { ok: false, error: `Seuls ${le(V.pilote)}, le responsable ${de(V.pole)}, ${le(V.raf)} et ${le(V.direction)} reconduisent ${un(V.edition)}.` };
  const src = await renewSource(editionId);
  if (!src) return { ok: false, error: `${cap(V.edition)} introuvable` };
  const year = src.year + 1;
  const exists = await prisma.edition.findUnique({ where: { projectId_year: { projectId: src.projectId, year } } });
  if (exists) return { ok: false, error: `${cap(le(V.edition))} ${year} existe déjà.` };
  // Liste venue du client : des chaînes seulement ; renewSelection ne garde de toute façon que des actions à reconduire.
  const actionIds = Array.isArray(opts?.actionIds) ? opts.actionIds.filter((x): x is string => typeof x === "string") : null;
  const created = await prisma.$transaction((tx) => renewInTx(tx, c.me.id, src, { year, status: "proposed", actionIds }), { timeout: 20_000 });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: created.id } };
}

function renewSource(editionId: string) {
  return prisma.edition.findUnique({ where: { id: editionId }, include: { project: { select: { name: true } }, fundingLines: { include: { convention: true } }, team: true, personDays: true, indicators: true, docLinks: true } });
}

// Écriture de la reconduction, dans la transaction de l'appelant (renewEdition, ou une ligne de « Préparer ») — garde faite
// avant. Frontière : l'année, son historique de création, les copies des actions retenues (jalons décalés, associés, liens
// vers les lignes recréées du même financeur), les indicateurs (repointés sur les copies) et les liens des lignes gardées
// sur un dossier aux actions qui courent l'année suivante (linkNewLineToRunningActions) — tout ou rien.
async function renewInTx(tx: Prisma.TransactionClient, authorId: string, src: NonNullable<Awaited<ReturnType<typeof renewSource>>>, opts: { year: number; status: string; actionIds?: string[] | null }) {
  const { year } = opts;
  const ed = await tx.edition.create({
    include: { fundingLines: { select: { id: true, conventionId: true, editionId: true, funderId: true } } },
    data: {
      projectId: src.projectId,
      year,
      status: opts.status,
      stakes: src.stakes, axis: src.axis, sressMeasure: src.sressMeasure, yearPriorities: src.yearPriorities, expectedOutcome: src.expectedOutcome,
      plannedFunders: src.plannedFunders, directExpenseEnvelope: src.directExpenseEnvelope, fte: src.fte, imposedIndicators: src.imposedIndicators,
      operationalObjectives: src.operationalObjectives, calendar: src.calendar, partners: src.partners, method: src.method, governance: src.governance,
      ownIndicators: src.ownIndicators, timeNeed: src.timeNeed, budgetNeed: src.budgetNeed,
      team: { create: src.team.map((t) => ({ personId: t.personId })) },
      personDays: { create: src.personDays.map((p) => ({ personId: p.personId, soldDays: p.soldDays, plannedDays: p.plannedDays })) },
      docLinks: { create: src.docLinks.map((d) => ({ label: d.label, url: d.url, codirOnly: d.codirOnly })) },
      fundingLines: {
        // Une convention qui couvre l'année suivante reste rattachée (montants à affecter) ; un financement annuel repart « à déposer ».
        create: src.fundingLines.map((f) => {
          const keeps = f.convention && conventionCovers(f.convention, year);
          return {
            funderId: f.funderId, scheme: f.scheme, analyticCode: f.analyticCode, allocationKeyRef: f.allocationKeyRef, multiYear: f.multiYear, notes: f.notes,
            conventionId: keeps ? f.conventionId : null,
            status: keeps && ["notified", "contracted", "justified"].includes(f.convention!.status) ? "contracted" : "to_submit",
          };
        }),
      },
    },
  });
  await tx.changeLog.create({ data: { editionId: ed.id, field: "création", before: null, after: `Reconduite depuis ${src.year}`, authorId } });

  // Les actions de l'année source (période qui chevauche l'année, comme attachYearActions), lues dans la transaction.
  const all = await tx.action.findMany({
    where: { projectId: src.projectId },
    include: { milestones: { orderBy: [{ date: "asc" }, { order: "asc" }] }, people: true, fundings: { include: { fundingLine: { select: { funderId: true, conventionId: true } } } } },
    orderBy: [{ startDate: "asc" }, { order: "asc" }],
  });
  const copies = new Map<string, string>();
  for (const a of renewSelection(actionsOfYear(all, src), src.year, opts.actionIds)) {
    // Copie : période et jalons un an plus tard (shiftDate, pour que les jalons restent dans la période), état « à faire »,
    // jalons non faits ; ni tâches, ni heures, ni réalisations.
    const copy = await tx.action.create({
      data: {
        editionId: ed.id, projectId: src.projectId, ...shiftYear(a), state: "todo", order: a.order,
        name: a.name, ownerId: a.ownerId, description: a.description, audience: a.audience, recurrence: a.recurrence,
        entrusted: a.entrusted, latitude: a.latitude, timeTarget: a.timeTarget,
        milestones: { create: a.milestones.map((m) => ({ date: shiftDate(m.date), label: m.label, venue: m.venue, participants: m.participants, isPublic: m.isPublic, isCheckpoint: m.isCheckpoint, order: m.order })) },
        people: { create: a.people.map((p) => ({ personId: p.personId })) },
      },
    });
    copies.set(a.id, copy.id);
    const lineIds = renewedLineIds(a.fundings.map((f) => f.fundingLine), ed.fundingLines);
    if (lineIds.length > 0) await tx.actionFunding.createMany({ data: lineIds.map((fundingLineId) => ({ actionId: copy.id, fundingLineId })) });
  }
  // Indicateurs : cibles recopiées ; celui d'une action recopiée suit sa copie, les autres ne sont rattachés à aucune action.
  if (src.indicators.length > 0) {
    await tx.indicator.createMany({ data: src.indicators.map((i) => ({ editionId: ed.id, label: i.label, target: i.target, imposed: i.imposed, order: i.order, actionId: (i.actionId && copies.get(i.actionId)) || null })) });
  }
  for (const line of ed.fundingLines) await linkNewLineToRunningActions(tx, line);
  return ed;
}

export async function markDeliverableDone(id: string, done: boolean): Promise<Result> {
  const d = await prisma.deliverable.findUnique({ where: { id }, include: { fundingLine: true } });
  if (!d) return { ok: false, error: "Livrable introuvable" };
  const c = await ctx(d.fundingLine.editionId);
  if (!canEditFunding(c.me) && !c.isPilot) return { ok: false, error: `Réservé ${au(V.pilote)} et ${au(V.raf)}.` };
  await prisma.deliverable.update({ where: { id }, data: { done, doneAt: done ? new Date() : null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// « Préparer {année} » (ex-séminaire, EF-A5, EF-H4 ; spec vocabulaire-gouvernance § 3) : pour chaque projet, la décision
// (reconduire, ajuster, arrêter) est consignée comme une Decision datée sur l'année source — plus dans codirDecision —, puis
// l'année suivante est créée par la même reconduction que renewEdition. « Arrêté » ne range le projet (archivé) que si la
// case de confirmation est cochée (`archive`). Qui : le CODIR seulement.
export async function batchCreateEditions(year: number, decisions: { editionId: string; decision: PrepareChoice; archive?: boolean }[], chosenInstance?: string | null): Promise<Result<{ created: number; stopped: number; skipped: string[] }>> {
  const me = await getCurrentPerson();
  if (!isCodir(me)) return { ok: false, error: `La création en série est réservée ${au(V.codir)}.` };
  if (!Number.isInteger(year) || !Array.isArray(decisions)) return { ok: false, error: "Demande invalide." };
  const instance = prepareInstance(Object.keys((await getRefs()).decision_instance ?? {}), typeof chosenInstance === "string" ? chosenInstance : null);
  if (!instance) return { ok: false, error: "Aucune instance de décision : ajoutez-en une dans Admin › Référentiels." };
  let created = 0, stopped = 0;
  const skipped: string[] = [];
  for (const d of decisions) {
    if (!d || typeof d.editionId !== "string" || !isPrepareChoice(d.decision)) continue;
    const src = await renewSource(d.editionId);
    if (!src) continue;
    if (d.decision !== "stop" && (await prisma.edition.findUnique({ where: { projectId_year: { projectId: src.projectId, year } }, select: { id: true } }))) {
      skipped.push(`${src.project.name} : ${le(V.edition)} ${year} existe déjà.`);
      continue;
    }
    const body = prepareDecisionBody(d.decision, year);
    try {
      // Frontière de transaction, par projet : la décision consignée (et son historique), puis la reconduction ou le rangement.
      await prisma.$transaction(async (tx) => {
        await tx.decision.create({ data: { editionId: src.id, instance, body, authorId: me.id } });
        await tx.changeLog.create({ data: { editionId: src.id, field: "décision", before: null, after: `${instance} : ${body}`, authorId: me.id } });
        if (d.decision === "stop") {
          if (d.archive === true) await tx.project.update({ where: { id: src.projectId }, data: { archived: true } });
          return;
        }
        await renewInTx(tx, me.id, src, { year, status: d.decision === "adjust" ? "rechallenged" : "proposed" });
      }, { timeout: 20_000 });
    } catch (e) {
      skipped.push(`${src.project.name} : ${reportInternalError("batchCreateEditions", e).error}`);
      continue;
    }
    if (d.decision === "stop") stopped++;
    else created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { created, stopped, skipped } };
}

// Dépense sans devis lié (RAF) : référence obligatoire, pour ne pas confondre avec un montant global importé. Action
// facultative (26/09) : du projet, et qui court l'année — même règle que saveField (expense.actionId).
export async function addExpense(editionId: string, label: string, spent: number, reference: string, actionId?: string | null): Promise<Result> {
  const c = await ctx(editionId);
  if (!canEditFunding(c.me)) return { ok: false, error: `${cap(seul(V.raf))} (ou ${le(V.direction)}) enregistre une dépense.` };
  if (!reference.trim()) return { ok: false, error: "Une référence (facture, ligne du suivi) est requise." };
  if (actionId && !(await actionRunsInEdition(actionId, editionId))) return { ok: false, error: `${cap(V.action)} introuvable sur ${ce(V.edition)}.` };
  await prisma.expense.create({ data: { editionId, label: label.trim() || "Dépense", committed: 0, spent: Math.max(0, spent), reference: reference.trim(), status: "closed", actionId: actionId || null } });
  revalidatePath(path(editionId));
  return { ok: true };
}

// Décision d'instance consignée sur l'édition, datée, avec suite éventuelle (EF-F4, EF-H2, EF-H3).
export async function recordDecision(input: { editionId: string; instance: string; body: string; followUpId?: string | null; dueDate?: string | null; alertKind?: string | null }): Promise<Result> {
  const c = await ctx(input.editionId);
  const allowed = canConsignDecision(c.me, c.samePole, input.instance);
  if (!allowed) return { ok: false, error: `Les décisions d'instance sont consignées par ${le(V.codir)}.` };
  if (!input.body.trim()) return { ok: false, error: "Décision vide." };
  await prisma.decision.create({
    // Une décision peut régler une alerte de l'édition (dépassement accepté, jalon reporté…) : elle s'éteint dans la bande d'état (revue du 15/09).
    data: { editionId: input.editionId, instance: input.instance, body: input.body.trim(), authorId: c.me.id, followUpId: input.followUpId || null, dueDate: input.dueDate ? new Date(input.dueDate) : null, alertKind: input.alertKind || null },
  });
  await prisma.changeLog.create({ data: { editionId: input.editionId, field: "décision", before: null, after: `${input.instance} : ${input.body.trim().slice(0, 200)}`, authorId: c.me.id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Conventions partagées (EF-C3) : création, rattachement d'une ligne, nouvelle ligne depuis une convention existante.
export async function createConvention(input: { funderId: string; reference: string; scheme?: string; startYear: number; endYear: number; amountNotified?: number | null; form?: string | null }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: `${cap(seul(V.raf))} (ou ${le(V.direction)}) enregistre un financement obtenu.` };
  const reference = input.reference.trim();
  if (!reference) return { ok: false, error: "Référence obligatoire (ex. FSE-2026-2028)." };
  if (await prisma.convention.findUnique({ where: { reference } })) return { ok: false, error: `La référence « ${reference} » existe déjà : rattachez le financement existant.` };
  if (input.endYear < input.startYear) return { ok: false, error: "La fin précède le début." };
  // Enregistré directement comme obtenu (lot 2 du 19/09) : un dossier encore en cours s'ouvre dans « Dossiers de financement ».
  const c = await prisma.convention.create({ data: { funderId: input.funderId, reference, scheme: input.scheme?.trim() || null, startYear: input.startYear, endYear: input.endYear, amountNotified: input.amountNotified ?? null, status: "notified", form: input.form || "convention", notifiedAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: c.id } };
}

// Détacher une affectation depuis la convention : la ligne redevient un financement annuel propre à l'édition ;
// si elle est vide (ni montant, ni livrable, ni pièce), elle est supprimée.
export async function detachFundingLineFromConvention(lineId: string): Promise<Result<{ deleted: boolean }>> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: `${cap(seul(V.raf))} (ou ${le(V.direction)}) modifie les affectations.` };
  const line = await prisma.fundingLine.findUnique({ where: { id: lineId }, include: { deliverables: true, attachments: true, actions: true, actionFundings: true, payments: true } });
  if (!line || !line.conventionId) return { ok: false, error: "Affectation introuvable." };
  // Un paiement est un usage métier, même attendu : ne jamais supprimer la
  // ligne parente et laisser la FK Cascade effacer son historique financier.
  const empty = detachedLineIsEmpty(line);
  if (empty) await prisma.fundingLine.delete({ where: { id: lineId } });
  else await prisma.fundingLine.update({ where: { id: lineId }, data: { conventionId: null } });
  revalidatePath("/", "layout");
  return { ok: true, data: { deleted: empty } };
}

export async function addFundingLineFromConvention(editionId: string, conventionId: string): Promise<Result> {
  const c = await ctx(editionId);
  if (!canEditFunding(c.me)) return { ok: false, error: `${cap(seul(V.raf))} (ou ${le(V.direction)}) ajoute une ligne de financement.` };
  const conv = await prisma.convention.findUnique({ where: { id: conventionId } });
  if (!conv) return { ok: false, error: "Convention introuvable" };
  if (!conventionCovers(conv, c.e.year)) return { ok: false, error: `Cette convention couvre ${conv.startYear}-${conv.endYear}, pas ${c.e.year}.` };
  if (await prisma.fundingLine.findFirst({ where: { editionId, conventionId } })) return { ok: false, error: `${cap(ce(V.edition))} est déjà rattachée à cette convention.` };
  const status = ["notified", "contracted", "justified"].includes(conv.status) ? "contracted" : conv.status;
  const multiYear = conv.endYear > conv.startYear;
  const existing = reusableLine(await prisma.fundingLine.findMany({ where: { editionId, funderId: conv.funderId, conventionId: null } }), conv.funderId);
  // Frontière de transaction : la ligne (reprise ou créée) et ses liens aux actions du projet déjà financées par ce dossier
  // qui courent cette année-là (linkNewLineToRunningActions) — jamais une ligne rattachée sans ses actions.
  const res = await prisma.$transaction(async (tx): Promise<Result> => {
    let line: { id: string; conventionId: string | null; editionId: string };
    if (existing) {
      // La ligne reprise compte aussitôt dans les affectations : même plafond que si on saisissait son montant obtenu.
      const lines = await tx.fundingLine.findMany({ where: { conventionId }, select: { id: true, amountGranted: true, amountRequested: true } });
      const check = allocationCheck({ amountNotified: conv.amountNotified, amountRequested: conv.amountRequested, lines }, existing.id, existing.amountGranted);
      if (!check.ok) return check;
      line = await tx.fundingLine.update({ where: { id: existing.id }, data: { conventionId, scheme: existing.scheme ?? conv.scheme, status, multiYear } });
    } else {
      line = await tx.fundingLine.create({ data: { editionId, funderId: conv.funderId, conventionId, scheme: conv.scheme, status, multiYear } });
    }
    await linkNewLineToRunningActions(tx, line);
    return { ok: true };
  });
  if (!res.ok) return res;
  // Le layout : les actions liées (page de l'action, autres années du projet) changent aussi.
  revalidatePath("/", "layout");
  return { ok: true };
}

// Proposition de projet par tout chargé de mission (retour du 14/09 ; S12 : « fais-moi une fiche projet »). Un projet « en devenir » :
// première édition en statut proposée, le proposant en pilote, son pôle, le responsable de pôle en garant. Le cycle relecture →
// validation → CA se fait ensuite sur la fiche.
export async function proposeProject(input: { name: string; missionId: string; year: number; summary: string; poleId?: string | null }): Promise<Result<{ editionId: string }>> {
  const me = await getCurrentPerson();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Donnez un nom au projet." };
  if (!input.summary.trim()) return { ok: false, error: "Dites en quelques lignes ce que vous proposez." };
  const mission = await prisma.mission.findUnique({ where: { id: input.missionId } });
  if (!mission) return { ok: false, error: "Mission introuvable." };
  const poleId = input.poleId || me.poleId;
  if (!poleId) return { ok: false, error: `Choisissez ${le(V.pole)} qui portera le projet.` };
  const pole = await prisma.pole.findUnique({ where: { id: poleId } });
  if (!pole) return { ok: false, error: `${cap(V.pole)} introuvable.` };
  if (![2026, 2027, 2028].includes(input.year) && (input.year < new Date().getFullYear() || input.year > new Date().getFullYear() + 2)) return { ok: false, error: "Année hors de portée." };
  const n = (await prisma.project.count({ where: { analyticCode: { startsWith: "PROP-" } } })) + 1;
  const p = await prisma.project.create({ data: { name, analyticCode: `PROP-${String(n).padStart(2, "0")}`, poleId, pilotId: me.id, guarantorId: pole.leadId ?? null, missionId: mission.id, recurring: false } });
  const e = await prisma.edition.create({ data: { projectId: p.id, year: input.year, status: "proposed", operationalObjectives: input.summary.trim(), team: { create: [{ personId: me.id }] }, personDays: { create: [{ personId: me.id, soldDays: 0 }] } } });
  await prisma.changeLog.create({ data: { editionId: e.id, field: "status", before: null, after: `Projet proposé par ${me.name}`, authorId: me.id } });
  const recipients = new Set<string>();
  if (pole.leadId && pole.leadId !== me.id) recipients.add(pole.leadId);
  const director = await prisma.person.findFirst({ where: { role: "director", active: true } });
  if (director && director.id !== me.id) recipients.add(director.id);
  await prisma.notification.createMany({ data: [...recipients].map((personId) => ({ personId, senderId: me.id, kind: "info", title: `Nouveau projet proposé : ${name}`, body: `${me.name} propose « ${name} » pour ${input.year} (${pole.name}). La fiche attend votre relecture.`, link: `/edition/${e.id}?onglet=fiche` })) });
  revalidatePath("/", "layout");
  return { ok: true, data: { editionId: e.id } };
}
