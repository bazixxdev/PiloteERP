import Link from "next/link";
import { Clock, Bell } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { AlertChips } from "@/components/common/alert-chips";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { loadAgenda } from "@/lib/agenda";
import { loadPortfolio } from "@/lib/queries";
import { canDecideValidation } from "@/lib/rights";
import { refColor, refLabel } from "@/lib/refs";
import { dayjs, fmtDate, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IcsCard } from "@/components/common/ics-card";
import { prisma } from "@/lib/db";
import { expectedHoursOn, loadRhythms, rhythmAt, weekDays } from "@/lib/time";

// Ma semaine (EF-G2), recentrée sur la semaine : « En retard », « Cette semaine », puis mes validations et mes temps ;
// les échéances lointaines (jusqu'à l'horizon réglé dans l'admin) restent repliées.
type Item = { id: string; kind: "action" | "deliverable" | "milestone"; title: string; sub: string; href: string; date: Date; daysLeft: number; owner?: string | null };

export default async function MaSemainePage() {
  const [me, settings, refs] = await Promise.all([getCurrentPerson(), getSettings(), getRefs()]);
  const weekStart = dayjs().startOf("isoWeek");
  const weekEnd = weekStart.add(6, "day");
  const days = weekDays(weekStart, 5);
  const [agenda, portfolio, unread, personFull, rhythms, weekEntries] = await Promise.all([
    loadAgenda(settings.horizonDays),
    loadPortfolio(settings, { statuses: ["in_progress", "validated"] }),
    prisma.notification.findMany({ where: { personId: me.id, readAt: null }, include: { sender: true }, orderBy: { createdAt: "desc" } }),
    prisma.person.findUnique({ where: { id: me.id }, include: { rhythmPeriods: { include: { rhythm: true } } } }),
    loadRhythms(),
    prisma.timeEntry.findMany({ where: { personId: me.id, date: { gte: weekStart.toDate(), lt: weekStart.add(1, "week").toDate() } }, select: { hours: true, date: true } }),
  ]);

  const myActions = agenda.milestones.filter((a) => a.ownerId === me.id);
  const myPilotMilestones = agenda.milestones.filter((a) => a.ownerId !== me.id && a.edition.project.pilotId === me.id);
  const myDeliverables = agenda.deliverables.filter((d) => d.fundingLine.edition.project.pilotId === me.id || me.role === "raf");
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
    ...myDeliverables.map((d): Item => ({ id: `d-${d.id}`, kind: "deliverable", title: d.label, sub: `${d.fundingLine.edition.project.name} · Livrable pour ${d.fundingLine.funder.name}`, href: `/edition/${d.fundingLine.editionId}?onglet=financements`, date: d.dueDate, daysLeft: d.daysLeft })),
    ...myPilotMilestones.map((a): Item => ({ id: `m-${a.id}`, kind: "milestone", title: a.name, sub: `${a.edition.project.name} · Jalon suivi par ${a.owner?.name ?? "personne"}`, href: `/edition/${a.editionId}?onglet=actions`, date: a.milestoneDate!, daysLeft: a.daysLeft, owner: a.owner?.name })),
  ].sort((a, b) => a.daysLeft - b.daysLeft);
  const late = items.filter((i) => i.daysLeft < 0);
  const thisWeek = items.filter((i) => i.daysLeft >= 0 && !dayjs(i.date).isAfter(weekEnd, "day"));
  const later = items.filter((i) => i.daysLeft >= 0 && dayjs(i.date).isAfter(weekEnd, "day"));

  const overdueValidation = toDecide.filter((v) => v.age > v.targetDelayDays).sort((a, b) => b.age - a.age)[0];
  const attention = late[0]
    ? { text: <><b>Un point d'attention :</b> {late[0].kind === "deliverable" ? "le livrable" : "le jalon"} « {late[0].title} » est dépassé de {-late[0].daysLeft} jour{-late[0].daysLeft > 1 ? "s" : ""}.</>, badge: late[0].kind === "deliverable" ? "À remettre" : "À reprendre", href: late[0].href }
    : overdueValidation
      ? { text: <><b>Un point d'attention :</b> la demande « {overdueValidation.label} » attend depuis {overdueValidation.age} jours (cible {overdueValidation.targetDelayDays} j).</>, badge: "À décider", href: "/validations" }
      : null;
  const nothingToDo = late.length === 0 && thisWeek.length === 0 && toDecide.length === 0 && missingThisWeek.length === 0 && missing.length === 0;

  const dayLabel = (n: number) => (n < 0 ? `${-n} j de retard` : n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} j`);
  const badgeColor = (n: number) => (n < 0 ? "danger" : n <= 7 ? "warning" : "muted");
  const firstName = me.name.split(/\s+/)[0];
  const kindLabel = { action: "Action", deliverable: "Livrable", milestone: "Jalon d'équipe" };

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
        <div>
          <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px]">Bonjour {firstName}.</h1>
          <p className="mt-1 text-xs text-muted-foreground">Semaine du {weekStart.format("D")} au {days[4].format("D MMMM YYYY")} · ce qui vous attend, dans l'ordre.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline"><Link href="/cafe">Écran café</Link></Button>
          <Button asChild><Link href="/temps"><Clock />Saisir mes temps</Link></Button>
        </div>
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
              <li key={n.id} className="py-0.5"><Link href={n.link ?? "#"} className="font-semibold text-primary hover:underline">{n.title}</Link>{n.body && <span className="text-muted-foreground"> — {n.body}</span>} <span className="text-muted-foreground">· {fmtDate(n.createdAt, "D MMM à HH:mm")}{n.sender ? ` · ${n.sender.name}` : ""}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Sur mobile, une seule colonne dans l'ordre : retard, semaine, validations, temps, plus tard. Sur grand écran, deux colonnes. */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="contents lg:grid lg:content-start lg:gap-4">
          <Panel title="En retard" aside={late.length ? <StatusBadge label={`${late.length} à reprendre`} color="danger" dot={false} /> : <span className="text-[11px] text-muted-foreground">Aucun retard</span>} testId="late" className="order-1">
            {late.length === 0 ? <Note>✓ Rien de dépassé.</Note> : late.map((it) => <ItemRow key={it.id} it={it} />)}
          </Panel>
          <Panel title="Cette semaine" aside={<span className="text-[11px] text-muted-foreground">Jusqu'au {weekEnd.format("D MMMM")}</span>} testId="this-week" className="order-2">
            {thisWeek.length === 0 ? <Note>✓ Aucune échéance d'ici dimanche.</Note> : thisWeek.map((it) => <ItemRow key={it.id} it={it} />)}
          </Panel>
          <details className="group order-5 overflow-hidden rounded-md border bg-card" data-testid="later">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5">
              <h4 className="text-[13px] font-bold">Plus tard</h4>
              <span className="text-[11px] text-primary"><span className="group-open:hidden">Voir les échéances à {settings.horizonDays} jours ({later.length})</span><span className="hidden group-open:inline">Replier</span></span>
            </summary>
            {later.length === 0 ? <Note>Rien d'autre dans les {settings.horizonDays} jours.</Note> : later.map((it) => <ItemRow key={it.id} it={it} />)}
          </details>
        </div>

        <div className="contents lg:grid lg:content-start lg:gap-4">
          <Panel title="Mes validations" aside={toDecide.length ? <StatusBadge label={`${toDecide.length} à traiter`} color="warning" dot={false} /> : <span className="text-[11px] text-muted-foreground">Rien à décider</span>} testId="my-validations" className="order-3">
            {toDecide.length + myRequests.length === 0 ? <Note>Aucune demande en attente.</Note> : (
              <>
                {toDecide.map((v) => (
                  <Row key={v.id}>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold"><Link href="/validations" className="hover:underline">{v.label}</Link>{v.amount ? ` · ${fmtNumber(v.amount, 0)} €` : ""}</h4>
                      <p className="mt-1 text-[10px] text-muted-foreground">{v.edition.project.name} · Demandé par {v.requester.name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground"><span className={cn(v.age > v.targetDelayDays ? "text-danger" : v.age > 0 ? "text-warning-foreground" : "")}>Depuis {v.age} jour{v.age > 1 ? "s" : ""}</span> · Délai cible : {v.targetDelayDays} jours</p>
                    </div>
                    <Button asChild size="sm" variant="outline"><Link href="/validations">Examiner</Link></Button>
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

          <div className="order-4 rounded-md border border-[#d5ddcc] bg-[#eff2e9] p-5" data-testid="my-time">
            <div className="flex items-center justify-between"><h4 className="text-[15px] font-bold">Mes temps à saisir</h4><span aria-hidden>◷</span></div>
            <p className="mt-2 mb-4 text-xs text-muted-foreground">
              {missingThisWeek.length > 0 ? <>{missingThisWeek.map((d) => d.format("dddd")).join(", ").replace(/^./, (c) => c.toUpperCase())} reste{missingThisWeek.length > 1 ? "nt" : ""} à compléter.<br /></> : weekTotal > 0 ? <>La semaine est saisie jusqu'ici.<br /></> : null}
              <b className="tabular text-foreground">{fmtNumber(weekTotal, 1)} h{expected !== null ? ` sur ${fmtNumber(expected, 1)} h attendues` : ""}</b> cette semaine.
            </p>
            {expected !== null && <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#e8e9e1]"><i className="block h-full rounded-[3px] bg-mint" style={{ width: `${Math.min(100, (weekTotal / expected) * 100)}%` }} /></div>}
            {missing.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5" data-testid="missing-days">
                <span className="w-full text-[10px] text-muted-foreground">Jours des deux dernières semaines sans saisie :</span>
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

function Panel({ title, aside, children, testId, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; testId?: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-md border bg-card", className)} data-testid={testId}>
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
