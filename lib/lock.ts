import { asDecisions, isCircuitComplete, type DecisionRow, type Level } from "./fiche-validation";

// Une fiche dont le cycle de validation est terminé (tous les niveaux actifs du circuit validés dans le tour courant, ou année
// validée / clôturée) est verrouillée : ses couches 1 à 3 ne changent que par proposition acceptée. Un « à retravailler »
// rouvre le circuit, donc la fiche. Depuis la tâche 13, le circuit (FicheValidation) remplace codirDecision.
export const LOCKED_STATUSES = ["validated", "closed"];
export const isLocked = (e: { status: string; ficheValidations: DecisionRow[] }, levels: Level[]) => LOCKED_STATUSES.includes(e.status) || isCircuitComplete(levels, asDecisions(e.ficheValidations));
