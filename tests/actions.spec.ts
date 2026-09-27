import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { iAm, pick } from "./helpers";
import { serverActionId } from "./security/fixtures";
import { dayjs } from "../lib/format";
import { W, cap, pl } from "./vocab";

// L'action, composante du projet (spec 2026-09-26, tâche 20 « Recette complète ») : cinq scénarios qui traversent la couche
// (période sur plusieurs années, jalon public, financement d'un dossier pluriannuel, reconduction, droits d'écriture). Chaque
// scénario crée ses propres données (projet, dossier ou action), avec un nom qui ne porte aucun mot du vocabulaire (le
// vérificateur de vocabulaire lit aussi les fichiers de recette) ; rien du jeu de démo ne bouge.
const prisma = new PrismaClient(); // DATABASE_URL = base de recette (playwright.config.ts)
test.afterAll(async () => { await prisma.$disconnect(); });

test("une période sur trois années : chaque année couverte la montre, avec SES heures, pas le total", async ({ page }) => {
  const y = dayjs().year();
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill("Recette heures pluriannuelles");
  await page.getByTestId("cp-code").fill("REC-20A");
  await pick(page, "cp-pilot", "Inès Cabral");
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("tab", { name: cap(pl(W.action)) })).toBeVisible({ timeout: 30_000 });
  const editionUrlY = page.url().split("?")[0];

  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Parcours triennal recette");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  const actionUrl = page.url().split("?")[0];
  const actionId = actionUrl.split("/").pop()!;

  // Trois années : (y-1) à (y+1).
  await page.getByTestId("period-start").fill(`${y - 1}-01-01`);
  await page.getByTestId("period-end").fill(`${y + 1}-12-31`);
  await page.getByTestId("period-submit").click();
  await expect(page.getByText("Période enregistrée")).toBeVisible();

  // Deuxième édition du même projet, l'année précédente.
  await page.getByTestId("action-summary").getByRole("link", { name: "Recette heures pluriannuelles" }).click();
  await expect(page.getByTestId("add-edition-open")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("add-edition-open").click();
  await page.getByTestId("add-edition-input").fill(String(y - 1));
  await page.getByTestId("add-edition-submit").click();
  await expect(page.getByRole("tab", { name: cap(pl(W.action)) })).toBeVisible({ timeout: 30_000 });
  const editionUrlY1 = page.url().split("?")[0];

  // Heures propres à chaque année (fixture : aucune saisie de temps n'est possible sur une année révolue depuis l'écran de
  // saisie hebdomadaire ; on pose directement les lignes que la lecture doit distinguer).
  const pilot = await prisma.person.findFirstOrThrow({ where: { name: "Inès Cabral" }, select: { id: true } });
  await prisma.timeEntry.createMany({ data: [
    { personId: pilot.id, actionId, date: new Date(`${y - 1}-03-10`), hours: 5 },
    { personId: pilot.id, actionId, date: new Date(`${y}-04-15`), hours: 8 },
  ] });

  // L'onglet Actions de chaque année montre SES heures (colonne « Heures {année} »), pas le total des trois années.
  await page.goto(`${editionUrlY1}?onglet=actions`);
  const rowY1 = page.getByTestId("action-row-0");
  await expect(rowY1).toContainText("Parcours triennal recette");
  await expect(rowY1).toContainText("5 / — h");
  await expect(rowY1).not.toContainText("8 / — h");

  await page.goto(`${editionUrlY}?onglet=actions`);
  const rowY = page.getByTestId("action-row-0");
  await expect(rowY).toContainText("Parcours triennal recette");
  await expect(rowY).toContainText("8 / — h");
  await expect(rowY).not.toContainText("5 / — h");

  // La page de l'action confirme : les heures de l'année choisie, puis le total sur toute la période.
  await page.goto(`${actionUrl}?annee=${y - 1}`);
  await expect(page.getByTestId("action-hours-total")).toHaveText("5 h");
  await page.goto(`${actionUrl}?annee=${y}`);
  await expect(page.getByTestId("action-hours-total")).toHaveText("8 h");
  await page.goto(`${actionUrl}?annee=tout`);
  await expect(page.getByTestId("action-hours-total")).toHaveText("13 h");
});

