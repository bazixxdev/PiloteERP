// Délégation (25/09, docs/superpowers/specs/2026-09-25-delegation-design.md) — fonctions pures : périodes, filtres, droits.
// Une délégation vaut pour l'année ; la période n'est qu'un filtre de la vue (les objectifs sont des actions datées).
import { has } from "./rights";
import type { Viewer } from "./scope";

export type Period = { key: string; label: string; from: Date; to: Date };

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// « 01-06,07-08,09-12 » → trois périodes de l'année, puis « toute l'année ». Une entrée illisible est ignorée.
export function periodsOf(setting: string, year: number): Period[] {
  const out: Period[] = [];
  for (const raw of setting.split(",")) {
    const m = raw.trim().match(/^(\d{1,2})-(\d{1,2})$/);
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2]);
    if (a < 1 || b > 12 || a > b) continue;
    out.push({ key: `${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`, label: a === b ? MONTHS[a - 1] : `${MONTHS[a - 1]} – ${MONTHS[b - 1]}`, from: new Date(year, a - 1, 1), to: new Date(year, b, 0, 23, 59, 59, 999) });
  }
  out.push({ key: "annee", label: "toute l'année", from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) });
  return out;
}

// La période demandée si elle existe, sinon celle qui contient aujourd'hui, sinon l'année.
export function periodFor(key: string | undefined, periods: Period[], today: Date): Period {
  return periods.find((p) => p.key === key) ?? periods.find((p) => p.key !== "annee" && today >= p.from && today <= p.to) ?? periods[periods.length - 1];
}

export const dueInPeriod = (d: Date, p: Period) => d >= p.from && d <= p.to;

// Un objectif est à l'ordre du jour d'une période : échéance dedans ; sans échéance tant qu'il n'est pas terminé ;
// en retard (jamais terminé) ; en cours avec une échéance plus tardive (il déborde sur la période).
export function objectiveInPeriod(a: { milestoneDate: Date | null; state: string }, p: Period): boolean {
  if (!a.milestoneDate) return a.state !== "done";
  if (dueInPeriod(a.milestoneDate, p)) return true;
  if (a.state === "late") return true;
  return a.state === "doing" && a.milestoneDate > p.to;
}

// Rédiger : le droit, et l'édition est dans son périmètre (tout avec scope.all, sinon son pôle).
export function canWriteDelegation(me: Viewer, poleIds: string[]): boolean {
  if (!has(me, "delegation.write")) return false;
  return has(me, "scope.all") || (me.poleId !== null && poleIds.includes(me.poleId));
}

// Lire : la personne elle-même, qui lit toutes les délégations, ou qui peut la rédiger.
export function canReadDelegation(me: Viewer, d: { personId: string; poleIds: string[] }): boolean {
  return d.personId === me.id || has(me, "delegation.view_all") || canWriteDelegation(me, d.poleIds);
}
