// Listes de valeurs : codes stables en anglais, libellés français modifiables dans l'admin (table RefValue).
// Les valeurs ci-dessous servent de défaut au seed et de secours si une valeur manque en base.

export type RefFamily =
  | "edition_status"
  | "action_state"
  | "funding_status"
  | "validation_kind"
  | "validation_status"
  | "codir_decision"
  | "role"
  | "work_rhythm"
  | "time_visibility"
  | "attachment_kind"
  | "decision_instance";

export type RefDef = { code: string; label: string; color?: string };

export const REF_DEFAULTS: Record<RefFamily, RefDef[]> = {
  edition_status: [
    { code: "rechallenged", label: "Re-challengée", color: "warning" },
    { code: "proposed", label: "Proposée", color: "info" },
    { code: "validated", label: "Validée", color: "mint" },
    { code: "in_progress", label: "En cours", color: "primary" },
    { code: "closed", label: "Bilan fait", color: "muted" },
  ],
  action_state: [
    { code: "todo", label: "À faire", color: "muted" },
    { code: "doing", label: "En cours", color: "primary" },
    { code: "done", label: "Fait", color: "mint" },
  ],
  funding_status: [
    { code: "to_submit", label: "À déposer", color: "muted" },
    { code: "submitted", label: "Déposé", color: "info" },
    { code: "notified", label: "Notifié", color: "warning" },
    { code: "contracted", label: "Conventionné", color: "mint" },
    { code: "justified", label: "Justifié", color: "primary" },
  ],
  validation_kind: [
    { code: "quote", label: "Devis" },
    { code: "expense", label: "Dépense" },
    { code: "sending", label: "Envoi" },
    { code: "scope_change", label: "Changement de périmètre" },
    { code: "funder_milestone", label: "Jalon financeur" },
  ],
  validation_status: [
    { code: "pending", label: "En attente", color: "warning" },
    { code: "approved", label: "Approuvée", color: "mint" },
    { code: "refused", label: "Refusée", color: "danger" },
  ],
  codir_decision: [
    { code: "renew", label: "Reconduire", color: "mint" },
    { code: "adjust", label: "Ajuster", color: "warning" },
    { code: "stop", label: "Arrêter", color: "danger" },
  ],
  role: [
    { code: "director", label: "Direction" },
    { code: "raf", label: "RAF" },
    { code: "pole_lead", label: "Responsable de pôle" },
    { code: "pilot", label: "Chargé·e de mission (pilote)" },
    { code: "contributor", label: "Contributeur·rice" },
    { code: "assistant", label: "Assistant·e" },
  ],
  work_rhythm: [
    { code: "option_a", label: "Option A (36 h 30)" },
    { code: "option_b", label: "Option B (9 jours / quinzaine)" },
    { code: "part_time", label: "Temps partiel (28 h)" },
    { code: "apprentice", label: "Alternance (35 h)" },
  ],
  attachment_kind: [
    { code: "quote", label: "Devis" },
    { code: "contract", label: "Convention signée" },
    { code: "notification", label: "Courrier de notification" },
    { code: "receipt", label: "Justificatif de dépense" },
    { code: "report_sent", label: "Bilan remis au financeur" },
    { code: "minutes", label: "Compte rendu (COPIL, GT)" },
    { code: "other", label: "Autre pièce" },
  ],
  decision_instance: [
    { code: "codir", label: "CODIR" },
    { code: "pole", label: "Réunion de pôle" },
    { code: "quarterly", label: "Revue trimestrielle" },
    { code: "board", label: "Bureau / CA" },
  ],
  time_visibility: [
    { code: "self", label: "La personne seule" },
    { code: "self_pole_lead_raf", label: "La personne, son responsable de pôle, la RAF et la direction" },
    { code: "codir", label: "Tout le CODIR" },
    { code: "all", label: "Toute l'équipe" },
  ],
};

export const REF_FAMILY_LABELS: Record<RefFamily, string> = {
  edition_status: "Statuts d'édition",
  action_state: "États d'action",
  funding_status: "Statuts de financement",
  validation_kind: "Natures de validation",
  validation_status: "Statuts de validation",
  codir_decision: "Décisions du séminaire",
  role: "Rôles",
  work_rhythm: "Rythmes de travail",
  time_visibility: "Visibilité du temps",
  attachment_kind: "Natures de pièces jointes",
  decision_instance: "Instances de décision",
};

export type RefMap = Record<string, Record<string, RefDef>>;

export function buildRefMap(rows: { family: string; code: string; label: string; color: string | null }[]): RefMap {
  const map: RefMap = {};
  for (const fam of Object.keys(REF_DEFAULTS) as RefFamily[]) {
    map[fam] = {};
    for (const d of REF_DEFAULTS[fam]) map[fam][d.code] = d;
  }
  for (const r of rows) {
    map[r.family] ??= {};
    map[r.family][r.code] = { code: r.code, label: r.label, color: r.color ?? map[r.family][r.code]?.color };
  }
  return map;
}

export function refLabel(map: RefMap, family: RefFamily, code: string | null | undefined): string {
  if (!code) return "—";
  return map[family]?.[code]?.label ?? code;
}

export function refColor(map: RefMap, family: RefFamily, code: string | null | undefined): string {
  if (!code) return "muted";
  return map[family]?.[code]?.color ?? "muted";
}
