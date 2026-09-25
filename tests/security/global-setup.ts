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
  await prisma.person.update({ where: { email: SECURITY_ACTORS.disabled.email }, data: { active: false } });
  await prisma.$disconnect();
}
