import Link from "next/link";
import { CheckSquare, Euro, Flag, Clock, AlertTriangle, Users, Maximize2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ValidationCard } from "@/components/common/validation-card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getPeople, getRefs, getSettings } from "@/lib/session";
import { loadPortfolio } from "@/lib/queries";
import { canDecideValidation, isCodir } from "@/lib/rights";
import { attachmentInclude } from "@/lib/attachments";
import { daysFromNow, dayjs, fmtDate, fmtEuro, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Presentation } from "@/app/cafe/presentation";
import { DecisionForm } from "./decision-form";
import { SessionTimer } from "./session-timer";

// Écran CODIR (EF-H2) : seulement ce qui appelle une décision — validations, jalons dépassés, livrables proches,
// enveloppes et temps en écart — et la décision se consigne sur l'édition sans quitter l'écran (EF-F4).
export default async function CodirPage({ searchParams }: { searchParams: Promise<{ pole?: string; plein?: string }> }) {
  const raw = await searchParams;
  const [me, settings, refs, people] = await Promise.all([getCurrentPerson(), getSettings(), getRefs(), getPeople()]);
  // Un responsable de pôle ouvre l'écran sur son pôle ; « pole=tous » donne la vue CODIR complète.
  const sp = { ...raw, pole: raw.pole === "tous" ? "" : raw.pole ?? (me.role === "pole_lead" ? me.poleId ?? "" : "") };
  if (!isCodir(me.role)) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader title="Écran CODIR" />
        <EmptyState title="Réservé au CODIR" hint="Direction, RAF et responsables de pôle. Choisissez « Claire Vasseur » dans le sélecteur pour le voir." />
      </div>
    );
  }
  const [rows, validations, recent] = await Promise.all([
    loadPortfolio(settings, { statuses: ["in_progress", "validated"] }),
    prisma.validationRequest.findMany({ where: { status: "pending" }, include: { requester: true, decider: true, action: true, edition: { include: { project: { include: { pole: true, secondaryPoles: true } } } }, attachments: { include: attachmentInclude } }, orderBy: { createdAt: "asc" } }),
    prisma.decision.findMany({ where: { decidedAt: { gte: dayjs().subtract(30, "day").toDate() } }, include: { edition: { include: { project: true } }, author: true, followUp: true }, orderBy: { decidedAt: "desc" }, take: 8 }),
  ]);
  const inPole = (p: { poleId: string; secondaryPoles?: { poleId: string }[] }) => !sp.pole || [p.poleId, ...(p.secondaryPoles ?? []).map((x) => x.poleId)].includes(sp.pole);
  const editions = rows.filter((r) => inPole(r.project));
  const pending = validations.filter((v) => inPole(v.edition.project));
  const lateMilestones = editions.flatMap((e) => e.actions.filter((a) => a.milestoneDate && a.state !== "done" && daysFromNow(a.milestoneDate) < 0).map((a) => ({ e, a, days: -daysFromNow(a.milestoneDate!) }))).sort((x, y) => y.days - x.days);
  const deliverables = editions.flatMap((e) => e.fundingLines.flatMap((f) => f.deliverables.filter((d) => !d.done && daysFromNow(d.dueDate) <= settings.deliverableAlertDays).map((d) => ({ e, f, d, days: daysFromNow(d.dueDate) })))).sort((x, y) => x.days - y.days);
  const envelopes = editions.filter((e) => e.budgetEnvelope && (e.used / e.budgetEnvelope) * 100 >= settings.envelopeAlertPercent).sort((x, y) => y.used / y.budgetEnvelope! - x.used / x.budgetEnvelope!);
  const timeOver = editions.flatMap((e) => e.actions.filter((a) => a.timeTarget && a.timeEntries.reduce((s, t) => s + t.hours, 0) > a.timeTarget).map((a) => ({ e, a, consumed: a.timeEntries.reduce((s, t) => s + t.hours, 0) })));
  const total = pending.length + lateMilestones.length + deliverables.length + envelopes.length + timeOver.length;
  const big = sp.plein === "1";
  const poles = [...new Map(rows.map((r) => [r.project.poleId, r.project.pole.name])).entries()];
  const decisionProps = { people: people.map((p) => ({ id: p.id, name: p.name })), instances: (refs.decision_instance ? Object.values(refs.decision_instance) : []).map((i) => ({ value: i.code, label: i.label })) };
  const qs = (extra: Record<string, string>) => { const q = new URLSearchParams({ ...(sp.pole ? { pole: sp.pole } : {}), ...(sp.plein ? { plein: sp.plein } : {}), ...extra }); const s = q.toString(); return `/codir${s ? `?${s}` : ""}`; };

  // Blocs V2 : liseré gauche ocre (vigilance) ou terre (retard), compteur écrit.
  const Block = ({ icon: Icon, title, count, tone, children }: { icon: typeof Flag; title: string; count: number; tone: "danger" | "warning" | "coral"; children: React.ReactNode }) => (
    <section className={cn("rounded-md border border-l-4 bg-card p-5", tone === "danger" ? "border-l-danger" : "border-l-warning", count === 0 && "border-l-border opacity-60")} data-testid={`codir-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <h2 className={cn("mb-3 flex items-center gap-2 font-bold", big ? "text-2xl" : "text-[15px]")}>
        <Icon className={cn("size-4", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-primary")} />{title}
        <span className={cn("ml-1 rounded-sm px-1.5 text-[11px] font-semibold", count ? (tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning-foreground") : "bg-muted text-muted-foreground")}>{count}</span>
      </h2>
      {count === 0 ? <p className="text-xs text-muted-foreground">Rien à traiter.</p> : children}
    </section>
  );
  const Line = ({ e, children, decisionLabel }: { e: (typeof editions)[number]; children: React.ReactNode; decisionLabel?: string }) => (
    <li className="flex flex-wrap items-start justify-between gap-2 border-t py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <Link href={`/edition/${e.id}`} className="font-medium text-primary hover:underline">{e.project.name}</Link> <span className="text-xs text-muted-foreground">· {e.project.pilot.name} · {e.project.pole.name}</span>
        <div className={cn(big ? "text-lg" : "text-sm")}>{children}</div>
      </div>
      {!big && <DecisionForm editionId={e.id} label={decisionLabel} {...decisionProps} />}
    </li>
  );

  const inAlert = editions.filter((e) => e.alerts.length > 0).length;

  // Ordre du jour : les alertes d'une même édition regroupées, notées, les 5 sujets les plus lourds en tête.
  // Chaque sujet dit le problème, la décision attendue, le responsable et l'échéance la plus proche.
  type Topic = { e: (typeof editions)[number]; score: number; problems: string[]; decisions: string[]; due: Date | null; overdueDays: number };
  const topics = new Map<string, Topic>();
  const topic = (e: (typeof editions)[number]) => { let t = topics.get(e.id); if (!t) { t = { e, score: 0, problems: [], decisions: [], due: null, overdueDays: 0 }; topics.set(e.id, t); } return t; };
  const nearer = (t: Topic, d: Date) => { if (!t.due || dayjs(d).isBefore(t.due)) t.due = d; };
  for (const v of pending) { const t = topic(editions.find((e) => e.id === v.editionId)!); t.score += 2 + (v.amount ? 1 : 0); t.problems.push(`Demande « ${v.label} »${v.amount ? ` · ${fmtEuro(v.amount)}` : ""} en attente depuis ${dayjs().diff(dayjs(v.createdAt), "day")} j`); t.decisions.push("Approuver ou refuser la demande"); }
  for (const { e, a, days } of lateMilestones) { const t = topic(e); t.score += 3 + Math.min(3, Math.floor(days / 30)); t.problems.push(`Jalon « ${a.name} » dépassé de ${days} j`); t.decisions.push("Replanifier le jalon, ou l'abandonner"); t.overdueDays = Math.max(t.overdueDays, days); nearer(t, a.milestoneDate!); }
  for (const { e, f, d, days } of deliverables) { const t = topic(e); t.score += days < 0 ? 3 : 2; t.problems.push(`Livrable « ${d.label} » pour ${f.funder.name} ${days < 0 ? `en retard de ${-days} j` : `dû dans ${days} j`}`); t.decisions.push(days < 0 ? "Fixer la date de remise et prévenir le financeur" : "Confirmer que la remise est tenue"); nearer(t, d.dueDate); }
  for (const e of envelopes) { const t = topic(e); const over = e.used - e.budgetEnvelope!; t.score += over > 0 ? 3 : 1; t.problems.push(over > 0 ? `Enveloppe dépassée de ${fmtEuro(over)} (${Math.round((e.used / e.budgetEnvelope!) * 100)} %)` : `Enveloppe consommée à ${Math.round((e.used / e.budgetEnvelope!) * 100) } %`); t.decisions.push(over > 0 ? "Couvrir le dépassement ou réduire les engagements" : "Geler ou autoriser les dépenses restantes"); }
  for (const { e, a, consumed } of timeOver) { const t = topic(e); t.score += 1; t.problems.push(`Temps « ${a.name} » : ${fmtNumber(consumed, 0)} h sur ${a.timeTarget} h`); t.decisions.push("Revoir l'objectif de temps ou le périmètre de l'action"); }
  const agenda = [...topics.values()].sort((x, y) => y.score - x.score || (x.due && y.due ? dayjs(x.due).diff(y.due) : 0)).slice(0, 5);
  const uniq = (xs: string[]) => [...new Set(xs)];

  return (
    <div className={cn("p-4 md:p-6", big && "text-lg")}>
      <Presentation on={big} exitHref={qs({ plein: "" })} />
      <div className="mb-1 text-[11px] font-bold tracking-[1.8px] text-primary uppercase">Réunion de direction · {fmtDate(new Date(), "D MMMM YYYY")}</div>
      <PageHeader
        title="Les sujets à décider."
        subtitle={<span>{inAlert} édition{inAlert > 1 ? "s" : ""} en alerte · {pending.length} validation{pending.length > 1 ? "s" : ""} en attente · {total} point{total > 1 ? "s" : ""} à traiter sur {editions.length} éditions · <SessionTimer minutes={20} /></span>}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/portefeuille">Quitter le mode CODIR <span className="text-muted-foreground">· Échap</span></Link></Button>
            <Button asChild variant={big ? "outline" : "default"} data-testid="codir-project"><Link href={big ? qs({ plein: "" }) : qs({ plein: "1" })}><Maximize2 />{big ? "Quitter la projection" : "Projeter"}</Link></Button>
          </>
        }
      />

      {/* Filtre par pôle, sous l'en-tête ; le bouton Projeter reste en haut à droite. */}
      <div className="mb-4 flex flex-wrap items-center gap-1" data-testid="codir-poles">
        <span className="mr-1 text-[11px] text-muted-foreground">Pôle</span>
        <Button asChild size="sm" variant={!sp.pole ? "default" : "outline"}><Link href={qs({ pole: "tous" })}>Tous les pôles</Link></Button>
        {poles.map(([id, name]) => <Button key={id} asChild size="sm" variant={sp.pole === id ? "default" : "outline"}><Link href={qs({ pole: id })}>{name.split(" ")[0]}</Link></Button>)}
      </div>

      {/* Ordre du jour : 3 à 5 sujets à arbitrer en 20 minutes ; le reste des alertes reste accessible plus bas. */}
      <section className="mb-4 rounded-md border bg-card p-5" data-testid="codir-agenda">
        <h2 className={cn("mb-1 font-bold", big ? "text-2xl" : "text-[15px]")}>Ordre du jour · {agenda.length} sujet{agenda.length > 1 ? "s" : ""} à arbitrer</h2>
        <p className={cn("mb-3 text-muted-foreground", big ? "text-base" : "text-xs")}>{topics.size} édition{topics.size > 1 ? "s" : ""} appellent une décision ; les {agenda.length} plus lourdes d'abord, alertes regroupées par édition. Environ {agenda.length ? Math.round(20 / agenda.length) : 0} minutes par sujet.</p>
        {agenda.length === 0 ? <p className="text-sm text-muted-foreground">Rien à arbitrer : la réunion peut être courte.</p> : (
          <ol className="grid gap-3">
            {agenda.map((t, i) => (
              <li key={t.e.id} className={cn("grid gap-2 rounded-md border border-l-4 p-4 md:grid-cols-[1fr_auto]", t.overdueDays > 0 || t.problems.some((p) => p.includes("dépassée")) ? "border-l-danger" : "border-l-warning")} data-testid={`agenda-${i}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                    <Link href={`/edition/${t.e.id}`} className={cn("font-bold text-primary hover:underline", big ? "text-xl" : "text-sm")}>{t.e.project.name} · {t.e.year}</Link>
                    <span className={cn("text-muted-foreground", big ? "text-base" : "text-xs")}>{t.e.project.pole.name}</span>
                  </div>
                  <dl className={cn("mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]", big ? "text-lg" : "text-sm")}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Problème</dt>
                    <dd><ul className="list-disc pl-4">{t.problems.map((x, j) => <li key={j}>{x}</li>)}</ul></dd>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Décision attendue</dt>
                    <dd>{uniq(t.decisions).join(" · ")}</dd>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsable</dt>
                    <dd>{t.e.project.pilot.name} <span className="text-muted-foreground">· pilote</span>{t.e.project.guarantor ? <span className="text-muted-foreground"> · garant {t.e.project.guarantor.name}</span> : null}</dd>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Échéance</dt>
                    <dd>{t.due ? <span className={cn(daysFromNow(t.due) < 0 && "font-semibold text-danger")}>{fmtDate(t.due)}{daysFromNow(t.due) < 0 ? ` · dépassée de ${-daysFromNow(t.due)} j` : ` · dans ${daysFromNow(t.due)} j`}</span> : "Pas de date : à fixer en séance"}</dd>
                  </dl>
                </div>
                <div className="flex items-start"><DecisionForm editionId={t.e.id} label={`Sujet ${i + 1}`} {...decisionProps} /></div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="group mb-4" open={!big} data-testid="codir-all">
        <summary className={cn("mb-3 cursor-pointer list-none font-bold", big ? "text-xl" : "text-[15px]")}>Toutes les alertes · {total} point{total > 1 ? "s" : ""} <span className="text-xs font-normal text-primary"><span className="group-open:hidden">afficher</span><span className="hidden group-open:inline">replier</span></span></summary>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Block icon={CheckSquare} title="Validations en attente" count={pending.length} tone="coral">
          <div className="grid gap-2">{pending.map((v, i) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={canDecideValidation(me, v)} showEdition index={i} attachments={v.attachments} />)}</div>
        </Block>

        <div className="grid content-start gap-4">
          <Block icon={Flag} title="Jalons dépassés" count={lateMilestones.length} tone="danger">
            <ul>{lateMilestones.map(({ e, a, days }) => <Line key={a.id} e={e} decisionLabel={`Jalon « ${a.name} »`}>{a.name} <span className="text-danger">· {days} j de retard</span> <span className="text-muted-foreground">· {a.owner?.name ?? "sans responsable"}</span></Line>)}</ul>
          </Block>
          <Block icon={Clock} title="Livrables financeurs proches" count={deliverables.length} tone="warning">
            <ul>{deliverables.map(({ e, f, d, days }) => <Line key={d.id} e={e} decisionLabel={`Livrable « ${d.label} » (${f.funder.name})`}>{d.label} <span className="text-muted-foreground">· {f.funder.name} · {fmtDate(d.dueDate)}</span> <span className={days < 0 ? "text-danger" : "text-warning-foreground"}>· {days < 0 ? `${-days} j de retard` : `J-${days}`}</span></Line>)}</ul>
          </Block>
          <Block icon={Euro} title="Enveloppes en alerte" count={envelopes.length} tone="warning">
            <ul>{envelopes.map((e) => <Line key={e.id} e={e} decisionLabel="Enveloppe">{fmtEuro(e.used)} consommés sur {fmtEuro(e.budgetEnvelope)} <span className={cn(e.used > e.budgetEnvelope! ? "text-danger" : "text-warning-foreground")}>· {Math.round((e.used / e.budgetEnvelope!) * 100)} %</span> <span className="text-muted-foreground">· disponible {fmtEuro(e.remaining)}</span></Line>)}</ul>
          </Block>
          <Block icon={AlertTriangle} title="Temps hors objectif" count={timeOver.length} tone="warning">
            <ul>{timeOver.map(({ e, a, consumed }) => <Line key={a.id} e={e} decisionLabel={`Temps « ${a.name} »`}>{a.name} <span className="text-warning-foreground">· {fmtNumber(consumed, 0)} h sur {a.timeTarget} h</span> <span className="text-muted-foreground">· {a.owner?.name ?? "—"}</span></Line>)}</ul>
          </Block>
        </div>
      </div>
      </details>

      <section className="mt-4 rounded-md border bg-card p-5">
        <h2 className={cn("mb-2 flex items-center gap-2 font-semibold", big ? "text-2xl" : "text-base")}><Users className="size-5 text-primary" />Décisions consignées ces 30 jours</h2>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">Aucune décision récente. Chaque point ci-dessus a un bouton « Consigner » : la décision est datée sur l'édition.</p> : (
          <ul className="divide-y text-sm" data-testid="recent-decisions">
            {recent.map((d) => (
              <li key={d.id} className="py-1.5">
                <span className="rounded-sm bg-secondary px-1.5 text-[11px] font-medium text-primary">{refs.decision_instance?.[d.instance]?.label ?? d.instance}</span> <Link href={`/edition/${d.editionId}?onglet=validations`} className="font-medium hover:underline">{d.edition.project.name} · {d.edition.year}</Link> — {d.body}
                {!big && <span className="text-xs text-muted-foreground"> · {fmtDate(d.decidedAt)} · {d.author.name}{d.followUp ? ` · suite : ${d.followUp.name}${d.dueDate ? ` pour le ${fmtDate(d.dueDate)}` : ""}` : ""}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
