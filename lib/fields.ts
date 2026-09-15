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
    sressMeasure: { type: "text", layer: "strategic", label: "Lien SRESS (orientation, mesure)" },
    snessLink: { type: "text", layer: "strategic", label: "Lien SNESS" },
    otherTexts: { type: "text", layer: "strategic", label: "Autres textes de rattachement" },
    yearPriorities: { type: "textarea", layer: "strategic", label: "Priorités de l'année" },
    expectedOutcome: { type: "textarea", layer: "strategic", label: "Impacts attendus" },
    plannedFunders: { type: "textarea", layer: "means", label: "Partenaires financiers pressentis et conventions en cours" },
    directExpenseEnvelope: { type: "number", layer: "means", label: "Budget prévisionnel · dépenses directes (€)" },
    fte: { type: "number", layer: "means", label: "ETP fléchés" },
    imposedIndicators: { type: "textarea", layer: "means", label: "Indicateurs imposés par les financeurs" },
    sponsorId: { type: "select", layer: "means", label: "Sponsor (membre du CODIR)" },
    operationalObjectives: { type: "textarea", layer: "proposal", label: "Objectifs qualitatifs (quelle problématique)" },
    quantitativeObjectives: { type: "textarea", layer: "proposal", label: "Objectifs quantitatifs" },
    content: { type: "textarea", layer: "proposal", label: "Contenu développé, valeur ajoutée" },
    audience: { type: "textarea", layer: "proposal", label: "Public, bénéficiaires" },
    calendar: { type: "textarea", layer: "proposal", label: "Calendrier, phases, échéances" },
    deliveryDate: { type: "date", layer: "proposal", label: "Date de rendu" },
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
    venues: { type: "text", layer: "year", label: "Lieux et animation" },
    equipment: { type: "text", layer: "year", label: "Matériel, outils, mobilier, services" },
    evidenceToKeep: { type: "textarea", layer: "year", label: "Justificatifs à conserver, et à quelles échéances" },
    evaluation: { type: "textarea", layer: "year", label: "Évaluation" },
    report: { type: "textarea", layer: "year", label: "Bilan" },
    budgetEnvelope: { type: "number", layer: "budget", label: "Enveloppe validée (€)" },
    spent: { type: "number", layer: "budget", label: "Réalisé hors devis (€)" },
  },
  action: {
    name: { type: "text" }, ownerId: { type: "select" }, milestoneDate: { type: "date" }, timeTarget: { type: "number" }, state: { type: "select" }, fundingLineId: { type: "select" }, isPublic: { type: "bool" },
    description: { type: "textarea", label: "Contenu" }, venue: { type: "text", label: "Lieu" }, participants: { type: "textarea", label: "Participants, invités" },
  },
  fundingLine: {
    funderId: { type: "select" }, conventionId: { type: "select" }, scheme: { type: "text" }, status: { type: "select" }, amountRequested: { type: "number" }, amountGranted: { type: "number" },
    submittedAt: { type: "date" }, answeredAt: { type: "date" }, contractedAt: { type: "date" }, analyticCode: { type: "text" }, allocationKeyRef: { type: "text" }, multiYear: { type: "bool" }, notes: { type: "textarea" }, contactId: { type: "select" },
  },
  deliverable: { label: { type: "text" }, dueDate: { type: "date" }, done: { type: "bool" } },
  payment: { label: { type: "text" }, amount: { type: "number" }, expectedAt: { type: "date" }, receivedAt: { type: "date" }, reference: { type: "text" }, note: { type: "text" } },
  call: { label: { type: "text" }, scheme: { type: "text" }, deadline: { type: "date" }, rolling: { type: "bool" }, recurring: { type: "bool" }, amountHint: { type: "text" }, link: { type: "text" }, note: { type: "textarea" } },
  convention: { reference: { type: "text" }, scheme: { type: "text" }, label: { type: "text" }, startYear: { type: "number" }, endYear: { type: "number" }, status: { type: "select" }, amountRequested: { type: "number" }, amountNotified: { type: "number" }, submittedAt: { type: "date" }, notifiedAt: { type: "date" }, signedAt: { type: "date" }, notes: { type: "textarea" }, contactId: { type: "select" } },
  indicator: { label: { type: "text" }, target: { type: "text" }, actual: { type: "text" }, imposed: { type: "bool" } },
  person: { name: { type: "text" }, role: { type: "select" }, workRhythm: { type: "select" }, availableDays: { type: "number" }, poleId: { type: "select" }, active: { type: "bool" } },
  project: { name: { type: "text" }, analyticCode: { type: "text" }, poleId: { type: "select" }, pilotId: { type: "select" }, guarantorId: { type: "select" }, missionId: { type: "select" }, strategicAxis: { type: "text" }, recurring: { type: "bool" } },
  editionPersonDays: { soldDays: { type: "number" }, plannedDays: { type: "number" }, availableDays: { type: "number" } },
  expense: { label: { type: "text" }, supplier: { type: "text" }, committed: { type: "number" }, spent: { type: "number" }, status: { type: "select" }, reference: { type: "text" }, nature: { type: "select", label: "Nature" } },
  rhythm: { label: { type: "text" }, hoursEven: { type: "text" }, hoursOdd: { type: "text" } },
  settings: {
    validationThresholdLevel1: { type: "number" }, validationThresholdLevel2: { type: "number" }, reminderDaysBefore: { type: "text" }, envelopeAlertPercent: { type: "number" },
    deliverableAlertDays: { type: "number" }, timeVisibility: { type: "select" }, horizonDays: { type: "number" }, timeRules: { type: "textarea" }, serverPathTemplate: { type: "text" }, apiToken: { type: "text" }, hoursPerDay: { type: "number" }, operatingDaysPerMonth: { type: "number" }, billingEmail: { type: "text" }, billingNote: { type: "textarea" },
  },
  refValue: { label: { type: "text" }, color: { type: "select" } },
  funder: { name: { type: "text" }, notes: { type: "textarea" } },
  funderContact: { firstName: { type: "text" }, lastName: { type: "text" }, role: { type: "text" }, email: { type: "text" }, phone: { type: "text" }, notes: { type: "textarea" } },
  mission: { name: { type: "text" } },
  supplier: { name: { type: "text" }, email: { type: "text" }, phone: { type: "text" }, notes: { type: "textarea" } },
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
