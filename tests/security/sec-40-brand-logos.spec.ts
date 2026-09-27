import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { cookieOf, expectAnonymous, postServerAction, serverActionId, SECURITY_ACTORS } from "./fixtures";

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

// Téléversement (tâche 4) : uploadBrandLogo et deleteBrandLogo appelées en direct comme le ferait un client. La garde
// canAdmin répond avant toute lecture du formulaire (uploadBrandLogo reçoit [{}], pas un FormData) ou de la base.
test.describe.serial("SEC-40 — téléversement des logos, réservé à l'administration", () => {
  const FILE = "app/actions/brand.ts";
  let updatedAt: string;

  test.beforeAll(async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 4, background: "#2040e0" } }).png().toBuffer();
    const row = await prisma.brandAsset.upsert({ where: { key: "logo" }, create: { key: "logo", png, width: 10, height: 10 }, update: { png } });
    updatedAt = row.updatedAt.toISOString();
  });

  test("une contributrice ne téléverse ni ne retire un logo : rien n'est écrit", async ({ baseURL }) => {
    const url = String(baseURL);
    const cookie = cookieOf(SECURITY_ACTORS.contributor);

    const upload = await postServerAction(url, serverActionId(FILE, "uploadBrandLogo"), [{}], cookie);
    expect(await upload.text()).toContain('"ok":false');
    expect((await prisma.brandAsset.findUniqueOrThrow({ where: { key: "logo" } })).updatedAt.toISOString()).toBe(updatedAt);

    const del = await postServerAction(url, serverActionId(FILE, "deleteBrandLogo"), ["logo"], cookie);
    expect(await del.text()).toContain('"ok":false');
    expect(await prisma.brandAsset.findUnique({ where: { key: "logo" } })).not.toBeNull();
  });

  test("témoin : l'administration retire le logo", async ({ baseURL }) => {
    const del = await postServerAction(String(baseURL), serverActionId(FILE, "deleteBrandLogo"), ["logo"], cookieOf(SECURITY_ACTORS.director));
    expect(await del.text()).toContain('"ok":true');
    expect(await prisma.brandAsset.findUnique({ where: { key: "logo" } })).toBeNull();
  });
});
