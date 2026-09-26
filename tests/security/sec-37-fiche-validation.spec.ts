import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// Circuit de validation de la fiche (26/09, tâche 13). decideFiche et saveLevels sont appelées en direct comme le ferait un
// client : une contributrice ne décide rien ; le pilote ne décide jamais sa propre fiche, à aucun niveau (la direction, qui
// tient les deux niveaux, pilote ici un projet) ; qui ne tient que le niveau 2 ne décide pas avant que le niveau 1 soit validé
// (le niveau est calculé côté serveur) ; « à retravailler » exige un commentaire et fait repartir le circuit. saveLevels est
// réservé à l'administration et ne supprime jamais un niveau qui a des décisions (il passe inactif). Données propres au test
// (années 2033), supprimées après ; le circuit et les droits du rôle RAF sont remis comme avant.
const FILE = "app/actions/fiche-validation.ts";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });
const Y = 2033;

async function call(baseURL: string, name: string, args: unknown[], actor = SECURITY_ACTORS.director) {
  const res = await postServerAction(baseURL, serverActionId(FILE, name), args, cookieOf(actor));
  expect(res.status, `${name} : HTTP ${res.status}`).toBe(200);
  return res.text();
}

const ids = { own: "", ownE: "", p: "", e: "", rafPermissions: "" };
const levelsBefore: { id: string; order: number; label: string; permission: string; active: boolean }[] = [];
const decisionsOf = (editionId: string) => prisma.ficheValidation.findMany({ where: { editionId }, orderBy: { decidedAt: "asc" }, select: { levelId: true, decision: true, comment: true } });

test.afterAll(async () => {
  const projects = [ids.own, ids.p].filter(Boolean);
  await prisma.changeLog.deleteMany({ where: { edition: { projectId: { in: projects } } } });
  await prisma.edition.deleteMany({ where: { projectId: { in: projects } } }); // FicheValidation suit (cascade)
  await prisma.project.deleteMany({ where: { id: { in: projects } } });
  if (ids.rafPermissions) await prisma.role.update({ where: { code: "raf" }, data: { permissions: ids.rafPermissions } });
  // Le circuit tel qu'il était : niveaux d'origine rétablis, niveaux ajoutés par le test retirés (sans décision).
  if (levelsBefore.length) {
    await prisma.ficheValidationLevel.deleteMany({ where: { id: { notIn: levelsBefore.map((l) => l.id) }, validations: { none: {} } } });
    for (const l of levelsBefore) await prisma.ficheValidationLevel.update({ where: { id: l.id }, data: l });
  }
  await prisma.$disconnect();
});

