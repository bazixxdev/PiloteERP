import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, DEMO_MODE } from "./auth";
import { withBase } from "./base-path";
import { prisma } from "./db";
import { buildRefMap, type RefMap } from "./refs";
import { actorOf, codirRole, getRoleMap, getRoles, withActor } from "./roles";

export const COOKIE = "pilote_person";

export type CurrentPerson = NonNullable<Awaited<ReturnType<typeof loadPerson>>>;

// La personne avec son pôle et, depuis le lot F2, les droits de son rôle (permissions, niveau de validation).
async function loadPerson(where: { id: string } | { userId: string }) {
  const p = await prisma.person.findUnique({ where, include: { pole: true } });
  return p ? actorOf(p) : null;
}

// Session en cours (better-auth) : l'utilisateur connecté, ou null.
export const getSessionUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

// Personne courante, ou null si personne n'est connecté (lot F). La personne est celle rattachée au compte ; en mode démo
// (PILOTE_DEMO=1), le cookie « Je suis… » permet à une personne connectée de prendre la place d'une autre, avec ses droits.
// Une personne désactivée ne passe pas, même avec une session ouverte.
export const getCurrentPersonOrNull = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const own = await loadPerson({ userId: user.id });
  if (!own || !own.active) return null;
  if (DEMO_MODE) {
    const jar = await cookies();
    const id = jar.get(COOKIE)?.value;
    if (id && id !== own.id) {
      const other = await loadPerson({ id });
      if (other?.active) return other;
    }
  }
  return own;
});

// Personne courante, sinon page de connexion. Une seule porte d'entrée pour tout l'outil.
export const getCurrentPerson = cache(async () => {
  const p = await getCurrentPersonOrNull();
  if (!p) redirect(withBase("/connexion"));
  return p;
});

export const getSettings = cache(async () => {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  return s ?? (await prisma.settings.create({ data: { id: 1 } }));
});

// Référentiels + les rôles (famille « role » servie par la table Role depuis le lot F2, pour que refLabel(refs, "role", …) tienne).
export const getRefs = cache(async (): Promise<RefMap> => {
  const [rows, roles] = await Promise.all([prisma.refValue.findMany({ orderBy: { order: "asc" } }), getRoles()]);
  return buildRefMap([...rows, ...roles.map((r) => ({ family: "role", code: r.code, label: r.label, color: null }))]);
});

// Personnes actives, avec les droits de leur rôle et le drapeau « siège au CODIR » (une lecture de la table Role pour toutes).
export const getPeople = cache(async () => {
  const [rows, roles] = await Promise.all([prisma.person.findMany({ where: { active: true }, include: { pole: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }), getRoleMap()]);
  return rows.map((p) => ({ ...withActor(roles, p), codir: codirRole(roles, p.role) }));
});
