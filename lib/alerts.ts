import { daysFromNow, dayjs, fmtEuro } from "./format";
import { budgetOf, type ExpenseLike } from "./budget";
import { actionAlerts, editionForMilestone, milestoneTitle } from "./actions";

export type AlertKind = "milestone_overdue" | "action_overdue" | "deliverable_soon" | "deliverable_overdue" | "payment_late" | "envelope" | "time_over" | "validation_pending" | "budget_over";

export type Alert = { kind: AlertKind; level: "warning" | "danger"; label: string; when?: Date };

type MilestoneForAlerts = { id: string; date: Date; done: boolean; label: string };
type ActionForAlerts = { id: string; name: string; state: string; endDate: Date; timeTarget: number | null; hoursYear?: number; milestones: MilestoneForAlerts[] };
// Qui prévenir d'un jalon : le responsable de l'action et les personnes associées (mode léger d'attachYearActions).
type ActionForReminders = ActionForAlerts & { projectId: string; startDate: Date; owner: { id: string; name: string } | null; people: { person: { id: string; name: string } }[] };

// Une action terminée ou abandonnée n'a plus de jalon à tenir (même si la case « fait » du jalon n'a pas été cochée).
const openMilestones = (a: ActionForAlerts) => (a.state === "done" || a.state === "abandoned" ? [] : a.milestones.filter((m) => !m.done));

type EditionForAlerts = {
  budgetEnvelope: number | null;
  spent: number;
  expenses: ExpenseLike[];
  // Les actions de l'année (attachYearActions) et leurs jalons.
  actions: ActionForAlerts[];
  fundingLines: { funder: { name: string }; deliverables: { label: string; dueDate: Date; done: boolean }[]; payments?: { label: string; amount: number; expectedAt: Date; receivedAt: Date | null }[] }[];
  validations: { status: string }[];
};

type SettingsForAlerts = { envelopeAlertPercent: number; deliverableAlertDays: number };

export function computeAlerts(e: EditionForAlerts, s: SettingsForAlerts): Alert[] {
  const alerts: Alert[] = [];

  // Jalon dépassé, fin dépassée, temps de l'année au-delà de l'objectif : une seule règle (lib/actions.ts).
  for (const a of e.actions) alerts.push(...actionAlerts({ ...a, hours: a.hoursYear ?? 0 }, new Date()));

  for (const f of e.fundingLines) {
    for (const d of f.deliverables) {
      if (d.done) continue;
      const n = daysFromNow(d.dueDate);
      if (n < 0) alerts.push({ kind: "deliverable_overdue", level: "danger", label: `Livrable en retard : ${d.label} (${f.funder.name})`, when: d.dueDate });
      else if (n <= s.deliverableAlertDays) alerts.push({ kind: "deliverable_soon", level: "warning", label: `Livrable dans ${n} j : ${d.label} (${f.funder.name})`, when: d.dueDate });
    }
    // Versement attendu dépassé (lot A) : une alerte d'argent, pas d'échéance de travail — la RAF et la direction la lisent.
    for (const p of f.payments ?? []) {
      if (p.receivedAt) continue;
      const n = daysFromNow(p.expectedAt);
      if (n < 0) alerts.push({ kind: "payment_late", level: "warning", label: `Versement en retard : ${p.label} ${fmtEuro(p.amount)} (${f.funder.name})`, when: p.expectedAt });
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

// Le prochain jalon non fait, toutes actions de l'année confondues.
export function nextMilestone(e: EditionForAlerts): { name: string; date: Date } | null {
  let best: { name: string; date: Date } | null = null;
  for (const a of e.actions) {
    for (const m of openMilestones(a)) {
      if (!best || dayjs(m.date).isBefore(best.date)) best = { name: milestoneTitle(a.name, m.label), date: m.date };
    }
  }
  return best;
}

// Rappels J-30 / J-7 (EF-C2), calculés à la volée. `stage` = le palier franchi (le plus proche de l'échéance, ou "retard") :
// c'est lui qui déclenche une notification (`lib/deadline-notifications.ts`), une seule par palier et par destinataire.
export type ReminderStage = number | "retard";
export type Reminder = { editionId: string; project: string; label: string; dueDate: Date; daysLeft: number; stage: ReminderStage; kind: "deliverable" | "milestone" | "payment" | "call"; who: string[]; whoIds: string[] };

function stageOf(daysLeft: number, reminderDays: number[]): ReminderStage | null {
  if (daysLeft < 0) return "retard";
  const crossed = reminderDays.filter((r) => daysLeft <= r);
  return crossed.length ? Math.min(...crossed) : null;
}

export function computeReminders(
  editions: (Omit<EditionForAlerts, "actions"> & { id: string; projectId: string; year: number; actions: ActionForReminders[]; project: { name: string; pilot: { id: string; name: string } } })[],
  raf: { id: string; name: string } | null,
  reminderDays: number[],
  horizonDays: number,
  // Direction : prévenue avec la RAF d'un versement en retard (lot A). Facultatif pour ne pas changer les appels existants.
  director: { id: string; name: string } | null = null,
): Reminder[] {
  const out: Reminder[] = [];
  const money = [raf, director].filter((p): p is { id: string; name: string } => !!p);
  for (const e of editions) {
    const who = [e.project.pilot.name, ...(raf ? [raf.name] : [])];
    const whoIds = [e.project.pilot.id, ...(raf ? [raf.id] : [])];
    // Versements : pas de J-30 / J-7 (on n'a rien à faire avant la date), seulement le retard, à la RAF et à la direction.
    for (const f of e.fundingLines) {
      for (const p of f.payments ?? []) {
        if (p.receivedAt) continue;
        const n = daysFromNow(p.expectedAt);
        if (n < 0 && money.length > 0) out.push({ editionId: e.id, project: e.project.name, label: `${p.label} · ${fmtEuro(p.amount)} (${f.funder.name})`, dueDate: p.expectedAt, daysLeft: n, stage: "retard", kind: "payment", who: money.map((m) => m.name), whoIds: money.map((m) => m.id) });
      }
    }
    for (const f of e.fundingLines) {
      for (const d of f.deliverables) {
        if (d.done) continue;
        const n = daysFromNow(d.dueDate);
        const stage = stageOf(n, reminderDays);
        if (n <= horizonDays && stage !== null) {
          out.push({ editionId: e.id, project: e.project.name, label: `${d.label} (${f.funder.name})`, dueDate: d.dueDate, daysLeft: n, stage, kind: "deliverable", who, whoIds });
        }
      }
    }
  }
  // Jalons : un rappel par jalon, pas par année — une action qui court sur deux années vivantes n'en envoie qu'un, depuis
  // l'année de la date du jalon (sinon la première). Au responsable, aux personnes associées, et au pilote.
  const seen = new Set<string>();
  for (const e of editions) {
    for (const a of e.actions) {
      for (const m of openMilestones(a)) {
        if (seen.has(m.id)) continue;
        const home = editionForMilestone(m, a, editions);
        if (home && home.id !== e.id) continue;
        seen.add(m.id);
        const n = daysFromNow(m.date);
        const stage = stageOf(n, reminderDays);
        if (n > horizonDays || stage === null) continue;
        const people = new Map<string, string>();
        for (const p of [a.owner, ...a.people.map((x) => x.person), e.project.pilot]) if (p) people.set(p.id, p.name);
        out.push({ editionId: e.id, project: e.project.name, label: milestoneTitle(a.name, m.label), dueDate: m.date, daysLeft: n, stage, kind: "milestone", who: [...people.values()], whoIds: [...people.keys()] });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
