// Circuit de validation de la fiche (spec vocabulaire § 3) : des niveaux réglés par instance, décidés dans l'ordre.
// Module pur : la commande (app/actions/fiche-validation.ts), le verrou (lib/lock.ts), la fiche et l'export Word le lisent.
import { V, cap, le } from "@/lib/vocab";

export type Level = { id: string; order: number; label: string; permission: string; active: boolean };
export type Decision = { levelId: string; decision: "approved" | "rework" | "refused"; decidedAt: Date };
export type FicheDecision = Decision["decision"];

// Les droits qu'un niveau peut exiger (Admin › Paramètres › Circuit de validation des fiches) ; déclarés dans lib/permissions.ts.
export const FICHE_LEVEL_PERMISSIONS = ["fiche.validate.1", "fiche.validate.2", "fiche.validate.3"] as const;
export const isLevelPermission = (p: string): p is (typeof FICHE_LEVEL_PERMISSIONS)[number] => (FICHE_LEVEL_PERMISSIONS as readonly string[]).includes(p);
export const isFicheDecision = (d: unknown): d is FicheDecision => d === "approved" || d === "rework" || d === "refused";
// Les lignes FicheValidation lues en base (decision: string) : une valeur inconnue ne compte pas dans le circuit.
export type DecisionRow = { levelId: string; decision: string; decidedAt: Date };
export const asDecisions = <R extends DecisionRow>(rows: R[]) => rows.filter((r): r is R & { decision: FicheDecision } => isFicheDecision(r.decision));

const active = (levels: Level[]) => levels.filter((l) => l.active).sort((a, b) => a.order - b.order);
const byDate = <D extends Decision>(ds: D[]) => [...ds].sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime());

// Un « à retravailler » remet le circuit à zéro : seules comptent les décisions prises après le dernier.
export function currentRound<D extends Decision>(decisions: D[]): D[] {
  const sorted = byDate(decisions);
  const last = sorted.map((d) => d.decision).lastIndexOf("rework");
  return sorted.slice(last + 1);
}

// Le premier niveau actif pas encore « validé » dans le tour courant (un refus ne fait pas avancer) ; null = circuit terminé.
export function nextLevel(levels: Level[], decisions: Decision[]): Level | null {
  const approved = new Set(currentRound(decisions).filter((d) => d.decision === "approved").map((d) => d.levelId));
  return active(levels).find((l) => !approved.has(l.id)) ?? null;
}

export function isCircuitComplete(levels: Level[], decisions: Decision[]): boolean {
  return active(levels).length > 0 && nextLevel(levels, decisions) === null;
}

// Statut de l'année après une décision (la seule règle) : « validée » au bout du circuit, « re-challengée » après un « à
// retravailler », inchangé sinon (un refus garde l'année telle quelle). Une année en cours ou close ne recule jamais : en
// cours, « à retravailler » rouvre la fiche (le circuit repart) mais l'année s'exécute, elle reste en cours (décision du
// contrôleur, 26/09) ; close, elle ne se décide plus (ficheDecisionRefusal).
const EXECUTING = ["in_progress", "closed"];
export function statusAfter(levels: Level[], decisions: Decision[], current: string): string {
  const last = byDate(decisions).at(-1);
  if (EXECUTING.includes(current)) return current;
  if (last?.decision === "rework") return "rechallenged";
  if (!isCircuitComplete(levels, decisions)) return current;
  return "validated";
}

// Ce que la fiche affiche : chaque niveau actif, sa dernière décision du tour courant, et lequel est à décider.
export function circuitSteps<D extends Decision>(levels: Level[], decisions: D[]): { level: Level; decision: D | null; isNext: boolean }[] {
  const round = currentRound(decisions);
  const next = nextLevel(levels, decisions);
  return active(levels).map((level) => ({ level, decision: round.filter((d) => d.levelId === level.id).at(-1) ?? null, isNext: level.id === next?.id }));
}

export const DECISION_LABEL: Record<FicheDecision, string> = { approved: "validé", rework: "à retravailler", refused: "refusé" };

// Le niveau sur lequel porte une décision : le prochain à décider. Circuit terminé, seul « à retravailler » reste possible, au
// dernier niveau actif : c'est ainsi qu'on rouvre une fiche validée (le circuit repart du premier niveau).
export function decisionLevel(levels: Level[], decisions: Decision[], decision: FicheDecision): Level | null {
  const next = nextLevel(levels, decisions);
  if (next) return next;
  if (decision !== "rework" || !isCircuitComplete(levels, decisions)) return null;
  return active(levels).at(-1) ?? null;
}

// La garde de decideFiche, la seule : la fiche l'appelle pour savoir quels boutons montrer, la commande pour refuser.
// `holds` dit si la personne a un droit ; `isPilot` si elle pilote le projet (on ne décide jamais sa propre fiche).
export function ficheDecisionRefusal(c: { levels: Level[]; decisions: Decision[]; status: string; isPilot: boolean; holds: (permission: string) => boolean; decision: FicheDecision; comment: string }): string | null {
  if (c.status === "closed") return `${cap(V.edition)} close (bilan fait) : le circuit de validation ne se rouvre plus.`;
  const level = decisionLevel(c.levels, c.decisions, c.decision);
  if (!level) return active(c.levels).length === 0 ? "Aucun niveau de validation actif : le circuit se règle dans Admin › Paramètres." : "Circuit terminé : la fiche est validée ; seul « À retravailler » la rouvre.";
  if (!isLevelPermission(level.permission) || !c.holds(level.permission)) return `Vous n'avez pas le droit de décider au niveau « ${level.label} ».`;
  if (c.isPilot) return `On ne décide pas sa propre fiche : ${le(V.pilote)} ne valide à aucun niveau.`;
  if (c.decision !== "approved" && !c.comment.trim()) return "Un commentaire est obligatoire pour « À retravailler » ou « Refuser » : il dit quoi reprendre.";
  return null;
}
