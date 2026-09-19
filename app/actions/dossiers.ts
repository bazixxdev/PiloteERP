"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { ALLOWED_MIME, MAX_ATTACHMENT_BYTES, UPLOAD_DIR } from "@/lib/attachments";
import { findOrCreateOrganisation } from "@/lib/organisations";
import { suggestedReference } from "@/lib/calls";
import { TRANSITIONS, isWon } from "@/lib/dossiers";
import { REF_DEFAULTS } from "@/lib/refs";
import { V, le } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const DENIED = `Un dossier de financement se tient par ${le(V.raf)} ou ${le(V.direction)} (droit « Gère les financements »).`;
const clean = (v: unknown) => { const s = v == null ? "" : String(v).trim(); return s || null; };

async function uniqueReference(base: string): Promise<string> {
  let reference = base;
  for (let i = 2; await prisma.convention.findUnique({ where: { reference } }); i++) reference = `${base}-${i}`;
  return reference;
}

export type DossierInput = { funderId?: string | null; funderName?: string | null; label: string; scheme?: string | null; description?: string | null; amountRequested?: number | string | null; amountKind?: string; startYear: number | string; endYear?: number | string | null; deadline?: string | null; targetProjectId?: string | null; ownerId?: string | null; status?: string };

// Ouvrir un dossier : un financeur (de l'annuaire, ou créé par son nom), un intitulé, ce qu'on vise ; statut « à étudier ».
export async function createDossier(input: DossierInput): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: DENIED };
  const label = clean(input.label); if (!label) return { ok: false, error: "Donnez un intitulé au dossier." };
  let funderId = input.funderId || null;
  if (!funderId && clean(input.funderName)) funderId = (await findOrCreateOrganisation(input.funderName!, "funder")).id;
  if (!funderId) return { ok: false, error: "Choisissez le financeur, ou donnez son nom." };
  const funder = await prisma.organisation.findUnique({ where: { id: funderId } });
  if (!funder) return { ok: false, error: "Financeur introuvable." };
  const startYear = Number(input.startYear) || new Date().getFullYear();
  const endYear = input.endYear ? Number(input.endYear) : startYear;
  if (endYear < startYear) return { ok: false, error: "La fin précède le début." };
  const amount = input.amountRequested != null && String(input.amountRequested).trim() ? Number(String(input.amountRequested).replace(",", ".")) : null;
  const status = input.status && ["study", "drafting"].includes(input.status) ? input.status : "study";
  const reference = await uniqueReference(suggestedReference(funder.name, startYear));
  const c = await prisma.convention.create({ data: { funderId, reference, label, scheme: clean(input.scheme), description: clean(input.description), startYear, endYear, status, amountRequested: amount != null && Number.isFinite(amount) ? amount : null, amountKind: input.amountKind === "annual" ? "annual" : "total", deadline: input.deadline ? new Date(input.deadline) : null, targetProjectId: input.targetProjectId || null, ownerId: input.ownerId || null } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: c.id } };
}