test.describe.serial("SEC-37 — circuit de validation de la fiche", () => {
  test.beforeAll(async () => {
    levelsBefore.push(...await prisma.ficheValidationLevel.findMany({ orderBy: { order: "asc" }, select: { id: true, order: true, label: true, permission: true, active: true } }));
    expect(levelsBefore.map((l) => [l.id, l.permission, l.active])).toEqual([["fvl_1", "fiche.validate.1", true], ["fvl_2", "fiche.validate.2", true]]);
    const base = await prisma.project.findFirstOrThrow({ orderBy: { id: "asc" }, select: { poleId: true, missionId: true } });
    const director = await prisma.person.findFirstOrThrow({ where: { email: SECURITY_ACTORS.director.email }, select: { id: true } });
    const pilot = await prisma.person.findFirstOrThrow({ where: { email: SECURITY_ACTORS.pilot.email }, select: { id: true } });
    // Un projet piloté par la direction (qui tient les deux niveaux) : sa propre fiche.
    const own = await prisma.project.create({ data: { ...base, pilotId: director.id, name: "SEC37 fiche de la direction", analyticCode: "SEC37-OWN" } });
    const ownE = await prisma.edition.create({ data: { projectId: own.id, year: Y, status: "proposed" } });
    const p = await prisma.project.create({ data: { ...base, pilotId: pilot.id, name: "SEC37 fiche d'un pilote", analyticCode: "SEC37-P" } });
    const e = await prisma.edition.create({ data: { projectId: p.id, year: Y, status: "proposed" } });
    // Le rôle RAF reçoit le seul niveau 2 (un « administrateur du CA ») le temps du test.
    const raf = await prisma.role.findUniqueOrThrow({ where: { code: "raf" }, select: { permissions: true } });
    await prisma.role.update({ where: { code: "raf" }, data: { permissions: `${raf.permissions},fiche.validate.2` } });
    Object.assign(ids, { own: own.id, ownE: ownE.id, p: p.id, e: e.id, rafPermissions: raf.permissions });
  });

  test("une contributrice ne décide aucune fiche : rien n'est écrit", async ({ baseURL }) => {
    const body = await call(String(baseURL), "decideFiche", [ids.e, "approved", ""], SECURITY_ACTORS.contributor);
    expect(body).toContain('"ok":false');
    expect(await decisionsOf(ids.e)).toEqual([]);
  });

  test("le pilote ne décide pas sa propre fiche, ni au niveau 1, ni au niveau 2", async ({ baseURL }) => {
    const url = String(baseURL);
    const n1 = await call(url, "decideFiche", [ids.ownE, "approved", ""]);
    expect(n1).toContain('"ok":false');
    expect(n1).toContain("propre fiche");
    // Niveau 1 validé par quelqu'un d'autre (posé en base) : au niveau 2, toujours non.
    const other = await prisma.person.findFirstOrThrow({ where: { email: SECURITY_ACTORS.raf.email }, select: { id: true } });
    await prisma.ficheValidation.create({ data: { editionId: ids.ownE, levelId: "fvl_1", decision: "approved", deciderId: other.id, decidedAt: new Date(Date.now() - 60_000) } });
    const n2 = await call(url, "decideFiche", [ids.ownE, "approved", ""]);
    expect(n2).toContain("propre fiche");
    const rework = await call(url, "decideFiche", [ids.ownE, "rework", "Je me renvoie ma fiche"]);
    expect(rework).toContain("propre fiche");
    expect(await decisionsOf(ids.ownE)).toHaveLength(1);
    expect((await prisma.edition.findUniqueOrThrow({ where: { id: ids.ownE } })).status).toBe("proposed");
  });

  test("qui ne tient que le niveau 2 ne décide pas avant le niveau 1 ; ensuite, la fiche est validée", async ({ baseURL }) => {
    const url = String(baseURL);
    const early = await call(url, "decideFiche", [ids.e, "approved", ""], SECURITY_ACTORS.raf);
    expect(early).toContain('"ok":false');
    expect(await decisionsOf(ids.e)).toEqual([]);
    expect(await call(url, "decideFiche", [ids.e, "approved", ""])).toContain('"ok":true');
    // La direction tient aussi le niveau 2, mais c'est le rôle RAF qui le décide ici.
    expect(await call(url, "decideFiche", [ids.e, "approved", "Vu en CA"], SECURITY_ACTORS.raf)).toContain('"ok":true');
    expect(await decisionsOf(ids.e)).toEqual([{ levelId: "fvl_1", decision: "approved", comment: null }, { levelId: "fvl_2", decision: "approved", comment: "Vu en CA" }]);
    expect((await prisma.edition.findUniqueOrThrow({ where: { id: ids.e } })).status).toBe("validated");
    const log = await prisma.changeLog.findMany({ where: { editionId: ids.e }, orderBy: { createdAt: "asc" }, select: { field: true, after: true } });
    expect(log.filter((c) => c.field === "validation").map((c) => c.after)).toHaveLength(2);
    expect(log.some((c) => c.field === "status" && c.after === "validated")).toBe(true);
    // Circuit terminé : plus de validation ni de refus possibles.
    expect(await call(url, "decideFiche", [ids.e, "approved", ""])).toContain("Circuit terminé");
  });

  test("« à retravailler » exige un commentaire, re-challenge la fiche et fait repartir le circuit du niveau 1", async ({ baseURL }) => {
    const url = String(baseURL);
    expect(await call(url, "decideFiche", [ids.e, "rework", "   "], SECURITY_ACTORS.raf)).toContain("commentaire est obligatoire");
    expect(await call(url, "decideFiche", [ids.e, "rework", "Budget à revoir"], SECURITY_ACTORS.raf)).toContain('"ok":true');
    expect((await prisma.edition.findUniqueOrThrow({ where: { id: ids.e } })).status).toBe("rechallenged");
    // Le circuit repart du niveau 1 : le niveau 2 seul ne décide plus rien.
    expect(await call(url, "decideFiche", [ids.e, "approved", ""], SECURITY_ACTORS.raf)).toContain('"ok":false');
    expect(await decisionsOf(ids.e)).toHaveLength(3);
  });

  test("saveLevels : refusé à qui n'administre pas ; un niveau décidé n'est jamais supprimé, il passe inactif", async ({ baseURL }) => {
    const url = String(baseURL);
    const only1 = [{ id: "fvl_1", label: "SEC37 seul niveau", permission: "fiche.validate.1", active: true }];
    for (const actor of [SECURITY_ACTORS.contributor, SECURITY_ACTORS.pilot]) {
      expect(await call(url, "saveLevels", [only1], actor)).toContain('"ok":false');
    }
    expect(await prisma.ficheValidationLevel.findUniqueOrThrow({ where: { id: "fvl_1" } })).toMatchObject({ label: levelsBefore[0].label, active: true });
    // Un droit hors circuit est refusé.
    expect(await call(url, "saveLevels", [[{ ...only1[0], permission: "admin.manage" }]])).toContain('"ok":false');
    // La direction retire le niveau 2 (qui a des décisions) et ajoute un niveau neuf : le 2 reste, inactif.
    expect(await call(url, "saveLevels", [[...only1, { label: "SEC37 neuf", permission: "fiche.validate.3", active: true }]])).toContain('"ok":true');
    expect(await prisma.ficheValidationLevel.findUniqueOrThrow({ where: { id: "fvl_2" } })).toMatchObject({ active: false });
    const fresh = await prisma.ficheValidationLevel.findFirstOrThrow({ where: { label: "SEC37 neuf" } });
    expect(fresh).toMatchObject({ order: 2, permission: "fiche.validate.3", active: true });
    // Retiré sans aucune décision : supprimé.
    expect(await call(url, "saveLevels", [only1])).toContain('"ok":true');
    expect(await prisma.ficheValidationLevel.count({ where: { id: fresh.id } })).toBe(0);
    // Sans niveau actif, refusé.
    expect(await call(url, "saveLevels", [[{ ...only1[0], active: false }]])).toContain('"ok":false');
    expect(await prisma.ficheValidationLevel.findUniqueOrThrow({ where: { id: "fvl_1" } })).toMatchObject({ active: true });
  });
});
