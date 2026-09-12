// Droits par rôle (EF-K1, EF-B1b). Le prototype n'a pas d'authentification :
// la personne courante est choisie dans le sélecteur « Je suis… ».

export type Role = "pilot" | "contributor" | "pole_lead" | "director" | "raf" | "assistant";

export const CODIR_ROLES: Role[] = ["director", "raf", "pole_lead"];

export type Layer = "strategic" | "means" | "proposal" | "validation" | "year" | "budget";

export const LAYER_OWNER_LABEL: Record<Layer, string> = {
  strategic: "à remplir par la direction",
  means: "à remplir par la RAF et la direction",
  proposal: "à remplir par le pilote",
  validation: "renseigné par le CODIR",
  year: "renseigné par le pilote au fil de l'année",
  budget: "renseigné par la RAF",
};

export function isCodir(role: string): boolean {
  return CODIR_ROLES.includes(role as Role);
}

export function canWriteLayer(role: string, layer: Layer, isPilotOfEdition: boolean, isTeamMember: boolean): boolean {
  switch (layer) {
    case "strategic":
      return role === "director";
    case "means":
      return role === "director" || role === "raf";
    case "validation":
      return role === "director";
    case "budget":
      return role === "raf" || role === "director";
    case "proposal":
    case "year":
      return role === "director" || isPilotOfEdition || (role === "pole_lead") || (isTeamMember && role !== "assistant");
  }
}

export function canEditActions(role: string, isPilotOfEdition: boolean, isTeamMember: boolean): boolean {
  return role === "director" || role === "pole_lead" || isPilotOfEdition || (isTeamMember && role === "contributor") || role === "raf";
}

export function canEditFunding(role: string): boolean {
  return role === "raf" || role === "director";
}

export function canLockMonths(role: string): boolean {
  return role === "raf" || role === "director";
}

export function canAdmin(role: string): boolean {
  return role === "director" || role === "raf";
}

// Niveau de validation qu'une personne peut approuver.
export function validationLevelOf(role: string): number {
  if (role === "director") return 3;
  if (role === "pole_lead") return 2;
  if (role === "raf") return 2;
  if (role === "pilot") return 1;
  return 0;
}

// Qui voit les temps de qui (EF-K6).
export function canSeeTimeOf(
  viewer: { id: string; role: string; poleId: string | null },
  target: { id: string; poleId: string | null },
  visibility: string,
): boolean {
  if (viewer.id === target.id) return true;
  if (visibility === "all") return true;
  if (viewer.role === "director" || viewer.role === "raf") return visibility !== "self";
  if (visibility === "codir") return isCodir(viewer.role);
  if (visibility === "self_pole_lead_raf") return viewer.role === "pole_lead" && viewer.poleId === target.poleId;
  return false;
}

// Niveau requis calculé depuis le montant, les seuils et l'enveloppe restante (EF-F2).
export function requiredLevelFor(
  amount: number | null | undefined,
  settings: { validationThresholdLevel1: number; validationThresholdLevel2: number },
  remaining: number | null,
): number {
  const a = amount ?? 0;
  if (remaining !== null && a > remaining) return 3;
  if (a > settings.validationThresholdLevel2) return 3;
  if (a > settings.validationThresholdLevel1) return 2;
  return 1;
}
