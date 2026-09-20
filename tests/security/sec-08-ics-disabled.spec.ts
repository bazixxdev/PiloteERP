import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.afterAll(async () => prisma.$disconnect());

test("SEC-08 — le flux ICS personnel est refusé pendant la désactivation", async ({ request, baseURL }) => {
  const person = await prisma.person.findUnique({ where: { email: "lucas.perrin@exemple.fr" }, select: { id: true, icsToken: true, active: true } });
  expect(person?.icsToken).toBeTruthy();
  const token = person!.icsToken!;
  await prisma.person.update({ where: { id: person!.id }, data: { active: true } });
  const active = await request.get(`/api/agenda/${token}.ics`);
  expect(active.status()).toBe(200);
  expect(await active.text()).toContain("BEGIN:VCALENDAR");

  await prisma.person.update({ where: { id: person!.id }, data: { active: false } });
  const inactive = await request.get(`/api/agenda/${token}.ics`);
  expect(inactive.status()).toBe(404);

  await prisma.person.update({ where: { id: person!.id }, data: { active: true } });
  const reactivated = await request.get(`/api/agenda/${token}.ics`);
  expect(reactivated.status()).toBe(200);
  expect(reactivated.url()).toContain(String(baseURL));
});
