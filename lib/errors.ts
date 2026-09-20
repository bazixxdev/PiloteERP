export const INTERNAL_ERROR = "Une erreur interne est survenue. Réessayez plus tard.";

export function reportInternalError(context: string, error: unknown): { code: "INTERNAL_ERROR"; error: string } {
  // Le détail reste côté serveur; ne jamais le retourner dans une Server Action.
  console.error(`[${context}]`, error);
  return { code: "INTERNAL_ERROR", error: INTERNAL_ERROR };
}
