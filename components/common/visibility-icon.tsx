import { Eye, Lock, Users } from "lucide-react";

// Icône d'une visibilité (listes, notes) : cadenas privé, œil partagé, groupe pour toute la CRESS.
export function visibilityIcon(v: string) {
  return v === "private" ? Lock : v === "all" ? Users : Eye;
}
