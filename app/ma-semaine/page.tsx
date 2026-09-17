import { SectionIcon } from "@/components/shell/section-icon";
import Link from "next/link";
import { Clock, Bell } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { AlertChips } from "@/components/common/alert-chips";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { loadAgenda } from "@/lib/agenda";
import { loadPortfolio } from "@/lib/queries";
import { canDecideValidation, canEditFunding } from "@/lib/rights";
import { byRelevance } from "@/lib/scope";
import { refColor, refLabel } from "@/lib/refs";
import { dayjs, fmtDate, fmtNumber, slotLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IcsCard } from "@/components/common/ics-card";
import { prisma } from "@/lib/db";
import { expectedHoursOn, loadRhythms, rhythmAt, weekDays } from "@/lib/time";
import { loadMyTasks } from "@/lib/tasks";
import { TaskList } from "@/components/tasks/task-list";
import { hasModule } from "@/lib/modules";
import { loadMyLists } from "@/lib/tasks";

// Ma semaine (EF-G2), recentrée sur la semaine : « En retard », « Cette semaine », puis mes validations et mes temps ;
// les échéances lointaines (jusqu'à l'horizon réglé dans l'admin) restent repliées.
type Item = { id: string; kind: "action" | "deliverable" | "milestone" | "task"; title: string; sub: string; href: string; date: Date; daysLeft: number; owner?: string | null };

