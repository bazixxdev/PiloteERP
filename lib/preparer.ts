// « Préparer l'année suivante » (ex-séminaire, spec vocabulaire-gouvernance § 3) : la décision prise pour chaque projet est
// consignée comme une Decision datée sur l'année source, plus dans codirDecision. Module pur : le texte de la décision et sa
// relecture (la page retrouve ce qui a été décidé pour l'année visée).
export type PrepareChoice = "renew" | "adjust" | "stop";

const WORD: Record<PrepareChoice, string> = { renew: "Reconduit", adjust: "Ajusté", stop: "Arrêté" };

export const isPrepareChoice = (v: unknown): v is PrepareChoice => v === "renew" || v === "adjust" || v === "stop";

export function prepareDecisionBody(choice: PrepareChoice, year: number): string {
  return `${WORD[choice]} pour ${year}`;
}

// La décision la plus récente pour `year` parmi les décisions de l'année source (triées de la plus récente à la plus ancienne).
export function prepareChoiceOf(bodies: string[], year: number): PrepareChoice | null {
  for (const b of bodies) {
    for (const c of Object.keys(WORD) as PrepareChoice[]) if (b.trim() === prepareDecisionBody(c, year)) return c;
  }
  return null;
}

// L'instance retenue : celle choisie si elle est dans la liste de l'admin, sinon la première de la liste.
export function prepareInstance(instances: string[], chosen?: string | null): string | null {
  return chosen && instances.includes(chosen) ? chosen : instances[0] ?? null;
}

// Une ligne de « Préparer {year} » à décider en lot : pas encore d'année `year`, une année source qui est bien `year - 1`
// (la reconduction décale d'un an, pas plus : batchCreateEditions refuse le reste), et pas déjà arrêtée pour `year`.
// Les projets rangés (archivés) ne sont pas listés du tout. Un projet interne (spec actions § 2) n'est proposé que s'il
// est récurrent : `kind`/`recurring` absents (anciens appels, tests) ne changent rien, seul un projet explicitement interne
// et non récurrent est écarté.
export function toPrepare(r: { nextId: string | null; sourceId: string | null; sourceYear: number | null; decision: string | null; kind?: string | null; recurring?: boolean }, year: number): boolean {
  if (!r.nextId && Boolean(r.sourceId) && r.sourceYear === year - 1 && r.decision !== "stop") {
    return r.kind !== "internal" || Boolean(r.recurring);
  }
  return false;
}
