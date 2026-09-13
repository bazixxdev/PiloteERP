import { NextResponse } from "next/server";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getRefs } from "@/lib/session";
import { refLabel } from "@/lib/refs";

// Export du bilan (EF-I3) : .md ou .docx basique.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "md";
  const e = await prisma.edition.findUnique({ where: { id }, include: { project: { include: { pilot: true, pole: true, guarantor: true } }, sponsor: true, team: { include: { person: true } }, indicators: { orderBy: { order: "asc" } }, fundingLines: { include: { funder: true, convention: true } }, actions: { orderBy: { order: "asc" } }, remarks: { where: { resolvedAt: null }, include: { author: true } } } });
  if (!e) return new NextResponse("Introuvable", { status: 404 });
  const refs = await getRefs();
  const state = (code: string) => refLabel(refs, "action_state", code);

  // Fiche projet au format du gabarit Word « À COPIER — FICHE PROJET » : mêmes rubriques, dans le même ordre, plus les remarques ouvertes.
  if (format === "fiche") {
    const P = (t: string) => new Paragraph({ text: t });
    const H = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 });
    const sub = (t: string) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 });
    const txt = (v: string | null | undefined) => (v && v.trim() ? v.split("\n").map(P) : [P("—")]);
    const rq = (field: string) => e.remarks.filter((r) => r.field === field).map((r) => new Paragraph({ children: [new TextRun({ text: `Remarque (${r.author.name}, ${fmtDate(r.createdAt)}) : ${r.body}`, italics: true, color: "8A5A00" })] }));
    const fmtEuroPlain = (n: number | null) => (n === null ? "—" : `${new Intl.NumberFormat("fr-FR").format(n)} €`);
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: `${e.project.name} — ${e.year}`, heading: HeadingLevel.TITLE }),
          P(`${e.project.pole.name} · ${refLabel(refs, "edition_status", e.status)} · Code ${e.project.analyticCode}`),
          H("Objectifs qualitatifs (résolution de quelle problématique)"), ...txt(e.operationalObjectives), ...rq("operationalObjectives"),
          H("Objectifs quantitatifs"), ...txt(e.quantitativeObjectives), ...rq("quantitativeObjectives"),
          H("Rattachement textes"),
          P(`Lien SRESS (orientation, mesure) : ${e.sressMeasure ?? "—"}`), ...rq("sressMeasure"),
          P(`Lien Plan stratégique : ${e.axis ?? "—"}`), ...rq("axis"),
          P(`Lien SNESS : ${e.snessLink ?? "—"}`), ...rq("snessLink"),
          P(`Autres : ${e.otherTexts ?? "—"}`), ...rq("otherTexts"),
          H("Enjeux et priorités de l'année (direction)"), ...txt(e.stakes), ...rq("stakes"), ...txt(e.yearPriorities), ...rq("yearPriorities"),
          H("Contenu développé, valeur ajoutée"), ...txt(e.content), ...rq("content"),
          H("Public / Bénéficiaires"), ...txt(e.audience), ...rq("audience"),
          H("Modalités d'exécution"),
          P(`Pilote : ${e.project.pilot.name}`), P(`Équipe projet : ${e.team.map((t) => t.person.name).join(", ") || "—"}`),
          P(`Gouvernance du projet (GT, COPIL…) : ${e.governance ?? "—"}`), ...rq("governance"),
          P(`Sponsor : ${e.sponsor?.name ?? "—"}`), P(`Responsable de pôle garant : ${e.project.guarantor?.name ?? "—"}`),
          P(`Méthode : ${e.method ?? "—"}`), ...rq("method"), P(`Partenaires : ${e.partners ?? "—"}`), ...rq("partners"),
          H("Lieux et animation"), ...txt(e.venues), ...rq("venues"),
          H("Matériel · outils, mobilier, services"), ...txt(e.equipment), ...rq("equipment"),
          H("Temporel — calendrier, phases, échéances"), ...txt(e.calendar), ...rq("calendar"),
          P(`Date de rendu : ${fmtDate(e.deliveryDate)}`), ...rq("deliveryDate"),
          sub("Dates jalons"), ...e.actions.map((a) => P(`• ${a.name} — ${fmtDate(a.milestoneDate)} — ${state(a.state)}`)),
          H("Financier"),
          P(`Budget prévisionnel (dépenses directes) : ${fmtEuroPlain(e.directExpenseEnvelope)} · enveloppe validée : ${fmtEuroPlain(e.budgetEnvelope)}`), ...rq("directExpenseEnvelope"),
          P(`Besoin en temps : ${e.timeNeed ?? "—"} · besoin en budget : ${e.budgetNeed ?? "—"} · ETP fléchés : ${e.fte ?? "—"}`),
          P(`Partenaires financiers pressentis : ${e.plannedFunders ?? "—"}`), ...rq("plannedFunders"),
          sub("Conventions financières"), ...(e.fundingLines.length ? e.fundingLines.map((f) => P(`• ${f.funder.name}${f.scheme ? ` · ${f.scheme}` : ""} — ${refLabel(refs, "funding_status", f.status)} — demandé ${fmtEuroPlain(f.amountRequested)}, obtenu ${fmtEuroPlain(f.amountGranted)}${f.convention ? ` — convention ${f.convention.reference}` : ""}`)) : [P("—")]),
          H("Éléments justificatifs à conserver, et à quelles échéances"), ...txt(e.evidenceToKeep), ...rq("evidenceToKeep"),
          H("Indicateurs de résultats"),
          P(`Imposés par les financeurs : ${e.imposedIndicators ?? "—"}`), ...rq("imposedIndicators"), P(`Propres : ${e.ownIndicators ?? "—"}`), ...rq("ownIndicators"),
          ...e.indicators.map((i) => P(`• ${i.label} — cible ${i.target ?? "—"} — réalisé ${i.actual ?? "—"}${i.imposed ? " (imposé)" : ""}`)),
          H("Impacts attendus"), ...txt(e.expectedOutcome), ...rq("expectedOutcome"),
          H("Évaluation"), ...txt(e.evaluation),
          H("Validation"), P(`Décision du CODIR : ${e.codirDecision ? refLabel(refs, "codir_decision", e.codirDecision) : "—"} (${fmtDate(e.codirDate)}) · CA : ${e.boardValidated ? `validé le ${fmtDate(e.boardDate)}` : "en attente"}`),
          P(`Exporté le ${fmtDate(new Date())} depuis Pilote (prototype), au format du gabarit « Fiche projet ».`),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="fiche-${e.project.analyticCode}-${e.year}.docx"` } });
  }

  const title = `Bilan ${e.year} — ${e.project.name}`;
  const meta = `Pôle ${e.project.pole.name} · Pilote ${e.project.pilot.name} · Code ${e.project.analyticCode} · Financeurs : ${e.fundingLines.map((f) => f.funder.name).join(", ") || "—"}`;
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
          new Paragraph({ text: "Actions", heading: HeadingLevel.HEADING_1 }),
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
    "## Actions", "", ...e.actions.map((a) => `- ${a.name} — ${fmtDate(a.milestoneDate)} — ${state(a.state)}`), "",
    `_Exporté le ${fmtDate(new Date())} depuis Pilote (prototype)._`, "",
  ].join("\n");
  return new NextResponse(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.md"` } });
}
