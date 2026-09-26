import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { cookieOf, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

// Reconduction sans doublons et « Préparer l'année suivante » (26/09, tâche 12). renewEdition et batchCreateEditions sont
// appelées en direct comme le ferait un client : une contributrice est refusée (rien n'est créé, rien n'est consigné) ; la
// direction reconduit, et la base prouve la règle de la spec actions § 2 — l'action qui continue n'est pas recopiée (même si le
// client l'envoie dans la liste), celle qui finit l'est (période et jalons +1 an, à faire, associés), ses liens suivent les
// lignes recréées du même financeur, l'indicateur suit sa copie ou reste sur l'action qui continue, la copie d'une action
// pluriannuelle ne déborde pas sur l'année source. « Préparer » consigne une Decision sur l'année source et ne range le
// projet que sur confirmation. Données propres au test, sur des années libres (2031–2032), supprimées après.
const FILE = "app/actions/edition.ts";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.SECURITY_DATABASE_URL } } });
const Y = 2031;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function call(baseURL: string, name: string, args: unknown[], actor = SECURITY_ACTORS.director) {
  const res = await postServerAction(baseURL, serverActionId(FILE, name), args, cookieOf(actor));
  expect(res.status, `${name} : HTTP ${res.status}`).toBe(200);
  return res.text();
}

const ids = { p: "", e1: "", conv: "", f1: "", f2: "", line1: "", line2: "", cont: "", fin: "", multi: "", aband: "", unchecked: "", indFin: "", indCont: "", q: "", qe: "", r: "", re: "", rCont: "", rFin: "" };

test.afterAll(async () => {
  const projects = [ids.p, ids.q, ids.r].filter(Boolean);
  await prisma.action.deleteMany({ where: { projectId: { in: projects } } });
  await prisma.changeLog.deleteMany({ where: { edition: { projectId: { in: projects } } } });
  await prisma.edition.deleteMany({ where: { projectId: { in: projects } } });
  if (ids.conv) await prisma.convention.deleteMany({ where: { id: ids.conv } });
  await prisma.project.deleteMany({ where: { id: { in: projects } } });
  await prisma.$disconnect();
});

