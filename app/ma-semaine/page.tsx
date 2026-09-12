import Link from "next/link";
import { CalendarDays, CheckSquare, Clock, Flag } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { AlertChips } from "@/components/common/alert-chips";
import { Button } from "@/components/ui/button";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { loadAgenda } from "@/lib/agenda";
import { loadPortfolio } from "@/lib/queries";
import { canDecideValidation } from "@/lib/rights";
import { refColor, refLabel } from "@/lib/refs";
import { dayjs, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IcsCard } from "@/components/common/ics-card";

export default async function MaSemainePage() {
  const [me, settings, refs] = await Promise.all([getCurrentPerson(), getSettings(), getRefs()]);
  const [agenda, portfolio] = await Promise.all([loadAgenda(settings.horizonDays), loadPortfolio(settings, { statuses: ["in_progress", "validated"] })]);

  const myActions = agenda.milestones.filter((a) => a.ownerId === me.id);
  const myPilotMilestones = agenda.milestones.filter((a) => a.ownerId !== me.id && a.edition.project.pilotId === me.id && a.daysLeft <= 14);
  const myDeliverables = agenda.deliverables.filter((d) => d.fundingLine.edition.project.pilotId === me.id || me.role === "raf");
  const toDecide = agenda.validations.filter((v) => canDecideValidation(me, v));
  const myRequests = agenda.validations.filter((v) => v.requesterId === me.id);
  const missing = agenda.missingTime.find((m) => m.person.id === me.id)?.missing ?? [];
  const myEditions = portfolio.filter((e) => e.project.pilotId === me.id || e.team.some((t) => t.personId === me.id));

  const dayLabel = (n: number) => (n < 0 ? `${-n} j de retard` : n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} j`);
  const tone = (n: number) => (n < 0 ? "text-danger" : n <= 7 ? "text-[#8a5a00]" : "text-muted-foreground");

  return (
    <div className="p-6">
      <PageHeader title="Ma semaine" subtitle={`${me.name} · semaine ${dayjs().isoWeek()} · tous projets confondus. Le café du lundi projette la même chose pour toute l'équipe.`} actions={<Button asChild variant="outline"><Link href="/cafe">Écran café</Link></Button>} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Mes actions à échéance" description={`Actions dont je suis responsable, jalon dans les ${settings.horizonDays} jours ou dépassé.`}>
          {myActions.length === 0 ? <Empty text="Aucune action à échéance : profitez-en pour avancer sur le reste." /> : (
            <ul className="divide-y">
              {myActions.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                  <Flag className={cn("size-4 shrink-0", tone(a.daysLeft))} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/edition/${a.editionId}?onglet=actions`} className="font-medium hover:underline">{a.name}</Link>
                    <div className="truncate text-xs text-muted-foreground">{a.edition.project.name} · {a.edition.year}</div>
                  </div>
                  <StatusBadge label={refLabel(refs, "action_state", a.state)} color={refColor(refs, "action_state", a.state)} />
                  <span className={cn("w-28 text-right text-xs", tone(a.daysLeft))}>{fmtDate(a.milestoneDate)}<br />{dayLabel(a.daysLeft)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Mes jalons et livrables financeurs" description="Sur les projets que je pilote (et pour la RAF, tous les livrables).">
          {myPilotMilestones.length + myDeliverables.length === 0 ? <Empty text="Rien à signaler dans l'horizon." /> : (
            <ul className="divide-y">
              {myDeliverables.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                  <CalendarDays className={cn("size-4 shrink-0", tone(d.daysLeft))} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/edition/${d.fundingLine.editionId}?onglet=financements`} className="font-medium hover:underline">{d.label}</Link>
                    <div className="truncate text-xs text-muted-foreground">{d.fundingLine.funder.name} · {d.fundingLine.edition.project.name}</div>
                  </div>
                  <span className={cn("w-28 text-right text-xs", tone(d.daysLeft))}>{fmtDate(d.dueDate)}<br />{dayLabel(d.daysLeft)}</span>
                </li>
              ))}
              {myPilotMilestones.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                  <Flag className={cn("size-4 shrink-0", tone(a.daysLeft))} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/edition/${a.editionId}?onglet=actions`} className="font-medium hover:underline">{a.name}</Link>
                    <div className="truncate text-xs text-muted-foreground">{a.owner?.name ?? "sans responsable"} · {a.edition.project.name}</div>
                  </div>
                  <span className={cn("w-28 text-right text-xs", tone(a.daysLeft))}>{fmtDate(a.milestoneDate)}<br />{dayLabel(a.daysLeft)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Mes validations" description={toDecide.length ? `${toDecide.length} à traiter par moi.` : "Rien à décider pour moi."} actions={<Button asChild size="sm" variant="outline"><Link href="/validations">Toute la file</Link></Button>}>
          {toDecide.length + myRequests.length === 0 ? <Empty text="Aucune demande en attente." /> : (
            <ul className="divide-y">
              {toDecide.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <CheckSquare className="size-4 shrink-0 text-coral" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/validations`} className="font-medium hover:underline">{v.label}</Link>
                    <div className="truncate text-xs text-muted-foreground">{refLabel(refs, "validation_kind", v.kind)} · {v.requester.name} · {v.edition.project.name}</div>
                  </div>
                  <span className={cn("text-xs", v.age > v.targetDelayDays ? "text-danger" : "text-muted-foreground")}>{v.age} j / cible {v.targetDelayDays} j</span>
                </li>
              ))}
              {myRequests.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
                  <CheckSquare className="size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span>{v.label}</span>
                    <div className="truncate text-xs">ma demande · en attente du niveau {v.requiredLevel} depuis {v.age} j</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Mes temps non saisis" description="Jours ouvrés des deux dernières semaines sans aucune saisie." actions={<Button asChild size="sm" className="bg-coral text-white hover:bg-coral/90"><Link href="/temps"><Clock />Saisir mes temps</Link></Button>}>
          {missing.length === 0 ? <Empty text="Tout est saisi. Merci !" /> : (
            <div className="flex flex-wrap gap-1.5" data-testid="missing-days">
              {missing.map((d) => (
                <Link key={d} href={`/temps?semaine=${dayjs(d).isoWeekYear()}-W${String(dayjs(d).isoWeek()).padStart(2, "0")}`} className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-[#8a5a00] hover:bg-warning/30">{dayjs(d).format("ddd D MMM")}</Link>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-4"><IcsCard kind="me" personId={me.id} /></div>

      <Section title="Mes éditions" description="Les éditions où je pilote ou contribue, avec leurs alertes." className="mt-4">
        {myEditions.length === 0 ? <Empty text="Aucune édition en cours pour moi." /> : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {myEditions.map((e) => (
              <li key={e.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/edition/${e.id}`} className="font-medium text-primary hover:underline">{e.project.name} · {e.year}</Link>
                  <StatusBadge label={refLabel(refs, "edition_status", e.status)} color={refColor(refs, "edition_status", e.status)} />
                </div>
                <div className="mb-2 text-xs text-muted-foreground">{e.project.pilotId === me.id ? "je pilote" : "je contribue"} · {e.project.pole.name}</div>
                <AlertChips alerts={e.alerts} max={2} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{text}</p>;
}
