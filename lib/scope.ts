// Périmètre d'une personne : son pôle d'abord (EF-G6). Les fonctions transversales (direction, RAF, assistante) voient tout.
// Un projet appartient à un pôle principal (celui du pilote) et, s'il est commun, à des pôles secondaires.

export type ProjectPoles = { poleId: string; secondaryPoles?: { poleId: string }[] };
export type Viewer = { id: string; role: string; poleId: string | null };

export function projectPoleIds(p: ProjectPoles): string[] {
  return [p.poleId, ...(p.secondaryPoles ?? []).map((x) => x.poleId)];
}

export function isTransversal(me: Viewer): boolean {
  return me.poleId === null || me.role === "director" || me.role === "raf" || me.role === "assistant";
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
