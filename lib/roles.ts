import { cache } from "react";
import { prisma } from "./db";
import { DEFAULT_ROLES, parsePermissions, serializePermissions, type PermissionKey } from "./permissions";

// Rôles en base (lot F2) : lecture une fois par requête, droits par défaut posés au premier passage pour une installation
// qui vient de migrer (table créée sans droits) — ensuite, seul l'écran Admin › Rôles et droits y touche.

export type RoleRow = { code: string; label: string; description: string; order: number; system: boolean; validationLevel: number; permissions: PermissionKey[]; count: number };

async function ensureDefaults() {
  const rows = await prisma.role.findMany();
  const missing = DEFAULT_ROLES.filter((d) => !rows.some((r) => r.code === d.code));
  const empty = rows.filter((r) => r.permissions === "" && r.description === "" && DEFAULT_ROLES.some((d) => d.code === r.code));
  for (const d of missing) await prisma.role.create({ data: { code: d.code, label: d.label, description: d.description, order: DEFAULT_ROLES.indexOf(d), system: true, validationLevel: d.validationLevel, permissions: serializePermissions(d.permissions) } });
  for (const r of empty) {
    const d = DEFAULT_ROLES.find((x) => x.code === r.code)!;
    await prisma.role.update({ where: { code: r.code }, data: { description: d.description, system: true, validationLevel: d.validationLevel, permissions: serializePermissions(d.permissions) } });
  }
  return missing.length || empty.length ? prisma.role.findMany() : rows;
}

export const getRoles = cache(async (): Promise<RoleRow[]> => {
  const [rows, counts] = await Promise.all([ensureDefaults(), prisma.person.groupBy({ by: ["role"], _count: { _all: true } })]);
  return rows
    .map((r) => ({ ...r, permissions: parsePermissions(r.permissions), count: counts.find((c) => c.role === r.code)?._count._all ?? 0 }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "fr"));
});

export const getRoleMap = cache(async () => {
  const roles = await getRoles();
  return new Map(roles.map((r) => [r.code, r]));
});

// Ce qu'une personne peut faire : son rôle, ses permissions, son niveau de validation (lib/rights.ts lit ces trois champs).
export type Actor = { role: string; permissions: readonly string[]; validationLevel: number };

export function withActor<T extends { role: string }>(map: Map<string, RoleRow>, p: T): T & Actor {
  const r = map.get(p.role);
  return { ...p, permissions: r?.permissions ?? [], validationLevel: r?.validationLevel ?? 0 };
}

export async function actorOf<T extends { role: string }>(p: T): Promise<T & Actor> {
  return withActor(await getRoleMap(), p);
}

// Le rôle siège-t-il au CODIR ? (teinte des avatars, listes de personnes) — pour une liste, une seule lecture de la table.
export function codirRole(map: Map<string, RoleRow>, role: string): boolean {
  return map.get(role)?.permissions.includes("codir.access") ?? false;
}
