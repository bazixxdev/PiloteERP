import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/common/section";
import { AlertChips } from "@/components/common/alert-chips";
import { StatusBadge } from "@/components/common/status-badge";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { isTransversal } from "@/lib/scope";
import { loadPortfolio } from "@/lib/queries";
import { refColor, refLabel } from "@/lib/refs";
import { dayjs, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnnuelFilters } from "./filters";
import { V, cap, du, de, aucun, pl } from "@/lib/vocab";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const STATE_DOT: Record<string, string> = { done: "bg-mint", doing: "bg-primary", todo: "bg-muted-foreground/40" };

// Vue annuelle par personne (EF-G3, EF-B3) et vue par pôle (EF-G6).
export default async function AnnuelPage({ searchParams }: { searchParams: Promise<{ annee?: string; pole?: string }> }) {
  const raw = await searchParams;
  const me = await getCurrentPerson();
  // Par défaut, une personne de pôle voit son pôle ; « pole=tous » élargit.
  const sp = { ...raw, pole: raw.pole === "tous" ? "" : raw.pole ?? (isTransversal(me) ? "" : me.poleId ?? "") };
  const year = Number(sp.annee) || dayjs().year();
  const [refs, settings, poles] = await Promise.all([getRefs(), getSettings(), prisma.pole.findMany({ orderBy: { name: "asc" } })]);
  const people = await prisma.person.findMany({
    where: { active: true, ...(sp.pole ? { poleId: sp.pole } : {}) },
    include: { pole: true, teams: { include: { edition: { include: { project: true } } } }, personDays: { include: { edition: true } }, actions: { include: { edition: { include: { project: true } } } } },
    orderBy: [{ pole: { name: "asc" } }, { order: "asc" }],
  });
  const editions = await loadPortfolio(settings, { year, statuses: ["in_progress", "validated", "proposed", "rechallenged"] });
  // Moi d'abord, puis mon pôle, puis les autres.
  people.sort((a, b) => Number(b.id === me.id) - Number(a.id === me.id) || (me.poleId ? Number(b.poleId === me.poleId) - Number(a.poleId === me.poleId) : 0) || (a.pole?.name ?? "").localeCompare(b.pole?.name ?? "") || a.order - b.order);
  const poleEditions = sp.pole ? editions.filter((e) => e.project.poleId === sp.pole) : [];

  return (
    <div className="p-4 md:p-6">
      <PageHeader title={sp.pole ? `Vue annuelle · ${poles.find((p) => p.id === sp.pole)?.name ?? ""}` : "Vue annuelle"} subtitle={`${year} · missions et ${pl(V.edition)} de l'année par mois, jours vendus dans les conventions face aux jours disponibles.`} actions={<Button asChild variant="outline" size="sm"><Link href={`/matrice?annee=${year}`} data-testid="to-matrix"><Grid3x3 />Qui finance quoi</Link></Button>} />
      <AnnuelFilters year={year} poles={poles.map((p) => ({ value: p.id, label: p.name }))} pole={sp.pole ?? ""} allValue={isTransversal(me) ? "" : "tous"} />

      {sp.pole && (
        <Section title={`${cap(pl(V.edition))} ${du(V.pole)}`} description={`Pour la réunion ${de(V.pole)} : statut et alertes de chaque ${V.edition.one}.`} className="mb-4">
          {poleEditions.length === 0 ? <p className="text-sm text-muted-foreground">{`${cap(aucun(V.edition))} cette année.`}</p> : (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {poleEditions.map((e) => (
                <li key={e.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/edition/${e.id}`} className="font-medium text-primary hover:underline">{e.project.name}</Link>
                    <StatusBadge label={refLabel(refs, "edition_status", e.status)} color={refColor(refs, "edition_status", e.status)} />
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">{`${V.pilote.one} `}{e.project.pilot.name}</div>
                  <AlertChips alerts={e.alerts} max={2} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Douze mois à 67 px tronquaient chaque jalon à quatre lettres (« CA d… ») : colonnes plus larges, libellé sur deux
          lignes, et la colonne Personne reste collée pendant le défilement horizontal (critique du 16/09). */}
      <div className="scroll-shadow-x overflow-x-auto rounded-2xl border" tabIndex={0} aria-label="Tableau personnes × mois, défilement horizontal">
        <table className="w-full table-fixed text-xs" style={{ minWidth: 1400 }} data-testid="annual-table">
          <colgroup><col style={{ width: 170 }} />{MONTHS.map((m) => <col key={m} />)}<col style={{ width: 120 }} /></colgroup>
          <thead className="bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-2">Personne</th>
              {MONTHS.map((m, i) => <th key={m} className={cn("px-1.5 py-2 text-center", dayjs().year() === year && dayjs().month() === i && "text-primary")}>{m}</th>)}
              <th className="px-3 py-2 text-right">Jours prévus / dispo.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {people.map((p) => {
              const myEditions = p.teams.map((t) => t.edition).filter((e) => e.year === year);
              const sold = p.personDays.filter((d) => d.edition.year === year && d.edition.status !== "closed").reduce((s, d) => s + d.plannedDays, 0);
              const over = sold > p.availableDays;
              const actions = p.actions.filter((a) => a.milestoneDate && dayjs(a.milestoneDate).year() === year);
              return (
                <tr key={p.id} className="align-top hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-muted-foreground">{p.pole?.name ?? "transversal"} · {myEditions.length}{` ${V.edition.one}`}{myEditions.length > 1 ? "s" : ""}</div>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {myEditions.slice(0, 4).map((e) => <Link key={e.id} href={`/edition/${e.id}`} className="rounded bg-secondary px-1 text-[10px] text-primary hover:underline" title={e.project.name}>{e.project.analyticCode}</Link>)}
                      {myEditions.length > 4 && <span className="text-[10px] text-muted-foreground">+{myEditions.length - 4}</span>}
                    </div>
                  </td>
                  {MONTHS.map((_, mi) => {
                    const cell = actions.filter((a) => dayjs(a.milestoneDate).month() === mi);
                    return (
                      <td key={mi} className="overflow-hidden px-1 py-1.5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          {cell.slice(0, 3).map((a) => (
                            <Link key={a.id} href={`/edition/${a.editionId}?onglet=${pl(V.action)}`} className="flex min-w-0 items-start gap-1 rounded px-1 hover:bg-muted" title={`${a.name} · ${a.edition.project.name} · ${dayjs(a.milestoneDate).format("D MMM")}`}>
                              <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", a.state !== "done" && dayjs(a.milestoneDate).isBefore(dayjs(), "day") ? "bg-danger" : STATE_DOT[a.state])} />
                              <span className="line-clamp-2 min-w-0 break-words leading-tight">{a.name}</span>
                            </Link>
                          ))}
                          {cell.length > 3 && <span className="px-1 text-[10px] text-muted-foreground">+{cell.length - 3}</span>}
                        </div>
                      </td>
                    );
                  })}
                  <td className={cn("px-3 py-2 text-right text-sm tabular", over ? "font-semibold text-danger" : "text-foreground")} data-testid={`load-${p.id}`}>
                    {fmtNumber(sold, 0)} / {p.availableDays} j
                    {over && <div className="text-[10px] font-normal">dépassement {fmtNumber(sold - p.availableDays, 0)} j</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{`Chaque pastille est un jalon d'${V.action.one} dont la personne est responsable ; les jours prévus (charge) se règlent sur chaque ${V.edition.one}, onglet Temps, ou au séminaire.`}</p>
    </div>
  );
}