test("un jalon marqué public sort dans le flux public /api/agenda, un jalon privé n'y sort pas", async ({ request }) => {
  const y = dayjs().year();
  const base = await prisma.project.findFirstOrThrow({ orderBy: { id: "asc" }, select: { poleId: true, pilotId: true, missionId: true } });
  const project = await prisma.project.create({ data: { ...base, name: "ACT20 projet agenda public", analyticCode: "ACT20-PUB" } });
  try {
    const edition = await prisma.edition.create({ data: { projectId: project.id, year: y, status: "validated" } });
    const action = await prisma.action.create({ data: { editionId: edition.id, projectId: project.id, name: "ACT20 action agenda public", startDate: new Date(`${y}-01-01`), endDate: new Date(`${y}-12-31`) } });
    const when = dayjs().add(10, "day").toDate();
    await prisma.milestone.createMany({ data: [
      { actionId: action.id, date: when, label: "ACT20_PUBLIC_MILESTONE", isPublic: true },
      { actionId: action.id, date: when, label: "ACT20_PRIVATE_MILESTONE", isPublic: false },
    ] });

    const res = await request.get("/api/agenda/public.ics");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const ics = await res.text();
    expect(ics).toContain("ACT20_PUBLIC_MILESTONE");
    expect(ics).not.toContain("ACT20_PRIVATE_MILESTONE");
  } finally {
    await prisma.changeLog.deleteMany({ where: { edition: { projectId: project.id } } }).catch(() => undefined);
    await prisma.edition.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
  }
});

test("lier une ligne d'un dossier à trois ans lie l'année suivante couverte, pas celle hors période", async ({ page }) => {
  const y = dayjs().year();
  const base = await prisma.project.findFirstOrThrow({ orderBy: { id: "asc" }, select: { poleId: true, pilotId: true, missionId: true } });
  const project = await prisma.project.create({ data: { ...base, name: "ACT20 projet dossier pluriannuel", analyticCode: "ACT20-DOS" } });
  try {
    const editions = await Promise.all([y - 1, y, y + 1].map((year) => prisma.edition.create({ data: { projectId: project.id, year } })));
    const funder = await prisma.organisation.create({ data: { name: "ACT20 Fondation" } });
    const convention = await prisma.convention.create({ data: { funderId: funder.id, reference: "ACT20-DOSSIER-3ANS", startYear: y - 1, endYear: y + 1, status: "contracted", amountNotified: 15_000 } });
    const lines = await Promise.all(editions.map((e) => prisma.fundingLine.create({ data: { editionId: e.id, funderId: funder.id, conventionId: convention.id } })));
    // L'action ne couvre que les deux dernières années du dossier (y et y+1) : la ligne (y-1) reste hors de sa portée.
    const action = await prisma.action.create({ data: { editionId: editions[1].id, projectId: project.id, name: "ACT20 action deux ans sur trois", ownerId: base.pilotId, startDate: new Date(`${y}-01-01`), endDate: new Date(`${y + 1}-12-31`) } });

    await page.goto(`/action/${action.id}?annee=${y}`);
    const section = page.getByTestId("action-fundings");
    await expect(section.getByTestId("fundings-empty")).toBeVisible();
    await section.getByTestId("funding-add").click();
    await pick(page, "funding-add-line", `ACT20 Fondation · ${y}`);
    await section.getByTestId("funding-add-submit").click();
    await expect(page.getByText("Rattachée à 2 lignes du dossier")).toBeVisible();
    await expect(section.locator("[data-testid^=funding-row-]")).toHaveCount(2);
    await expect(section.getByTestId("funding-year-0")).toHaveText(String(y));
    await expect(section.getByTestId("funding-year-1")).toHaveText(String(y + 1));

    const links = await prisma.actionFunding.findMany({ where: { actionId: action.id }, select: { fundingLineId: true } });
    const linkedIds = links.map((l) => l.fundingLineId).sort();
    expect(linkedIds).toEqual([lines[1].id, lines[2].id].sort());
    expect(linkedIds).not.toContain(lines[0].id);
  } finally {
    await prisma.changeLog.deleteMany({ where: { edition: { projectId: project.id } } }).catch(() => undefined);
    await prisma.action.deleteMany({ where: { projectId: project.id } });
    await prisma.edition.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.convention.deleteMany({ where: { reference: "ACT20-DOSSIER-3ANS" } });
    await prisma.organisation.deleteMany({ where: { name: "ACT20 Fondation" } });
  }
});

