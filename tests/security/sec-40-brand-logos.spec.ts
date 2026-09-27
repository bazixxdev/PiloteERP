import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { expectAnonymous } from "./fixtures";

const prisma = new PrismaClient();
test.afterAll(async () => { await prisma.brandAsset.deleteMany({}); await prisma.$disconnect(); });

test.describe("SEC-40 — logos de l'organisation", () => {
  test("sans logo téléversé : /marque/logo répond 404 ; une clé inconnue aussi", async ({ page }) => {
    await prisma.brandAsset.deleteMany({});
    expect((await expectAnonymous(page, "/marque/logo")).status()).toBe(404);
    expect((await expectAnonymous(page, "/marque/autre")).status()).toBe(404);
  });

  test("un logo téléversé est servi sans session, en PNG, sans reniflage du type", async ({ page }) => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 4, background: "#e02020" } }).png().toBuffer();
    await prisma.brandAsset.upsert({ where: { key: "logo" }, create: { key: "logo", png, width: 10, height: 10 }, update: { png } });
    const r = await expectAnonymous(page, "/marque/logo");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
    expect(r.headers()["x-content-type-options"]).toBe("nosniff");
    expect((await r.body()).subarray(0, 8)).toEqual(png.subarray(0, 8));
  });
});