test.describe.serial("SEC-36 — reconduction sans doublons, « Préparer »", () => {
  test.beforeAll(async () => {
    const base = await prisma.project.findFirstOrThrow({ orderBy: { id: "asc" }, select: { poleId: true, pilotId: true, missionId: true } });
    const f1 = (await prisma.fundingLine.findFirstOrThrow({ orderBy: { id: "asc" }, select: { funderId: true } })).funderId;
    const f2 = (await prisma.organisation.findFirstOrThrow({ where: { id: { not: f1 } }, orderBy: { id: "asc" }, select: { id: true } })).id;
    const director = await prisma.person.findFirstOrThrow({ where: { name: SECURITY_ACTORS.director.name }, select: { id: true } });

    const p = await prisma.project.create({ data: { ...base, name: "SEC36 projet reconduit", analyticCode: "SEC36-P" } });
    const e1 = await prisma.edition.create({ data: { projectId: p.id, year: Y, status: "in_progress" } });
    const conv = await prisma.convention.create({ data: { funderId: f1, reference: "SEC36-DOSSIER-2031-2032", startYear: Y, endYear: Y + 1, status: "contracted", amountNotified: 20_000 } });
    const line1 = await prisma.fundingLine.create({ data: { editionId: e1.id, funderId: f1, conventionId: conv.id, status: "contracted", amountGranted: 10_000 } });
    const line2 = await prisma.fundingLine.create({ data: { editionId: e1.id, funderId: f2, status: "contracted", amountGranted: 3_000 } });
    const mk = (name: string, from: string, to: string, state = "todo") =>
      prisma.action.create({ data: { editionId: e1.id, projectId: p.id, name, ownerId: base.pilotId, startDate: day(from), endDate: day(to), state } });
    const cont = await mk("SEC36 continue", `${Y}-01-01`, `${Y + 1}-06-30`, "doing");
    const fin = await prisma.action.create({
      data: {
        editionId: e1.id, projectId: p.id, name: "SEC36 finie", ownerId: base.pilotId, startDate: day(`${Y}-02-01`), endDate: day(`${Y}-11-30`), state: "done",
        description: "Quatre ateliers", audience: "Adhérents", recurrence: "4 ateliers/an", entrusted: "L'animation", latitude: "Le choix des dates", timeTarget: 40,
        milestones: { create: [
          { date: day(`${Y}-03-15`), label: "Lancement", venue: "Salle A", participants: "Réseau", isPublic: true, done: true, doneAt: day(`${Y}-03-15`), order: 0 },
          { date: day(`${Y}-11-30`), label: "Bilan", isCheckpoint: true, order: 1 },
        ] },
        people: { create: [{ personId: director.id }] },
        fundings: { create: [{ fundingLineId: line1.id, amount: 500 }, { fundingLineId: line2.id, amount: 300 }] },
      },
    });
    await prisma.actionFunding.create({ data: { actionId: cont.id, fundingLineId: line1.id, amount: 1_000 } });
    // Pluriannuelle qui finit en Y : sa copie commence au 1er janvier Y+1 (jamais dans Y), son jalon de Y-1 est abandonné.
    const multi = await prisma.action.create({
      data: {
        editionId: e1.id, projectId: p.id, name: "SEC36 pluriannuelle", ownerId: base.pilotId, startDate: day(`${Y - 1}-03-01`), endDate: day(`${Y}-06-30`), state: "doing",
        milestones: { create: [{ date: day(`${Y - 1}-04-15`), label: "Ancien jalon", order: 0 }, { date: day(`${Y}-05-20`), label: "Restitution", order: 1 }] },
      },
    });
    const aband = await mk("SEC36 abandonnée", `${Y}-01-01`, `${Y}-06-30`, "abandoned");
    const unchecked = await mk("SEC36 décochée", `${Y}-01-01`, `${Y}-12-31`);
    const indFin = await prisma.indicator.create({ data: { editionId: e1.id, label: "SEC36 ateliers tenus", target: "4", actual: "4", order: 0, actionId: fin.id } });
    const indCont = await prisma.indicator.create({ data: { editionId: e1.id, label: "SEC36 suivi continu", target: "10", order: 1, actionId: cont.id } });

    // Deux autres projets pour « Préparer » : Q (arrêté), R (reconduit en lot, avec une action qui continue).
    const q = await prisma.project.create({ data: { ...base, name: "SEC36 projet arrêté", analyticCode: "SEC36-Q" } });
    const qe = await prisma.edition.create({ data: { projectId: q.id, year: Y, status: "in_progress" } });
    const r = await prisma.project.create({ data: { ...base, name: "SEC36 projet préparé", analyticCode: "SEC36-R" } });
    const re = await prisma.edition.create({ data: { projectId: r.id, year: Y, status: "in_progress" } });
    const rCont = await prisma.action.create({ data: { editionId: re.id, projectId: r.id, name: "SEC36 R continue", startDate: day(`${Y}-01-01`), endDate: day(`${Y + 1}-12-31`) } });
    const rFin = await prisma.action.create({ data: { editionId: re.id, projectId: r.id, name: "SEC36 R finie", startDate: day(`${Y}-01-01`), endDate: day(`${Y}-12-31`) } });
    Object.assign(ids, { p: p.id, e1: e1.id, conv: conv.id, f1, f2, line1: line1.id, line2: line2.id, cont: cont.id, fin: fin.id, multi: multi.id, aband: aband.id, unchecked: unchecked.id, indFin: indFin.id, indCont: indCont.id, q: q.id, qe: qe.id, r: r.id, re: re.id, rCont: rCont.id, rFin: rFin.id });
  });

  test("une contributrice ne reconduit pas et ne prépare pas l'année suivante : rien n'est créé ni consigné", async ({ baseURL }) => {
    const url = String(baseURL);
    const renew = await call(url, "renewEdition", [ids.e1], SECURITY_ACTORS.contributor);
    expect(renew).toContain('"ok":false');
    const batch = await call(url, "batchCreateEditions", [Y + 1, [{ editionId: ids.e1, decision: "renew" }, { editionId: ids.qe, decision: "stop", archive: true }]], SECURITY_ACTORS.contributor);
    expect(batch).toContain('"ok":false');
    expect(await prisma.edition.count({ where: { projectId: { in: [ids.p, ids.q] }, year: Y + 1 } })).toBe(0);
    expect(await prisma.decision.count({ where: { editionId: { in: [ids.e1, ids.qe] } } })).toBe(0);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: ids.q } })).archived).toBe(false);
  });

  test("reconduire : l'action qui continue n'est pas recopiée, celle qui finit l'est, liens et indicateur suivent", async ({ baseURL }) => {
    // Le client envoie aussi l'action qui continue et l'abandonnée : ignorées. La décochée n'est pas envoyée.
    const body = await call(String(baseURL), "renewEdition", [ids.e1, { actionIds: [ids.fin, ids.multi, ids.cont, ids.aband] }]);
    expect(body).toContain('"ok":true');
    const e2 = await prisma.edition.findUniqueOrThrow({ where: { projectId_year: { projectId: ids.p, year: Y + 1 } }, include: { fundingLines: true, indicators: { orderBy: { order: "asc" } } } });
    const count = (name: string) => prisma.action.count({ where: { projectId: ids.p, name } });
    expect(await count("SEC36 continue")).toBe(1);
    expect(await count("SEC36 abandonnée")).toBe(1);
    expect(await count("SEC36 décochée")).toBe(1);
    expect(await count("SEC36 finie")).toBe(2);

    const copy = await prisma.action.findFirstOrThrow({
      where: { projectId: ids.p, name: "SEC36 finie", id: { not: ids.fin } },
      include: { milestones: { orderBy: { date: "asc" } }, people: true, fundings: true, tasks: true, timeEntries: true, achievements: true },
    });
    expect(copy.editionId).toBe(e2.id);
    expect(copy.startDate?.toISOString().slice(0, 10)).toBe(`${Y + 1}-02-01`);
    expect(copy.endDate?.toISOString().slice(0, 10)).toBe(`${Y + 1}-11-30`);
    expect(copy.state).toBe("todo");
    expect([copy.description, copy.audience, copy.recurrence, copy.entrusted, copy.latitude, copy.timeTarget]).toEqual(["Quatre ateliers", "Adhérents", "4 ateliers/an", "L'animation", "Le choix des dates", 40]);
    expect(copy.milestones.map((m) => [m.date.toISOString().slice(0, 10), m.label, m.done, m.doneAt, m.venue, m.participants, m.isPublic, m.isCheckpoint])).toEqual([
      [`${Y + 1}-03-15`, "Lancement", false, null, "Salle A", "Réseau", true, false],
      [`${Y + 1}-11-30`, "Bilan", false, null, null, null, false, true],
    ]);
    expect(copy.people).toHaveLength(1);
    expect([copy.tasks.length, copy.timeEntries.length, copy.achievements.length]).toEqual([0, 0, 0]);

    // La copie de la pluriannuelle ne chevauche pas l'année source : 1er janvier Y+1 → fin décalée ; jalon de Y-1 abandonné.
    const multiCopy = await prisma.action.findFirstOrThrow({ where: { projectId: ids.p, name: "SEC36 pluriannuelle", id: { not: ids.multi } }, include: { milestones: true } });
    expect([multiCopy.startDate?.toISOString().slice(0, 10), multiCopy.endDate?.toISOString().slice(0, 10)]).toEqual([`${Y + 1}-01-01`, `${Y + 1}-06-30`]);
    expect(multiCopy.milestones.map((m) => [m.date.toISOString().slice(0, 10), m.label])).toEqual([[`${Y + 1}-05-20`, "Restitution"]]);

    // Liens : la ligne recréée du même financeur (le dossier couvre Y+1 : la ligne F1 y reste rattachée), sans montant.
    const newF1 = e2.fundingLines.find((l) => l.funderId === ids.f1)!;
    const newF2 = e2.fundingLines.find((l) => l.funderId === ids.f2)!;
    expect(newF1.conventionId).toBe(ids.conv);
    expect(newF2.conventionId).toBeNull();
    expect(copy.fundings.map((f) => [f.fundingLineId, f.amount]).sort()).toEqual([[newF1.id, null], [newF2.id, null]].sort());
    // L'action qui continue rejoint la ligne gardée sur le dossier (linkNewLineToRunningActions), sans montant ; ses liens
    // d'origine ne bougent pas.
    expect((await prisma.actionFunding.findUnique({ where: { actionId_fundingLineId: { actionId: ids.cont, fundingLineId: newF1.id } } }))?.amount).toBeNull();
    expect((await prisma.actionFunding.findUnique({ where: { actionId_fundingLineId: { actionId: ids.cont, fundingLineId: ids.line1 } } }))?.amount).toBe(1_000);

    // Indicateurs : cibles recopiées, réalisé vidé ; celui de l'action recopiée suit sa copie, celui de l'action qui continue
    // reste sur elle.
    expect(e2.indicators.map((i) => [i.label, i.target, i.actual, i.actionId])).toEqual([
      ["SEC36 ateliers tenus", "4", null, copy.id],
      ["SEC36 suivi continu", "10", null, ids.cont],
    ]);
    // Rien ne bouge dans l'année source.
    expect((await prisma.indicator.findUniqueOrThrow({ where: { id: ids.indFin } })).actionId).toBe(ids.fin);
  });

  test("« Préparer » : chaque décision est consignée sur l'année source ; « arrêté » ne range le projet que sur confirmation", async ({ baseURL }) => {
    const url = String(baseURL);
    // Arrêté sans confirmation : la décision seule. Instance inventée : la première de la liste est retenue.
    let body = await call(url, "batchCreateEditions", [Y + 1, [{ editionId: ids.qe, decision: "stop" }, { editionId: ids.re, decision: "adjust" }], "inventée"]);
    expect(body).toContain('"ok":true');
    expect(body).toContain('"created":1');
    expect(body).toContain('"stopped":1');
    const decisions = await prisma.decision.findMany({ where: { editionId: { in: [ids.qe, ids.re] } }, orderBy: { body: "asc" } });
    expect(decisions.map((d) => [d.editionId, d.body, d.instance])).toEqual([[ids.re, `Ajusté pour ${Y + 1}`, "codir"], [ids.qe, `Arrêté pour ${Y + 1}`, "codir"]]);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: ids.q } })).archived).toBe(false);
    expect(await prisma.edition.count({ where: { projectId: ids.q, year: Y + 1 } })).toBe(0);
    // Plus rien dans codirDecision / codirDate de l'année source.
    const src = await prisma.edition.findUniqueOrThrow({ where: { id: ids.re } });
    expect([src.codirDecision, src.codirDate]).toEqual([null, null]);
    // Ajusté : l'année suivante re-challengée, l'action qui continue n'y est pas recopiée, celle qui finit l'est.
    const next = await prisma.edition.findUniqueOrThrow({ where: { projectId_year: { projectId: ids.r, year: Y + 1 } } });
    expect(next.status).toBe("rechallenged");
    expect(await prisma.action.count({ where: { projectId: ids.r, name: "SEC36 R continue" } })).toBe(1);
    expect(await prisma.action.count({ where: { projectId: ids.r, name: "SEC36 R finie" } })).toBe(2);

    // Arrêté avec la case cochée : le projet est rangé ; l'instance choisie, si elle est dans la liste, est gardée.
    body = await call(url, "batchCreateEditions", [Y + 1, [{ editionId: ids.qe, decision: "stop", archive: true }], "board"]);
    expect(body).toContain('"ok":true');
    expect((await prisma.project.findUniqueOrThrow({ where: { id: ids.q } })).archived).toBe(true);
    expect((await prisma.decision.findFirstOrThrow({ where: { editionId: ids.qe, instance: "board" } })).body).toBe(`Arrêté pour ${Y + 1}`);
  });
});
