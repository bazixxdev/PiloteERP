// Champs modifiables en ligne : liste blanche par modèle, type et couche (pour les droits).
import type { Layer } from "./rights";

export type FieldType = "text" | "textarea" | "number" | "date" | "bool" | "select";

export type FieldDef = { type: FieldType; layer?: Layer; label?: string };

export const FIELDS: Record<string, Record<string, FieldDef>> = {
  edition: {
    status: { type: "select", label: "Statut" },
    decisionDate: { type: "date", label: "Date de décision" },
    conditionalStart: { type: "bool", label: "Démarrage conditionné à la notification" },
    stakes: { type: "textarea", layer: "strategic", label: "Enjeux" },
    axis: { type: "text", layer: "strategic", label: "Ambition / chantier du plan stratégique" },
    sressMeasure: { type: "text", layer: "strategic", label: "Mesure SRESS" },
    yearPriorities: { type: "textarea", layer: "strategic", label: "Priorités de l'année" },
    expectedOutcome: { type: "textarea", layer: "strategic", label: "Ce qu'on attend du projet" },
    plannedFunders: { type: "textarea", layer: "means", label: "Financeurs pressentis et conventions en cours" },
    directExpenseEnvelope: { type: "number", layer: "means", label: "Enveloppe de dépenses directes (€)" },
    fte: { type: "number", layer: "means", label: "ETP fléchés" },
    imposedIndicators: { type: "textarea", layer: "means", label: "Indicateurs imposés par les financeurs" },
    operationalObjectives: { type: "textarea", layer: "proposal", label: "Objectifs opérationnels" },
    calendar: { type: "textarea", layer: "proposal", label: "Calendrier et jalons" },
    partners: { type: "textarea", layer: "proposal", label: "Partenaires" },
    method: { type: "textarea", layer: "proposal", label: "Méthode" },
    governance: { type: "textarea", layer: "proposal", label: "Gouvernance (GT, COPIL, CODO)" },
    ownIndicators: { type: "textarea", layer: "proposal", label: "Indicateurs propres" },
    timeNeed: { type: "text", layer: "proposal", label: "Besoin en temps" },
    budgetNeed: { type: "text", layer: "proposal", label: "Besoin en budget" },
    codirDecision: { type: "select", layer: "validation", label: "Décision du CODIR" },
    codirDate: { type: "date", layer: "validation", label: "Date du séminaire" },
    boardValidated: { type: "bool", layer: "validation", label: "Validé par le CA" },
    boardDate: { type: "date", layer: "validation", label: "Date du CA" },
    venues: { type: "text", layer: "year", label: "Lieux" },
    equipment: { type: "text", layer: "year", label: "Matériel" },
    evidenceToKeep: { type: "textarea", layer: "year", label: "Justificatifs à conserver" },
    evaluation: { type: "textarea", layer: "year", label: "Évaluation" },
    report: { type: "textarea", layer: "year", label: "Bilan" },
    budgetEnvelope: { type: "number", layer: "budget", label: "Enveloppe validée (€)" },
    committed: { type: "number", layer: "budget", label: "Engagé (€)" },
    spent: { type: "number", layer: "budget", label: "Réalisé (€)" },
  },
  action: {
    name: { type: "text" }, ownerId: { type: "select" }, milestoneDate: { type: "date" }, timeTarget: { type: "number" }, state: { type: "select" }, fundingLineId: { type: "select" },
  },
  fundingLine: {
    funderId: { type: "select" }, scheme: { type: "text" }, status: { type: "select" }, amountRequested: { type: "number" }, amountGranted: { type: "number" },
    submittedAt: { type: "date" }, answeredAt: { type: "date" }, contractedAt: { type: "date" }, analyticCode: { type: "text" }, allocationKeyRef: { type: "text" }, multiYear: { type: "bool" }, notes: { type: "textarea" },
  },
  deliverable: { label: { type: "text" }, dueDate: { type: "date" }, done: { type: "bool" } },
  indicator: { label: { type: "text" }, target: { type: "text" }, actual: { type: "text" }, imposed: { type: "bool" } },
  person: { name: { type: "text" }, role: { type: "select" }, workRhythm: { type: "select" }, availableDays: { type: "number" }, poleId: { type: "select" }, active: { type: "bool" } },
  project: { name: { type: "text" }, analyticCode: { type: "text" }, poleId: { type: "select" }, pilotId: { type: "select" }, guarantorId: { type: "select" }, missionId: { type: "select" }, strategicAxis: { type: "text" }, recurring: { type: "bool" } },
  editionPersonDays: { soldDays: { type: "number" }, availableDays: { type: "number" } },
  settings: {
    validationThresholdLevel1: { type: "number" }, validationThresholdLevel2: { type: "number" }, reminderDaysBefore: { type: "text" }, envelopeAlertPercent: { type: "number" },
    deliverableAlertDays: { type: "number" }, timeVisibility: { type: "select" }, horizonDays: { type: "number" }, timeRules: { type: "textarea" }, serverPathTemplate: { type: "text" },
  },
  refValue: { label: { type: "text" }, color: { type: "select" } },
  funder: { name: { type: "text" } },
  mission: { name: { type: "text" } },
  timeCode: { label: { type: "text" }, kind: { type: "select" } },
  pole: { name: { type: "text" }, leadId: { type: "select" } },
  docLink: { label: { type: "text" }, url: { type: "text" }, codirOnly: { type: "bool" } },
};

export type Model = keyof typeof FIELDS;

export function coerce(type: FieldType, value: unknown): string | number | boolean | Date | null {
  if (value === "" || value === null || value === undefined) return type === "bool" ? false : null;
  switch (type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
    case "date":
      return new Date(String(value));
    case "bool":
      return value === true || value === "true";
    default:
      return String(value);
  }
}
