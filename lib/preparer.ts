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
