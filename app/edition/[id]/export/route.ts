import { NextResponse } from "next/server";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from "docx";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getRefs } from "@/lib/session";
import { refLabel } from "@/lib/refs";
import { ficheParagraphs, loadFiche } from "@/lib/fiche-docx";
import { V, cap, pl } from "@/lib/vocab";

// Export du bilan (EF-I3) : .md ou .docx basique.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "md";
  const e = await prisma.edition.findUnique({ where: { id }, include: { project: { include: { pilot: true, pole: true, guarantor: true } }, sponsor: true, team: { include: { person: true } }, indicators: { orderBy: { order: "asc" } }, fundingLines: { include: { funder: true, convention: true } }, actions: { orderBy: { order: "asc" } }, remarks: { where: { resolvedAt: null }, include: { author: true } }, achievements: { orderBy: { date: "asc" }, include: { action: true } } } });
  if (!e) return new NextResponse("Introuvable", { status: 404 });
  const refs = await getRefs();
  const state = (code: string) => refLabel(refs, "action_state", code);
  const KINDS: Record<string, string> = { participants: "Participants / inscrits", audience: "Public touché", deliverable: "Livrable", press: "Retombée", partner: "Partenaire", other: "Autre" };
  const achLine = (a: (typeof e.achievements)[number]) => `${fmtDate(a.date)} — ${a.value != null ? `${new Intl.NumberFormat("fr-FR").format(a.value)}${a.unit ? ` ${a.unit}` : ""} · ` : ""}${a.label} (${KINDS[a.kind] ?? a.kind}${a.action ? `, ${a.action.name}` : ""})`;

  // Fiche projet au format du gabarit Word : construction partagée avec le plan opérationnel assemblé (lib/fiche-docx.ts).
  if (format === "fiche") {
    const fe = await loadFiche(id);
    const doc = new Document({ sections: [{ children: [...ficheParagraphs(fe!, refs), new Paragraph({ text: `Exporté le ${fmtDate(new Date())} depuis Pilote (prototype), au format du gabarit « Fiche projet ».` })] }] });
    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="fiche-${e.project.analyticCode}-${e.year}.docx"` } });
  }

  const title = `Bilan ${e.year} — ${e.project.name}`;
  const meta = `${cap(V.pole)} ${e.project.pole.name} · ${cap(V.pilote)} ${e.project.pilot.name} · Code ${e.project.analyticCode} · Financeurs : ${e.fundingLines.map((f) => f.funder.name).join(", ") || "—"}`;
  const filename = `bilan-${e.project.analyticCode}-${e.year}`;

  if (format === "docx") {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
          new Paragraph({ text: meta }),
          new Paragraph({ text: "Évaluation", heading: HeadingLevel.HEADING_1 }),
          ...(e.evaluation ?? "—").split("\n").map((l) => new Paragraph({ text: l })),
          new Paragraph({ text: "Bilan", heading: HeadingLevel.HEADING_1 }),
          ...(e.report ?? "—").split("\n").map((l) => new Paragraph({ text: l })),
          new Paragraph({ text: "Indicateurs", heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: ["Indicateur", "Cible", "Réalisé", "Imposé"].map((t) => new TableCell({ children: [new Paragraph({ text: t })] })) }),
              ...e.indicators.map((i) => new TableRow({ children: [i.label, i.target ?? "", i.actual ?? "", i.imposed ? "oui" : ""].map((t) => new TableCell({ children: [new Paragraph({ text: t })] })) })),
            ],
          }),
          new Paragraph({ text: "Réalisations consignées", heading: HeadingLevel.HEADING_1 }),
          ...(e.achievements.length ? e.achievements.map((a) => new Paragraph({ text: `• ${achLine(a)}` })) : [new Paragraph({ text: "—" })]),
          new Paragraph({ text: `${cap(pl(V.action))}`, heading: HeadingLevel.HEADING_1 }),
          ...e.actions.map((a) => new Paragraph({ text: `• ${a.name} — ${fmtDate(a.milestoneDate)} — ${state(a.state)}` })),
          new Paragraph({ text: `Exporté le ${fmtDate(new Date())} depuis Pilote (prototype).` }),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${filename}.docx"` } });
  }

  const md = [
    `# ${title}`, "", meta, "",
    "## Évaluation", "", e.evaluation ?? "—", "",
    "## Bilan", "", e.report ?? "—", "",
    "## Indicateurs", "", "| Indicateur | Cible | Réalisé | Imposé |", "|---|---|---|---|",
    ...e.indicators.map((i) => `| ${i.label} | ${i.target ?? ""} | ${i.actual ?? ""} | ${i.imposed ? "oui" : ""} |`), "",
    "## Réalisations consignées", "", ...(e.achievements.length ? e.achievements.map((a) => `- ${achLine(a)}`) : ["—"]), "",
    `## ${cap(pl(V.action))}`, "", ...e.actions.map((a) => `- ${a.name} — ${fmtDate(a.milestoneDate)} — ${state(a.state)}`), "",
    `_Exporté le ${fmtDate(new Date())} depuis Pilote (prototype)._`, "",
  ].join("\n");
  return new NextResponse(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.md"` } });
}
