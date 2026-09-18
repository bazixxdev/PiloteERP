// Périmètre d'une personne : son pôle d'abord (EF-G6). Les fonctions transversales (direction, RAF, assistante) voient tout.
// Un projet appartient à un pôle principal (celui du pilote) et, s'il est commun, à des pôles secondaires.

import { has, type Actor } from "./rights";
import { V, cap, mon, pl } from "@/lib/vocab";

export type ProjectPoles = { poleId: string; secondaryPoles?: { poleId: string }[] };
export type Viewer = Actor & { id: string; poleId: string | null };

export function projectPoleIds(p: ProjectPoles): string[] {
  return [p.poleId, ...(p.secondaryPoles ?? []).map((x) => x.poleId)];
}

export function isTransversal(me: Viewer): boolean {
  return me.poleId === null || has(me, "scope.all");
}

// Le projet est-il dans le pôle de la personne (principal ou secondaire) ?
export function inMyPole(me: Viewer, p: ProjectPoles): boolean {
  return me.poleId !== null && projectPoleIds(p).includes(me.poleId);
}

// Dans mon périmètre quotidien : mon pôle, ou une édition où je pilote / contribue.
export function inMyScope(me: Viewer, p: ProjectPoles & { pilotId?: string }, teamIds: string[] = []): boolean {
  if (isTransversal(me)) return true;
  return inMyPole(me, p) || p.pilotId === me.id || teamIds.includes(me.id);
}

export type Perimeter = "pole" | "cress";

// Périmètre par défaut d'un écran : mon pôle si j'en ai un, toute la CRESS sinon ; « perimetre=cress » élargit.
export function perimeterFrom(me: Viewer, param: string | undefined): Perimeter {
  if (param === "cress" || param === "pole") return param;
  return isTransversal(me) ? "cress" : "pole";
}

// Ordre de pertinence pour une personne : 0 je pilote · 1 je contribue (équipe ou action) · 2 mon pôle · 3 le reste.
export type Tier = 0 | 1 | 2 | 3;
export const TIER_LABEL: Record<Tier, string> = { 0: "Je pilote", 1: "Je contribue" /* vocab-ok : verbe */, 2: cap(mon(V.pole)), 3: `Autres ${pl(V.pole)}` };

export function relevanceTier(me: Viewer, p: ProjectPoles & { pilotId?: string; guarantorId?: string | null }, teamIds: string[] = [], actionOwnerIds: string[] = []): Tier {
  if (p.pilotId === me.id) return 0;
  if (teamIds.includes(me.id) || actionOwnerIds.includes(me.id) || p.guarantorId === me.id) return 1;
  if (inMyPole(me, p)) return 2;
  return 3;
}

// Tri stable par pertinence puis par un critère secondaire (alerte, ancienneté…).
export function byRelevance<T>(me: Viewer, items: T[], pick: (x: T) => { project: ProjectPoles & { pilotId?: string; guarantorId?: string | null }; teamIds?: string[]; ownerIds?: string[] }, secondary?: (a: T, b: T) => number): (T & { tier: Tier })[] {
  return items
    .map((x) => { const k = pick(x); return { ...x, tier: relevanceTier(me, k.project, k.teamIds, k.ownerIds) }; })
    .sort((a, b) => a.tier - b.tier || (secondary ? secondary(a, b) : 0));
}
