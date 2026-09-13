import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getPeople, getSettings } from "@/lib/session";
import { canSeeTimeOf } from "@/lib/rights";
import { dayjs, fmtNumber, monthKey } from "@/lib/format";
import { expectedHoursOn, loadRhythms, parseWeek, rhythmAt, weekDays, weekKey } from "@/lib/time";
import { TimeGrid, type GridRow } from "./grid";
import { PersonSelect } from "./person-select";
import { TimeNav } from "@/components/common/time-nav";
import { canLockMonths } from "@/lib/rights";

export default async function TempsPage({ searchParams }: { searchParams: Promise<{ semaine?: string; personne?: string; equipe?: string }> }) {
  const sp = await searchParams;
  const [me, settings, people] = await Promise.all([getCurrentPerson(), getSettings(), getPeople()]);
  const visibleAll = people.filter((p) => canSeeTimeOf(me, p, settings.timeVisibility));
  const teamMode = Boolean(sp.equipe) || (Boolean(sp.personne) && sp.personne !== me.id);
  const firstOther = visibleAll.find((p) => p.id !== me.id);
  const target = (sp.personne && people.find((p) => p.id === sp.personne)) || (sp.equipe && firstOther) || me;
  const canSee = canSeeTimeOf(me, target, settings.timeVisibility);
  const person = canSee ? target : me;
  const readOnly = person.id !== me.id;

  const start = parseWeek(sp.semaine);
  const days = weekDays(start, 5);
  const end = start.add(1, "week");
  const year = start.year();

  const [rhythms, personFull, declaration] = await Promise.all([
    loadRhythms(),
    prisma.person.findUnique({ where: { id: person.id }, include: { rhythmPeriods: { include: { rhythm: true } } } }),
    prisma.weekDeclaration.findUnique({ where: { personId_week: { personId: person.id, week: weekKey(start) } } }),
  ]);
  const expectedByDay = days.map((d) => { const r = personFull ? rhythmAt(personFull, d, rhythms) : null; return r ? expectedHoursOn(r, d) : null; });
  const rhythmLabel = personFull ? rhythmAt(personFull, start, rhythms)?.label ?? "Référence hebdomadaire non configurée" : "";
  const [editions, entries, locks, personCodes, prevWeekCount] = await Promise.all([
    prisma.edition.findMany({
      where: { year, status: { in: ["in_progress", "validated"] }, team: { some: { personId: person.id } } },
      include: { project: true, actions: { orderBy: { order: "asc" }, include: { timeEntries: { select: { hours: true } } } } },
      orderBy: { project: { name: "asc" } },
    }),
    prisma.timeEntry.findMany({ where: { personId: person.id, date: { gte: start.toDate(), lt: end.toDate() } }, include: { project: true, action: true, timeCode: true } }),
    prisma.monthLock.findMany({ where: { personId: person.id } }),
    prisma.personTimeCode.findMany({ where: { personId: person.id }, include: { timeCode: true }, orderBy: { timeCode: { order: "asc" } } }),
    prisma.timeEntry.count({ where: { personId: person.id, date: { gte: start.subtract(1, "week").toDate(), lt: start.toDate() } } }),
  ]);

  // Lignes de la grille : projets de la personne, ses actions, ses codes hors projet, plus toute ligne déjà saisie cette semaine.
  const rows: GridRow[] = [];
  const key = (r: { projectId?: string | null; actionId?: string | null; timeCodeId?: string | null }) => `${r.projectId ?? ""}|${r.actionId ?? ""}|${r.timeCodeId ?? ""}`;
  const seen = new Set<string>();
  const push = (r: GridRow) => { if (!seen.has(key(r))) { seen.add(key(r)); rows.push(r); } };
  const weekEntryActionIds = new Set(entries.map((t) => t.actionId).filter(Boolean));
  for (const e of editions) {
    push({ label: e.project.name, sub: `${e.project.analyticCode} · ${e.year}`, projectId: e.projectId, actionId: null, timeCodeId: null, kind: "project" });
    // Mes actions, plus celles du projet où j'ai déjà saisi cette semaine.
    const actions = e.actions.filter((a) => (a.ownerId === person.id && a.state !== "done") || weekEntryActionIds.has(a.id));
    for (const a of actions) {
      const consumed = a.timeEntries.reduce((s, t) => s + t.hours, 0);
      push({ label: a.name, sub: a.timeTarget ? `objectif ${a.timeTarget} h · consommé ${fmtNumber(consumed, 0)} h` : "sans objectif de temps", projectId: e.projectId, actionId: a.id, timeCodeId: null, kind: "action" });
    }
  }
  for (const c of personCodes) push({ label: c.timeCode.label, sub: c.timeCode.code, projectId: null, actionId: null, timeCodeId: c.timeCodeId, kind: "code" });
  for (const t of entries) {
    push({ label: t.action?.name ?? t.project?.name ?? t.timeCode?.label ?? "?", sub: t.action ? t.project?.name ?? "" : t.project ? t.project.analyticCode : t.timeCode?.code ?? "", projectId: t.projectId, actionId: t.actionId, timeCodeId: t.timeCodeId, kind: t.actionId ? "action" : t.projectId ? "project" : "code" });
  }

  const lockedMonths = new Set(locks.map((l) => l.month));
  const weekLocked = days.every((d) => lockedMonths.has(monthKey(d.toDate())));
  const expected = expectedByDay.some((x) => x !== null) ? expectedByDay.reduce<number>((s, x) => s + (x ?? 0), 0) : null;
  const total = entries.reduce((s, t) => s + t.hours, 0);
  const prevKey = weekKey(start.subtract(1, "week"));
  const nextKey = weekKey(start.add(1, "week"));
  const qs = (w: string) => `/temps?semaine=${w}${readOnly ? `&personne=${person.id}` : ""}`;
  void teamMode;
  const visible = visibleAll;

  return (
    <div className="p-4 md:p-6">
      <TimeNav current={readOnly ? "team" : "me"} showTeam={visible.length > 1} showCloture={canLockMonths(me.role)} teamHref={firstOther ? `/temps?personne=${firstOther.id}&semaine=${weekKey(start)}` : undefined} />
      {/* En-tête compact : titre, puis la navigation de semaine sur une seule ligne (cibles de 44 px sur mobile), le rythme en retrait. */}
      <PageHeader
        title={readOnly ? `Temps de ${person.name}` : "Mes temps"}
        subtitle={<span>Semaine {start.isoWeek()} · du {start.format("D")} au {days[4].format("D MMMM YYYY")}<span className="hidden md:inline"> · {readOnly ? "lecture seule, selon la visibilité réglée dans l'admin" : "codes utiles à votre poste"} · rythme : {rhythmLabel}</span></span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {readOnly && visible.length > 1 && <PersonSelect people={visible.filter((p) => p.id !== me.id).map((p) => ({ id: p.id, name: p.name }))} current={person.id} week={weekKey(start)} />}
            <nav className="flex items-center gap-1" aria-label="Changer de semaine">
              <Button asChild variant="outline" className="size-11 md:size-8" size="icon" aria-label="Semaine précédente"><Link href={qs(prevKey)}><ChevronLeft /></Link></Button>
              <Button asChild variant="outline" className="h-11 px-4 md:h-7 md:px-2.5" size="sm"><Link href={qs(weekKey(dayjs()))}>Cette semaine</Link></Button>
              <Button asChild variant="outline" className="size-11 md:size-8" size="icon" aria-label="Semaine suivante"><Link href={qs(nextKey)}><ChevronRight /></Link></Button>
            </nav>
            <span className="hidden md:inline">{weekLocked ? <StatusBadge label={`${start.format("MMMM")} verrouillé par la RAF`} color="muted" dot={false} /> : <StatusBadge label={`${start.format("MMMM").replace(/^./, (c) => c.toUpperCase())} ouvert à la saisie`} color="mint" />}</span>
          </div>
        }
      />

      {weekLocked && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md bg-muted px-3 py-3 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5" /><span><b>{start.format("MMMM YYYY").replace(/^./, (c) => c.toUpperCase())} verrouillé par la RAF.</b><br />Pour corriger une valeur, contactez la RAF.</span></div>
      )}

      <TimeGrid
        personId={person.id}
        weekStart={start.format("YYYY-MM-DD")}
        days={days.map((d) => d.format("YYYY-MM-DD"))}
        rows={rows}
        entries={entries.map((t) => ({ date: dayjs(t.date).format("YYYY-MM-DD"), projectId: t.projectId, actionId: t.actionId, timeCodeId: t.timeCodeId, hours: t.hours, comment: t.comment }))}
        lockedMonths={[...lockedMonths]}
        expectedByDay={expectedByDay}
        weekKey={weekKey(start)}
        declaredAt={declaration ? dayjs(declaration.declaredAt).format("D MMM à HH:mm") : null}
        readOnly={readOnly}
        canCopyPrevious={!readOnly && prevWeekCount > 0 && entries.length === 0 && !weekLocked}
      />

      {/* Les règles détaillées restent accessibles, mais repliées : elles ne prennent plus la place des saisies. */}
      <details className="group mt-5 rounded-2xl border bg-card p-4 md:p-5" data-testid="time-help">
        <summary className="cursor-pointer list-none text-[15px] font-bold">Aide et règles de saisie <span className="text-xs font-normal text-muted-foreground">· fixées par la direction, pour que tout le monde saisisse pareil · <span className="text-primary group-open:hidden">afficher</span><span className="text-primary hidden group-open:inline">replier</span></span></summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_360px]">
          <p className="whitespace-pre-line text-xs">{settings.timeRules || "Aucune règle renseignée dans l'admin."}</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>Total de la semaine : <strong className="text-foreground tabular">{fmtNumber(total, 1)} h</strong>{expected !== null ? ` pour ${fmtNumber(expected, 2)} h attendues` : ""} (semaine {start.isoWeek() % 2 === 0 ? "paire" : "impaire"}). Informatif seulement : aucun solde, aucune récupération.</li>
            <li>Pas de sous-catégorie obligatoire. L'objectif du projet reste une aide à la saisie ; il ne devient pas un objectif d'heures personnel.</li>
            <li>Une fois le mois verrouillé par la RAF, les saisies passent en lecture seule.</li>
            <li>Rythme de {readOnly ? "la personne" : "votre poste"} : {rhythmLabel}.</li>
          </ul>
        </div>
      </details>
    </div>
  );
}
