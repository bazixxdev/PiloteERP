import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Flag } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { withBase } from "@/lib/base-path";
import { fmtDate } from "@/lib/format";
import { loadMesActions } from "@/lib/mes-actions-db";
import { canSeeTimeOf } from "@/lib/rights";
import { getCurrentPerson, getPeople, getSettings } from "@/lib/session";
import { cn } from "@/lib/utils";
import { V, aucun, cap, e, pl } from "@/lib/vocab";

// « Mes actions » (26/09) remplace « Ma délégation » : les actions dont une personne est responsable ou associée, avec ce
// qui leur est confié, leur marge de décision et leurs jalons de la période, plus ses tâches (elle seule). `personne=`
// n'est autorisé qu'avec le droit de voir le temps de l'équipe sur son périmètre — même garde que /temps?personne=
// (canSeeTimeOf), vérifiée avant toute lecture. La donnée se lit dans lib/mes-actions-db.ts, pas dans la table Delegation.
export default async function MesActionsPage({ searchParams }: { searchParams: Promise<{ personne?: string; annee?: string; periode?: string }> }) {
  const sp = await searchParams;
  const [me, settings, people] = await Promise.all([getCurrentPerson(), getSettings(), getPeople()]);
  const year = Number(sp.annee) || new Date().getFullYear();
  const personId = sp.personne ?? me.id;
  const isSelf = personId === me.id;
  if (!isSelf) {
    const target = people.find((p) => p.id === personId);
    if (!target || !canSeeTimeOf(me, target, settings.timeVisibility)) notFound();
  }
  const sheet = await loadMesActions(personId, year, sp.periode, isSelf);
  if (!sheet) notFound();

  const href = (q: Record<string, string | number>) => `/mes-actions?${new URLSearchParams({ personne: personId, annee: String(year), ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) })}`;
  const total = sheet.projects.reduce((s, p) => s + p.actions.length, 0);
  // Personnes que je peux ouvrir ici (spec § 4, « la coordination voit Mes actions de chacun ») : même droit que /temps?personne=
  // (canSeeTimeOf), sur les personnes déjà chargées pour la page — aucune donnée en plus n'est calculée pour qui n'y a pas droit.
  // Un simple contributeur (droit refusé pour tout le monde) ne voit personne d'autre que lui-même : la liste est vide, cachée.
  const visiblePeople = people.filter((p) => p.id !== me.id && canSeeTimeOf(me, p, settings.timeVisibility)).sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <div className="grid gap-4 p-4 md:p-6" data-testid="mes-actions-page">
      <PageHeader
        title={isSelf ? `Mes ${pl(V.action)}` : `${cap(pl(V.action))} de ${sheet.person.name}`}
        subtitle={`${year}${sheet.person.jobTitle ? ` · ${sheet.person.jobTitle}` : ""} · ce qui est confié à chacun, sa marge de décision, ses jalons.`}
        actions={total > 0 ? <a href={withBase(`/mes-actions/export?personne=${personId}&annee=${year}&periode=${sheet.period.key}`)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline" data-testid="mes-actions-export"><Download className="size-4" />Exporter en .docx</a> : undefined}
      />

      <div className={cn("grid gap-4", visiblePeople.length > 0 && "lg:grid-cols-[16rem_1fr]")}>
        {visiblePeople.length > 0 && (
          <aside className="grid content-start gap-3">
            <Section title="Personnes" testId="mes-actions-people">
              <ul className="grid gap-1 text-sm">
                <li>
                  <Link href={href({ personne: me.id, periode: sheet.period.key })} className={cn("block rounded-md px-2 py-1 hover:bg-muted", isSelf && "bg-muted font-semibold")}>Moi</Link>
                </li>
                {visiblePeople.map((p) => (
                  <li key={p.id}>
                    <Link href={href({ personne: p.id, periode: sheet.period.key })} className={cn("block rounded-md px-2 py-1 hover:bg-muted", p.id === personId && "bg-muted font-semibold")}>{p.name}</Link>
                  </li>
                ))}
              </ul>
            </Section>
          </aside>
        )}

        <div className="grid content-start gap-4">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Période">
        {sheet.periods.map((p) => (
          <Link key={p.key} href={href({ periode: p.key })} className={cn("rounded-full border px-2.5 py-0.5", p.key === sheet.period.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")} data-testid={`mes-actions-period-${p.key}`}>{p.label}</Link>
        ))}
      </nav>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="mes-actions-empty">{`${cap(aucun(V.action))} confié${e(V.action)} pour ${year}, sur cette période.`}</p>
      ) : (
        sheet.projects.map((p) => (
          <Section key={p.id} testId={`mes-actions-project-${p.id}`} title={p.name} description={<Link href={`/edition/${p.id}`} className="text-primary hover:underline">{`Ouvrir la fiche ${p.name} ${year}`}</Link>}>
            <div className="grid gap-4">
              {p.actions.map((a) => (
                <div key={a.id} className="rounded-lg border p-3" data-testid={`mes-actions-action-${a.id}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Link href={`/action/${a.id}?annee=${year}`} className="font-semibold text-primary hover:underline">{a.name}</Link>
                    <span className="text-xs text-muted-foreground">{`Du ${fmtDate(a.startDate)} au ${fmtDate(a.endDate)}`}</span>
                  </div>
                  <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs font-medium text-muted-foreground">Ce qui est confié</dt><dd className="whitespace-pre-line" data-testid={`mes-actions-entrusted-${a.id}`}>{a.entrusted ?? "—"}</dd></div>
                    <div><dt className="text-xs font-medium text-muted-foreground">Marge de décision</dt><dd className="whitespace-pre-line" data-testid={`mes-actions-latitude-${a.id}`}>{a.latitude ?? "—"}</dd></div>
                  </dl>
                  <div className="mt-2" data-testid={`mes-actions-milestones-${a.id}`}>
                    <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{`Jalons · ${sheet.period.label}`}</h3>
                    {a.milestones.length === 0 ? <p className="text-sm text-muted-foreground">Aucun sur la période.</p> : (
                      <ul className="grid gap-1 text-sm">
                        {a.milestones.map((m) => (
                          <li key={m.id} className={cn("flex items-center gap-1.5", m.done && "text-muted-foreground line-through")}>
                            {m.isCheckpoint && <Flag className="size-3.5 shrink-0 text-primary" aria-label="Point de contrôle" />}
                            <span className={cn(m.isCheckpoint && "font-semibold")}>{m.name}</span>
                            <span className="text-[11px] text-muted-foreground">{fmtDate(m.date)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
              {isSelf && (
                <div data-testid={`mes-actions-tasks-${p.id}`}>
                  <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Mes tâches (visibles de moi seul·e)</h3>
                  {(sheet.tasks ?? []).filter((t) => t.editionId === p.id).length === 0 ? <p className="text-sm text-muted-foreground">Aucune.</p> : (
                    <ul className="grid gap-1 text-sm">
                      {(sheet.tasks ?? []).filter((t) => t.editionId === p.id).map((t) => (
                        <li key={t.id} className={cn(t.done && "text-muted-foreground line-through")}>{t.label}{t.dueDate ? <span className="text-[11px] text-muted-foreground"> · {fmtDate(t.dueDate)}</span> : null}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </Section>
        ))
      )}
        </div>
      </div>
    </div>
  );
}
