import { Briefcase, CalendarDays, CalendarClock, Clock, LayoutGrid, Coffee, Bell, Presentation, Gavel, FileSignature, BarChart3, ListTodo, NotebookPen, Inbox, Settings, UserCircle, Lightbulb, type LucideIcon } from "lucide-react";

// Une seule iconographie pour un même écran : barre latérale, navigation basse, titre de page (retour du 15/09).
// L'ordre compte : le premier motif qui correspond gagne.
const SECTION_ICONS: [RegExp, LucideIcon][] = [
  [/^\/projets\/proposer/, Lightbulb],
  [/^\/(portefeuille|edition)/, Briefcase],
  [/^\/ma-semaine/, CalendarDays],
  [/^\/taches/, ListTodo],
  [/^\/notes/, NotebookPen],
  [/^\/(temps|cloture)/, Clock],
  [/^\/(demandes|validations)/, Inbox],
  [/^\/cafe/, Coffee],
  [/^\/annuel/, LayoutGrid],
  [/^\/plan-de-charge/, BarChart3],
  [/^\/(projets|conventions|financeurs|appels)/, FileSignature],
  [/^\/(rappels|echeances)/, CalendarClock],
  [/^\/notifications/, Bell],
  [/^\/codir/, Gavel],
  [/^\/seminaire/, Presentation],
  [/^\/admin/, Settings],
  [/^\/compte/, UserCircle],
];

export function iconFor(pathname: string): LucideIcon | null {
  return SECTION_ICONS.find(([re]) => re.test(pathname))?.[1] ?? null;
}
