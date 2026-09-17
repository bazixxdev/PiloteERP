"use server";

import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { newToken } from "@/lib/ics";
import { canAdmin } from "@/lib/rights";

// Crée le jeton du flux personnel s'il n'existe pas ; « régénérer » invalide l'ancien abonnement.
export async function ensureMyIcsToken(regenerate = false): Promise<string> {
  const me = await getCurrentPerson();
  if (me.icsToken && !regenerate) return me.icsToken;
  const token = newToken();
  await prisma.person.update({ where: { id: me.id }, data: { icsToken: token } });
  return token;
}

export async function ensureTeamIcsToken(regenerate = false): Promise<string | null> {
  const me = await getCurrentPerson();
  if (!canAdmin(me) && !regenerate) {
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    return s?.teamIcsToken ?? null;
  }
  if (!canAdmin(me)) return null;
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  if (s?.teamIcsToken && !regenerate) return s.teamIcsToken;
  const token = newToken();
  await prisma.settings.update({ where: { id: 1 }, data: { teamIcsToken: token } });
  return token;
}
