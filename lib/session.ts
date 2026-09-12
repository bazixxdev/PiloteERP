import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import { buildRefMap, type RefMap } from "./refs";

export const COOKIE = "pilote_person";

export type CurrentPerson = NonNullable<Awaited<ReturnType<typeof loadPerson>>>;

async function loadPerson(id: string | undefined) {
  if (id) {
    const p = await prisma.person.findUnique({ where: { id }, include: { pole: true } });
    if (p) return p;
  }
  return prisma.person.findFirst({ where: { role: "director", active: true }, include: { pole: true }, orderBy: { order: "asc" } });
}

// Personne courante (sélecteur « Je suis… »). Par défaut : la direction.
export const getCurrentPerson = cache(async () => {
  const jar = await cookies();
  const p = await loadPerson(jar.get(COOKIE)?.value);
  if (!p) throw new Error("Aucune personne en base : lancez `npm run seed`.");
  return p;
});

export const getSettings = cache(async () => {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  return s ?? (await prisma.settings.create({ data: { id: 1 } }));
});

export const getRefs = cache(async (): Promise<RefMap> => {
  const rows = await prisma.refValue.findMany({ orderBy: { order: "asc" } });
  return buildRefMap(rows);
});

export const getPeople = cache(async () => {
  return prisma.person.findMany({ where: { active: true }, include: { pole: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
});