test("reconduire ne recopie pas l'action qui continue dans l'année suivante", async ({ page }) => {
  const y = dayjs().year();
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill("Recette reconduction composantes");
  await page.getByTestId("cp-code").fill("REC-20B");
  await pick(page, "cp-pilot", "Inès Cabral");
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("tab", { name: cap(pl(W.action)) })).toBeVisible({ timeout: 30_000 });
  const editionUrlY = page.url().split("?")[0];

  // Un cycle qui finit dans l'année (période par défaut = l'année entière) : proposé à la reconduction.
  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Cycle qui finit dans l'année");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  const idFinishing = page.url().split("?")[0].split("/").pop()!;
  await page.getByTestId("action-back").click();
  await expect(page.getByTestId("actions-table")).toBeVisible();

  // Un cycle qui continue l'année suivante : déjà là en Y+1, la reconduction ne doit pas le recopier.
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Cycle qui continue l'année suivante");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  const idContinuing = page.url().split("?")[0].split("/").pop()!;
  await page.getByTestId("period-start").fill(`${y}-01-01`);
  await page.getByTestId("period-end").fill(`${y + 1}-06-30`);
  await page.getByTestId("period-submit").click();
  await expect(page.getByText("Période enregistrée")).toBeVisible();
  await page.getByTestId("action-back").click();
  await expect(page.getByTestId("actions-table")).toBeVisible();

  // Le dialogue de reconduction : le cycle qui finit est proposé (coché par défaut), celui qui continue est dit « déjà là ».
  await page.getByTestId("edition-menu").click();
  await page.getByTestId("renew-open").click();
  const renewable = page.getByTestId("renew-actions");
  await expect(renewable).toContainText("Cycle qui finit dans l'année");
  // Coché par défaut (le cycle qui finit) ; le cycle qui continue n'a pas de case, il n'est pas de la liste à recopier — la
  // phrase « déjà là » (renew-continuing) est nichée dans le même bloc, donc pas de not.toContainText sur le bloc entier.
  await expect(page.getByTestId(`renew-action-${idFinishing}`)).toBeChecked();
  await expect(page.getByTestId(`renew-action-${idContinuing}`)).toHaveCount(0);
  await expect(page.getByTestId("renew-continuing")).toContainText("Cycle qui continue l'année suivante");
  await page.getByTestId("renew-confirm").click();
  await expect(page).toHaveURL(/\/edition\/[^/?]+$/, { timeout: 30_000 });
  const editionUrlY1 = page.url();
  expect(editionUrlY1).not.toBe(editionUrlY);

  // Dans l'année Y+1 : le cycle qui finissait est copié (nouvel identifiant) ; celui qui continuait est le même (identifiant
  // inchangé) — il n'a pas été recopié.
  await page.goto(`${editionUrlY1}?onglet=actions`);
  const table = page.getByTestId("actions-table");
  await expect(table).toBeVisible();
  const rowFinishing = table.locator("tr", { hasText: "Cycle qui finit dans l'année" });
  const rowContinuing = table.locator("tr", { hasText: "Cycle qui continue l'année suivante" });
  await expect(rowFinishing).toHaveCount(1);
  await expect(rowContinuing).toHaveCount(1);
  const hrefFinishing = await rowFinishing.getByRole("link").getAttribute("href");
  const hrefContinuing = await rowContinuing.getByRole("link").getAttribute("href");
  expect(hrefContinuing).toContain(idContinuing);
  expect(hrefFinishing).not.toContain(idFinishing);
});

