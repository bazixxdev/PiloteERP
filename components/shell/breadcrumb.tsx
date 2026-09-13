"use client";

import { usePathname, useSearchParams } from "next/navigation";

// Fil d'Ariane de la barre haute : section / écran / onglet courant, lu dans l'URL (chemin + paramètres).
const SECTIONS: [RegExp, string, string][] = [
  [/^\/portefeuille/, "Pilotage", "Portefeuille"],
  [/^\/edition/, "Projets", "Édition"],
  [/^\/ma-semaine/, "Mon travail", "Ma semaine"],
  [/^\/temps/, "Mon travail", "Temps"],
  [/^\/cloture/, "Mon travail", "Temps"],
  [/^\/annuel/, "Pilotage", "Vue annuelle"],
  [/^\/plan-de-charge/, "Pilotage", "Plan de charge"],
  [/^\/validations/, "Pilotage", "Validations"],
  [/^\/cafe/, "Collectif", "Écran café"],
  [/^\/codir/, "Collectif", "Écran CODIR"],
  [/^\/seminaire/, "Collectif", "Séminaire"],
  [/^\/rappels/, "Collectif", "Rappels"],
  [/^\/projets/, "Projets et financements", "Projets et éditions"],
  [/^\/conventions/, "Projets et financements", "Conventions"],
  [/^\/financeurs/, "Projets et financements", "Financeurs"],
  [/^\/admin/, "Réglages", "Admin"],
  [/^\/compte/, "Réglages", "Mon compte"],
];

const EDITION_TABS: Record<string, string> = { fiche: "Fiche", actions: "Actions", financements: "Financements", temps: "Temps", budget: "Budget", validations: "Validations", documents: "Documents", bilan: "Bilan" };
const ADMIN_SECTIONS: Record<string, string> = { personnes: "Personnes", projets: "Projets et éditions", referentiels: "Référentiels", parametres: "Paramètres", donnees: "Import / export" };

export function Breadcrumb({ editions }: { editions: { id: string; label: string }[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const hit = SECTIONS.find(([re]) => re.test(pathname));
  if (!hit) return <span className="text-[11px] text-muted-foreground">Pilote</span>;
  const [, section, page] = hit;

  // Le dernier maillon suit l'onglet ou la vue affichée.
  const parts: string[] = [];
  if (pathname.startsWith("/edition")) {
    const id = pathname.match(/^\/edition\/([^/?]+)/)?.[1];
    const label = id ? editions.find((e) => e.id === id)?.label : null;
    if (label) parts.push(...label.split(" / "));
    parts.push(EDITION_TABS[sp.get("onglet") ?? "fiche"] ?? "Fiche");
  } else if (/^\/conventions\/./.test(pathname)) {
    parts.push(page, "Convention");
  } else if (/^\/financeurs\/./.test(pathname)) {
    parts.push(page, "Financeur");
  } else if (pathname.startsWith("/cloture")) {
    parts.push(page, "Clôture mensuelle");
  } else if (pathname.startsWith("/temps")) {
    parts.push(page, sp.get("personne") || sp.get("equipe") ? "Temps de l'équipe" : "Ma saisie");
  } else if (pathname.startsWith("/admin")) {
    parts.push(page, ADMIN_SECTIONS[sp.get("section") ?? "personnes"] ?? "Personnes");
  } else if (pathname.startsWith("/portefeuille") && sp.get("mode") === "codir") {
    parts.push(page, "Mode CODIR");
  } else if ((pathname.startsWith("/codir") || pathname.startsWith("/cafe")) && sp.get("plein") === "1") {
    parts.push(page, "Projection");
  } else {
    parts.push(page);
  }
  const last = parts.pop();
  return (
    <span className="truncate text-[11px] text-muted-foreground" data-testid="breadcrumb">
      {[section, ...parts].join(" / ")} / <b className="font-semibold text-foreground">{last}</b>
    </span>
  );
}
