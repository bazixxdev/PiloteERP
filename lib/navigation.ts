// Arbre de navigation à deux niveaux, rangé par usage (spec menu du 27/09) : « Mon travail » (le quotidien), puis par objet —
// Projets, Financements, Réseau, Ressources, Admin. Une vue d'une même liste est un onglet de la page, pas une entrée ; un moment
// de l'année est une entrée de saison. Tout est calculé ici, côté serveur, à partir des droits et des modules. Module pur.
import { canAdmin, canViewTreasury, isCodir, type Actor } from "./rights";
import { preparedYear, prepareInSeason } from "./season";
import { V, pl } from "@/lib/vocab";

export type NavLeaf = {
  label: string;
  href: string;
  badge?: number;
  // Reconnaissance de l'entrée active : préfixe(s) d'adresse, puis conditions sur la chaîne de requête.
  path: string | string[];
  exact?: boolean;
  param?: { key: string; oneOf: (string | null)[] };
  present?: string[];
  absent?: string[];
  // Adresses qui activent aussi cette entrée, sans condition de paramètres (pages d'onglet, pages rattachées : /cloture, /cafe).
  alsoPaths?: string[];
};

export type NavSection = {
  id: "travail" | "projets" | "financements" | "reseau" | "ressources" | "admin";
  label: string;
  badge?: number;
  items: NavLeaf[];
  also?: string[];
};

export type NavContext = Actor & {
  modules: string[];
  veille: boolean;
  adherents: boolean;
  tresorerie: boolean;
  materiel: boolean;
  tracksTime: boolean; // suit son temps : sinon seule « Mon temps » disparaît (spec menu § 6.6)
  showTeam: boolean; // au moins une autre personne dont le temps est visible
  canCloseMonths: boolean; // droit de clôturer les mois (onglet Clôture de Temps de l'équipe)
  wide: string | null;
  badges: { requests: number; reminders: number };
  today: Date; // la saison de « Préparer » (lib/season.ts)
};

export function navTreeFor(ctx: NavContext): NavSection[] {
  const codir = isCodir(ctx);
  const inSeason = prepareInSeason(ctx.today);
  const sections: NavSection[] = [
    {
      id: "travail",
      label: "Mon travail",
      badge: ctx.badges.requests,
      also: ["/notifications"],
      items: [
        { label: "Ma semaine", href: "/ma-semaine", path: "/ma-semaine" },
        { label: "À traiter", href: "/demandes", badge: ctx.badges.requests, path: ["/demandes", "/validations"] },
        ...(ctx.modules.includes("tasks") ? [{ label: "Tâches", href: "/taches", path: "/taches" }] : []),
        ...(ctx.modules.includes("notes") ? [{ label: "Notes", href: "/notes", path: "/notes" }] : []),
        ...(ctx.tracksTime ? [{ label: "Mon temps", href: "/temps", path: "/temps", absent: ["equipe", "personne"] }] : []),
        { label: `Mes ${pl(V.action)}`, href: "/mes-actions", path: "/mes-actions" },
      ],
    },
    {
      id: "projets",
      label: "Projets",
      also: ["/edition", "/action", "/seminaire"],
      items: [
        { label: `Tous les ${pl(V.projet)}`, href: "/projets", path: ["/projets", "/portefeuille"] },
        { label: "Vue annuelle", href: "/annuel", path: "/annuel" },
        { label: "Plan de charge", href: "/plan-de-charge", path: "/plan-de-charge" },
        { label: "Échéances", href: "/echeances", badge: ctx.badges.reminders, path: ["/echeances", "/rappels"], alsoPaths: ["/cafe"] },
        ...(codir ? [{ label: "À décider", href: "/codir", path: "/codir" }] : []),
        ...(codir && inSeason ? [{ label: `Préparer ${preparedYear(ctx.today)}`, href: "/seminaire", path: "/seminaire" }] : []),
      ],
    },
    {
      id: "financements",
      label: "Financements",
      items: [
        { label: "Dossiers", href: "/conventions", path: "/conventions" },
        { label: "Qui finance quoi", href: "/matrice", path: "/matrice" },
        ...(ctx.veille ? [{ label: "Appels à projets", href: "/appels", path: "/appels" }] : []),
      ],
    },
    {
      id: "reseau",
      label: "Réseau",
      also: ["/financeurs"],
      items: [
        { label: "Organisations", href: "/organisations", path: "/organisations" },
        ...(ctx.adherents ? [{ label: "Adhérents", href: "/adherents", path: "/adherents" }] : []),
        { label: "Contacts", href: "/contacts", path: "/contacts" },
      ],
    },
    {
      id: "ressources",
      label: "Ressources",
      items: [
        ...(ctx.tresorerie && canViewTreasury(ctx) ? [{ label: "Trésorerie", href: "/tresorerie", path: "/tresorerie" }] : []),
        ...(ctx.materiel ? [{ label: "Matériel et prêts", href: "/materiel/prets", path: "/materiel" }] : []),
        ...(ctx.showTeam || ctx.canCloseMonths
          ? [{ label: "Temps de l'équipe", href: ctx.showTeam ? "/temps?equipe=1" : "/cloture", path: "/temps", present: ["equipe", "personne"], alsoPaths: ["/cloture"] }]
          : []),
      ],
    },
  ];
  if (canAdmin(ctx)) sections.push({ id: "admin", label: "Admin", items: [{ label: "Admin", href: "/admin", path: "/admin" }] });
  return sections.filter((s) => s.items.length > 0);
}

function underPath(pathname: string, p: string): boolean {
  return pathname === p || pathname.startsWith(p + "/");
}

export function leafMatches(leaf: NavLeaf, pathname: string, params: URLSearchParams): boolean {
  if (leaf.alsoPaths?.some((p) => underPath(pathname, p))) return true;
  const paths = Array.isArray(leaf.path) ? leaf.path : [leaf.path];
  if (!paths.some((p) => (leaf.exact ? pathname === p : underPath(pathname, p)))) return false;
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