// Qui aide (19/09) : des personnes de l'équipe, choisies — plus un texte libre pour l'extérieur. Réservé à qui tient les financements.
export async function setDossierHelpers(id: string, personIds: string[]): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: DENIED };
  if (!(await prisma.convention.findUnique({ where: { id } }))) return { ok: false, error: "Dossier introuvable." };
  const ids = Array.from(new Set(personIds.filter(Boolean)));
  const known = (await prisma.person.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id);
  await prisma.$transaction([
    prisma.conventionHelper.deleteMany({ where: { conventionId: id } }),
    ...(known.length ? [prisma.conventionHelper.createMany({ data: known.map((personId) => ({ conventionId: id, personId })) })] : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

// Changer d'étape : seulement les passages prévus ; écarté / refusé demandent le pourquoi ; obtenu demande la forme et le montant.
export async function setDossierStatus(id: string, to: string, extra: { reason?: string | null; form?: string | null; amountNotified?: number | string | null } = {}): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: DENIED };
  const c = await prisma.convention.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Dossier introuvable." };
  const t = (TRANSITIONS[c.status] ?? []).find((x) => x.to === to);
  if (!t) return { ok: false, error: `Passage impossible depuis « ${c.status} »." ` };
  const data: Record<string, unknown> = { status: to };
  const now = new Date();
  if (t.ask === "reason") { const r = clean(extra.reason); if (!r) return { ok: false, error: "Dites pourquoi : c'est ce qui reste dans l'historique." }; data.decisionNote = r; data.decidedAt = now; }
  if (to === "submitted") data.submittedAt = c.submittedAt ?? now;
  if (to === "notified") {
    const form = clean(extra.form);
    if (!form || !REF_DEFAULTS.funding_form.some((f) => f.code === form)) return { ok: false, error: "Dites sous quelle forme le financement est obtenu (convention, arrêté, lettre…)." };
    const n = extra.amountNotified != null && String(extra.amountNotified).trim() ? Number(String(extra.amountNotified).replace(",", ".")) : null;
    data.form = form; data.notifiedAt = c.notifiedAt ?? now; data.decidedAt = now;
    if (n != null && Number.isFinite(n)) data.amountNotified = n;
  }
  if (to === "contracted") data.signedAt = c.signedAt ?? now;
  if (to === "study") { data.decisionNote = null; data.decidedAt = null; }
  await prisma.convention.update({ where: { id }, data });
  // L'appel d'origine suit : dossier écarté = appel écarté ; dossier repris = « on dépose ».
  const call = await prisma.call.findFirst({ where: { conventionId: id } });
  if (call) await prisma.call.update({ where: { id: call.id }, data: { teamStatus: to === "dismissed" ? "dismissed" : isWon(to) || to === "submitted" || to === "drafting" ? "apply" : "study", statusById: me.id, statusAt: now } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Pièces d'un dossier (cahier des charges, réponse déposée, notification, convention signée).
export async function uploadDossierFile(form: FormData): Promise<Result> {
  const me = await getCurrentPerson();
  if (!canEditFunding(me)) return { ok: false, error: DENIED };
  const conventionId = String(form.get("conventionId") ?? "");
  if (!(await prisma.convention.findUnique({ where: { id: conventionId } }))) return { ok: false, error: "Dossier introuvable." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier." };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "Pièce trop lourde (5 Mo au plus)." };
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.includes(mime)) return { ok: false, error: "Format non accepté : PDF, image, Word, Excel ou texte." };
  const storedName = `${randomBytes(12).toString("hex")}${path.extname(file.name).toLowerCase().slice(0, 8)}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()));
  await prisma.attachment.create({ data: { conventionId, kind: String(form.get("kind") ?? "other"), label: String(form.get("label") ?? "").trim() || file.name, fileName: file.name, storedName, mimeType: mime, size: file.size, uploadedById: me.id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Tâches et notes du dossier : des tâches ordinaires (à leur auteur) et des notes ordinaires, rattachées au dossier.
export async function addDossierTask(conventionId: string, label: string, dueDate?: string | null): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const l = clean(label); if (!l) return { ok: false, error: "Écrivez la tâche." };
  if (!(await prisma.convention.findUnique({ where: { id: conventionId } }))) return { ok: false, error: "Dossier introuvable." };
  const t = await prisma.task.create({ data: { personId: me.id, label: l, dueDate: dueDate ? new Date(dueDate) : null, conventionId } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: t.id } };
}

export async function toggleDossierTask(id: string, done: boolean): Promise<Result> {
  const me = await getCurrentPerson();
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t || !t.conventionId) return { ok: false, error: "Tâche introuvable." };
  if (t.personId !== me.id && !canEditFunding(me)) return { ok: false, error: "Cette tâche est à quelqu'un d'autre." };
  await prisma.task.update({ where: { id }, data: { done, doneAt: done ? new Date() : null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addDossierNote(conventionId: string, title: string, body: string): Promise<Result<{ id: string }>> {
  const me = await getCurrentPerson();
  const b = clean(body); const t = clean(title) ?? "Note du dossier";
  if (!b) return { ok: false, error: "Écrivez la note." };
  if (!(await prisma.convention.findUnique({ where: { id: conventionId } }))) return { ok: false, error: "Dossier introuvable." };
  const n = await prisma.note.create({ data: { authorId: me.id, title: t, body: b, context: "other", conventionId, visibility: "all" } });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: n.id } };
}
