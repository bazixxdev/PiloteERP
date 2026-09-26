// Actions financées par une ligne (ou les lignes d'un dossier), vues depuis le financement : pour chaque lien action ↔ ligne,
// l'année de la ligne, le montant affecté, les heures de l'année par personne, les jalons faits et les réalisations de l'année.
// Helpers purs, partagés par le panneau de ligne, la page du dossier et l'export CSV (une seule règle pour les trois).
import { csvRow } from "./csv";

export type TimePerson = { id: string; name: string; poleId: string | null };

export type FundedAction = {
  lineId: string;
  year: number;
  amount: number | null;
  action: { id: string; name: string; projectName: string };
  totalHours: number;
  // Heures des seules personnes dont le temps est visible (canSeeTimeOf) ; les autres ne sortent qu'en compte et en somme.
  visible: { person: { id: string; name: string }; hours: number }[];
  hidden: { count: number; hours: number };
  milestonesDone: number;
  achievements: number;
};

// Répartit les heures par personne selon la visibilité du temps : le détail des seules personnes visibles, le reste agrégé.
export function splitHours(hours: { person: TimePerson; hours: number }[], canSee: (p: TimePerson) => boolean): Pick<FundedAction, "totalHours" | "visible" | "hidden"> {
  const visible: FundedAction["visible"] = [];
  const hidden = { count: 0, hours: 0 };
  let totalHours = 0;
  for (const h of hours) {
    totalHours += h.hours;
    if (canSee(h.person)) visible.push({ person: { id: h.person.id, name: h.person.name }, hours: h.hours });
    else { hidden.count += 1; hidden.hours += h.hours; }
  }
  visible.sort((x, y) => y.hours - x.hours || x.person.name.localeCompare(y.person.name));
  return { totalHours, visible, hidden };
}

// Le libellé de l'agrégat, le même que sur la page de l'action (onglet Heures).
export function hiddenPeopleLabel(count: number): string {
  return `${count} ${count > 1 ? "autres personnes" : "autre personne"} : détail non visible`;
}

export const sortFunded = (xs: FundedAction[]) =>
  [...xs].sort((a, b) => a.year - b.year || a.action.projectName.localeCompare(b.action.projectName) || a.action.name.localeCompare(b.action.name));

const num = (n: number) => n.toFixed(2).replace(".", ",");
const euro = (n: number | null) => (n === null ? "" : String(Math.round(n)));

// CSV `projet;action;personne;heures;montant` : une ligne par action × personne (sur l'année de la ligne). Le montant du lien
// n'est porté que par la première ligne de l'action, pour qu'une somme de la colonne ne le compte qu'une fois ; une action sans
// heure garde une ligne (personne vide, 0 h) pour son montant. Les personnes non visibles tiennent en une ligne agrégée.
export function fundedActionsCsv(items: FundedAction[]): string {
  const rows: unknown[][] = [["projet", "action", "personne", "heures", "montant"]];
  for (const f of sortFunded(items)) {
    const people: [string, number][] = f.visible.map((v) => [v.person.name, v.hours]);
    if (f.hidden.count > 0) people.push([hiddenPeopleLabel(f.hidden.count), f.hidden.hours]);
    if (people.length === 0) people.push(["", 0]);
    people.forEach(([who, hours], i) => rows.push([f.action.projectName, f.action.name, who, num(hours), i === 0 ? euro(f.amount) : ""]));
  }
  return rows.map(csvRow).join("\n");
}
