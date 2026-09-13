// Une capture par écran dans docs/screens/ (serveur de dev sur BASE_URL, base seedée).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const out = "docs/screens";

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" });
  const iAm = async (name: string) => {
    await page.waitForLoadState("networkidle");
    await page.getByTestId("person-switcher").click();
    await page.getByRole("menuitem", { name: new RegExp(name) }).click();
    await page.waitForTimeout(800);
  };
  const shot = async (name: string, url: string, fullPage = false) => {
    await page.goto(base + url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    if (fullPage) {
      // Le contenu défile dans <main> : on libère la hauteur pour capturer la page entière.
      await page.evaluate(() => {
        const main = document.querySelector("main") as HTMLElement | null;
        const root = main?.parentElement?.parentElement ?? null;
        if (root) { root.style.height = "auto"; root.style.overflow = "visible"; }
        if (main) main.style.overflow = "visible";
        const aside = document.querySelector("aside") as HTMLElement | null;
        if (aside) { aside.style.position = "sticky"; aside.style.top = "0"; }
      });
    }
    await page.screenshot({ path: `${out}/${name}.png`, fullPage });
    console.log("✓", name);
  };

  await page.goto(base + "/portefeuille");
  await iAm("Claire Vasseur");
  await shot("01-portefeuille", "/portefeuille");
  await shot("02-ecran-codir", "/codir", true);
  const editionUrl = await page.getByTestId("portfolio-table").getByRole("link", { name: "Observatoire régional (ORESS)" }).first().getAttribute("href");
  await shot("03-edition-fiche", `${editionUrl}?onglet=fiche`, true);
  await shot("04-edition-actions", `${editionUrl}?onglet=actions`);
  await shot("05-edition-financements", `${editionUrl}?onglet=financements`, true);
  await shot("06-edition-temps", `${editionUrl}?onglet=temps`);
  await shot("07-edition-budget", `${editionUrl}?onglet=budget`);
  await shot("08-edition-validations", `${editionUrl}?onglet=validations`);
  await shot("09-edition-documents", `${editionUrl}?onglet=documents`);
  await shot("10-edition-bilan", `${editionUrl}?onglet=bilan`);
  await shot("11-ma-semaine", "/ma-semaine");
  await shot("12-temps", "/temps");
  await shot("13-annuel", "/annuel");
  await shot("14-validations", "/validations");
  await shot("15-cafe", "/cafe?plein=1");
  await shot("16-seminaire", "/seminaire", true);
  await shot("17-rappels", "/rappels");
  await shot("18-admin-personnes", "/admin");
  await shot("19-admin-referentiels", "/admin?section=referentiels", true);
  await shot("20-admin-parametres", "/admin?section=parametres");
  await iAm("Nadia Ferrand");
  await shot("21-cloture", "/cloture?mois=2026-08");
  await iAm("Inès Cabral");
  await shot("22-temps-pilote", "/temps");
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
