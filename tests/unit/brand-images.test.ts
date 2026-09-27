import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processLogo, BrandImageError } from "../../lib/brand-images";

const png = (w: number, h: number, rgba: [number, number, number, number]) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: rgba[0], g: rgba[1], b: rgba[2], alpha: rgba[3] / 255 } } }).png().toBuffer();

test("un PNG rouge donne une palette dont la source est ce rouge, et ressort en PNG", async () => {
  const out = await processLogo(await png(200, 100, [224, 32, 32, 255]), "logo");
  assert.deepEqual(out.palette?.source, ["#e02020"]);
  const meta = await sharp(out.png).metadata();
  assert.equal(meta.format, "png");
  assert.equal(out.width, 200);
});

test("un grand logo est réduit à 640 px de côté, un petit à 256 px ; le petit n'a pas de palette", async () => {
  const big = await processLogo(await png(2000, 1000, [32, 64, 224, 255]), "logo");
  assert.equal(big.width, 640);
  assert.equal(big.height, 320);
  const small = await processLogo(await png(1000, 1000, [32, 64, 224, 255]), "logo_small");
  assert.equal(small.width, 256);
  assert.equal(small.palette, null);
});

test("un SVG est rastérisé : même palette que le PNG de même couleur", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#e02020"/></svg>');
  const out = await processLogo(svg, "logo");
  assert.deepEqual(out.palette?.source, ["#e02020"]);
  assert.equal((await sharp(out.png).metadata()).format, "png");
});

test("un JPG sur fond blanc : fond ignoré, logoOnWhite vrai", async () => {
  const jpg = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#ffffff" } })
    .composite([{ input: await png(40, 40, [224, 32, 32, 255]), left: 30, top: 30 }]).jpeg({ quality: 100 }).toBuffer();
  const out = await processLogo(jpg, "logo");
  assert.equal(out.palette?.logoOnWhite, true);
  assert.equal(out.palette?.source.length, 1);
});

test("des octets illisibles sont refusés par une BrandImageError", async () => {
  await assert.rejects(processLogo(Buffer.from("pas une image"), "logo"), BrandImageError);
});