export default async function MaSemainePage() {
  const [me, settings, refs] = await Promise.all([getCurrentPerson(), getSettings(), getRefs()]);
  const weekStart = dayjs().startOf("isoWeek");
  const weekEnd = weekStart.add(6, "day");
  const days = weekDays(weekStart, 5);
  const tasksOn = hasModule(me, "tasks");
  const [agenda, portfolio, unread, personFull, rhythms, weekEntries, tasks, openRemarks, lists] = await Promise.all([
    loadAgenda(settings.horizonDays),
    loadPortfolio(settings, { statuses: ["in_progress", "validated"] }),
    prisma.notification.findMany({ where: { personId: me.id, readAt: null }, include: { sender: true }, orderBy: { createdAt: "desc" } }),
    prisma.person.findUnique({ where: { id: me.id }, include: { rhythmPeriods: { include: { rhythm: true } } } }),
    loadRhythms(),
    prisma.timeEntry.findMany({ where: { personId: me.id, date: { gte: weekStart.toDate(), lt: weekStart.add(1, "week").toDate() } }, select: { hours: true, date: true } }),
    tasksOn ? loadMyTasks(me.id) : Promise.resolve([]),
    // Remarques ouvertes de la direction (ou du garant) sur les fiches que je pilote ou où je contribue.
    prisma.fieldRemark.findMany({ where: { resolvedAt: null, edition: { status: { not: "closed" }, OR: [{ project: { pilotId: me.id } }, { team: { some: { personId: me.id } } }] } }, include: { author: true, edition: { include: { project: true } } }, orderBy: { createdAt: "desc" } }),
    tasksOn ? loadMyLists(me.id) : Promise.resolve([]),
  ]);

  const myActions = agenda.milestones.filter((a) => a.ownerId === me.id);
  const myPilotMilestones = agenda.milestones.filter((a) => a.ownerId !== me.id && a.edition.project.pilotId === me.id);
  const myDeliverables = agenda.deliverables.filter((d) => d.fundingLine.edition.project.pilotId === me.id || canEditFunding(me));
  const toDecide = agenda.validations.filter((v) => canDecideValidation(me, v));
  const myRequests = agenda.validations.filter((v) => v.requesterId === me.id);
  const missing = agenda.missingTime.find((m) => m.person.id === me.id)?.missing ?? [];
  const myEditions = portfolio.filter((e) => e.project.pilotId === me.id || e.team.some((t) => t.personId === me.id));

  const expectedByDay = days.map((d) => { const r = personFull ? rhythmAt(personFull, d, rhythms) : null; return r ? expectedHoursOn(r, d) : null; });
  const expected = expectedByDay.some((x) => x !== null) ? expectedByDay.reduce<number>((s, x) => s + (x ?? 0), 0) : null;
  const weekTotal = weekEntries.reduce((s, t) => s + t.hours, 0);
  const missingThisWeek = days.filter((d, i) => !d.isAfter(dayjs(), "day") && (expectedByDay[i] ?? 0) > 0 && !weekEntries.some((t) => dayjs(t.date).isSame(d, "day")));

  // Une seule liste d'échéances, découpée en trois horizons.
  const items: Item[] = [
    ...myActions.map((a): Item => ({ id: `a-${a.id}`, kind: "action", title: a.name, sub: `${a.edition.project.name} · Édition ${a.edition.year} · ${refLabel(refs, "action_state", a.state)}`, href: `/edition/${a.editionId}?onglet=actions`, date: a.milestoneDate!, daysLeft: a.daysLeft })),
    ...myDeliverables.map((d): Item => ({ id: `d-${d.id}`, kind: "deliverable", title: d.label, sub: `${d.fundingLine.edition.project.name} · Livrable pour ${d.fundingLine.funder.name}`, href: `/edition/${d.fundingLine.editionId}?onglet=budget#recettes`, date: d.dueDate, daysLeft: d.daysLeft })),
    ...myPilotMilestones.map((a): Item => ({ id: `m-${a.id}`, kind: "milestone", title: a.name, sub: `${a.edition.project.name} · Jalon suivi par ${a.owner?.name ?? "personne"}`, href: `/edition/${a.editionId}?onglet=actions`, date: a.milestoneDate!, daysLeft: a.daysLeft, owner: a.owner?.name })),
    // Les tâches datées en retard rejoignent le retard ; les autres vivent dans « Mes tâches » (pas de doublon).
    ...tasks.filter((t) => !t.done && t.dueDate && dayjs(t.dueDate).isBefore(dayjs(), "day")).map((t): Item => ({ id: `t-${t.id}`, kind: "task", title: t.label, sub: t.edition ? `${t.edition.name} · ${t.edition.year}` : "tâche personnelle", href: "#mes-taches", date: dayjs(t.dueDate!).toDate(), daysLeft: dayjs(t.dueDate!).startOf("day").diff(dayjs().startOf("day"), "day") })),
  ].sort((a, b) => a.daysLeft - b.daysLeft);
  const late = items.filter((i) => i.daysLeft < 0);
  const thisWeek = items.filter((i) => i.daysLeft >= 0 && !dayjs(i.date).isAfter(weekEnd, "day"));
  const later = items.filter((i) => i.daysLeft >= 0 && dayjs(i.date).isAfter(weekEnd, "day"));

  // Aujourd'hui : échéances du jour, tâches du jour, créneaux posés, heures saisies face au rythme.
  const todayRhythm = personFull ? rhythmAt(personFull, dayjs(), rhythms) : null;
  const todayExpected = todayRhythm ? expectedHoursOn(todayRhythm, dayjs()) : null;
  const todayHours = weekEntries.filter((t) => dayjs(t.date).isSame(dayjs(), "day")).reduce((s, t) => s + t.hours, 0);
  const todayItems = items.filter((i) => i.daysLeft === 0);
  const todayTasks = tasks.filter((t) => !t.done && t.dueDate && dayjs(t.dueDate).isSame(dayjs(), "day"));
  const todaySlots = tasks.flatMap((t) => t.slots.filter((sl) => dayjs(sl.startAt).isSame(dayjs(), "day")).map((sl) => ({ sl, t }))).sort((a, b) => a.sl.startAt.localeCompare(b.sl.startAt));
  const openTasks = tasks.filter((t) => !t.done).length;
  const editionOpts = byRelevance(me, portfolio, (e) => ({ project: e.project, teamIds: e.team.map((t) => t.personId), ownerIds: e.actions.map((a) => a.ownerId ?? "") }), (a, b) => a.project.name.localeCompare(b.project.name, "fr") || a.year - b.year)
    .map((e) => ({ id: e.id, name: e.project.name, year: e.year, actions: e.actions.filter((a) => a.state !== "done").map((a) => ({ id: a.id, name: a.name })) }));

  const overdueValidation = toDecide.filter((v) => v.age > v.targetDelayDays).sort((a, b) => b.age - a.age)[0];
  const attention = late[0]
    ? { text: <><b>Un point d'attention :</b> {late[0].kind === "deliverable" ? "le livrable" : "le jalon"} « {late[0].title} » est dépassé de {-late[0].daysLeft} jour{-late[0].daysLeft > 1 ? "s" : ""}.</>, badge: late[0].kind === "deliverable" ? "À remettre" : "À reprendre", href: late[0].href }
    : overdueValidation
      ? { text: <><b>Un point d'attention :</b> la demande « {overdueValidation.label} » attend depuis {overdueValidation.age} jours (cible {overdueValidation.targetDelayDays} j).</>, badge: "À décider", href: "/demandes" }
      : null;
  const remarksByEdition = [...new Map(openRemarks.map((r) => [r.editionId, { edition: r.edition, items: openRemarks.filter((x) => x.editionId === r.editionId) }])).values()];
  const nothingToDo = late.length === 0 && thisWeek.length === 0 && toDecide.length === 0 && missingThisWeek.length === 0 && missing.length === 0 && openTasks === 0 && openRemarks.length === 0;

  const dayLabel = (n: number) => (n < 0 ? `${-n} j de retard` : n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} j`);
  const badgeColor = (n: number) => (n < 0 ? "danger" : n <= 7 ? "warning" : "muted");
  const firstName = me.name.split(/\s+/)[0];
  const kindLabel = { action: "Action", deliverable: "Livrable", milestone: "Jalon d'équipe", task: "Tâche" };

  const ItemRow = ({ it }: { it: Item }) => (
    <Row late={it.daysLeft < 0}>
      <DateBox date={it.date} />
      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-semibold"><Link href={it.href} className="hover:underline">{it.title}</Link></h4>
        <p className="mt-1 text-[10px] text-muted-foreground">{kindLabel[it.kind]} · {it.sub}</p>
      </div>
      <StatusBadge label={it.daysLeft < 0 ? `! ${dayLabel(it.daysLeft)}` : dayLabel(it.daysLeft)} color={badgeColor(it.daysLeft)} dot={false} />
    </Row>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-start gap-3">
          <SectionIcon />
          <div>
          <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px]">Bonjour {firstName}.</h1>
          <p className="mt-1 text-xs text-muted-foreground">Semaine du {weekStart.format("D")} au {days[4].format("D MMMM YYYY")} · ce qui vous attend, dans l'ordre.</p>
          </div>
        </div>
        <Button asChild><Link href="/temps"><Clock />Répartir mon temps</Link></Button>
      </div>

      {attention ? (
        <Link href={attention.href} className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-warning-soft px-3.5 py-[11px] text-xs text-[#77521a] hover:bg-[#f5e6c4]" data-testid="attention-bar">
          <span>{attention.text}</span>
          <StatusBadge label={attention.badge} color="warning" dot={false} />
        </Link>
      ) : nothingToDo ? (
        <div className="mb-4 rounded-md bg-mint-soft px-3.5 py-3 text-xs text-mint" data-testid="nothing-to-do"><b>✓ Rien à faire cette semaine.</b> Aucun retard, aucune échéance d'ici dimanche, aucune décision en attente, vos temps sont à jour.{later.length > 0 ? ` Les ${later.length} échéances suivantes sont repliées plus bas.` : ""}</div>
      ) : (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-mint-soft px-3.5 py-[11px] text-xs text-mint"><span><b>✓ Rien d'urgent.</b> Aucun retard, aucune décision en attente au-delà du délai.</span></div>
      )}

      {unread.length > 0 && (
        <div className="mb-4 rounded-md border bg-card px-4 py-3" data-testid="unread-notifications">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Bell className="size-4 text-primary" />{unread.length} notification{unread.length > 1 ? "s" : ""} à lire</div>
          <ul className="text-xs">
            {unread.map((n) => (
              <li key={n.id} className="py-0.5"><Link href={n.link ?? "#"} className="font-semibold text-primary hover:underline">{n.title}</Link>{n.body && <span className="text-muted-foreground"> — {n.body}</span>} <span className="text-muted-foreground" title={fmtDate(n.createdAt, "D MMM YYYY à HH:mm")}>· {dayjs(n.createdAt).fromNow()}</span></li>
            ))}
          </ul>
        </div>
      )}

      {remarksByEdition.length > 0 && (
        <div className="mb-4 rounded-md border border-l-4 border-l-warning bg-card px-4 py-3" data-testid="remarks-to-treat">
          <div className="mb-1 text-sm font-semibold">{openRemarks.length} remarque{openRemarks.length > 1 ? "s" : ""} à traiter sur {remarksByEdition.length > 1 ? "vos fiches" : "votre fiche"}</div>
          <ul className="grid gap-1 text-xs">
            {remarksByEdition.map(({ edition, items }) => (
              <li key={edition.id}><Link href={`/edition/${edition.id}?onglet=fiche`} className="font-semibold text-primary hover:underline">{edition.project.name} · {edition.year}</Link> <span className="text-muted-foreground">· {items.length} remarque{items.length > 1 ? "s" : ""} de {[...new Set(items.map((r) => r.author.name))].join(", ")} · « {items[0].body.slice(0, 90)}{items[0].body.length > 90 ? "…" : ""} »</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Aujourd'hui : la journée en un coup d'œil — ce qui est dû, ce que j'ai prévu de faire, mes heures. */}
      {(
        <div className="mb-4 rounded-md border bg-card px-4 py-3" data-testid="today">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[13px] font-bold">Aujourd'hui · {dayjs().format("dddd D MMMM")}</h4>
            <span className="text-[11px] text-muted-foreground"><b className="tabular text-foreground">{fmtNumber(todayHours, 1)} h</b> réparties{todayExpected ? ` sur ${fmtNumber(todayExpected, 1)} h attendues` : ""} · <Link href="/temps" className="text-primary hover:underline">répartir</Link></span>
          </div>
          {todayItems.length + todayTasks.length + todaySlots.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Rien de daté aujourd'hui. Posez un créneau sur une tâche pour organiser la journée.</p>
          ) : (
            <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
              {todaySlots.map(({ sl, t }) => <li key={sl.id} className="flex items-center gap-2"><span className="w-28 shrink-0 font-semibold tabular text-primary">{sl.allDay ? "Journée" : slotLabel(sl).split(" · ")[1]}</span><span className="truncate">{t.label}</span></li>)}
              {todayTasks.filter((t) => !todaySlots.some((x) => x.t.id === t.id)).map((t) => <li key={t.id} className="flex items-center gap-2"><span className="w-28 shrink-0 text-muted-foreground">Tâche due</span><span className="truncate">{t.label}</span></li>)}
              {todayItems.map((it) => <li key={it.id} className="flex items-center gap-2"><span className="w-28 shrink-0 text-muted-foreground">{kindLabel[it.kind]} due</span><Link href={it.href} className="truncate hover:underline">{it.title}</Link></li>)}
            </ul>
          )}
        </div>
      )}

      {/* Sur mobile, une seule colonne dans l'ordre : retard, semaine, tâches, validations, temps, plus tard. Sur grand écran, deux colonnes. */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="contents lg:grid lg:content-start lg:gap-4">
          <Panel title="En retard" aside={late.length ? <StatusBadge label={`${late.length} à reprendre`} color="danger" dot={false} /> : <span className="text-[11px] text-muted-foreground">Aucun retard</span>} testId="late" className="order-1">
            {late.length === 0 ? <Note>✓ Rien de dépassé.</Note> : late.map((it) => <ItemRow key={it.id} it={it} />)}
          </Panel>
          <Panel title="Cette semaine" aside={<span className="text-[11px] text-muted-foreground">Jusqu'au {weekEnd.format("D MMMM")}</span>} testId="this-week" className="order-2">
            {thisWeek.length === 0 ? <Note>✓ Aucune échéance d'ici dimanche.</Note> : thisWeek.map((it) => <ItemRow key={it.id} it={it} />)}
          </Panel>
          {tasksOn && (
            <Panel title="Mes tâches" aside={<span className="text-[11px] text-muted-foreground">{openTasks ? `${openTasks} en cours` : "Rien en cours"} · <Link href="/taches" className="text-primary hover:underline">{lists.length ? `${lists.length} liste${lists.length > 1 ? "s" : ""} →` : "mes listes →"}</Link></span>} testId="my-tasks" className="order-3 scroll-mt-4" id="mes-taches">
              <TaskList tasks={tasks} editions={editionOpts} lists={lists.map((l) => ({ id: l.id, name: l.name, color: l.color }))} showList />
            </Panel>
          )}
          <details className="group order-6 overflow-hidden rounded-md border bg-card" data-testid="later">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5">
              <h4 className="text-[13px] font-bold">Plus tard</h4>
              <span className="text-[11px] text-primary"><span className="group-open:hidden">Voir les échéances à {settings.horizonDays} jours ({later.length})</span><span className="hidden group-open:inline">Replier</span></span>
            </summary>
            {later.length === 0 ? <Note>Rien d'autre dans les {settings.horizonDays} jours.</Note> : later.map((it) => <ItemRow key={it.id} it={it} />)}
          </details>
        </div>

        <div className="contents lg:grid lg:content-start lg:gap-4">
          <Panel title="Mes validations" aside={toDecide.length ? <StatusBadge label={`${toDecide.length} à traiter`} color="warning" dot={false} /> : <span className="text-[11px] text-muted-foreground">Rien à décider</span>} testId="my-validations" className="order-4">
            {toDecide.length + myRequests.length === 0 ? <Note>Aucune demande en attente.</Note> : (
              <>
                {toDecide.map((v) => (
                  <Row key={v.id}>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold"><Link href="/demandes" className="hover:underline">{v.label}</Link>{v.amount ? ` · ${fmtNumber(v.amount, 0)} €` : ""}</h4>
                      <p className="mt-1 text-[10px] text-muted-foreground">{v.edition.project.name} · Demandé par {v.requester.name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground"><span className={cn(v.age > v.targetDelayDays ? "text-danger" : v.age > 0 ? "text-warning-foreground" : "")}>Depuis {v.age} jour{v.age > 1 ? "s" : ""}</span> · Délai cible : {v.targetDelayDays} jours</p>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link href="/demandes">Décider</Link></Button>
                  </Row>
                ))}
                {myRequests.map((v) => (
                  <Row key={v.id}>
                    <div className="min-w-0 flex-1 text-muted-foreground">
                      <h4 className="text-xs font-semibold">{v.label}</h4>
                      <p className="mt-1 text-[10px]">Ma demande · en attente depuis {v.age} j</p>
                    </div>
                  </Row>
                ))}
              </>
            )}
          </Panel>

          <div className="order-5 rounded-md border border-[#d5ddcc] bg-[#eff2e9] p-5" data-testid="my-time">
            <div className="flex items-center justify-between"><h4 className="text-[15px] font-bold">Mon temps à répartir</h4><span aria-hidden>◷</span></div>
            <p className="mt-2 mb-4 text-xs text-muted-foreground">
              {missingThisWeek.length > 0 ? <>{missingThisWeek.map((d) => d.format("dddd")).join(", ").replace(/^./, (c) => c.toUpperCase())} reste{missingThisWeek.length > 1 ? "nt" : ""} à compléter.<br /></> : weekTotal > 0 ? <>La semaine est répartie jusqu'ici.<br /></> : null}
              <b className="tabular text-foreground">{fmtNumber(weekTotal, 1)} h{expected !== null ? ` sur ${fmtNumber(expected, 1)} h attendues` : ""}</b> cette semaine.
            </p>
            {expected !== null && <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#e8e9e1]"><i className="block h-full rounded-[3px] bg-mint" style={{ width: `${Math.min(100, (weekTotal / expected) * 100)}%` }} /></div>}
            {missing.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5" data-testid="missing-days">
                <span className="w-full text-[10px] text-muted-foreground">Jours des deux dernières semaines sans répartition :</span>
                {missing.map((d) => (
                  <Link key={d} href={`/temps?semaine=${dayjs(d).isoWeekYear()}-W${String(dayjs(d).isoWeek()).padStart(2, "0")}`} className="rounded-sm bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-foreground hover:bg-warning/30">{dayjs(d).format("ddd D MMM")}</Link>
                ))}
              </div>
            )}
            <Button asChild className="mt-4"><Link href="/temps">Compléter ma semaine →</Link></Button>
          </div>
        </div>
      </div>

      <Section title="Mes éditions" description="Les éditions où je pilote ou contribue, avec leurs alertes." className="mt-5">
        {myEditions.length === 0 ? <Note>Aucune édition en cours pour moi.</Note> : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {myEditions.map((e) => (
              <li key={e.id} className="rounded-md border p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/edition/${e.id}`} className="font-semibold text-primary hover:underline">{e.project.name} · {e.year}</Link>
                  <StatusBadge label={refLabel(refs, "edition_status", e.status)} color={refColor(refs, "edition_status", e.status)} />
                </div>
                <div className="mb-2 text-[10px] text-muted-foreground">{e.project.pilotId === me.id ? "je pilote" : "je contribue"} · {e.project.pole.name}</div>
                <AlertChips alerts={e.alerts} max={2} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="mt-4"><IcsCard kind="me" personId={me.id} /></div>
    </div>
  );
}

function Panel({ title, aside, children, testId, className, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; testId?: string; className?: string; id?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-md border bg-card", className)} data-testid={testId} id={id}>
      <div className="flex items-center justify-between border-b px-4 py-3.5"><h4 className="text-[13px] font-bold">{title}</h4>{aside}</div>
      {children}
    </div>
  );
}

function Row({ children, late }: { children: React.ReactNode; late?: boolean }) {
  return <div className={cn("flex items-start gap-3 border-b border-[#e5e7de] px-4 py-4 last:border-b-0", late && "bg-[#fff8f0]")}>{children}</div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#f3f5ee] px-4 py-3.5 text-[11px] text-muted-foreground">{children}</div>;
}

function DateBox({ date }: { date: Date }) {
  return (
    <div className="w-9 shrink-0 text-center">
      <small className="block text-[9px] text-muted-foreground uppercase">{fmtDate(date, "MMM")}</small>
      <b className="block text-[21px] leading-tight">{fmtDate(date, "D")}</b>
    </div>
  );
}
