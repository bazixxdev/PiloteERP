import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Flag } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { withBase } from "@/lib/base-path";
import { listPeople, loadSheet, writableEditions } from "@/lib/delegation-db";
import { daysFromNow, fmtDate } from "@/lib/format";
import { instanceHas } from "@/lib/modules";
import { has } from "@/lib/rights";
import { getCurrentPerson, getPeople, getSettings } from "@/lib/session";
import { cn } from "@/lib/utils";
import { V, cap, pl } from "@/lib/vocab";
import { AcknowledgeButton, AddObjectiveForm, BoardPresentationForm, CheckpointToggle, DelegationTextForm, DeleteDelegationButton, NewDelegationForm } from "./forms";

const STATE: Record<string, string> = { todo: "à faire", doing: "en cours", done: "fait", late: "en retard" };

// Délégation (25/09, docs/superpowers/specs/2026-09-25-delegation-design.md) : ce que la coordination délègue à une personne
// sur ses éditions — attendus, limites, contrôles — et, sans ressaisie, ses objectifs (actions), les points de contrôle, les
// indicateurs et les livrables dus, filtrés par période. La lecture est filtrée dans lib/delegation-db.ts.
export default async function DelegationPage({ searchParams }: { searchParams: Promise<{ personne?: string; annee?: string; periode?: string }> }) {
  const sp = await searchParams;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  if (!instanceHas(settings, "delegation")) notFound();
  const year = Number(sp.annee) || new Date().getFullYear();
  const personId = sp.personne ?? me.id;
  const [sheet, people, editions, everyone] = await Promise.all([loadSheet(me, personId, year, sp.periode), listPeople(me, year), writableEditions(me, year), has(me, "delegation.write") ? getPeople() : Promise.resolve([])]);
  const href = (q: Record<string, string | number>) => `/delegation?${new URLSearchParams({ personne: personId, annee: String(year), ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) })}`;
  const all = sheet ? sheet.groups.flatMap((g) => g.cards) : [];
  const unread = all.filter((c) => !c.delegation.acknowledgedAt);
  const board = all.map((c) => c.delegation.boardPresentedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="grid gap-4 p-4 md:p-6">
      <PageHeader
        title={sheet ? (sheet.isSelf ? "Ma délégation" : `Délégation · ${sheet.person.name}`) : "Délégation"}
        subtitle={sheet ? `${year}${sheet.person.jobTitle ? ` · ${sheet.person.jobTitle}` : ""} · ce qui est délégué, avec quelles limites, et comment on fait le point.` : undefined}
        actions={sheet && all.length > 0 ? <a href={withBase(`/delegation/export?personne=${personId}&annee=${year}&periode=${sheet.period.key}`)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline" data-testid="delegation-export"><Download className="size-4" />Exporter en .docx</a> : undefined}
      />

      <div className={cn("grid gap-4", people.length > 0 && "lg:grid-cols-[16rem_1fr]")}>
        {people.length > 0 && (
          <aside className="grid content-start gap-3">
            <Section title="Personnes" testId="delegation-people">
              <ul className="grid gap-1 text-sm">
                {people.map((p) => (
                  <li key={p.id}>
                    <Link href={`/delegation?personne=${p.id}&annee=${year}`} className={cn("block rounded-md px-2 py-1 hover:bg-muted", p.id === personId && "bg-muted font-semibold")}>
                      {p.name}
                      <span className="block text-[11px] font-normal text-muted-foreground">{p.total} {p.total > 1 ? pl(V.projet) : V.projet.one}{p.unread > 0 ? ` · ${p.unread} à relire` : " · lu"}{p.board ? ` · CA le ${fmtDate(p.board)}` : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
            {editions.length > 0 && (
              <Section title="Nouvelle délégation">
                <NewDelegationForm people={everyone.map((p) => ({ id: p.id, name: p.name }))} editions={editions} year={year} />
              </Section>
            )}
          </aside>
        )}

        <div className="grid content-start gap-4">
          {!sheet ? (
            <p className="text-sm text-muted-foreground" data-testid="delegation-none">Aucune délégation à afficher.</p>
          ) : (
            <>
              <nav className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Période">
                {sheet.periods.map((p) => (
                  <Link key={p.key} href={href({ periode: p.key })} className={cn("rounded-full border px-2.5 py-0.5", p.key === sheet.period.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")} data-testid={`delegation-period-${p.key}`}>{p.label}</Link>
                ))}
              </nav>

              <div className="flex flex-wrap items-center gap-2" data-testid="delegation-ack-state">
                {all.length > 0 && (unread.length === 0 ? <StatusBadge label="Lu, pris en compte" color="mint" /> : <StatusBadge label={`${unread.length} à relire`} color="warning" />)}
                {board && <StatusBadge label={`Présentée au CA le ${fmtDate(board)}`} color="info" />}
                {sheet.isSelf && unread.length > 0 && <AcknowledgeButton ids={unread.map((c) => c.delegation.id)} />}
                {sheet.canWrite && <BoardPresentationForm personId={personId} year={year} />}
              </div>

              {all.length === 0 && <p className="text-sm text-muted-foreground" data-testid="delegation-empty">Aucune délégation pour {year}.</p>}

              {sheet.groups.map((g) => (
                <div key={g.pole} className="grid gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.pole}</h2>
                  {g.cards.map((c) => (
                    <Section key={c.edition.id} testId={`delegation-card-${c.edition.id}`}
                      title={c.edition.name}
                      description={<Link href={`/edition/${c.edition.id}`} className="text-primary hover:underline">{`Ouvrir la fiche ${c.edition.year}`}</Link>}
                      actions={<div className="flex items-center gap-1.5">{c.delegation.acknowledgedAt ? <span className="text-[11px] text-muted-foreground">lu le {fmtDate(c.delegation.acknowledgedAt)}</span> : <StatusBadge label="à relire" color="warning" />}{c.canWrite && <DeleteDelegationButton id={c.delegation.id} />}</div>}>
                      {c.canWrite ? (
                        <DelegationTextForm id={c.delegation.id} expectations={c.delegation.expectations} limits={c.delegation.limits} controls={c.delegation.controls} />
                      ) : (
                        <dl className="grid gap-3 text-sm md:grid-cols-3" data-testid={`delegation-texts-${c.delegation.id}`}>
                          {([["Attendus", c.delegation.expectations], ["Limites", c.delegation.limits], ["Contrôles", c.delegation.controls]] as const).map(([k, v]) => (
                            <div key={k}><dt className="text-xs font-medium text-muted-foreground">{k}</dt><dd className="whitespace-pre-line">{v ?? "—"}</dd></div>
                          ))}
                        </dl>
                      )}
                      {c.delegation.revisions.length > 0 && (
                        <details className="mt-2 text-xs text-muted-foreground" data-testid={`delegation-history-${c.delegation.id}`}>
                          <summary className="cursor-pointer">Historique ({c.delegation.revisions.length} version{c.delegation.revisions.length > 1 ? "s" : ""} précédente{c.delegation.revisions.length > 1 ? "s" : ""})</summary>
                          <ul className="mt-1 grid gap-2">
                            {c.delegation.revisions.map((r) => <li key={r.id} className="rounded-md border p-2"><b className="font-medium text-foreground">Remplacée le {fmtDate(r.createdAt)} par {r.author.name}</b><div className="whitespace-pre-line">Attendus : {r.expectations ?? "—"}{"\n"}Limites : {r.limits ?? "—"}{"\n"}Contrôles : {r.controls ?? "—"}</div></li>)}
                          </ul>
                        </details>
                      )}

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div data-testid={`delegation-objectives-${c.edition.id}`}>
                          <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{`Objectifs · ${sheet.period.label}`}</h3>
                          {c.objectives.length === 0 ? <p className="text-sm text-muted-foreground">Aucun sur la période.</p> : (
                            <ul className="grid gap-1 text-sm">
                              {c.objectives.map((a) => (
                                <li key={a.id} className="flex items-center gap-1.5">
                                  {c.canAddObjective && <CheckpointToggle actionId={a.id} value={a.isCheckpoint} />}
                                  <span className={cn(a.state === "done" && "text-muted-foreground line-through")}>{a.name}</span>
                                  <span className={cn("text-[11px] text-muted-foreground", a.state !== "done" && a.milestoneDate && daysFromNow(a.milestoneDate) < 0 && "text-danger")}>{a.milestoneDate ? fmtDate(a.milestoneDate) : "sans échéance"} · {STATE[a.state] ?? a.state}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {c.canAddObjective && <div className="mt-1"><AddObjectiveForm editionId={c.edition.id} ownerId={personId} /></div>}
                        </div>
                        <div data-testid={`delegation-checkpoints-${c.edition.id}`}>
                          <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Points de contrôle et livrables dus</h3>
                          {c.checkpoints.length + c.deliverables.length === 0 ? <p className="text-sm text-muted-foreground">Rien sur la période.</p> : (
                            <ul className="grid gap-1 text-sm">
                              {c.checkpoints.map((a) => <li key={a.id} className="flex items-center gap-1.5"><Flag className="size-3.5 text-primary" />{a.name} <span className="text-[11px] text-muted-foreground">{fmtDate(a.milestoneDate!)}{a.owner ? ` · ${a.owner.name}` : ""}</span></li>)}
                              {c.deliverables.map((d) => <li key={d.id} className={cn(d.done && "text-muted-foreground line-through")}>{d.label} <span className="text-[11px] text-muted-foreground">{fmtDate(d.dueDate)} · {d.funder}</span></li>)}
                            </ul>
                          )}
                        </div>
                        {c.indicators.length > 0 && (
                          <div>
                            <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Indicateurs</h3>
                            <ul className="grid gap-1 text-sm">{c.indicators.map((i) => <li key={i.id}>{i.label} <span className="text-[11px] text-muted-foreground">cible {i.target ?? "—"} · réalisé {i.actual ?? "—"}{i.imposed ? " · imposé" : ""}</span></li>)}</ul>
                          </div>
                        )}
                        {c.tasks && (
                          <div data-testid={`delegation-tasks-${c.edition.id}`}>
                            <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Mes tâches (visibles de moi seul·e)</h3>
                            {c.tasks.length === 0 ? <p className="text-sm text-muted-foreground">Aucune.</p> : <ul className="grid gap-1 text-sm">{c.tasks.map((t) => <li key={t.id} className={cn(t.done && "text-muted-foreground line-through")}>{t.label}{t.dueDate ? <span className="text-[11px] text-muted-foreground"> · {fmtDate(t.dueDate)}</span> : null}</li>)}</ul>}
                          </div>
                        )}
                      </div>
                    </Section>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{`${cap(pl(V.action))} du projet = objectifs de la personne quand elle en est responsable ; un drapeau les marque comme points de contrôle.`}</p>
    </div>
  );
}
