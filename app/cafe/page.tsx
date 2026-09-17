import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { getRefs, getSettings } from "@/lib/session";
import { loadAgenda } from "@/lib/agenda";
import { refLabel } from "@/lib/refs";
import { dayjs, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Presentation } from "./presentation";
import { IcsCard } from "@/components/common/ics-card";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";

// Écran projetable du café du lundi (EF-H1) : la quinzaine à venir, blocages, qui attend quoi de qui.
export default async function CafePage({ searchParams }: { searchParams: Promise<{ plein?: string }> }) {
  const { plein } = await searchParams;
  const [settings, refs, me] = await Promise.all([getSettings(), getRefs(), getCurrentPerson()]);
  const agenda = await loadAgenda(15);
  const late = agenda.milestones.filter((a) => a.daysLeft < 0);
  const soon = agenda.milestones.filter((a) => a.daysLeft >= 0);
  const days: string[] = [];
  for (let i = 0; i <= 14; i++) days.push(dayjs().add(i, "day").format("YYYY-MM-DD"));
  const byDay = (d: string) => ({
    milestones: soon.filter((a) => dayjs(a.milestoneDate).format("YYYY-MM-DD") === d),
    deliverables: agenda.deliverables.filter((x) => dayjs(x.dueDate).format("YYYY-MM-DD") === d),
  });
  const big = plein === "1";

  return (
    <div className={cn("p-4 md:p-6", big && "text-lg")}>
      <Presentation on={big} exitHref="/cafe" />
      <PageHeader
        title="Café du lundi"
        subtitle={`Quinzaine du ${fmtDate(dayjs())} au ${fmtDate(dayjs().add(14, "day"))} · ${soon.length} jalons, ${agenda.deliverables.filter((d) => d.daysLeft >= 0).length} livrables financeurs, ${agenda.validations.length} validations en attente.`}
        actions={<Button asChild variant={big ? "outline" : "default"}><Link href={big ? "/cafe" : "/cafe?plein=1"}>{big ? "Quitter la projection" : "Projeter en grand"}</Link></Button>}
      />

      <div className={cn("grid gap-4", big ? "grid-cols-[2fr_1fr]" : "lg:grid-cols-[2fr_1fr]")}>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className={cn("mb-3 font-semibold", big ? "text-2xl" : "text-base")}>La quinzaine à venir</h2>
          <ol className="grid gap-1">
            {days.map((d) => {
              const { milestones, deliverables } = byDay(d);
              if (milestones.length + deliverables.length === 0) return null;
              const dj = dayjs(d);
              return (
                <li key={d} className="grid grid-cols-[110px_1fr] gap-3 border-t py-2 first:border-t-0">
                  <div className={cn("font-semibold", dj.isSame(dayjs(), "day") && "text-coral")}>{dj.format("ddd D MMM")}</div>
                  <ul className="grid gap-1">
                    {milestones.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-muted-foreground">{a.edition.project.name} · {a.owner?.name ?? "—"}</span>
                      </li>
                    ))}
                    {deliverables.map((x) => (
                      <li key={x.id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="rounded-sm bg-secondary px-2 text-xs font-semibold text-primary">financeur</span>
                        <span className="font-medium">{x.label}</span>
                        <span className="text-muted-foreground">{x.fundingLine.funder.name} · {x.fundingLine.edition.project.name} · {x.fundingLine.edition.project.pilot.name}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
            {soon.length + agenda.deliverables.length === 0 && <li className="text-muted-foreground">Rien de daté sur la quinzaine.</li>}
          </ol>
        </div>

        <div className="grid content-start gap-4">
          <div className="rounded-2xl border border-danger/30 bg-danger-soft/40 p-5">
            <h2 className={cn("mb-2 font-semibold text-danger", big ? "text-2xl" : "text-base")}>Blocages · jalons dépassés</h2>
            {late.length === 0 ? <p className="text-muted-foreground">Aucun jalon dépassé.</p> : (
              <ul className="grid gap-1.5">
                {late.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    <span className="font-medium">{a.name}</span> <span className="text-muted-foreground">· {a.edition.project.name} · {a.owner?.name ?? "—"} · {-a.daysLeft} j</span>
                  </li>
                ))}
                {late.length > 10 && <li className="text-muted-foreground">et {late.length - 10} autres…</li>}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-warning/40 bg-warning-soft/50 p-5">
            <h2 className={cn("mb-2 font-semibold text-warning-foreground", big ? "text-2xl" : "text-base")}>Qui attend quoi de qui</h2>
            {agenda.validations.length === 0 ? <p className="text-muted-foreground">Aucune validation en attente.</p> : (
              <ul className="grid gap-1.5">
                {agenda.validations.map((v) => (
                  <li key={v.id}>
                    <span className="font-medium">{v.requester.name}</span> attend <span className="font-medium">{["", "le pilote", "le responsable de pôle", "la direction"][v.requiredLevel]}</span>
                    <span className="text-muted-foreground"> · {refLabel(refs, "validation_kind", v.kind).toLowerCase()} « {v.label} » · {v.age} j</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h2 className={cn("mb-2 font-semibold", big ? "text-2xl" : "text-base")}>Temps à saisir</h2>
            {agenda.missingTime.length === 0 ? <p className="text-muted-foreground">Tout le monde est à jour.</p> : (
              <p>{agenda.missingTime.length} personne{agenda.missingTime.length > 1 ? "s ont" : " a"} des jours sans saisie sur la quinzaine. <span className="text-muted-foreground">Chacun voit les siens dans « Ma semaine » ; la RAF a le détail dans la clôture.</span></p>
            )}
          </div>
        </div>
      </div>
      {!big && <div className="mt-4"><IcsCard kind="team" canRegenerate={canAdmin(me)} /></div>}
      {!big && <p className="mt-4 text-xs text-muted-foreground">Horizon des alertes : {settings.horizonDays} jours dans le reste de l'outil ; ici, quinze jours.</p>}
    </div>
  );
}
