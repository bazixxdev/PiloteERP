"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { canDecideValidation, canEditActions, canEditFunding, canWriteLayer, requiredLevelFor } from "@/lib/rights";
import { dayjs } from "@/lib/format";
import { budgetOf } from "@/lib/budget";
import { inMyPole } from "@/lib/scope";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function ctx(editionId: string) {
  const me = await getCurrentPerson();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { project: { include: { secondaryPoles: true } }, team: true, expenses: true } });
  if (!e) throw new Error("Édition introuvable");
  return { me, e, isPilot: e.project.pilotId === me.id, isTeam: e.team.some((t) => t.personId === me.id), samePole: inMyPole(me, e.project) };
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
export async function requestValidation(input: { editionId: string; actionId?: string | null; kind: string; label: string; amount?: number | null; attachmentUrl?: string | null; requiredLevel?: number | null; targetDelayDays?: number; supplier?: string | null; supplierEmail?: string | null; supplierId?: string | null; saveSupplier?: boolean }): Promise<Result<{ id: string; requiredLevel: number }>> {
  const c = await ctx(input.editionId);
  const settings = await getSettings();
  const remaining = budgetOf(c.e).available;
  const computed = requiredLevelFor(input.amount, settings, remaining);
  const level = input.requiredLevel ?? computed;
  // Base fournisseurs (15/09) : fournisseur choisi dans la base, ou nouveau nom ajouté si demandé ; le nom et l'adresse restent copiés sur la demande.
  let supplierId = input.supplierId || null;
  const supplierName = input.supplier?.trim() || null;
  if (!supplierId && supplierName && input.saveSupplier) {
    const existing = (await prisma.supplier.findMany({ where: { name: { contains: supplierName } } })).find((x) => x.name.toLowerCase() === supplierName.toLowerCase());
    supplierId = (existing ?? (await prisma.supplier.create({ data: { name: supplierName, email: input.supplierEmail?.trim() || null } }))).id;
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

// Niveau requis et sa raison, en clair, pour que le demandeur sache à qui part sa demande et pourquoi.
export async function explainRequiredLevel(editionId: string, amount: number | null): Promise<{ level: number; reason: string }> {
  const settings = await getSettings();
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { expenses: true } });
  const remaining = e ? budgetOf(e).available : null;
  const level = requiredLevelFor(amount, settings, remaining);
  const euro = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const a = amount ?? 0;
  const reason =
    remaining !== null && remaining < 0 ? `enveloppe déjà dépassée de ${euro(-remaining)} : toute dépense passe par la direction`
    : remaining !== null && a > remaining ? `montant supérieur au reste de l'enveloppe (${euro(remaining)})`
    : a > settings.validationThresholdLevel2 ? `montant supérieur au seuil de niveau 3 (${euro(settings.validationThresholdLevel2)})`
    : a > settings.validationThresholdLevel1 ? `montant supérieur au seuil de niveau 2 (${euro(settings.validationThresholdLevel1)})`
    : a > 0 ? `montant sous le seuil de niveau 2 (${euro(settings.validationThresholdLevel1)})` : "sans montant : validation du pilote";
  return { level, reason };
}

