import { FIELDS } from "@/lib/fields";
import { has, type Actor } from "@/lib/rights";

/** A proposal cannot bypass the permission of a financial field mutation. */
export function canAcceptProposedField(me: Actor, field: string): boolean {
  const def = FIELDS.edition[field];
  if (!def) return false;
  return def.layer !== "budget" || has(me, "fiche.budget");
}
