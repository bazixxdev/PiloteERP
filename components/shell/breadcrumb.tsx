"use client";

import { usePathname } from "next/navigation";

// Fil d'Ariane de la barre haute : « Mon travail / Mes temps », « Pilotage / Portefeuille »…
const SECTIONS: [RegExp, string, string][] = [
  [/^\/portefeuille/, "Pilotage", "Portefeuille"],
  [/^\/edition/, "Projets", "Édition"],
  [/^\/ma-semaine/, "Mon travail", "Ma semaine"],
  [/^\/temps/, "Mon travail", "Mes temps"],
  [/^\/cloture/, "Mon travail", "Clôture mensuelle"],
  [/^\/annuel/, "Pilotage", "Vue annuelle"],
  [/^\/validations/, "Pilotage", "Validations"],
  [/^\/cafe/, "Collectif", "Écran café"],
  [/^\/codir/, "Collectif", "Écran CODIR"],
  [/^\/seminaire/, "Collectif", "Séminaire"],
  [/^\/rappels/, "Collectif", "Rappels"],
  [/^\/admin/, "Réglages", "Admin"],
];

export function Breadcrumb({ editions }: { editions: { id: string; label: string }[] }) {
  const pathname = usePathname();
  const editionId = pathname.match(/^\/edition\/([^/?]+)/)?.[1];
  const editionLabel = editionId ? editions.find((e) => e.id === editionId)?.label : null;
  const hit = SECTIONS.find(([re]) => re.test(pathname));
  if (!hit) return <span className="text-[11px] text-muted-foreground">Pilote</span>;
  const [, section, page] = hit;
  return (
    <span className="truncate text-[11px] text-muted-foreground" data-testid="breadcrumb">
      {section} / <b className="font-semibold text-foreground">{pathname.startsWith("/edition") && editionLabel ? editionLabel : page}</b>
    </span>
  );
}
