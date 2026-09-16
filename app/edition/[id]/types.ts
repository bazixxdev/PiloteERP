import type { EditionFull } from "@/lib/queries";
import type { CurrentPerson } from "@/lib/session";
import type { RefMap } from "@/lib/refs";
import type { Settings, Funder, Convention } from "@prisma/client";

export type TabCtx = {
  e: EditionFull;
  me: CurrentPerson;
  refs: RefMap;
  settings: Settings;
  people: Awaited<ReturnType<typeof import("@/lib/session").getPeople>>;
  funders: Funder[];
  conventions: (Convention & { lines: { id: string; amountGranted: number | null; amountRequested: number | null; editionId: string }[] })[];
  isPilot: boolean;
  isTeam: boolean;
  // Mode relecture : les boutons « Remarque » s'affichent sous les rubriques (sinon, seules les remarques existantes).
  feedback?: boolean;
  // Mes tâches ouvertes sur cette édition (Aperçu).
  myTasks?: { id: string; label: string; dueDate: Date | null; action: { name: string } | null }[];
  // Ligne de financement à ouvrir en panneau à l'arrivée (clic sur une cellule de la matrice « Qui finance quoi »).
  openLine?: string | null;
  // Champ à surligner dans ce panneau (le chiffre d'où l'on a cliqué).
  openField?: string | null;
};
