// Arbre de navigation à deux niveaux (proto validé le 17/09) : une section = une icône et des feuilles ; la section
// active se déplie d'après l'adresse, une seule à la fois. Tout est calculé ici, côté serveur, à partir des droits et des
// modules ; la barre latérale ne fait qu'afficher et reconnaître l'entrée active. Module pur : pas de base, pas de React.
import { canAdmin, canLockMonths, canViewTreasury, isCodir, type Actor } from "./rights";

export type NavLeaf = {
  label: string;
  href: string;
  badge?: number;
  // Reconnaissance de l'entrée active : préfixe(s) d'adresse, puis conditions sur la chaîne de requête.
  path: string | string[];
  param?: { key: string; oneOf: (string | null)[] }; // la valeur du paramètre (ou son absence, null) doit être dans la liste
  present?: string[]; // actif si l'un de ces paramètres est présent
  absent?: string[]; // actif seulement si aucun de ces paramètres n'est présent
};

export type NavSection = {
  id: "travail" | "temps" | "portefeuille" | "demandes" | "projets" | "adherents" | "tresorerie" | "materiel" | "echeances" | "direction" | "admin";
  label: string;
  badge?: number;
  items: NavLeaf[];
  // Adresses qui appartiennent à la section sans être une feuille (la page Édition sous Portefeuille, par exemple).
  also?: string[];
};

export type NavContext = Actor & {
  modules: string[]; // modules de la personne (Mon compte)
  veille: boolean; // module d'instance « appels à projets »
  adherents: boolean; // module d'instance « adhérents »
  tresorerie: boolean; // module d'instance « trésorerie »
  materiel: boolean; // module d'instance « matériel »
  showTeam: boolean; // au moins une autre personne dont le temps est visible
  wide: string | null; // libellé de la vue large des demandes (Toute la CRESS / Mon pôle / Mes projets), null si aucune
  badges: { requests: number; reminders: number };
};

