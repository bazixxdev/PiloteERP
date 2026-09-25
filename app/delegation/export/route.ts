import { NextResponse } from "next/server";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { sessionExportAllowed } from "@/lib/export-auth";
import { loadSheet } from "@/lib/delegation-db";
import { fmtDate } from "@/lib/format";
import { getCurrentPerson } from "@/lib/session";

// Export .docx de la feuille de délégation (25/09) : les mêmes blocs que la vue, pour la période, **sans les tâches**
// (personnelles). Mêmes règles de lecture que la page : une délégation illisible n'y entre pas.
export async function GET(req: Request) {
  if (!(await sessionExportAllowed(req))) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const me = await getCurrentPerson();
  const url = new URL(req.url);
  const personId = url.searchParams.get("personne") ?? me.id;
  const year = Number(url.searchParams.get("annee")) || new Date().getFullYear();
  const sheet = await loadSheet(me, personId, year, url.searchParams.get("periode") ?? undefined);
  if (!sheet) return new NextResponse("Introuvable", { status: 404 });

  const p = (text: string) => new Paragraph({ text });
  const label = (k: string, v: string | null) => new Paragraph({ children: [new TextRun({ text: `${k} : `, bold: true }), new TextRun(v ?? "—")] });
  const children: Paragraph[] = [
    new Paragraph({ text: `Feuille de délégation · ${sheet.person.name}`, heading: HeadingLevel.TITLE }),
    p(`${year} · période : ${sheet.period.label}${sheet.person.jobTitle ? ` · ${sheet.person.jobTitle}` : ""}`),
  ];
  for (const g of sheet.groups) {
    children.push(new Paragraph({ text: g.pole, heading: HeadingLevel.HEADING_1 }));
    for (const c of g.cards) {
      children.push(new Paragraph({ text: c.edition.name, heading: HeadingLevel.HEADING_2 }));
      children.push(label("Attendus", c.delegation.expectations), label("Limites", c.delegation.limits), label("Contrôles", c.delegation.controls));
      children.push(p(c.delegation.acknowledgedAt ? `Pris connaissance le ${fmtDate(c.delegation.acknowledgedAt)}.` : "Pas encore pris connaissance."));
      if (c.objectives.length) { children.push(new Paragraph({ text: "Objectifs", heading: HeadingLevel.HEADING_3 })); for (const a of c.objectives) children.push(new Paragraph({ text: `${a.name}${a.milestoneDate ? ` — ${fmtDate(a.milestoneDate)}` : ""}`, bullet: { level: 0 } })); }
      if (c.checkpoints.length || c.deliverables.length) {
        children.push(new Paragraph({ text: "Points de contrôle et livrables dus", heading: HeadingLevel.HEADING_3 }));
        for (const a of c.checkpoints) children.push(new Paragraph({ text: `${a.name} — ${fmtDate(a.milestoneDate!)}`, bullet: { level: 0 } }));
        for (const d of c.deliverables) children.push(new Paragraph({ text: `${d.label} — ${fmtDate(d.dueDate)} (${d.funder})`, bullet: { level: 0 } }));
      }
      if (c.indicators.length) { children.push(new Paragraph({ text: "Indicateurs", heading: HeadingLevel.HEADING_3 })); for (const i of c.indicators) children.push(new Paragraph({ text: `${i.label} — cible ${i.target ?? "—"}, réalisé ${i.actual ?? "—"}`, bullet: { level: 0 } })); }
    }
  }
  children.push(p(`Exporté le ${fmtDate(new Date())} depuis Pilote.`));
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  const slug = sheet.person.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="delegation-${slug}-${year}-${sheet.period.key}.docx"` } });
}
