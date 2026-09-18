import { HeadingLevel, Paragraph, TextRun } from "docx";
import { prisma } from "./db";
import { fmtDate } from "./format";
import { refLabel, type RefMap } from "./refs";
import { V, du, de } from "@/lib/vocab";

// Fiche projet au format du gabarit Word « À COPIER — FICHE PROJET » : mêmes rubriques, dans le même ordre, plus les remarques
// ouvertes et les réalisations. Partagé entre l'export d'une fiche et le plan opérationnel assemblé (toutes les fiches d'une année).
export const ficheInclude = {
  project: { include: { pilot: true, pole: true, guarantor: true, mission: true } }, sponsor: true, team: { include: { person: true } },
  indicators: { orderBy: { order: "asc" as const } }, fundingLines: { include: { funder: true, convention: true } }, actions: { orderBy: { order: "asc" as const } },
  remarks: { where: { resolvedAt: null }, include: { author: true } }, achievements: { orderBy: { date: "asc" as const }, include: { action: true } },
};

export type FicheEdition = NonNullable<Awaited<ReturnType<typeof loadFiche>>>;
export async function loadFiche(id: string) { return prisma.edition.findUnique({ where: { id }, include: ficheInclude }); }

const KINDS: Record<string, string> = { participants: "Participants / inscrits", audience: "Public touché", deliverable: "Livrable", press: "Retombée", partner: "Partenaire", other: "Autre" };

// Dans un document assemblé (plan opérationnel), la fiche descend d'un niveau de titre.
export function ficheParagraphs(e: FicheEdition, refs: RefMap, opts?: { nested?: boolean }): Paragraph[] {
  const nested = Boolean(opts?.nested);
  const state = (code: string) => refLabel(refs, "action_state", code);
  const achLine = (a: FicheEdition["achievements"][number]) => `${fmtDate(a.date)} — ${a.value != null ? `${new Intl.NumberFormat("fr-FR").format(a.value)}${a.unit ? ` ${a.unit}` : ""} · ` : ""}${a.label} (${KINDS[a.kind] ?? a.kind}${a.action ? `, ${a.action.name}` : ""})`;
  const P = (t: string) => new Paragraph({ text: t });
  const H = (t: string) => new Paragraph({ text: t, heading: nested ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1 });
  const sub = (t: string) => new Paragraph({ text: t, heading: nested ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2 });
  const txt = (v: string | null | undefined) => (v && v.trim() ? v.split("\n").map(P) : [P("—")]);
  const rq = (field: string) => e.remarks.filter((r) => r.field === field).map((r) => new Paragraph({ children: [new TextRun({ text: `Remarque (${r.author.name}, ${fmtDate(r.createdAt)}) : ${r.body}`, italics: true, color: "8A5A00" })] }));
  const fmtEuroPlain = (n: number | null) => (n === null ? "—" : `${new Intl.NumberFormat("fr-FR").format(n)} €`);
  return [
    new Paragraph({ text: `${e.project.name} — ${e.year}`, heading: nested ? HeadingLevel.HEADING_1 : HeadingLevel.TITLE, pageBreakBefore: nested }),
    P(`${e.project.pole.name} · ${e.project.mission.name} · ${refLabel(refs, "edition_status", e.status)} · Code ${e.project.analyticCode} · Pilote ${e.project.pilot.name}`),
    H("Objectifs qualitatifs (résolution de quelle problématique)"), ...txt(e.operationalObjectives), ...rq("operationalObjectives"),
    H("Objectifs quantitatifs"), ...txt(e.quantitativeObjectives), ...rq("quantitativeObjectives"),
    H("Rattachement textes"),
    P(`Lien SRESS (orientation, mesure) : ${e.sressMeasure ?? "—"}`), ...rq("sressMeasure"),
    P(`Lien Plan stratégique : ${e.axis ?? "—"}`), ...rq("axis"),
    P(`Lien SNESS : ${e.snessLink ?? "—"}`), ...rq("snessLink"),
    P(`Autres : ${e.otherTexts ?? "—"}`), ...rq("otherTexts"),
    H(`Enjeux et priorités de l'année (${V.direction.one})`), ...txt(e.stakes), ...rq("stakes"), ...txt(e.yearPriorities), ...rq("yearPriorities"),
    H("Contenu développé, valeur ajoutée"), ...txt(e.content), ...rq("content"),
    H("Public / Bénéficiaires"), ...txt(e.audience), ...rq("audience"),
    H("Modalités d'exécution"),
    P(`Pilote : ${e.project.pilot.name}`), P(`Équipe projet : ${e.team.map((t) => t.person.name).join(", ") || "—"}`),
    P(`Gouvernance du projet (GT, COPIL…) : ${e.governance ?? "—"}`), ...rq("governance"),
    P(`Sponsor : ${e.sponsor?.name ?? "—"}`), P(`Responsable ${de(V.pole)} garant : ${e.project.guarantor?.name ?? "—"}`),
    P(`Méthode : ${e.method ?? "—"}`), ...rq("method"), P(`Partenaires : ${e.partners ?? "—"}`), ...rq("partners"),
    H("Lieux et animation"), ...txt(e.venues), ...rq("venues"),
    H("Matériel · outils, mobilier, services"), ...txt(e.equipment), ...rq("equipment"),
    H("Temporel — calendrier, phases, échéances"), ...txt(e.calendar), ...rq("calendar"),
    P(`Date de rendu : ${fmtDate(e.deliveryDate)}`), ...rq("deliveryDate"),
    sub("Dates jalons"), ...(e.actions.length ? e.actions.map((a) => P(`• ${a.name} — ${fmtDate(a.milestoneDate)} — ${state(a.state)}${a.venue ? ` — ${a.venue}` : ""}`)) : [P("—")]),
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
    H("Réalisations consignées"), ...(e.achievements.length ? e.achievements.map((a) => P(`• ${achLine(a)}`)) : [P("—")]),
    H("Évaluation"), ...txt(e.evaluation),
    H("Validation"), P(`Décision ${du(V.codir)} : ${e.codirDecision ? refLabel(refs, "codir_decision", e.codirDecision) : "—"} (${fmtDate(e.codirDate)}) · CA : ${e.boardValidated ? `validé le ${fmtDate(e.boardDate)}` : "en attente"}`),
  ];
}
