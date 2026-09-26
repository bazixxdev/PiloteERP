import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SECURITY_ACTORS, signInActor } from "./fixtures";

/**
 * Prépare uniquement la base jetable indiquée par SECURITY_DATABASE_URL.
 * Cette base ne doit jamais être une base de développement ou de production.
 */
export default async function globalSetup(config: FullConfig) {
  const databaseUrl = process.env.SECURITY_DATABASE_URL;
  if (!databaseUrl) throw new Error("SECURITY_DATABASE_URL est obligatoire.");
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PILOTE_DEMO: "0",
    AUTH_RATE_LIMIT: "5",
    DEMO_PASSWORD: process.env.SECURITY_TEST_PASSWORD ?? "security-test-password-2026",
    UPLOAD_DIR: process.env.SECURITY_UPLOAD_DIR ?? path.join(process.cwd(), "uploads-security"),
  };
  mkdirSync(env.UPLOAD_DIR, { recursive: true });
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env });
  execFileSync("npx", ["prisma", "db", "seed"], { stdio: "inherit", env });

  const baseURL = String(config.projects[0].use.baseURL ?? "http://localhost:3200");
  const authDir = path.join(process.cwd(), "tests", ".security-auth");
  mkdirSync(authDir, { recursive: true });
  for (const actor of Object.values(SECURITY_ACTORS)) {
    const state = await signInActor(baseURL, actor, env.DEMO_PASSWORD);
    writeFileSync(path.join(authDir, `${actor.key}.json`), JSON.stringify(state, null, 2));
  }
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const edition = await prisma.edition.findFirst({ where: { year: 2027 }, orderBy: { id: "asc" }, select: { id: true } });
  if (!edition) throw new Error("Aucune édition 2027 dans la fixture sécurité.");
  writeFileSync(path.join(authDir, "../.security-edition-id"), edition.id);
  const convention = await prisma.convention.findUnique({ where: { reference: "ADEME-2027" }, select: { id: true } });
  const author = await prisma.person.findUnique({ where: { email: SECURITY_ACTORS.director.email }, select: { id: true } });
  if (!convention || !author) throw new Error("Fixture SEC-04 introuvable.");
  const sentinel = "SEC04_PRIVATE_SENTINEL_7f2c91";
  await prisma.note.deleteMany({ where: { title: "SEC04 private fixture" } });
  const note = await prisma.note.create({ data: { title: "SEC04 private fixture", body: sentinel, context: "other", visibility: "private", date: new Date(), authorId: author.id, conventionId: convention.id } });
  writeFileSync(path.join(authDir, "../.security-convention-id"), convention.id);
  writeFileSync(path.join(authDir, "../.security-note-id"), note.id);
  writeFileSync(path.join(authDir, "../.security-note-sentinel"), sentinel);
  // Budget prévisionnel (25/09) : l'édition dont le détail Personnel (coût par personne) ne doit sortir que pour la trésorerie.
  const budgetEdition = await prisma.edition.findFirst({ where: { year: 2026, project: { analyticCode: "OBS-01" } }, select: { id: true } });
  if (!budgetEdition) throw new Error("Fixture budget prévisionnel introuvable (OBS-01 2026).");
  writeFileSync(path.join(authDir, "../.security-budget-edition-id"), budgetEdition.id);
  // Délégation (25/09) : la feuille de Thomas Guérin (acteur « pilot ») et une tâche personnelle témoin sur l'un de ses projets.
  const thomas = await prisma.person.findUnique({ where: { email: SECURITY_ACTORS.pilot.email }, select: { id: true } });
  const deleg = thomas ? await prisma.delegation.findFirst({ where: { personId: thomas.id }, select: { editionId: true } }) : null;
  if (!thomas || !deleg) throw new Error("Fixture délégation introuvable.");
  await prisma.task.create({ data: { personId: thomas.id, editionId: deleg.editionId, label: "SEC31_TASK_SENTINEL_4b1e" } });
  writeFileSync(path.join(authDir, "../.security-delegation-person-id"), thomas.id);
  // Actions composantes (26/09), SEC-32. Le contributeur (Lucas Perrin) :
  // 1. entre dans l'équipe 2027 d'un projet (pas 2026) ; une action de ce projet créée en 2026 court sur 2026–2027 : il la
  //    modifie par l'année 2027 qu'elle couvre (runsIn) ;
  const lucas = await prisma.person.findUnique({ where: { email: SECURITY_ACTORS.contributor.email }, select: { id: true, poleId: true } });
  if (!lucas) throw new Error("Fixture SEC-32 : contributeur introuvable.");
  const later = await prisma.edition.findFirst({
    where: { year: 2027, team: { none: { personId: lucas.id } }, project: { analyticCode: { not: "OBS-01" }, pilotId: { not: lucas.id }, editions: { some: { year: 2026, team: { none: { personId: lucas.id } } } } } },
    orderBy: { id: "asc" },
    select: { id: true, projectId: true, project: { select: { pilotId: true, editions: { where: { year: 2026 }, select: { id: true } } } } },
  });
  if (!later) throw new Error("Fixture SEC-32 : aucun projet avec une année 2026 et une année 2027.");
  await prisma.editionTeam.createMany({ data: [{ editionId: later.id, personId: lucas.id }], skipDuplicates: true });
  const multi = await prisma.action.create({ data: {
    editionId: later.project.editions[0].id, projectId: later.projectId, name: "SEC32 action sur deux années", ownerId: later.project.pilotId,
    startDate: new Date(Date.UTC(2026, 0, 1)), endDate: new Date(Date.UTC(2027, 11, 31)),
  } });
  writeFileSync(path.join(authDir, "../.security-multiyear-action-id"), multi.id);
  // 2. n'est rien sur une autre action — ni pilote, ni équipe d'aucune année, ni responsable ou associé, projet hors de son
  //    pôle — et sans heures ni dépenses (seule sa garde la protège) ;
  const outsideWhere = {
    startDate: { not: null }, endDate: { not: null }, ownerId: { not: lucas.id }, people: { none: { personId: lucas.id } },
    timeEntries: { none: {} }, expenses: { none: {} },
    project: {
      pilotId: { not: lucas.id }, editions: { none: { team: { some: { personId: lucas.id } } } },
      ...(lucas.poleId ? { poleId: { not: lucas.poleId }, secondaryPoles: { none: { poleId: lucas.poleId } } } : {}),
    },
  };
  const outside = await prisma.action.findMany({ where: outsideWhere, orderBy: { id: "asc" }, take: 2, select: { id: true } });
  if (outside.length < 2) throw new Error("Fixture SEC-32 : pas assez d'actions hors du périmètre du contributeur.");
  writeFileSync(path.join(authDir, "../.security-outside-action-id"), outside[0].id);
  // 3. est seulement personne associée d'une troisième : il la modifie, mais ne gère pas la liste et ne la supprime pas ;
  await prisma.actionPerson.createMany({ data: [{ actionId: outside[1].id, personId: lucas.id }], skipDuplicates: true });
  writeFileSync(path.join(authDir, "../.security-associate-action-id"), outside[1].id);
  // 4. une action avec des heures saisies : même la direction ne la supprime pas (« abandonnée » plutôt).
  const withHours = await prisma.action.findFirst({ where: { timeEntries: { some: {} }, startDate: { not: null }, endDate: { not: null }, projectId: { not: null } }, orderBy: { id: "asc" }, select: { id: true } });
  if (!withHours) throw new Error("Fixture SEC-32 : aucune action avec des heures.");
  writeFileSync(path.join(authDir, "../.security-hours-action-id"), withHours.id);
  await prisma.person.update({ where: { email: SECURITY_ACTORS.disabled.email }, data: { active: false } });
  await prisma.$disconnect();
}
