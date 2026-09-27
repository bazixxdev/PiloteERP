import { NextResponse } from "next/server";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { fmtDate } from "@/lib/format";
import { sessionExportAllowed } from "@/lib/export-auth";
import { loadMesActions } from "@/lib/mes-actions-db";
import { canSeeTimeOf } from "@/lib/rights";
import { getCurrentPerson, getPeople, getSettings } from "@/lib/session";

// Export .docx « feuille de mission » (26/09, modelé sur l'ancien app/delegation/export/route.ts) : les mêmes blocs que
// /mes-actions, pour la période, **sans les tâches** (personnelles). Garde identique à la page mais 403 (pas 404) sur un
// refus : la ressource existe, l'export est seulement interdit — vérifiée **avant** toute lecture des actions.
export async function GET(req: Request) {
  if (!(await sessionExportAllowed(req))) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const me = await getCurrentPerson();
  const url = new URL(req.url);
  const personId = url.searchParams.get("personne") ?? me.id;
  const isSelf = personId === me.id;
  if (!isSelf) {
    const [settings, people] = await Promise.all([getSettings(), getPeople()]);
    const target = people.find((p) => p.id === personId);
    if (!target || !canSeeTimeOf(me, target, settings.timeVisibility)) return NextResponse.json({ error: "Export non autorisé" }, { status: 403 });
  }
  const year = Number(url.searchParams.get("annee")) || new Date().getFullYear();
  const sheet = await loadMesActions(personId, year, url.searchParams.get("periode") ?? undefined, isSelf);
  if (!sheet) return new NextResponse("Introuvable", { status: 404 });

  const p = (text: string) => new Paragraph({ text });
  const label = (k: string, v: string | null) => new Paragraph({ children: [new TextRun({ text: `${k} : `, bold: true }), new TextRun(v ?? "—")] });
  const children: Paragraph[] = [
    new Paragraph({ text: `Feuille de mission · ${sheet.person.name}`, heading: HeadingLevel.TITLE }),
    p(`${year} · période : ${sheet.period.label}${sheet.person.jobTitle ? ` · ${sheet.person.jobTitle}` : ""}`),
  ];
  for (const project of sheet.projects) {
    children.push(new Paragraph({ text: project.name, heading: HeadingLevel.HEADING_1 }));
    for (const a of project.actions) {
      children.push(new Paragraph({ text: `${a.name} — du ${fmtDate(a.startDate)} au ${fmtDate(a.endDate)}`, heading: HeadingLevel.HEADING_2 }));
      children.push(label("Ce qui est confié", a.entrusted), label("Marge de décision", a.latitude));
      if (a.milestones.length) {
        children.push(new Paragraph({ text: "Jalons de la période", heading: HeadingLevel.HEADING_3 }));
        for (const m of a.milestones) children.push(new Paragraph({ text: `${m.name} — ${fmtDate(m.date)}${m.isCheckpoint ? " (point de contrôle)" : ""}`, bullet: { level: 0 } }));
      }
    }
  }
  children.push(p(`Exporté le ${fmtDate(new Date())} depuis Pilote.`));
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  const slug = sheet.person.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="feuille-mission-${slug}-${year}-${sheet.period.key}.docx"` } });
}
