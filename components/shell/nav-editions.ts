import { cache } from "react";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { byRelevance } from "@/lib/scope";

// Éditions ouvertes, par pertinence pour la personne : la recherche rapide et le fil d'Ariane s'en servent (une lecture par requête).
export const getNavEditions = cache(async () => {
  const current = await getCurrentPerson();
  const rows = await prisma.edition.findMany({
    where: { status: { not: "closed" } },
    select: { id: true, year: true, project: { select: { name: true, poleId: true, pilotId: true, guarantorId: true, secondaryPoles: { select: { poleId: true } } } }, team: { select: { personId: true } } },
    orderBy: [{ project: { name: "asc" } }, { year: "desc" }],
  });
  return byRelevance(current, rows, (e) => ({ project: e.project, teamIds: e.team.map((t) => t.personId) }));
});
