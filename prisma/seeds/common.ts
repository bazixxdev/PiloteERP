// Tronc commun de toute instance (lot I) : la base vidée, les Settings du client, les référentiels, les rôles, les rythmes et le
// mot de passe de démo (DEMO_PASSWORD, « pilote-demo-2026 »). Pour la CRESS, le résultat est identique au seed d'avant le découpage.
import { PrismaClient, type Prisma, type Rhythm } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { client } from "../../config/clients";
import { REF_DEFAULTS } from "../../lib/refs";
import { DEFAULT_ROLES, serializePermissions } from "../../lib/permissions";
import { DEFAULT_RHYTHMS } from "../../lib/time";
import { V, cap, le } from "../../lib/vocab";

export type Common = {
  passwordHash: string;
  rhythms: Rhythm[];
  rhythmByCode: (code: string) => Rhythm;
  emailOf: (name: string) => string;
};

// Règles de saisie affichées dans l'admin et sur la grille des temps ; le client peut les réécrire.
export const TIME_RULES = `Chaque salarié·e saisit ses heures chaque semaine, au plus tard le lundi suivant. Les réunions transverses (café du lundi, réunion d'équipe) vont sur « Fonctionnement ». Les congés et absences vont sur « Non travaillé ». ${cap(le(V.raf))} verrouille le mois dans les dix jours qui suivent.`;

export async function reset(prisma: PrismaClient, uploads: string) {
  // Budget prévisionnel (25/09) : ses lignes et saisies manuelles partent avec les éditions ; les catégories restent (migration).
  await prisma.budgetActualOverride.deleteMany();
  await prisma.budgetLine.deleteMany();
  // Délégations (25/09) : elles tiennent à des personnes (Restrict) ; elles partent avant elles.
  await prisma.delegation.deleteMany();
  // Circuit de validation (26/09) : les décisions tiennent à des personnes et à des niveaux (Restrict) ; les niveaux sont reposés
  // par seedCommon, comme la migration 20260927090000 les pose.
  await prisma.ficheValidation.deleteMany();
  await prisma.ficheValidationLevel.deleteMany();
  await prisma.mailOutbox.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.ledgerLine.deleteMany();
  await prisma.ledgerImport.deleteMany();
  await prisma.analyticTag.deleteMany();
  await prisma.call.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.fieldRemark.deleteMany();
  await prisma.plannedLoad.deleteMany();
  await prisma.workSlot.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskList.deleteMany();
  await prisma.note.deleteMany();
  await prisma.changeProposal.deleteMany();
  await prisma.request.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.loadFreeze.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.cashRule.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.contactListItem.deleteMany();
  await prisma.contactList.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.editionPartner.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.weekDeclaration.deleteMany();
  await prisma.personRhythmPeriod.deleteMany();
  await prisma.rhythm.deleteMany();
  try { for (const f of readdirSync(uploads)) if (f.endsWith(".pdf")) unlinkSync(path.join(uploads, f)); } catch { /* dossier absent */ }
  await prisma.changeLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.docLink.deleteMany();
  await prisma.indicator.deleteMany();
  await prisma.validationRequest.deleteMany();
  await prisma.monthLock.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.action.deleteMany();
  await prisma.fundingLine.deleteMany();
  await prisma.editionPersonDays.deleteMany();
  await prisma.convention.deleteMany();
  await prisma.editionTeam.deleteMany();
  await prisma.edition.deleteMany();
  await prisma.project.deleteMany();
  await prisma.personTimeCode.deleteMany();
  await prisma.projectPole.deleteMany();
  await prisma.pole.updateMany({ data: { leadId: null } });
  await prisma.person.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.pole.deleteMany();
  await prisma.timeCode.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.refValue.deleteMany();
  await prisma.settings.deleteMany();
}

