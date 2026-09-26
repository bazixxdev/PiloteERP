import { prisma } from "./db";
import type { Level } from "./fiche-validation";

// Les niveaux du circuit de validation des fiches (Admin › Paramètres), dans l'ordre, actifs ou non : un niveau inactif garde
// ses décisions passées lisibles, il n'est simplement plus demandé.
export async function loadFicheLevels(): Promise<Level[]> {
  return prisma.ficheValidationLevel.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true, order: true, label: true, permission: true, active: true } });
}

// Ce que la fiche, le verrou et l'export lisent d'une année : ses décisions, avec le niveau et qui a décidé.
export const ficheValidationsInclude = { include: { level: true, decider: { select: { id: true, name: true } } }, orderBy: { decidedAt: "asc" as const } };
