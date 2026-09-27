"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { locate, type NavSection } from "@/lib/navigation";
import { V, cap, un, pl } from "@/lib/vocab";

// Fil d'Ariane de la barre haute : section / feuille de la barre latérale (même arbre, lib/navigation.ts), puis le
// dernier maillon qui suit l'onglet ou la vue affichée. Les pages hors arbre (Mon compte, Proposer un projet…) ont leur libellé ici.
const EDITION_TABS: Record<string, string> = { apercu: "Aperçu", fiche: "Fiche", actions: `${cap(pl(V.action))}`, financements: "Financements", temps: "Temps", budget: "Budget", validations: "Validations", documents: "Documents", bilan: "Bilan" };
// Pages hors arbre (Mon compte, Proposer un projet…) : leur libellé, pour la personne à qui il ne reste aucune feuille reconnue.
// `/validations` (redirige vers /demandes) et `/cafe` (rattaché à Échéances par `alsoPaths`) sont désormais reconnus par
// l'arbre lui-même : plus besoin d'un maillon hors arbre pour eux.
const OUTSIDE: [RegExp, string][] = [
  [/^\/compte/, "Mon compte"],
  [/^\/admin\/depart/, "Préparer un départ"],
  [/^\/projets\/proposer/, "Proposer un projet"],
];

// Calcule les maillons du fil d'Ariane (section, feuille, puis le dernier maillon qui suit l'onglet ou la vue affichée) —
// fonction pure, testable indépendamment du rendu (menu rangé par usage, tâche 6 du 27/09). `null` = page hors arbre et hors
// liste `OUTSIDE` : le composant affiche alors juste « Pilote », sans gras.
export function breadcrumbParts(tree: NavSection[], editions: { id: string; label: string }[], pathname: string, sp: URLSearchParams): string[] | null {
  const { section: sectionId, leaf: leafHref } = locate(tree, pathname, sp);
  const section = tree.find((s) => s.id === sectionId);
  const leaf = section?.items.find((l) => l.href === leafHref);
  const outside = OUTSIDE.find(([re]) => re.test(pathname))?.[1];
  if (!section && !outside) return null;

  const parts: string[] = [];
  if (section) parts.push(section.label);
  if (pathname.startsWith("/edition")) {
    const id = pathname.match(/^\/edition\/([^/?]+)/)?.[1];
    const label = id ? editions.find((e) => e.id === id)?.label : null;
    parts.push(...(label ? label.split(" / ") : [cap(V.edition)]), EDITION_TABS[sp.get("onglet") ?? "apercu"] ?? "Aperçu");
  } else if (/^\/action\//.test(pathname)) {
    parts.push(cap(V.action));
  } else if (/^\/projets\/proposer/.test(pathname)) {
    parts.push(`${cap(pl(V.projet))} et ${pl(V.edition)}`, `Proposer ${un(V.projet)}`);
  } else {
    // « Préparer {année} » : l'année demandée dans l'adresse (?annee=), sinon celle du menu.
    if (pathname.startsWith("/seminaire") && /^\d{4}$/.test(sp.get("annee") ?? "")) parts.push(`Préparer ${sp.get("annee")}`);
    // « À décider » vu depuis le portefeuille (?mode=codir) : remplace la vue de la feuille (« Tous les {projets} »), pas d'ajout à côté.
    else if (pathname.startsWith("/portefeuille") && sp.get("mode") === "codir") parts.push("À décider");
    else if (leaf && leaf.label !== section?.label) parts.push(leaf.label);
    else if (!leaf && outside) parts.push(outside);
    if (/^\/materiel\/pret\/./.test(pathname)) parts.push("Fiche de prêt");
    else if (/^\/projets\/[^/]+$/.test(pathname) && !pathname.startsWith("/projets/proposer")) parts.push("Fiche projet");
    else if (/^\/conventions\/./.test(pathname)) parts.push("Dossier");
    else if (/^\/financeurs\/./.test(pathname)) parts.push("Financeur");
    // Clôture : rattachée à « Temps de l'équipe » par `alsoPaths`, dernier maillon propre à l'onglet.
    else if (pathname.startsWith("/cloture")) parts.push("Clôture");
    // Café du lundi : rattaché à Échéances par `alsoPaths` ; en projection plein écran (?plein=1), comme l'écran À décider (/codir).
    else if (pathname.startsWith("/cafe")) parts.push(sp.get("plein") === "1" ? "Projection" : "Café du lundi");
    else if (pathname.startsWith("/codir") && sp.get("plein") === "1") parts.push("Projection");
  }
  return parts;
}

export function Breadcrumb({ tree, editions }: { tree: NavSection[]; editions: { id: string; label: string }[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const parts = breadcrumbParts(tree, editions, pathname, sp);
  if (!parts) return <span className="block text-[13px] text-muted-foreground">Pilote</span>;
  const rest = [...parts];
  const last = rest.pop();
  return (
    <span className="block truncate text-[13px] text-muted-foreground" data-testid="breadcrumb">
      {rest.length > 0 && <>{rest.join(" / ")} / </>}<b className="font-medium text-primary">{last}</b>
    </span>
  );
}
