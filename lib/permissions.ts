// Catalogue des permissions (lot F2). Point de vérité unique : clés stables en code, rôles en base (table Role) qui en
// portent un sous-ensemble. Ce qui est contextuel — je pilote cette édition, j'en suis l'équipe, c'est mon pôle, ce n'est pas
// ma propre demande — reste en code dans lib/rights.ts : une permission dit « au-delà de mon périmètre », le contexte dit le reste.
// Ajouter une permission : une entrée ici (module, libellé, explication), puis la donner aux rôles par défaut ci-dessous ;
// les installations existantes la reçoivent par l'écran Admin › Rôles et droits (ou au reseed).

export type PermissionModule = "perimetre" | "editions" | "financements" | "adherents" | "tresorerie" | "temps" | "demandes" | "validations" | "direction" | "admin";

export const PERMISSION_MODULES: Record<PermissionModule, string> = {
  perimetre: "Périmètre",
  editions: "Projets et éditions",
  financements: "Financements",
  adherents: "Adhérents",
  tresorerie: "Trésorerie",
  temps: "Temps et charge",
  demandes: "Demandes et dépenses",
  validations: "Validations et décisions",
  direction: "Direction",
  admin: "Administration",
};

export const PERMISSIONS = [
  { key: "scope.all", module: "perimetre", label: "Voit toute la CRESS", help: "Sans ce droit, le périmètre par défaut est le pôle de la personne (les autres pôles restent consultables)." },
  { key: "pole.manage", module: "perimetre", label: "Responsable de son pôle", help: "Agit sur les éditions, les demandes et la charge de son pôle ; voit les temps de son pôle ; valide au niveau 2 sur son pôle." },

  { key: "edition.contribute", module: "editions", label: "Contribue aux éditions de son équipe", help: "Fil de l'année et actions sur les éditions où la personne est dans l'équipe (le pilote a toujours la main sur les siennes)." },
  { key: "edition.edit_all", module: "editions", label: "Intervient sur toute édition", help: "Comme le pilote, sur n'importe quelle édition : proposition, fil de l'année, actions, réalisations, propositions et remarques des autres." },
  { key: "edition.status", module: "editions", label: "Change le statut d'une édition", help: "Proposée, validée, en cours, bilan fait." },
  { key: "fiche.strategic", module: "editions", label: "Remplit le cadre stratégique", help: "Couche « à remplir par la direction » de la fiche." },
  { key: "fiche.means", module: "editions", label: "Remplit les moyens", help: "Enveloppe, jours, ressources : couche « RAF et direction »." },
  { key: "fiche.validation", module: "editions", label: "Renseigne la décision du CODIR sur la fiche", help: "Couche « renseigné par le CODIR »." },
  { key: "fiche.budget", module: "editions", label: "Tient le budget", help: "Dépenses réalisées, engagements, couche « renseigné par la RAF »." },

  { key: "funding.edit", module: "financements", label: "Gère les financements", help: "Lignes de financement, conventions, versements, financeurs, livrables financeurs." },
  { key: "calls.edit", module: "financements", label: "Gère les appels à projets", help: "Veille : ajouter, qualifier, transformer en dossier (module Veille)." },

  { key: "members.manage", module: "adherents", label: "Gère les adhésions", help: "Crée et règle les adhésions (cotisation, collège, paiement), reconduit une année, synchronise HelloAsso. Tout le monde lit les adhérents." },
  { key: "treasury.view", module: "tresorerie", label: "Consulte la trésorerie", help: "Plan de trésorerie mensuel : solde, point bas, versements attendus, règles de flux. Donnée sensible : par défaut direction, RAF, responsables de pôle." },
  { key: "treasury.manage", module: "tresorerie", label: "Tient la trésorerie", help: "Solde de départ, seuil d'alerte, règles de flux (salaires, loyer, subventions de fonctionnement…)." },
  { key: "time.declare", module: "temps", label: "Saisit son temps", help: "Attendu·e en clôture mensuelle ; sans ce droit, la personne n'apparaît pas dans les retardataires." },
  { key: "time.view_all", module: "temps", label: "Voit les temps de tous", help: "Selon la visibilité réglée dans les paramètres (« Visibilité du temps »)." },
  { key: "time.lock", module: "temps", label: "Clôture les mois", help: "Verrouille un mois de saisie, relance les retardataires." },
  { key: "load.plan_all", module: "temps", label: "Planifie la charge de toute l'équipe", help: "Jours prévus et conventionnés sur toute édition, plan de charge complet." },

  { key: "requests.treat_all", module: "demandes", label: "Traite toute demande", help: "Devis, factures, achats, congés… de toute la CRESS, pas seulement celles qui lui sont adressées." },
  { key: "expenses.track", module: "demandes", label: "Suit les factures et les dépenses", help: "Réception des factures, montants réalisés, rapprochement." },

  { key: "decisions.consign_all", module: "validations", label: "Consigne les décisions d'instance", help: "CODIR, pôle, revue trimestrielle, CA, sur toute édition." },

  { key: "codir.access", module: "direction", label: "Siège au CODIR", help: "Page CODIR, séminaire, montants dans la matrice et le portefeuille, écran café, décisions." },

  { key: "admin.manage", module: "admin", label: "Administre l'outil", help: "Personnes, comptes, référentiels, paramètres, import / export." },
  { key: "roles.manage", module: "admin", label: "Modifie les rôles et leurs droits", help: "Cet écran. Le rôle Direction garde toujours l'administration." },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);