// Décision : le devis approuvé remonte dans l'engagé de l'édition (EF-E2).
export async function decideValidation(id: string, decision: "approved" | "refused", comment: string): Promise<Result> {
  const me = await getCurrentPerson();
  const v = await prisma.validationRequest.findUnique({ where: { id }, include: { edition: { include: { project: { include: { secondaryPoles: true } } } } } });
  if (!v) return { ok: false, error: "Demande introuvable" };
  if (v.status !== "pending") return { ok: false, error: "Cette demande est déjà traitée." };
  if (!canDecideValidation(me, v)) return { ok: false, error: `Cette demande requiert le niveau ${v.requiredLevel} sur ce projet : vous ne pouvez pas la décider.` };
  // Une seule décision, même en cas de double clic : la mise à jour ne passe que si la demande est encore en attente.
  const changed = await prisma.validationRequest.updateMany({ where: { id, status: "pending" }, data: { status: decision, deciderId: me.id, decidedAt: new Date(), decisionComment: comment.trim() || null } });
  if (changed.count === 0) return { ok: false, error: "Cette demande vient d'être traitée par quelqu'un d'autre." };
  if (decision === "approved" && (v.kind === "quote" || v.kind === "expense") && v.amount) {
    // Le devis approuvé crée l'engagement une seule fois (validationId unique) ; le réalisé viendra s'y rattacher.
    await prisma.expense.upsert({ where: { validationId: v.id }, create: { editionId: v.editionId, label: v.label, supplier: v.supplier, committed: v.amount, validationId: v.id }, update: {} });
    await prisma.changeLog.create({ data: { editionId: v.editionId, field: "engagement", before: null, after: `+${v.amount} € (${v.label})`, authorId: me.id } });
  }
  // Lot 3 : le demandeur est prévenu ; pour un devis approuvé, le « bon pour accord » est prêt à envoyer (plus d'impression ni de tampon).
  const isQuote = v.kind === "quote" || v.kind === "expense";
  if (v.requesterId !== me.id) {
    await prisma.notification.create({ data: { personId: v.requesterId, senderId: me.id, kind: "info", title: `${decision === "approved" ? "Approuvée" : "Refusée"} : ${v.label}`, body: decision === "approved" && isQuote ? "Bon pour accord prêt à envoyer au fournisseur." : comment.trim() || null, link: decision === "approved" && isQuote ? `/validations/${v.id}/bon-pour-accord` : `/edition/${v.editionId}?onglet=apercu` } });
  }
  // La directrice voit tout ce qui s'engage sans elle : information, pas validation (retour du 14/09).
  if (decision === "approved" && me.role !== "director" && v.amount) {
    const director = await prisma.person.findFirst({ where: { role: "director", active: true } });
    if (director && director.id !== v.requesterId) await prisma.notification.create({ data: { personId: director.id, senderId: me.id, kind: "info", title: `Pour information · ${v.label} approuvé (${v.amount} €)`, body: `Par ${me.name}, niveau ${v.requiredLevel}.`, link: `/edition/${v.editionId}?onglet=budget` } });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Reconduction N → N+1 (EF-A2) : couches 1 à 3, actions, financements, équipe ; couche 4, budget, temps et bilan vidés.
export async function renewEdition(editionId: string): Promise<Result<{ id: string }>> {
  const c = await ctx(editionId);
  if (!["director", "raf", "pole_lead"].includes(c.me.role) && !c.isPilot) return { ok: false, error: "Seuls le pilote, le responsable de pôle, la RAF et la direction reconduisent une édition." };
  const src = await prisma.edition.findUnique({ where: { id: editionId }, include: { actions: true, fundingLines: { include: { convention: true } }, team: true, personDays: true, indicators: true, docLinks: true } });
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
      personDays: { create: src.personDays.map((p) => ({ personId: p.personId, soldDays: p.soldDays, plannedDays: p.plannedDays })) },
      indicators: { create: src.indicators.map((i) => ({ label: i.label, target: i.target, imposed: i.imposed, order: i.order })) },
      docLinks: { create: src.docLinks.map((d) => ({ label: d.label, url: d.url, codirOnly: d.codirOnly })) },
      actions: {
        create: src.actions.map((a) => ({
          name: a.name, ownerId: a.ownerId, timeTarget: a.timeTarget, order: a.order, state: "todo",
          milestoneDate: a.milestoneDate ? dayjs(a.milestoneDate).add(1, "year").toDate() : null,
        })),
      },
      fundingLines: {
        // Une convention qui couvre l'année suivante reste rattachée (montants à affecter) ; un financement annuel repart « à déposer ».
        create: src.fundingLines.map((f) => {
          const keeps = f.convention && f.convention.startYear <= year && year <= f.convention.endYear;
          return {
            funderId: f.funderId, scheme: f.scheme, analyticCode: f.analyticCode, allocationKeyRef: f.allocationKeyRef, multiYear: f.multiYear, notes: f.notes,
            conventionId: keeps ? f.conventionId : null,
            status: keeps && ["notified", "contracted", "justified"].includes(f.convention!.status) ? "contracted" : "to_submit",
          };
        }),
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


// Dépense sans devis lié (RAF) : référence obligatoire, pour ne pas confondre avec un montant global importé.
export async function addExpense(editionId: string, label: string, spent: number, reference: string): Promise<Result> {
  const c = await ctx(editionId);
  if (!canEditFunding(c.me.role)) return { ok: false, error: "Seule la RAF (ou la direction) enregistre une dépense." };
  if (!reference.trim()) return { ok: false, error: "Une référence (facture, ligne du suivi) est requise." };
  await prisma.expense.create({ data: { editionId, label: label.trim() || "Dépense", committed: 0, spent: Math.max(0, spent), reference: reference.trim(), status: "closed" } });
  revalidatePath(path(editionId));
  return { ok: true };
}

// Décision d'instance consignée sur l'édition, datée, avec suite éventuelle (EF-F4, EF-H2, EF-H3).
export async function recordDecision(input: { editionId: string; instance: string; body: string; followUpId?: string | null; dueDate?: string | null; alertKind?: string | null }): Promise<Result> {
  const c = await ctx(input.editionId);
  const allowed = ["director", "raf"].includes(c.me.role) || (c.me.role === "pole_lead" && (input.instance !== "codir" ? c.samePole : true));
  if (!allowed) return { ok: false, error: "Les décisions d'instance sont consignées par le CODIR." };
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
export async function createConvention(input: { funderId: string; reference: string; scheme?: string; startYear: number; endYear: number; amountNotified?: number | null }): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: "Seule la RAF (ou la direction) crée une convention." };
  const reference = input.reference.trim();
  if (!reference) return { ok: false, error: "Référence obligatoire (ex. FSE-2026-2028)." };
  if (await prisma.convention.findUnique({ where: { reference } })) return { ok: false, error: `La référence « ${reference} » existe déjà : rattachez la convention existante.` };
  if (input.endYear < input.startYear) return { ok: false, error: "La fin précède le début." };
  const c = await prisma.convention.create({ data: { funderId: input.funderId, reference, scheme: input.scheme?.trim() || null, startYear: input.startYear, endYear: input.endYear, amountNotified: input.amountNotified ?? null, status: input.amountNotified ? "notified" : "to_submit" } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: c.id } };
}

// Détacher une affectation depuis la convention : la ligne redevient un financement annuel propre à l'édition ;
// si elle est vide (ni montant, ni livrable, ni pièce), elle est supprimée.
export async function detachFundingLineFromConvention(lineId: string): Promise<Result<{ deleted: boolean }>> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me.role)) return { ok: false, error: "Seule la RAF (ou la direction) modifie les affectations." };
  const line = await prisma.fundingLine.findUnique({ where: { id: lineId }, include: { deliverables: true, attachments: true, actions: true } });
  if (!line || !line.conventionId) return { ok: false, error: "Affectation introuvable." };
  const empty = !line.amountRequested && !line.amountGranted && line.deliverables.length === 0 && line.attachments.length === 0 && line.actions.length === 0;
  if (empty) await prisma.fundingLine.delete({ where: { id: lineId } });
  else await prisma.fundingLine.update({ where: { id: lineId }, data: { conventionId: null } });
  revalidatePath("/", "layout");
  return { ok: true, data: { deleted: empty } };
}