export function navTreeFor(ctx: NavContext): NavSection[] {
  const codir = isCodir(ctx);
  // Ordre demandé par Gaël (17/09) : Mon travail, Portefeuille, Projets et financements, Demandes, Échéances, Temps.
  const sections: NavSection[] = [
    {
      id: "travail",
      label: "Mon travail",
      items: [
        { label: "Ma semaine", href: "/ma-semaine", path: "/ma-semaine" },
        ...(ctx.modules.includes("tasks") ? [{ label: "Tâches", href: "/taches", path: "/taches" }] : []),
        ...(ctx.modules.includes("notes") ? [{ label: "Notes", href: "/notes", path: "/notes" }] : []),
      ],
    },
    {
      id: "portefeuille",
      label: codir ? "Portefeuille" : "Mes projets",
      also: ["/edition"],
      items: [
        { label: codir ? "Portefeuille" : "Mes projets", href: "/portefeuille", path: "/portefeuille" },
        { label: "Vue annuelle", href: "/annuel", path: "/annuel" },
        { label: "Plan de charge", href: "/plan-de-charge", path: "/plan-de-charge" },
      ],
    },
    {
      id: "projets",
      label: "Projets et financements",
      items: [
        { label: "Projets et éditions", href: "/projets", path: "/projets" },
        { label: "Conventions", href: "/conventions", path: "/conventions" },
        { label: "Financeurs", href: "/financeurs", path: "/financeurs" },
        { label: "Organisations", href: "/organisations", path: "/organisations" },
        { label: "Contacts", href: "/contacts", path: "/contacts" },
        { label: "Qui finance quoi", href: "/matrice", path: "/matrice" },
        ...(ctx.veille ? [{ label: "Appels à projets", href: "/appels", path: "/appels" }] : []),
      ],
    },
    ...(ctx.adherents ? [{
      id: "adherents" as const,
      label: "Adhérents",
      items: [
        { label: "Adhérents", href: "/adherents", path: "/adherents", absent: ["vue"] },
        { label: "Cotisations", href: "/adherents?vue=cotisations", path: "/adherents", present: ["vue"] },
      ],
    }] : []),
    ...(ctx.tresorerie && canViewTreasury(ctx) ? [{
      id: "tresorerie" as const,
      label: "Trésorerie",
      items: [{ label: "Plan de trésorerie", href: "/tresorerie", path: "/tresorerie" }],
    }] : []),
    ...(ctx.materiel ? [{
      id: "materiel" as const,
      label: "Prêts",
      items: [
        { label: "Prêts en cours", href: "/materiel/prets", path: "/materiel/prets", absent: ["vue"] },
        { label: "Prêts terminés", href: "/materiel/prets?vue=termines", path: "/materiel/prets", present: ["vue"] },
        { label: "Inventaire du matériel", href: "/materiel", path: "/materiel" },
      ],
      also: ["/materiel/pret"],
    }] : []),
    {
      id: "demandes",
      label: "Demandes",
      badge: ctx.badges.requests,
      items: [
        { label: "À traiter par moi", href: "/demandes", badge: ctx.badges.requests, path: "/demandes", param: { key: "vue", oneOf: ["moi", null] } },
        { label: "Mes demandes", href: "/demandes?vue=mes", path: "/demandes", param: { key: "vue", oneOf: ["mes"] } },
        ...(ctx.wide ? [{ label: ctx.wide, href: "/demandes?vue=toutes", path: "/demandes", param: { key: "vue", oneOf: ["toutes"] } }] : []),
        ...(codir ? [{ label: "Validations par niveau", href: "/validations", path: "/validations" }] : []),
      ],
    },
    {
      id: "echeances",
      label: "Échéances",
      badge: ctx.badges.reminders,
      items: [
        { label: "Échéances", href: "/echeances", badge: ctx.badges.reminders, path: ["/echeances", "/rappels"] },
        { label: "Notifications", href: "/notifications", path: "/notifications" },
      ],
    },
    {
      id: "temps",
      label: "Temps",
      items: [
        { label: "Ma répartition", href: "/temps", path: "/temps", absent: ["equipe", "personne"] },
        ...(ctx.showTeam ? [{ label: "Temps de l'équipe", href: "/temps?equipe=1", path: "/temps", present: ["equipe", "personne"] }] : []),
        ...(canLockMonths(ctx) ? [{ label: "Clôture mensuelle", href: "/cloture", path: "/cloture" }] : []),
      ],
    },
  ];
  if (codir) {
    sections.push({
      id: "direction",
      label: "Direction",
      items: [
        { label: "Écran CODIR", href: "/codir", path: "/codir" },
        { label: "Séminaire", href: "/seminaire", path: "/seminaire" },
        { label: "Écran café", href: "/cafe", path: "/cafe" },
      ],
    });
  }
  if (canAdmin(ctx)) {
    sections.push({
      id: "admin",
      label: "Admin",
      items: [
        { label: "Personnes", href: "/admin", path: "/admin", param: { key: "section", oneOf: ["personnes", null] } },
        { label: "Référentiels", href: "/admin?section=referentiels", path: "/admin", param: { key: "section", oneOf: ["referentiels"] } },
        { label: "Paramètres", href: "/admin?section=parametres", path: "/admin", param: { key: "section", oneOf: ["parametres"] } },
        { label: "Import / export", href: "/admin?section=donnees", path: "/admin", param: { key: "section", oneOf: ["donnees"] } },
      ],
    });
  }
  return sections;
}

function underPath(pathname: string, p: string): boolean {
  return pathname === p || pathname.startsWith(p + "/");
}

export function leafMatches(leaf: NavLeaf, pathname: string, params: URLSearchParams): boolean {
  const paths = Array.isArray(leaf.path) ? leaf.path : [leaf.path];
  if (!paths.some((p) => underPath(pathname, p))) return false;
  if (leaf.param && !leaf.param.oneOf.includes(params.get(leaf.param.key))) return false;
  if (leaf.present && !leaf.present.some((k) => params.has(k))) return false;
  if (leaf.absent && leaf.absent.some((k) => params.has(k))) return false;
  return true;
}

// Section ouverte et feuille active pour une adresse donnée ; la première feuille qui reconnaît l'adresse gagne.
export function locate(tree: NavSection[], pathname: string, params: URLSearchParams): { section: NavSection["id"] | null; leaf: string | null } {
  for (const s of tree) {
    const leaf = s.items.find((l) => leafMatches(l, pathname, params));
    if (leaf) return { section: s.id, leaf: leaf.href };
  }
  // Adresse rattachée à une section sans être une feuille (la page Édition) : la première feuille reste marquée active,
  // sinon le menu perd son gras dès qu'on ouvre une édition (retour de Gaël, 17/09).
  const s = tree.find((s) => s.also?.some((p) => underPath(pathname, p)));
  return { section: s?.id ?? null, leaf: s?.items[0]?.href ?? null };
}
