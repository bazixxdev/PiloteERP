import { BookUser, HandCoins, CalendarDays, CalendarClock, Clock, LayoutGrid, Coffee, Bell, Presentation, Gavel, FileSignature, BarChart3, ListTodo, NotebookPen, Inbox, Settings, UserCircle, Lightbulb, CircleHelp, type LucideIcon } from "lucide-react";

// Une seule iconographie pour un même écran : barre latérale, navigation basse, titre de page (retour du 15/09).
// L'ordre compte : le premier motif qui correspond gagne.
const SECTION_ICONS: [RegExp, LucideIcon][] = [
  [/^\/projets\/proposer/, Lightbulb],
  [/^\/(portefeuille|edition|projets)/, FileSignature],
  [/^\/ma-semaine/, CalendarDays],
  [/^\/taches/, ListTodo],
  [/^\/notes/, NotebookPen],
  [/^\/(temps|cloture)/, Clock],
  [/^\/(demandes|validations)/, Inbox],
  [/^\/cafe/, Coffee],
  [/^\/annuel/, LayoutGrid],
  [/^\/plan-de-charge/, BarChart3],
  [/^\/(conventions|matrice|appels)/, HandCoins],
  [/^\/(organisations|contacts|financeurs)/, BookUser],
  [/^\/(rappels|echeances)/, CalendarClock],
  [/^\/notifications/, Bell],
  [/^\/codir/, Gavel],
  [/^\/seminaire/, Presentation],
  [/^\/admin/, Settings],
  [/^\/compte/, UserCircle],
  [/^\/aide/, CircleHelp],
];

export function iconFor(pathname: string): LucideIcon | null {
  return SECTION_ICONS.find(([re]) => re.test(pathname))?.[1] ?? null;
}
