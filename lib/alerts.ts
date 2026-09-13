import { daysFromNow, dayjs, fmtEuro } from "./format";
import { budgetOf, type ExpenseLike } from "./budget";

export type AlertKind = "milestone_overdue" | "deliverable_soon" | "deliverable_overdue" | "envelope" | "time_over" | "validation_pending";

export type Alert = { kind: AlertKind; level: "warning" | "danger"; label: string; when?: Date };

type EditionForAlerts = {
  budgetEnvelope: number | null;
  spent: number;
  expenses: ExpenseLike[];
  actions: { name: string; milestoneDate: Date | null; state: string; timeTarget: number | null; timeEntries?: { hours: number }[] }[];
  fundingLines: { funder: { name: string }; deliverables: { label: string; dueDate: Date; done: boolean }[] }[];
  validations: { status: string }[];
};

type SettingsForAlerts = { envelopeAlertPercent: number; deliverableAlertDays: number };

export function computeAlerts(e: EditionForAlerts, s: SettingsForAlerts): Alert[] {
  const alerts: Alert[] = [];

  for (const a of e.actions) {
    if (a.milestoneDate && a.state !== "done" && daysFromNow(a.milestoneDate) < 0) {
      alerts.push({ kind: "milestone_overdue", level: "danger", label: `Jalon dépassé : ${a.name}`, when: a.milestoneDate });
    }
    const consumed = (a.timeEntries ?? []).reduce((sum, t) => sum + t.hours, 0);
    if (a.timeTarget && consumed > a.timeTarget) {
      alerts.push({ kind: "time_over", level: "warning", label: `Temps dépassé : ${a.name} (${Math.round(consumed)} h / ${a.timeTarget} h)` });
    }
  }

  for (const f of e.fundingLines) {
    for (const d of f.deliverables) {
      if (d.done) continue;
      const n = daysFromNow(d.dueDate);
      if (n < 0) alerts.push({ kind: "deliverable_overdue", level: "danger", label: `Livrable en retard : ${d.label} (${f.funder.name})`, when: d.dueDate });
      else if (n <= s.deliverableAlertDays) alerts.push({ kind: "deliverable_soon", level: "warning", label: `Livrable dans ${n} j : ${d.label} (${f.funder.name})`, when: d.dueDate });
    }
  }

  const env = e.budgetEnvelope ?? 0;
  if (env > 0) {
    const b = budgetOf(e);
    const used = (b.used / env) * 100;
    // Le pourcentage n'est jamais plafonné : même calcul (réalisé + engagements restants) que Budget, portefeuille et CODIR.
    if (used >= 100) alerts.push({ kind: "envelope", level: "danger", label: b.used > env ? `Enveloppe dépassée de ${fmtEuro(b.used - env)} (${Math.round(used)} %)` : `Enveloppe consommée à 100 %` });
    else if (used >= s.envelopeAlertPercent) alerts.push({ kind: "envelope", level: "warning", label: `Enveloppe à ${Math.round(used)} %` });
  }

  const pending = e.validations.filter((v) => v.status === "pending").length;
  if (pending > 0) alerts.push({ kind: "validation_pending", level: "warning", label: `${pending} validation${pending > 1 ? "s" : ""} en attente` });

  return alerts;
}

export function nextDeliverable(e: EditionForAlerts): { label: string; dueDate: Date; funder: string } | null {
  let best: { label: string; dueDate: Date; funder: string } | null = null;
  for (const f of e.fundingLines) {
    for (const d of f.deliverables) {
      if (d.done) continue;
      if (!best || dayjs(d.dueDate).isBefore(best.dueDate)) best = { label: d.label, dueDate: d.dueDate, funder: f.funder.name };
    }
  }
  return best;
}

export function nextMilestone(e: EditionForAlerts): { name: string; date: Date } | null {
  let best: { name: string; date: Date } | null = null;
  for (const a of e.actions) {
    if (!a.milestoneDate || a.state === "done") continue;
    if (!best || dayjs(a.milestoneDate).isBefore(best.date)) best = { name: a.name, date: a.milestoneDate };
  }
  return best;
}

// Rappels J-30 / J-7 (EF-C2), calculés à la volée.
export type Reminder = { editionId: string; project: string; label: string; dueDate: Date; daysLeft: number; kind: "deliverable" | "milestone"; who: string[] };

export function computeReminders(
  editions: (EditionForAlerts & { id: string; project: { name: string; pilot: { name: string } } })[],
  rafName: string | null,
  reminderDays: number[],
  horizonDays: number,
): Reminder[] {
  const out: Reminder[] = [];
  for (const e of editions) {
    const who = [e.project.pilot.name, ...(rafName ? [rafName] : [])];
    for (const f of e.fundingLines) {
      for (const d of f.deliverables) {
        if (d.done) continue;
        const n = daysFromNow(d.dueDate);
        if (n <= horizonDays && (n < 0 || reminderDays.some((r) => n <= r))) {
          out.push({ editionId: e.id, project: e.project.name, label: `${d.label} (${f.funder.name})`, dueDate: d.dueDate, daysLeft: n, kind: "deliverable", who });
        }
      }
    }
    for (const a of e.actions) {
      if (!a.milestoneDate || a.state === "done") continue;
      const n = daysFromNow(a.milestoneDate);
      if (n <= horizonDays && (n < 0 || reminderDays.some((r) => n <= r))) {
        out.push({ editionId: e.id, project: e.project.name, label: a.name, dueDate: a.milestoneDate, daysLeft: n, kind: "milestone", who: [e.project.pilot.name] });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
