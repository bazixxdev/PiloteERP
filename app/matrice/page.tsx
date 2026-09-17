import Link from "next/link";
import { listFunders } from "@/lib/organisations";
import { Download } from "lucide-react";
import { DossiersHeader } from "@/components/common/dossiers-nav";
import { EmptyState } from "@/components/common/empty-state";
import { PerimeterChips } from "@/components/common/perimeter";
import { HelpTip } from "@/components/common/help-tip";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { isCodir } from "@/lib/rights";
import { inMyScope, isTransversal, perimeterFrom } from "@/lib/scope";
import { buildMatrix, coverageTone, type Cell } from "@/lib/matrix";
import { refLabel } from "@/lib/refs";
import { fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";
import { YearPicker } from "./year-picker";
import { UrlPanel } from "@/components/common/url-panel";
import { FundingLinePanelBody, fundingPanelTitle, FUNDING_PANEL_DESCRIPTION } from "@/components/funding/line-panel";
import { loadEdition } from "@/lib/queries";
import { canEditFunding } from "@/lib/rights";

type Search = { annee?: string; perimetre?: string; ligne?: string; champ?: string };

// « Qui finance quoi » (lot C) : la matrice éditions × financeurs d'une année. Les données existaient ligne par ligne
// (onglet Budget) et financeur par financeur ; cette page les croise. Montants pour le CODIR ; pastilles pour les autres.
export default async function MatricePage({ searchParams }: { searchParams: Promise<Search> }) {
  const [me, refs, sp] = await Promise.all([getCurrentPerson(), getRefs(), searchParams]);
  const currentYear = new Date().getFullYear();
  const year = Number(sp.annee) || currentYear;
  const perimeter = perimeterFrom(me, sp.perimetre);
  const [editions, funders, conventions, years] = await Promise.all([
    prisma.edition.findMany({ where: { year }, include: { project: { include: { pole: true, pilot: true, secondaryPoles: true } }, team: true, fundingLines: { include: { deliverables: true } } } }),
    listFunders(),
    prisma.convention.findMany({ include: { lines: { select: { id: true, amountGranted: true, amountRequested: true, editionId: true } } } }),
    prisma.edition.findMany({ select: { year: true }, distinct: ["year"], orderBy: { year: "asc" } }),
  ]);
  const scoped = perimeter === "pole" ? editions.filter((e) => inMyScope(me, e.project, e.team.map((t) => t.personId))) : editions;
  const m = buildMatrix(year, scoped, funders, conventions);
  const money = isCodir(me);
  const qs = (p: Record<string, string | number | undefined>) => { const q = Object.entries({ annee: year, perimetre: sp.perimetre, ...p }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${v}`).join("&"); return q ? `/matrice?${q}` : "/matrice"; };
  // Panneau d'une ligne, ouvert sur la matrice sans la quitter (?ligne=&champ=) : même contenu que dans l'onglet Budget.
  const panel = sp.ligne ? await (async () => {
    const line = await prisma.fundingLine.findUnique({ where: { id: sp.ligne }, select: { editionId: true } });
    const ed = line ? await loadEdition(line.editionId) : null;
    const i = ed ? ed.fundingLines.findIndex((f) => f.id === sp.ligne) : -1;
    if (!ed || i < 0) return null;
    return { e: ed, f: ed.fundingLines[i], i, isPilot: ed.project.pilotId === me.id };
  })() : null;
  const statusLabel = (code: string) => refLabel(refs, "edition_status", code);

  // Chaque cellule ouvre la ligne en panneau, ici même : on corrige, on ferme, on passe au chiffre suivant.
  const cellNode = (c: Cell | undefined, key: string) => {
    if (!c) return <td key={key} className="px-2 py-2 text-center text-muted-foreground/40">·</td>;
    // Vert = obtenu, ocre italique = demandé (dossier parti, pas tranché), ocre clair = à déposer : la couleur dit l'état, pas seulement la graisse.
    const tone = c.kind === "granted" ? "text-mint font-medium" : c.kind === "requested" ? "text-warning-foreground italic" : "text-warning-foreground/70";
    const glyph = c.kind === "granted" ? "●" : c.kind === "requested" ? "◐" : "○";
    return (
      <td key={key} className={cn("p-0 text-right tabular whitespace-nowrap", tone)} data-kind={c.kind}>
        <Link href={qs({ ligne: c.lineId, champ: c.kind === "granted" ? "amountGranted" : c.kind === "requested" ? "amountRequested" : "status" })} scroll={false} className="block px-2 py-2 hover:bg-muted/60 hover:underline" title={`${c.kind === "granted" ? "obtenu" : c.kind === "requested" ? "demandé, dossier non tranché" : "à déposer"}${c.conventionRef ? ` · convention ${c.conventionRef}` : ""}${c.late ? ` · ${c.late} livrable(s) en retard` : ""} — ouvrir la ligne ici`} data-testid={`cell-${c.lineId}`}>
        {money ? (c.kind === "to_submit" ? <span className="text-[11px]">à déposer{c.amount !== null && <span className="ml-1 tabular">{fmtEuro(c.amount)}</span>}</span> : c.amount !== null ? fmtEuro(c.amount) : "—") : <span className={cn("text-base", c.kind === "granted" ? "text-mint" : c.kind === "requested" ? "text-primary" : "text-warning-foreground")}>{glyph}</span>}
        {c.late > 0 && <span className="ml-1 text-[10px] font-semibold text-danger" title="livrable en retard">!</span>}
        </Link>
      </td>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <DossiersHeader
        current="matrice"
        summary=<>{year} · {m.rows.length} édition{m.rows.length > 1 ? "s" : ""} · {m.columns.length} financeur{m.columns.length > 1 ? "s" : ""}{money && <> · <b className="text-foreground">{fmtEuro(m.totals.granted)} obtenus</b> pour {fmtEuro(m.totals.envelope)} d&apos;enveloppes{m.totals.envelope > 0 && ` (${Math.round((m.totals.granted / m.totals.envelope) * 100) } %)`} · {fmtEuro(m.totals.requested)} demandés</>}. Chaque cellule ouvre sa ligne de financement en panneau, sans quitter le tableau ; le chiffre cliqué y est surligné.</>
        tools={<><YearPicker years={[...new Set([...years.map((y) => y.year), currentYear])].sort()} current={year} hrefFor={(y) => qs({ annee: y })} />{!isTransversal(me) && <PerimeterChips current={perimeter} poleName={me.pole?.name ?? null} hrefFor={(p) => qs({ perimetre: p })} />}<HelpTip title="Lire la matrice" testId="matrix-help"><p>Une ligne par édition de l&apos;année, une colonne par financeur présent. <b className="text-mint">Vert</b> = obtenu ; <i className="text-warning-foreground">ocre en italique</i> = demandé, dossier parti mais pas encore tranché ; « à déposer » = ligne créée, dossier pas encore envoyé (le montant est celui prévu). La couverture compare l&apos;obtenu à l&apos;enveloppe de dépenses directes — plus de 100 % est normal, la subvention finance aussi les jours vendus ; en ocre, l&apos;édition est sous-financée ; le pied de colonne donne ce que chaque financeur apporte sur l&apos;année. Sans droit sur les montants, seules les pastilles ● obtenu ◐ demandé ○ à déposer s&apos;affichent.</p></HelpTip></>}
        actions={<div className="flex flex-wrap items-center gap-2">{money && <Button asChild variant="outline" size="sm"><a href={withBase(`/matrice/export?annee=${year}${perimeter === "pole" ? "&perimetre=pole" : ""}`)} data-testid="matrix-export"><Download />CSV</a></Button>}</div>}
      />

      {m.rows.length === 0 ? <EmptyState title={`Aucune édition en ${year}`} hint="Changez d'année ou de périmètre." /> : (
        <div className="overflow-auto rounded-md border bg-card" tabIndex={0} aria-label={`Matrice ${year} : ${m.rows.length} éditions × ${m.columns.length} financeurs`}>
          <table className="w-full text-[13px]" data-testid="matrix" data-money={money ? "1" : "0"}>
            <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-[3] bg-[#f1f5f6] px-3 py-2.5">Édition</th>
                {money && <th className="px-2 py-2.5 text-right">Enveloppe</th>}
                <th className="px-2 py-2.5 text-right">{money ? "Obtenu" : "Financeurs"}</th>
                {money && <th className="border-r px-2 py-2.5 text-right">Couverture</th>}
                {m.columns.map((c) => <th key={c.funder.id} className="px-2 py-2.5 text-right whitespace-nowrap"><Link href={`/financeurs/${c.funder.id}`} className="hover:underline">{c.funder.name}</Link>{c.late > 0 && <span className="ml-1 text-danger" title={`${c.late} livrable(s) en retard`}>!</span>}</th>)}
              </tr>
            </thead>
            <tbody>
              {m.rows.map((r) => {
                const tone = coverageTone(r.coverage);
                return (
                  <tr key={r.edition.id} className={cn("border-t border-[#e3e9eb] hover:bg-[#f8f9f3]", r.orphan && "bg-warning-soft/30")} data-testid={`matrix-row-${r.edition.project.analyticCode}`} data-orphan={r.orphan ? "1" : "0"}>
                    <td className="sticky left-0 z-[1] bg-card px-3 py-2 whitespace-nowrap">
                      <Link href={`/edition/${r.edition.id}?onglet=budget#recettes`} className="font-medium text-primary hover:underline">{r.edition.project.name}</Link>
                      <div className="text-[10px] text-muted-foreground">{r.edition.project.pole.name} · {r.edition.project.pilot.name} · {statusLabel(r.edition.status)}{r.orphan && <span className="ml-1 font-semibold text-warning-foreground">sans financement</span>}{r.pending > 0 && !r.orphan && <span className="ml-1">· {r.pending} dossier{r.pending > 1 ? "s" : ""} à déposer ou en attente</span>}</div>
                    </td>
                    {money && <td className="px-2 py-2 text-right tabular text-muted-foreground whitespace-nowrap">{r.edition.budgetEnvelope ? fmtEuro(r.edition.budgetEnvelope) : "—"}</td>}
                    <td className="px-2 py-2 text-right tabular font-semibold whitespace-nowrap">{money ? fmtEuro(r.granted) : `${r.cells.size}`}{money && r.requested > r.granted && <div className="text-[10px] font-normal text-muted-foreground">{fmtEuro(r.requested)} demandés</div>}</td>
                    {money && <td className="border-r px-2 py-2 text-right tabular whitespace-nowrap"><span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold", tone === "mint" ? "bg-mint-soft text-mint" : tone === "warning" ? "bg-warning-soft text-warning-foreground" : "bg-muted text-muted-foreground")} data-testid={`coverage-${r.edition.project.analyticCode}`}>{r.coverage === null ? "—" : `${Math.round(r.coverage * 100)} %`}</span></td>}
                    {m.columns.map((c) => cellNode(r.cells.get(c.funder.id), c.funder.id))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 font-semibold">
              <tr>
                <td className="sticky left-0 z-[1] bg-card px-3 py-2">Total {year}</td>
                {money && <td className="px-2 py-2 text-right tabular">{fmtEuro(m.totals.envelope)}</td>}
                <td className="px-2 py-2 text-right tabular">{money ? fmtEuro(m.totals.granted) : ""}</td>
                {money && <td className="border-r px-2 py-2 text-right tabular">{m.totals.envelope > 0 ? `${Math.round((m.totals.granted / m.totals.envelope) * 100)} %` : "—"}</td>}
                {m.columns.map((c) => <td key={c.funder.id} className="px-2 py-2 text-right tabular whitespace-nowrap" data-testid={`column-total-${c.funder.name}`}>{money ? <>{fmtEuro(c.granted)}{c.requested > 0 && <div className="text-[10px] font-normal text-muted-foreground">+ {fmtEuro(c.requested)} demandés</div>}</> : `${c.editions} éd.`}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="matrix-attention">
        <Zone title="Sans financement" hint="Éditions de l'année sans aucune ligne de financement." count={m.attention.orphans.length}>
          {m.attention.orphans.map((e) => <li key={e.id}><Link href={`/edition/${e.id}?onglet=budget#recettes`} className="text-primary hover:underline">{e.project.name}</Link> <span className="text-muted-foreground">· {e.project.pole.name}</span></li>)}
        </Zone>
        <Zone title="Dossiers à déposer ou en attente" hint="Éditions en cours dont un financeur n'a pas encore tranché." count={m.attention.pending.length}>
          {m.attention.pending.map(({ edition, funders: fs }) => <li key={edition.id}><Link href={`/edition/${edition.id}?onglet=budget#recettes`} className="text-primary hover:underline">{edition.project.name}</Link> <span className="text-muted-foreground">· {fs.join(", ")}</span></li>)}
        </Zone>
        <Zone title="Conventions sous-affectées" hint="Notifié non encore affecté à une édition (reste à répartir)." count={m.attention.underAllocated.length}>
          {m.attention.underAllocated.map(({ convention, remaining }) => <li key={convention.id}><Link href={`/conventions/${convention.id}`} className="text-primary hover:underline">{convention.reference}</Link>{money && <span className="text-muted-foreground"> · reste {fmtEuro(remaining)}</span>}</li>)}
        </Zone>
        <Zone title="Livrables en retard" hint="Par financeur, sur les éditions de l'année." count={m.attention.lateByFunder.length}>
          {m.attention.lateByFunder.map(({ funder, count }) => <li key={funder.id}><Link href={`/financeurs/${funder.id}`} className="text-primary hover:underline">{funder.name}</Link> <span className="text-danger">· {count}</span></li>)}
        </Zone>
      </div>
      {panel && (
        <UrlPanel title={fundingPanelTitle(panel.e, panel.f)} description={<>{canEditFunding(me) ? FUNDING_PANEL_DESCRIPTION.rw : FUNDING_PANEL_DESCRIPTION.ro} · <Link href={`/edition/${panel.e.id}?onglet=budget#recettes`} className="text-primary hover:underline">ouvrir l&apos;édition</Link></>} closeHref={qs({})} testId="matrix-panel" wide>
          <FundingLinePanelBody e={panel.e} f={panel.f} i={panel.i} rw={canEditFunding(me)} isPilot={panel.isPilot} refs={refs} funders={funders} conventions={conventions} highlight={sp.champ ?? null} />
        </UrlPanel>
      )}
      <p className="mt-2.5 text-[10px] text-muted-foreground">Une ligne par édition, une colonne par financeur présent sur l&apos;année · {money ? "vert : obtenu · ocre italique : demandé, non tranché · à déposer : dossier pas encore envoyé" : "● obtenu ◐ demandé ○ à déposer"} · « ! » : livrable en retard chez ce financeur.</p>
    </div>
  );
}

function Zone({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4", count > 0 && "border-warning/40")}>
      <h2 className="text-[13px] font-bold">{title} <span className={cn("ml-1 rounded-full px-1.5 text-[10px]", count > 0 ? "bg-warning-soft text-warning-foreground" : "bg-muted text-muted-foreground")}>{count}</span></h2>
      <p className="mb-2 text-[11px] text-muted-foreground">{hint}</p>
      {count === 0 ? <p className="text-xs text-mint">Rien à signaler.</p> : <ul className="grid gap-1 text-xs">{children}</ul>}
    </section>
  );
}
