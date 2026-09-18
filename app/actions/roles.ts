"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canManageRoles } from "@/lib/rights";
import { DEFAULT_ROLES, isPermissionKey, serializePermissions, type PermissionKey } from "@/lib/permissions";
import { V, cap } from "@/lib/vocab";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// Rôles et droits (lot F2) : réservé au droit « roles.manage ». Garde-fou : Direction garde toujours l'administration et la
// gestion des rôles (personne ne peut enfermer l'installation dehors).
async function guard(): Promise<string | null> {
  const me = await getCurrentPerson();
  return canManageRoles(me) ? null : "Seules les personnes habilitées modifient les rôles et leurs droits.";
}

const LOCKED: Record<string, PermissionKey[]> = { director: ["admin.manage", "roles.manage"] };

const normCode = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export async function setRolePermission(code: string, key: string, on: boolean): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  if (!isPermissionKey(key)) return { ok: false, error: "Droit inconnu." };
  const r = await prisma.role.findUnique({ where: { code } });
  if (!r) return { ok: false, error: "Rôle introuvable." };
  if (!on && LOCKED[code]?.includes(key)) return { ok: false, error: `Le rôle ${cap(V.direction)} garde toujours l'administration : sinon plus personne ne pourrait rouvrir la porte.` };
  const set = new Set(r.permissions.split(",").filter(Boolean));
  if (on) set.add(key); else set.delete(key);
  await prisma.role.update({ where: { code }, data: { permissions: serializePermissions(Array.from(set)) } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateRole(code: string, input: { label?: string; description?: string; validationLevel?: number }): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const r = await prisma.role.findUnique({ where: { code } });
  if (!r) return { ok: false, error: "Rôle introuvable." };
  const data: { label?: string; description?: string; validationLevel?: number } = {};
  if (input.label !== undefined) { const label = input.label.trim(); if (!label) return { ok: false, error: "Le libellé est obligatoire." }; data.label = label; }
  if (input.description !== undefined) data.description = input.description.trim();
  if (input.validationLevel !== undefined) { const lv = Math.round(input.validationLevel); if (lv < 0 || lv > 3) return { ok: false, error: "Niveau entre 0 et 3." }; data.validationLevel = lv; }
  await prisma.role.update({ where: { code }, data });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Nouveau rôle, copié d'un rôle existant (droits et niveau) : le code vient du libellé et reste stable ensuite.
export async function createRole(label: string, copyOf?: string | null): Promise<Result<{ code: string }>> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const name = label.trim();
  if (!name) return { ok: false, error: "Donnez un nom au rôle." };
  let code = normCode(name);
  if (!code) return { ok: false, error: "Nom invalide." };
  if (await prisma.role.findUnique({ where: { code } })) code = `${code}_${Date.now().toString(36).slice(-4)}`;
  const src = copyOf ? await prisma.role.findUnique({ where: { code: copyOf } }) : null;
  const count = await prisma.role.count();
  await prisma.role.create({ data: { code, label: name, description: src ? `Copie de « ${src.label} ».` : "", order: 10 + count, system: false, validationLevel: src?.validationLevel ?? 0, permissions: src?.permissions ?? "" } });
  revalidatePath("/", "layout");
  return { ok: true, data: { code } };
}

// Supprimer un rôle créé : jamais un rôle système, jamais un rôle encore porté par quelqu'un.
export async function deleteRole(code: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const r = await prisma.role.findUnique({ where: { code }, include: { _count: { select: { people: true } } } });
  if (!r) return { ok: false, error: "Rôle introuvable." };
  if (r.system) return { ok: false, error: "Un rôle système ne se supprime pas (ses droits, si)." };
  if (r._count.people > 0) return { ok: false, error: `Ce rôle est encore porté par ${r._count.people} personne${r._count.people > 1 ? "s" : ""} : changez leur rôle d'abord.` };
  await prisma.role.delete({ where: { code } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Remettre les droits d'origine sur un rôle système (le libellé et la description restent).
export async function resetRole(code: string): Promise<Result> {
  const d = await guard(); if (d) return { ok: false, error: d };
  const def = DEFAULT_ROLES.find((r) => r.code === code);
  if (!def) return { ok: false, error: "Pas de droits d'origine pour ce rôle." };
  await prisma.role.update({ where: { code }, data: { validationLevel: def.validationLevel, permissions: serializePermissions(def.permissions) } });
  revalidatePath("/", "layout");
  return { ok: true };
}
