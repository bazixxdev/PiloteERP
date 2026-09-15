// Natures des réalisations consignées au fil de l'année. Module sans « use client » : lu aussi par l'Aperçu (serveur).
export const ACHIEVEMENT_KINDS = [
  { value: "participants", label: "Participants / inscrits", unit: "personnes" },
  { value: "audience", label: "Public touché", unit: "personnes" },
  { value: "deliverable", label: "Livrable produit ou envoyé", unit: "" },
  { value: "press", label: "Retombée (presse, réseaux)", unit: "" },
  { value: "partner", label: "Partenaire mobilisé", unit: "" },
  { value: "other", label: "Autre réalisation", unit: "" },
];
export const kindLabel = (v: string) => ACHIEVEMENT_KINDS.find((k) => k.value === v)?.label ?? v;

