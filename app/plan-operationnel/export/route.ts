import { NextResponse } from "next/server";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import { prisma } from "@/lib/db";
import { getRefs } from "@/lib/session";
import { ficheInclude, ficheParagraphs } from "@/lib/fiche-docx";
import { fmtDate } from "@/lib/format";

// Plan opérationnel assemblé (retour du 14/09, S15) : toutes les fiches d'une année en un seul Word, par pôle puis mission,
// à la place des 2-3 heures de copier-coller de l'assistante. Une fiche par page, un sommaire en tête. Comme l'export d'une fiche :
// ouvert depuis l'outil, sans jeton (le jeton d'API reste exigé sur les exports de données pour Excel).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("annee")) || new Date().getFullYear();
  const poleId = url.searchParams.get("pole") || null;
  const editions = await prisma.edition.findMany({
    where: { year, status: { not: "closed" }, ...(poleId ? { project: { poleId } } : {}) },
    include: ficheInclude,
    orderBy: [{ project: { pole: { name: "asc" } } }, { project: { mission: { order: "asc" } } }, { project: { name: "asc" } }],
  });
  const refs = await getRefs();
  const byPole = new Map<string, typeof editions>();
  for (const e of editions) byPole.set(e.project.pole.name, [...(byPole.get(e.project.pole.name) ?? []), e]);
  const children: Paragraph[] = [
    new Paragraph({ text: `Plan opérationnel ${year} — CRESS Centre-Val de Loire`, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `${editions.length} fiche${editions.length > 1 ? "s" : ""} projet · assemblé le ${fmtDate(new Date())} depuis Pilote (prototype). Chaque fiche est au format du gabarit « Fiche projet ».` }),
    new Paragraph({ text: "Sommaire", heading: HeadingLevel.HEADING_1 }),
    ...[...byPole.entries()].flatMap(([pole, list]) => [new Paragraph({ text: pole, heading: HeadingLevel.HEADING_2 }), ...list.map((e) => new Paragraph({ text: `• ${e.project.name} — ${e.project.mission.name} — pilote ${e.project.pilot.name}` }))]),
    ...editions.flatMap((e) => ficheParagraphs(e, refs, { nested: true })),
  ];
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="plan-operationnel-${year}.docx"` } });
}
