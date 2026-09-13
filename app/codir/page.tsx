import Link from "next/link";
import { CheckSquare, Euro, Flag, Clock, AlertTriangle, Users } from "lucide-react";
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
  const sp = await searchParams;
  const [me, settings, refs, people] = await Promise.all([getCurrentPerson(), getSettings(), getRefs(), getPeople()]);
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
    prisma.validationRequest.findMany({ where: { status: "pending" }, include: { requester: true, decider: true, action: true, edition: { include: { project: { include: { pole: true } } } }, attachments: { include: attachmentInclude } }, orderBy: { createdAt: "asc" } }),
    prisma.decision.findMany({ where: { decidedAt: { gte: dayjs().subtract(30, "day").toDate() } }, include: { edition: { include: { project: true } }, author: true, followUp: true }, orderBy: { decidedAt: "desc" }, take: 8 }),
  ]);
  const inPole = (poleId: string) => !sp.pole || poleId === sp.pole;
  const editions = rows.filter((r) => inPole(r.project.poleId));
  const pending = validations.filter((v) => inPole(v.edition.project.poleId));
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
      <DecisionForm editionId={e.id} label={decisionLabel} {...decisionProps} />
    </li>
  );

  const inAlert = editions.filter((e) => e.alerts.length > 0).length;
  return (
    <div className={cn("p-4 md:p-6", big && "text-lg")}>
      <Presentation on={big} exitHref={qs({ plein: "" })} />
      <div className="mb-1 text-[11px] font-bold tracking-[1.8px] text-primary uppercase">Réunion de direction · {fmtDate(new Date(), "D MMMM YYYY")}</div>
      <PageHeader
        title="Les sujets à décider."
        subtitle={<span>{inAlert} édition{inAlert > 1 ? "s" : ""} en alerte · {pending.length} validation{pending.length > 1 ? "s" : ""} en attente · {total} point{total > 1 ? "s" : ""} à traiter sur {editions.length} éditions · <SessionTimer minutes={20} /></span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <Button asChild size="sm" variant={!sp.pole ? "default" : "outline"}><Link href={qs({ pole: "" })}>Tous les pôles</Link></Button>
              {poles.map(([id, name]) => <Button key={id} asChild size="sm" variant={sp.pole === id ? "default" : "outline"}><Link href={qs({ pole: id })}>{name.split(" ")[0]}</Link></Button>)}
            </div>
            <Button asChild variant={big ? "outline" : "default"} ><Link href={big ? qs({ plein: "" }) : qs({ plein: "1" })}>{big ? "Quitter la projection" : "Projeter"}</Link></Button>
            <Button asChild variant="outline"><Link href="/portefeuille">Quitter le mode CODIR <span className="text-muted-foreground">· Échap</span></Link></Button>
          </div>
        }
      />

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

      <section className="mt-4 rounded-md border bg-card p-5">
        <h2 className={cn("mb-2 flex items-center gap-2 font-semibold", big ? "text-2xl" : "text-base")}><Users className="size-5 text-primary" />Décisions consignées ces 30 jours</h2>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">Aucune décision récente. Chaque point ci-dessus a un bouton « Consigner » : la décision est datée sur l'édition.</p> : (
          <ul className="divide-y text-sm" data-testid="recent-decisions">
            {recent.map((d) => (
              <li key={d.id} className="py-1.5">
                <span className="rounded-sm bg-secondary px-1.5 text-[11px] font-medium text-primary">{refs.decision_instance?.[d.instance]?.label ?? d.instance}</span> <Link href={`/edition/${d.editionId}?onglet=validations`} className="font-medium hover:underline">{d.edition.project.name} · {d.edition.year}</Link> — {d.body}
                <span className="text-xs text-muted-foreground"> · {fmtDate(d.decidedAt)} · {d.author.name}{d.followUp ? ` · suite : ${d.followUp.name}${d.dueDate ? ` pour le ${fmtDate(d.dueDate)}` : ""}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
