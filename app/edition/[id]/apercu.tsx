import Link from "next/link";
import { Section } from "@/components/common/section";
import { Gauge } from "@/components/common/gauge";
import { StatusBadge } from "@/components/common/status-badge";
import { ValidationCard } from "@/components/common/validation-card";
import { budgetOf } from "@/lib/budget";
import { canDecideValidation, canEditFunding } from "@/lib/rights";
import { UploadForm } from "@/components/attachments/upload-form";
import { Reveal } from "@/components/common/reveal";
import { dayjs, daysFromNow, fmtDate, fmtEuro, fmtNumber } from "@/lib/format";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { DeliverablesList } from "./deliverables-list";
import { kindLabel } from "@/lib/achievements";
import { CreateTaskButton } from "./create-task-button";
import { TaskTick } from "./task-tick";

// L'Aperçu (revue du 15/09) : où en est le projet, en un écran — jalons et retards, budget, temps, livrables, ce qui attend
// une décision, la dernière décision d'instance, le fil, mes tâches, les réalisations. Il n'invente rien : il assemble.
export function ApercuTab({ e, me, refs, settings, isPilot, myTasks = [] }: TabCtx) {
  const hpd = settings.hoursPerDay || 7;
  const b = budgetOf(e);
  const pct = e.budgetEnvelope ? Math.round((b.used / e.budgetEnvelope) * 100) : null;
  const timeTotal = e.yearEntries.reduce((s, t) => s + t.hours, 0);
  const timeTarget = e.actions.reduce((s, a) => s + (a.timeTarget ?? 0), 0);
  const noAction = e.yearEntries.filter((t) => !t.actionId).reduce((s, t) => s + t.hours, 0);
  const milestones = e.actions.filter((a) => a.state !== "done").map((a) => ({ ...a, n: a.milestoneDate ? daysFromNow(a.milestoneDate) : null })).sort((x, y) => (x.n ?? 9999) - (y.n ?? 9999));
  const pending = e.validations.filter((v) => v.status === "pending");
  const decided = e.validations.filter((v) => v.status !== "pending");
  const lastDecision = e.decisions[0];
  const comments = [...e.comments].slice(-3).reverse();
  const achievements = e.achievements.slice(0, 4);
  const reached = e.indicators.filter((i) => i.target && i.actual && Number(String(i.actual).replace(",", ".")) >= Number(String(i.target).replace(",", "."))).length;
  const pieces = (id: string) => e.attachments.filter((a) => a.validationId === id);
  const kinds = REF_DEFAULTS.attachment_kind.map((k) => ({ value: k.code, label: refLabel(refs, "attachment_kind", k.code) }));
  const canUpload = (requesterId: string) => requesterId === me.id || isPilot || canEditFunding(me.role) || me.role === "pole_lead";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <div className="grid content-start gap-4">
        <Section title="État de l'édition" description={`${e.year} · ${e.actions.filter((a) => a.state === "done").length} action${e.actions.filter((a) => a.state === "done").length > 1 ? "s" : ""} faite${e.actions.filter((a) => a.state === "done").length > 1 ? "s" : ""} sur ${e.actions.length}`} testId="apercu-etat">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md bg-muted/40 p-3">
              <dt className="flex items-baseline justify-between text-xs text-muted-foreground"><span>Budget de dépenses directes</span><Link href={`/edition/${e.id}?onglet=budget`} className="text-primary hover:underline">Budget →</Link></dt>
              <dd className="mt-1.5">
                {e.budgetEnvelope ? (
                  <>
                    <div className="flex items-baseline justify-between"><b className="tabular text-base">{fmtEuro(b.used)}</b><span className={cn("text-xs font-semibold tabular", pct! >= 100 ? "text-danger" : pct! >= settings.envelopeAlertPercent ? "text-warning-foreground" : "text-mint")}>{pct} % de {fmtEuro(e.budgetEnvelope)}</span></div>
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded-[3px] bg-[#e8e9e1]"><div className={cn("h-full", pct! >= 100 ? "bg-danger" : pct! >= settings.envelopeAlertPercent ? "bg-warning" : "bg-mint")} style={{ width: `${Math.min(100, pct!)}%` }} /></div>
                    <div className="mt-1 text-[11px] text-muted-foreground">réalisé {fmtEuro(b.realized)} · engagé {fmtEuro(b.remainingCommitments)} · {b.available !== null && b.available < 0 ? <span className="font-semibold text-danger">dépassé de {fmtEuro(-b.available)}</span> : <>reste {fmtEuro(b.available ?? 0)}</>}</div>
                  </>
                ) : <span className="text-xs text-warning-foreground">Enveloppe non renseignée{b.used > 0 ? ` · ${fmtEuro(b.used)} consommés` : ""}.</span>}
              </dd>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <dt className="flex items-baseline justify-between text-xs text-muted-foreground"><span>Temps de l'équipe</span><Link href={`/edition/${e.id}?onglet=temps`} className="text-primary hover:underline">Temps →</Link></dt>
              <dd className="mt-1.5">
                <div className="flex items-baseline justify-between"><b className="tabular text-base">{fmtNumber(timeTotal, 0)} h</b><span className="text-xs text-muted-foreground">{fmtNumber(timeTotal / hpd, 1)} j{timeTarget ? ` · objectif ${fmtNumber(timeTarget, 0)} h` : ""}</span></div>
                {timeTarget ? <div className="mt-1.5"><Gauge value={timeTotal} max={timeTarget} alertPercent={90} bare className="[&>div]:w-full [&>div]:flex-1" /></div> : <div className="mt-1.5 text-[11px] text-muted-foreground">Objectif non fixé sur les actions.</div>}
                {timeTotal > 0 && noAction > 0 && <div className={cn("mt-1 text-[11px]", noAction / timeTotal > 0.25 ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>dont {fmtNumber(noAction, 0)} h sans action ({Math.round((noAction / timeTotal) * 100)} %)</div>}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground"><span>Livrables financeurs à remettre</span><Link href={`/edition/${e.id}?onglet=budget#recettes`} className="text-primary hover:underline">Financeurs →</Link></div>
            <DeliverablesList e={e} settings={settings} canTick={false} canEdit={false} compact />
          </div>
        </Section>

        <Section title="Prochains jalons" description={milestones.length ? `${milestones.filter((m) => m.n !== null && m.n < 0).length} en retard · ${milestones.length} action${milestones.length > 1 ? "s" : ""} à mener` : "Toutes les actions sont faites."} actions={<Link href={`/edition/${e.id}?onglet=actions`} className="text-xs text-primary hover:underline">Actions →</Link>} testId="apercu-jalons">
          {milestones.length > 0 && (
            <ul className="divide-y text-sm">
              {milestones.slice(0, 6).map((a) => {
                const late = a.n !== null && a.n < 0;
                return (
                  <li key={a.id} className="flex items-center gap-3 py-1.5">
                    <span className={cn("size-2.5 shrink-0 rounded-full", late ? "bg-danger" : a.state === "doing" ? "bg-primary" : "bg-muted-foreground/40")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">{a.owner?.name ?? "—"}</span>
                    <span className={cn("w-40 shrink-0 text-right text-xs tabular whitespace-nowrap", late ? "font-semibold text-danger" : "text-muted-foreground")}>{a.milestoneDate ? (late ? `${fmtDate(a.milestoneDate)} · ${-a.n!} j` : a.n === 0 ? "aujourd'hui" : `${fmtDate(a.milestoneDate)} · J-${a.n}`) : "sans jalon"}</span>
                  </li>
                );
              })}
              {milestones.length > 6 && <li className="py-1.5 text-xs text-muted-foreground">+ {milestones.length - 6} autres dans l'onglet Actions.</li>}
            </ul>
          )}
        </Section>

        <Section title="Mes tâches sur cette édition" description={myTasks.length ? `${myTasks.length} à faire` : "Rien en cours pour vous sur cette édition."} actions={<CreateTaskButton editionId={e.id} actions={e.actions.map((a) => ({ id: a.id, name: a.name }))} compact />} testId="apercu-taches">
          {myTasks.length > 0 && (
            <ul className="divide-y text-sm">
              {myTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1.5">
                  <TaskTick id={t.id} />
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  {t.action && <span className="truncate text-xs text-muted-foreground">{t.action.name}</span>}
                  {t.dueDate && <span className={cn("shrink-0 text-xs tabular", daysFromNow(t.dueDate) < 0 ? "font-semibold text-danger" : "text-muted-foreground")}>{fmtDate(t.dueDate)}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs"><Link href="/taches" className="text-primary hover:underline">Toutes mes tâches →</Link></p>
        </Section>
      </div>

      <div className="grid content-start gap-4">
        <Section title="À décider" description={pending.length ? `${pending.length} validation${pending.length > 1 ? "s" : ""} en attente` : "Aucune validation en attente."} actions={<Link href="/demandes" className="text-xs text-primary hover:underline">Demandes →</Link>} testId="apercu-a-decider">
          {pending.length > 0 && <div className="grid gap-2">{pending.map((v, i) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={canDecideValidation(me, { ...v, edition: e })} index={i} attachments={pieces(v.id)} upload={canUpload(v.requesterId) ? <Reveal label="Pièce" size="xs" testId={`validation-upload-open-${i}`}><UploadForm editionId={e.id} kinds={kinds} defaultKind="quote" validationId={v.id} compact /></Reveal> : undefined} />)}</div>}
          {decided.length > 0 && (
            <details className="group mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer list-none">{decided.length} décidée{decided.length > 1 ? "s" : ""} <span className="text-primary group-open:hidden">afficher</span><span className="hidden text-primary group-open:inline">masquer</span></summary>
              <div className="mt-2 grid gap-2">{decided.slice(0, 5).map((v) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={false} attachments={pieces(v.id)} />)}</div>
            </details>
          )}
        </Section>

        <Section title="Dernière décision d'instance" description={lastDecision ? undefined : "Aucune décision consignée."} actions={<Link href={`/edition/${e.id}?onglet=fiche#decisions`} className="text-xs text-primary hover:underline">Toutes →</Link>} testId="apercu-decision">
          {lastDecision && (
            <p className="text-sm"><StatusBadge label={refLabel(refs, "decision_instance", lastDecision.instance)} color="info" dot={false} /> {lastDecision.body}<span className="text-xs text-muted-foreground"> · {fmtDate(lastDecision.decidedAt)} · {lastDecision.author.name}{lastDecision.followUp ? ` · suite : ${lastDecision.followUp.name}` : ""}</span></p>
          )}
        </Section>

        <Section title="Fil" description={e.comments.length ? `${e.comments.length} message${e.comments.length > 1 ? "s" : ""} · les derniers` : "Aucun message : ouvrez le fil en haut de page."} testId="apercu-fil">
          {comments.length > 0 && (
            <ul className="space-y-2 text-sm">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted/60 p-2">
                  <div className="text-[11px] text-muted-foreground"><b className="text-foreground">{c.author.name}</b> · {fmtDate(c.createdAt)}</div>
                  <p className="line-clamp-3">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Réalisations et indicateurs" description={<>{e.achievements.length} réalisation{e.achievements.length > 1 ? "s" : ""} consignée{e.achievements.length > 1 ? "s" : ""}{e.indicators.length > 0 && <> · {reached}/{e.indicators.length} indicateur{e.indicators.length > 1 ? "s" : ""} atteint{reached > 1 ? "s" : ""}</>}</>} actions={<Link href={`/edition/${e.id}?onglet=actions#realisations`} className="text-xs text-primary hover:underline">Actions →</Link>} testId="apercu-realisations">
          {achievements.length > 0 ? (
            <ul className="divide-y text-sm">
              {achievements.map((a) => <li key={a.id} className="flex items-start gap-2 py-1.5"><span className="w-14 shrink-0 text-[11px] tabular text-muted-foreground">{dayjs(a.date).format("D MMM")}</span><span className="min-w-0 flex-1"><b className="tabular">{a.value != null ? `${new Intl.NumberFormat("fr-FR").format(a.value)}${a.unit ? ` ${a.unit}` : ""} · ` : ""}</b>{a.label}<span className="block text-[10px] text-muted-foreground">{kindLabel(a.kind)}</span></span></li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Rien de consigné pour l'instant{isPilot ? " : notez au fil de l'eau, ce sera le bilan." : "."}</p>}
        </Section>
      </div>
    </div>
  );
}