test("l'équipe d'une année couverte modifie l'action ; un tiers est refusé par la commande, rien n'est écrit", async ({ page, baseURL }) => {
  const y = dayjs().year();
  await page.goto("/projets");
  await iAm(page, "Claire Vasseur");
  await page.getByTestId("cp-open").click();
  await page.getByTestId("cp-name").fill("Recette droits pluriannuels");
  await page.getByTestId("cp-code").fill("REC-20C");
  await pick(page, "cp-pilot", "Inès Cabral");
  await page.getByTestId("cp-submit").click();
  await expect(page.getByRole("tab", { name: cap(pl(W.action)) })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("tab", { name: cap(pl(W.action)) }).click();
  await page.getByTestId("add-action-open").click();
  await page.getByTestId("add-action-input").fill("Cycle de portage pluriannuel");
  await page.getByTestId("add-action-submit").click();
  await expect(page.getByTestId("action-page")).toBeVisible({ timeout: 30_000 });
  const actionUrl = page.url().split("?")[0];
  const actionId = actionUrl.split("/").pop()!;
  await page.getByTestId("period-start").fill(`${y}-01-01`);
  await page.getByTestId("period-end").fill(`${y + 1}-12-31`);
  await page.getByTestId("period-submit").click();
  await expect(page.getByText("Période enregistrée")).toBeVisible();

  // Deuxième année du projet : son équipe n'a rien à voir avec celle de la création — Lucas Perrin y entre seul.
  await page.getByTestId("action-summary").getByRole("link", { name: "Recette droits pluriannuels" }).click();
  await expect(page.getByTestId("add-edition-open")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("add-edition-open").click();
  await page.getByTestId("add-edition-input").fill(String(y + 1));
  await page.getByTestId("add-edition-submit").click();
  await expect(page).toHaveURL(/\/edition\/[^/?]+$/, { timeout: 30_000 });
  await page.goto(`${page.url().split("?")[0]}?onglet=fiche`);
  await expect(page.getByTestId("team-section")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("team-edit").click();
  await page.getByTestId("team-section").getByRole("button", { name: "Lucas Perrin" }).click();
  await page.getByTestId("team-done").click();

  // L'équipe de cette année-là (pas celle de la création) modifie l'action.
  await iAm(page, "Lucas Perrin");
  await page.goto(`${actionUrl}?annee=${y + 1}`);
  await expect(page.getByTestId("outside-scope")).toHaveCount(0);
  await page.getByTestId("milestone-add").click();
  await page.getByTestId("milestone-add-date").fill(`${y + 1}-05-05`);
  await page.getByTestId("milestone-add-label").fill("Jalon posé par l'équipe de la deuxième année");
  await page.getByTestId("milestone-add-submit").click();
  await expect(page.getByTestId("milestone-label-0")).toHaveValue("Jalon posé par l'équipe de la deuxième année");

  // Un tiers : ni pilote, ni équipe d'aucune année couverte, ni pôle, ni responsable, ni associé. La page se lit seule.
  await iAm(page, "Thomas Guérin");
  await page.goto(`${actionUrl}?annee=${y}`);
  await expect(page.getByTestId("outside-scope")).toBeVisible();
  await expect(page.getByTestId("milestone-add")).toHaveCount(0);

  // La commande elle-même refuse — appelée en direct, comme le ferait un client falsifié — et rien n'est écrit.
  const before = await prisma.milestone.count({ where: { actionId } });
  const origin = String(baseURL);
  const res = await page.request.post(origin, {
    headers: { "Next-Action": serverActionId("app/actions/actions.ts", "addMilestone", ".next-test"), "Content-Type": "text/plain;charset=UTF-8", Origin: origin },
    data: JSON.stringify([actionId, { date: `${y}-06-06`, label: "Intrusion refusée" }]),
  });
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('"ok":false');
  expect(body).toMatch(/Vous ne pouvez pas/);
  expect(await prisma.milestone.count({ where: { actionId } })).toBe(before);
});
