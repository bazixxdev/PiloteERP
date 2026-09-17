// Droits (EF-K1, EF-B1b). Depuis le lot F2, un droit se lit dans les permissions du rôle (table Role, catalogue
// lib/permissions.ts) — jamais dans le code du rôle — et le contexte (je pilote, j'en suis l'équipe, c'est mon pôle) reste ici.
// Tout l'outil passe par ces fonctions ; un `role === "…"` ailleurs n'est qu'une identité (« la directrice », « le responsable
// du pôle »), pas un droit.

import type { PermissionKey } from "./permissions";
import type { Actor } from "./roles";

export type { Actor };

export const has = (me: Actor, key: PermissionKey): boolean => me.permissions.includes(key);

export type Layer = "strategic" | "means" | "proposal" | "validation" | "year" | "budget";

export const LAYER_OWNER_LABEL: Record<Layer, string> = {
  strategic: "à remplir par la direction",
  means: "à remplir par la RAF et la direction",
  proposal: "à remplir par le pilote",
  validation: "renseigné par le CODIR",
  year: "renseigné par le pilote au fil de l'année",
  budget: "renseigné par la RAF",
};

// Siège au CODIR : montants, page CODIR, séminaire, écran café.
export function isCodir(me: Actor): boolean {
  return has(me, "codir.access");
}

// Responsable de pôle sur ce pôle : la permission, et le pôle est le sien.
export const leadsPole = (me: Actor, samePole: boolean): boolean => has(me, "pole.manage") && samePole;

export function canWriteLayer(me: Actor, layer: Layer, isPilotOfEdition: boolean, isTeamMember: boolean, samePole = true): boolean {
  switch (layer) {
    case "strategic":
      return has(me, "fiche.strategic");
    case "means":
      return has(me, "fiche.means");
    case "validation":
      return has(me, "fiche.validation");
    case "budget":
      return has(me, "fiche.budget");
    case "proposal":
      return has(me, "edition.edit_all") || isPilotOfEdition;
    case "year":
      return has(me, "edition.edit_all") || isPilotOfEdition || leadsPole(me, samePole) || (isTeamMember && has(me, "edition.contribute"));
  }
}

// Actions : le pilote, l'équipe projet, le responsable de pôle sur son pôle, la direction.
export function canEditActions(me: Actor, isPilotOfEdition: boolean, isTeamMember: boolean, samePole = true): boolean {
  return canWriteLayer(me, "year", isPilotOfEdition, isTeamMember, samePole);
}

// Intervenir sur une édition comme son pilote (propositions, remarques, réalisations, confirmations…).
export function canActAsPilot(me: Actor, isPilotOfEdition: boolean, isTeamMember = false): boolean {
  return has(me, "edition.edit_all") || isPilotOfEdition || isTeamMember;
}

export function canEditFunding(me: Actor): boolean {
  return has(me, "funding.edit");
}

export function canEditCalls(me: Actor): boolean {
  return has(me, "calls.edit");
}

export function canSetEditionStatus(me: Actor): boolean {
  return has(me, "edition.status");
}

export function canLockMonths(me: Actor): boolean {
  return has(me, "time.lock");
}

export function canPlanLoad(me: Actor, isPilotOfEdition = false): boolean {
  return has(me, "load.plan_all") || isPilotOfEdition;
}

export function canTrackExpenses(me: Actor): boolean {
  return has(me, "expenses.track");
}

export function canTreatAllRequests(me: Actor): boolean {
  return has(me, "requests.treat_all");
}

export function canConsignDecision(me: Actor, samePole: boolean, instance = ""): boolean {
  return has(me, "decisions.consign_all") || (has(me, "pole.manage") && (instance === "codir" || samePole));
}

export function canAdmin(me: Actor): boolean {
  return has(me, "admin.manage");
}

export function canManageRoles(me: Actor): boolean {
  return has(me, "roles.manage");
}

// Attendu·e en clôture mensuelle.
export function declaresTime(me: Actor): boolean {
  return has(me, "time.declare");
}

// Niveau de validation qu'une personne peut approuver (1 son édition, 2 son pôle, 3 partout ; 0 = informée, pas valideuse).
export function validationLevelOf(me: Actor): number {
  return me.validationLevel;
}

// Peut-on décider cette demande ? Niveau 1 seulement sur son édition, niveau 2 seulement sur son pôle, jamais sa propre demande.
export function canDecideValidation(
  me: Actor & { id: string; poleId: string | null },
  v: { requiredLevel: number; requesterId: string; edition: { project: { pilotId: string; poleId: string; secondaryPoles?: { poleId: string }[] } } },
): boolean {
  if (v.requesterId === me.id) return false;
  const level = validationLevelOf(me);
  if (level < v.requiredLevel) return false;
  if (level >= 3) return true;
  if (level === 2) return me.poleId !== null && [v.edition.project.poleId, ...(v.edition.project.secondaryPoles ?? []).map((x) => x.poleId)].includes(me.poleId);
  return v.edition.project.pilotId === me.id;
}

// Qui voit les temps de qui (EF-K6).
export function canSeeTimeOf(
  viewer: Actor & { id: string; poleId: string | null },
  target: { id: string; poleId: string | null },
  visibility: string,
): boolean {
  if (viewer.id === target.id) return true;
  if (visibility === "all") return true;
  if (has(viewer, "time.view_all")) return visibility !== "self";
  if (visibility === "codir") return isCodir(viewer);
  if (visibility === "self_pole_lead_raf") return leadsPole(viewer, viewer.poleId === target.poleId);
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