export const isPermissionKey = (k: string): k is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(k);

// Rôles par défaut = les droits du prototype tels qu'ils étaient écrits en dur avant le lot F2 (aucun changement de comportement).
// `system` : code fixe, non supprimable ; libellé, description, niveau et droits restent modifiables.
// `validationLevel` : ce que la personne peut approuver (1 pilote sur son édition, 2 responsable sur son pôle, 3 direction partout).
export type RoleDef = { code: string; label: string; description: string; validationLevel: number; permissions: PermissionKey[] };

const ALL_EDITIONS: PermissionKey[] = ["edition.contribute", "edition.edit_all", "edition.status", "fiche.strategic", "fiche.means", "fiche.validation", "fiche.budget"];

export const DEFAULT_ROLES: RoleDef[] = [
  { code: "director", label: "Direction", description: "Voit tout, intervient partout, valide au niveau 3, administre l'outil.", validationLevel: 3,
    permissions: ["scope.all", ...ALL_EDITIONS, "funding.edit", "calls.edit", "members.manage", "treasury.view", "treasury.manage", "time.declare", "time.view_all", "time.lock", "load.plan_all", "requests.treat_all", "expenses.track", "decisions.consign_all", "codir.access", "admin.manage", "roles.manage"] },
  { code: "raf", label: "RAF", description: "Financements, budget, clôture des temps, suivi des factures ; siège au CODIR, administre l'outil ; informée des validations, pas valideuse.", validationLevel: 0,
    permissions: ["scope.all", "edition.contribute", "edition.status", "fiche.means", "fiche.budget", "funding.edit", "calls.edit", "members.manage", "treasury.view", "treasury.manage", "time.declare", "time.view_all", "time.lock", "load.plan_all", "requests.treat_all", "expenses.track", "decisions.consign_all", "codir.access", "admin.manage", "roles.manage"] },
  { code: "pole_lead", label: "Responsable de pôle", description: "Agit sur les éditions et les demandes de son pôle, valide au niveau 2, siège au CODIR.", validationLevel: 2,
    permissions: ["pole.manage", "edition.contribute", "calls.edit", "treasury.view", "time.declare", "load.plan_all", "codir.access"] },
  { code: "pilot", label: "Chargé·e de mission (pilote)", description: "Pilote ses éditions : proposition, fil de l'année, actions, validations de niveau 1 sur ses éditions.", validationLevel: 1,
    permissions: ["edition.contribute", "time.declare"] },
  { code: "contributor", label: "Contributeur·rice", description: "Contribue aux éditions où il ou elle est dans l'équipe, saisit son temps.", validationLevel: 0,
    permissions: ["edition.contribute", "time.declare"] },
  { code: "assistant", label: "Assistant·e", description: "Voit toute la CRESS, suit les factures et les dépenses ; pas de saisie de temps attendue.", validationLevel: 0,
    permissions: ["scope.all", "expenses.track"] },
];

// Rôles dont le code sert d'identité dans l'outil (« qui est la directrice », « le responsable du pôle », destinataires des
// notifications) : ils existent toujours, quels que soient leurs droits.
export const SYSTEM_ROLE_CODES = DEFAULT_ROLES.map((r) => r.code);

export const serializePermissions = (keys: readonly string[]) => Array.from(new Set(keys.filter(isPermissionKey))).sort().join(",");
export const parsePermissions = (s: string | null | undefined): PermissionKey[] => (s ?? "").split(",").map((k) => k.trim()).filter(isPermissionKey);
