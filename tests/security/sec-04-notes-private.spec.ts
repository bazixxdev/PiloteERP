import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pageFor, SECURITY_ACTORS } from "./fixtures";

const conventionId = readFileSync("tests/.security-convention-id", "utf8").trim();
const noteId = readFileSync("tests/.security-note-id", "utf8").trim();
const sentinel = readFileSync("tests/.security-note-sentinel", "utf8").trim();

test.describe("SEC-04 — notes privées", () => {
  test("le tiers ne reçoit pas la note privée directement ni via la convention", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.contributor, baseURL);
    const direct = await page.goto(`/notes?note=${noteId}`, { waitUntil: "networkidle" });
    expect(await page.content()).not.toContain(sentinel);
    expect(direct?.status()).toBe(200);
    const convention = await page.goto(`/conventions/${conventionId}`, { waitUntil: "networkidle" });
    expect(convention?.status()).toBe(200);
    expect(await page.content()).not.toContain(sentinel);
    await page.context().close();
  });

  test("l'auteur conserve la lecture de sa note privée", async ({ browser, baseURL }) => {
    const page = await pageFor(browser, SECURITY_ACTORS.director, baseURL);
    await page.goto(`/conventions/${conventionId}`, { waitUntil: "networkidle" });
    expect(await page.content()).toContain(sentinel);
    await page.context().close();
  });
});