export async function seedCommon(prisma: PrismaClient, uploads: string): Promise<Common> {
  await reset(prisma, uploads);

  await prisma.settings.create({
    data: {
      id: 1,
      teamIcsToken: randomBytes(18).toString("base64url"),
      apiToken: randomBytes(18).toString("base64url"),
      serverPathTemplate: client.settings.serverPathTemplate,
      billingEmail: client.settings.billingEmail,
      modules: client.modules,
      timeRules:
        TIME_RULES,
    },
  });

  for (const [family, defs] of Object.entries(REF_DEFAULTS)) {
    await prisma.refValue.createMany({ data: defs.map((v, i) => ({ family, code: v.code, label: v.label, color: v.color ?? null, order: i })) });
  }
  // Rôles et droits (lot F2) : les six rôles système avec les droits du prototype.
  await prisma.role.createMany({ data: DEFAULT_ROLES.map((r, i) => ({ code: r.code, label: r.label, description: r.description, order: i, system: true, validationLevel: r.validationLevel, permissions: serializePermissions(r.permissions) })) });
  // Circuit de validation de la fiche (26/09) : les deux niveaux et leurs droits, exactement comme la migration
  // 20260927090000_actions_composantes (niveau 1 pour qui avait « fiche.validation », niveau 2 pour la direction). Droits
  // ajoutés tels quels : serializePermissions les filtrerait tant que le catalogue (lib/permissions.ts) ne les connaît pas.
  await prisma.ficheValidationLevel.createMany({ data: [
    { id: "fvl_1", order: 1, label: "Direction", permission: "fiche.validate.1", active: true },
    { id: "fvl_2", order: 2, label: "CA", permission: "fiche.validate.2", active: true },
  ] });
  for (const r of await prisma.role.findMany()) {
    const keys = r.permissions ? r.permissions.split(",") : [];
    if (keys.includes("fiche.validation") && !keys.includes("fiche.validate.1")) keys.push("fiche.validate.1");
    if (r.code === "director" && !keys.includes("fiche.validate.2")) keys.push("fiche.validate.2");
    if (keys.join(",") !== r.permissions) await prisma.role.update({ where: { code: r.code }, data: { permissions: keys.join(",") } });
  }
  const rhythms = await Promise.all(DEFAULT_RHYTHMS.map((r, i) => prisma.rhythm.create({ data: { ...r, order: i } })));
  const rhythmByCode = (code: string) => rhythms.find((r) => r.code === code)!;
  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD ?? "pilote-demo-2026");
  const emailOf = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "") + "@exemple.fr";
  return { passwordHash, rhythms, rhythmByCode, emailOf };
}

// Une personne avec son compte (lot F) : User + Account « credential » (accountId = id du User) + Person, et sa période de rythme.
export async function createPerson(prisma: PrismaClient, c: Common, data: { name: string; role: string; rhythm: string; poleId: string | null; days: number; order: number; jobTitle?: string; phone?: string; arrivedAt?: string }) {
  const email = c.emailOf(data.name);
  const user = await prisma.user.create({ data: { name: data.name, email, emailVerified: true } });
  await prisma.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: c.passwordHash } });
  const p = await prisma.person.create({ data: { name: data.name, firstName: data.name.split(" ")[0], lastName: data.name.split(" ").slice(1).join(" "), jobTitle: data.jobTitle ?? null, phone: data.phone ?? null, arrivedAt: data.arrivedAt ? new Date(data.arrivedAt) : null, role: data.role, workRhythm: data.rhythm, availableDays: data.days, poleId: data.poleId, order: data.order, icsToken: randomBytes(18).toString("base64url"), email, userId: user.id } });
  await prisma.personRhythmPeriod.create({ data: { personId: p.id, rhythmId: c.rhythmByCode(data.rhythm).id, from: new Date("2026-01-01") } });
  return p;
}

// Action composante (26/09) : les anciennes colonnes (editionId, milestoneDate, venue, participants, isPublic, isCheckpoint,
// fundingLineId) restent écrites jusqu'au contract, et l'action reçoit ce que la migration 20260927090000_actions_composantes
// copie pour une action existante : son projet, sa période (l'année, prolongée jusqu'au jalon s'il tombe après le 31/12) et un
// jalon « ms_<id> » repris de milestoneDate. Une base semée se lit donc comme une base migrée.
export async function createAction(prisma: PrismaClient, edition: { projectId: string; year: number }, data: Omit<Prisma.ActionUncheckedCreateInput, "projectId" | "startDate" | "endDate">) {
  const yearEnd = new Date(Date.UTC(edition.year, 11, 31));
  const m = data.milestoneDate ? new Date(data.milestoneDate) : null;
  const milestoneDay = m ? new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate())) : null; // milestoneDate::date
  const action = await prisma.action.create({ data: { ...data, projectId: edition.projectId, startDate: new Date(Date.UTC(edition.year, 0, 1)), endDate: milestoneDay && milestoneDay > yearEnd ? milestoneDay : yearEnd } });
  if (action.milestoneDate) await prisma.milestone.create({ data: { id: `ms_${action.id}`, actionId: action.id, date: action.milestoneDate, label: action.name, done: action.state === "done", venue: action.venue, participants: action.participants, isPublic: action.isPublic, isCheckpoint: action.isCheckpoint, order: 0 } });
  if (action.fundingLineId) await prisma.actionFunding.create({ data: { actionId: action.id, fundingLineId: action.fundingLineId, amount: null } });
  return action;
}

// L'ancien financeur d'une action (fundingLineId) et, comme la migration, le lien sans montant qui le remplace.
export async function setActionFunding(prisma: PrismaClient, actionId: string, fundingLineId: string) {
  await prisma.action.update({ where: { id: actionId }, data: { fundingLineId } });
  await prisma.actionFunding.create({ data: { actionId, fundingLineId, amount: null } });
}
