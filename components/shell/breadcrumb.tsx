"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { locate, type NavSection } from "@/lib/navigation";

// Fil d'Ariane de la barre haute : section / feuille de la barre latérale (même arbre, lib/navigation.ts), puis le
// dernier maillon qui suit l'onglet ou la vue affichée. Les pages hors arbre (Mon compte, Proposer un projet…) ont leur libellé ici.
const EDITION_TABS: Record<string, string> = { apercu: "Aperçu", fiche: "Fiche", actions: "Actions", financements: "Financements", temps: "Temps", budget: "Budget", validations: "Validations", documents: "Documents", bilan: "Bilan" };
const OUTSIDE: [RegExp, string][] = [
  [/^\/compte/, "Mon compte"],
  [/^\/admin\/depart/, "Préparer un départ"],
  [/^\/projets\/proposer/, "Proposer un projet"],
  [/^\/validations/, "Validations par niveau"],
  [/^\/cafe/, "Écran café"],
];

export function Breadcrumb({ tree, editions }: { tree: NavSection[]; editions: { id: string; label: string }[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const { section: sectionId, leaf: leafHref } = locate(tree, pathname, sp);
  const section = tree.find((s) => s.id === sectionId);
  const leaf = section?.items.find((l) => l.href === leafHref);
  const outside = OUTSIDE.find(([re]) => re.test(pathname))?.[1];
  if (!section && !outside) return <span className="block text-[13px] text-muted-foreground">Pilote</span>;

  const parts: string[] = [];
  if (section) parts.push(section.label);
  if (pathname.startsWith("/edition")) {
    const id = pathname.match(/^\/edition\/([^/?]+)/)?.[1];
    const label = id ? editions.find((e) => e.id === id)?.label : null;
    parts.push(...(label ? label.split(" / ") : ["Édition"]), EDITION_TABS[sp.get("onglet") ?? "apercu"] ?? "Aperçu");
  } else if (/^\/projets\/proposer/.test(pathname)) {
    parts.push("Projets et éditions", "Proposer un projet");
  } else {
    if (leaf && leaf.label !== section?.label) parts.push(leaf.label);
    else if (!leaf && outside) parts.push(outside);
    if (/^\/conventions\/./.test(pathname)) parts.push("Convention");
    else if (/^\/financeurs\/./.test(pathname)) parts.push("Financeur");
    else if (pathname.startsWith("/portefeuille") && sp.get("mode") === "codir") parts.push("Mode CODIR");
    else if ((pathname.startsWith("/codir") || pathname.startsWith("/cafe")) && sp.get("plein") === "1") parts.push("Projection");
  }
  const last = parts.pop();
  return (
    <span className="block truncate text-[13px] text-muted-foreground" data-testid="breadcrumb">
      {parts.length > 0 && <>{parts.join(" / ")} / </>}<b className="font-medium text-primary">{last}</b>
    </span>
  );
}
