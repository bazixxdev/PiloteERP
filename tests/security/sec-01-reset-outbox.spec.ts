import { test, expect } from "@playwright/test";
import { expectAnonymous, pageFor, SECURITY_ACTORS } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("SEC-01 — un compte non administrateur ne reçoit pas les liens de la boîte d'envoi", async ({ request, browser }) => {
  const baseURL = test.info().project.use.baseURL!;
  const reset = await request.post(`${baseURL}/api/auth/request-password-reset`, {
    data: { email: SECURITY_ACTORS.director.email, redirectTo: "/reinitialiser" },
  });
  expect(reset.ok()).toBeTruthy();

  const contributor = await pageFor(browser, SECURITY_ACTORS.contributor, baseURL);
  const navigation = await contributor.goto("/admin?section=comptes", { waitUntil: "networkidle" });
  const html = await contributor.content();
  expect(navigation?.status()).toBe(200);
  expect(html).not.toContain("mail-link-");
  expect(html).not.toContain("api/auth/reset-password/");
  await expect(contributor.getByTestId("outbox-list")).toHaveCount(0);
  await contributor.context().close();
});

test("SEC-01 — la direction conserve la lecture légitime du lien", async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL!;
  const director = await pageFor(browser, SECURITY_ACTORS.director, baseURL);
  await director.goto("/admin?section=comptes", { waitUntil: "networkidle" });
  const mail = director.getByTestId("outbox-list").locator("li", { hasText: SECURITY_ACTORS.director.email }).first();
  await expect(mail).toBeVisible();
  await expect(mail.locator("[data-testid^=mail-link-]")).toHaveAttribute("href", /reset-password/);
  await director.context().close();
});

test("SEC-01 — une session anonyme ne reçoit jamais la boîte d'envoi", async ({ page }) => {
  const response = await expectAnonymous(page, "/admin?section=comptes");
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(await page.content()).not.toContain("api/auth/reset-password/");
});

test("SEC-01 — un compte désactivé ne reçoit pas la boîte d'envoi", async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL!;
  const disabled = await pageFor(browser, SECURITY_ACTORS.disabled, baseURL);
  await disabled.goto("/admin?section=comptes", { waitUntil: "networkidle" });
  const html = await disabled.content();
  expect(html).not.toContain("api/auth/reset-password/");
  expect(html).not.toContain("mail-link-");
  await disabled.context().close();
});