export async function addFundingLineFromConvention(editionId: string, conventionId: string): Promise<Result> {
  const c = await ctx(editionId);
  if (!canEditFunding(c.me.role)) return { ok: false, error: "Seule la RAF (ou la direction) ajoute une ligne de financement." };
  const conv = await prisma.convention.findUnique({ where: { id: conventionId } });
  if (!conv) return { ok: false, error: "Convention introuvable" };
  if (c.e.year < conv.startYear || c.e.year > conv.endYear) return { ok: false, error: `Cette convention couvre ${conv.startYear}-${conv.endYear}, pas ${c.e.year}.` };
  if (await prisma.fundingLine.findFirst({ where: { editionId, conventionId } })) return { ok: false, error: "Cette édition est déjà rattachée à cette convention." };
  await prisma.fundingLine.create({ data: { editionId, funderId: conv.funderId, conventionId, scheme: conv.scheme, status: ["notified", "contracted", "justified"].includes(conv.status) ? "contracted" : conv.status, multiYear: conv.endYear > conv.startYear } });
  revalidatePath(path(editionId));
  return { ok: true };
}

// Dupliquer une action (occurrences : petits-déjeuners, forums SPRO) : même contenu, lieu, participants et objectif ; jalon vidé, état « à faire ».
export async function duplicateAction(actionId: string): Promise<Result<{ id: string }>> {
  const a = await prisma.action.findUnique({ where: { id: actionId } });
  if (!a) return { ok: false, error: "Action introuvable." };
  const c = await ctx(a.editionId);
  if (!canEditActions(c.me.role, c.isPilot, c.isTeam, c.samePole) && a.ownerId !== c.me.id) return { ok: false, error: "Vous ne pouvez pas dupliquer cette action." };
  const count = await prisma.action.count({ where: { editionId: a.editionId } });
  const d = await prisma.action.create({ data: { editionId: a.editionId, name: `${a.name} (copie)`, ownerId: a.ownerId, timeTarget: a.timeTarget, fundingLineId: a.fundingLineId, description: a.description, venue: a.venue, participants: a.participants, isPublic: a.isPublic, order: count } });
  revalidatePath(path(a.editionId));
  return { ok: true, data: { id: d.id } };
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
  if (!poleId) return { ok: false, error: "Choisissez le pôle qui portera le projet." };
  const pole = await prisma.pole.findUnique({ where: { id: poleId } });
  if (!pole) return { ok: false, error: "Pôle introuvable." };
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
