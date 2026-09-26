import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { Gauge } from "@/components/common/gauge";
import { AutoField } from "@/components/inline/auto-field";
import { SectionIcon } from "@/components/shell/section-icon";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getPeople, getRefs, getSettings } from "@/lib/session";
import { actionCtx } from "@/lib/actions-rights-db";
import { balance, fundingOverflow, runsIn, spanLabel, yearsLabel, yearsOf } from "@/lib/actions";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { canSeeTimeOf } from "@/lib/rights";
import { canReadShared, instanceHas } from "@/lib/modules";
import { canSeePersonnelDetail } from "@/lib/budget-plan";
import { actionTimeCost } from "@/lib/budget-plan-db";
import { inMyScope, isTransversal } from "@/lib/scope";
import { dayjs, fmtDate, fmtDateInput, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateTaskButton } from "@/app/edition/[id]/create-task-button";
import { Milestones } from "./milestones";
import { PeriodForm } from "./period-form";
import { PeopleSection } from "./people-picker";
import { DeleteActionButton } from "./delete-action";
import { ActionName } from "./action-name";
import { Fundings, type BalanceView, type FundingLinkView } from "./fundings";
import { V, cap, du, ce, pl } from "@/lib/vocab";

// La page de l'action (spec actions § 3) : l'action est une composante du projet, sur une période qui peut couvrir plusieurs
// années. Qui peut lire ? comme une année du projet : tout le monde, avec la bande « hors de votre périmètre » (page Édition).
// Qui peut écrire ? actionCtx (lib/actions-rights-db.ts) — les contrôles affichés en suivent les drapeaux ; chaque commande
// se garde elle-même. `?annee=2026` filtre heures et réalisations ; `?annee=tout`, toute la période.
export default async function ActionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ annee?: string }> }) {
  const { id } = await params;
  const { annee } = await searchParams;
  const [me, refs, settings, people] = await Promise.all([getCurrentPerson(), getRefs(), getSettings(), getPeople()]);
  const a = await prisma.action.findUnique({
    where: { id },
    include: {
      project: { include: { pole: true, secondaryPoles: { select: { poleId: true } }, editions: { orderBy: { year: "asc" }, select: { id: true, year: true, team: { select: { personId: true } } } } } },
      owner: { select: { id: true, name: true } },
      people: { select: { personId: true, person: { select: { id: true, name: true, active: true } } } },
      milestones: { orderBy: [{ date: "asc" }, { order: "asc" }] },
      tasks: { where: { done: false }, include: { person: { select: { id: true, name: true } }, list: { select: { visibility: true, person: { select: { id: true, poleId: true } } } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
      achievements: { include: { edition: { select: { year: true } } }, orderBy: { date: "asc" } },
      indicators: { include: { edition: { select: { year: true } } }, orderBy: { order: "asc" } },
    },
  });
  if (!a || !a.project || !a.startDate || !a.endDate) notFound();
  const project = a.project;
  const period = { startDate: a.startDate, endDate: a.endDate };
  const { can, canManagePeople, canDelete } = await actionCtx(a.id, me);

  // L'année affichée : celle demandée si la période la couvre, sinon l'année en cours, sinon la première.
  const years = yearsOf(period);
  const thisYear = dayjs().year();
  const all = annee === "tout";
  const asked = Number(annee);
  const year = all ? null : years.includes(asked) ? asked : years.includes(thisYear) ? thisYear : years[0];
  const refYear = year ?? (years.includes(thisYear) ? thisYear : years[0]);
  const covered = project.editions.filter((e) => runsIn(period, e.year));
  // Retour vers l'année affichée ; sans elle (période hors des années ouvertes), la première année couverte, sinon le projet.
  const edition = covered.find((e) => e.year === refYear) ?? covered[0] ?? null;
  const backHref = edition ? `/edition/${edition.id}?onglet=actions` : `/projets/${project.id}`;
  const backLabel = edition ? `${project.name} · ${edition.year}` : project.name;

  const teamIds = [...new Set([...covered.flatMap((e) => e.team.map((t) => t.personId)), ...(a.ownerId ? [a.ownerId] : []), ...a.people.map((p) => p.personId)])];
  const outside = !isTransversal(me) && !inMyScope(me, project, teamIds);

  // Heures saisies sur l'action, par personne, sur l'année choisie ou toute la période. Le détail d'une personne suit la
  // visibilité du temps (canSeeTimeOf, comme l'onglet Temps) ; le total de l'action, lui, est déjà public dans l'onglet.
  const hours = await prisma.timeEntry.groupBy({
    by: ["personId"],
    where: { actionId: a.id, ...(year ? { date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } } : {}) },
    _sum: { hours: true },
  });
  const totalHours = hours.reduce((s, h) => s + (h._sum.hours ?? 0), 0);
  // Noms pris dans toutes les personnes (une personne partie garde ses heures) ; visibilité selon son pôle.
  const who = hours.length === 0 ? [] : await prisma.person.findMany({ where: { id: { in: hours.map((h) => h.personId) } }, select: { id: true, name: true, poleId: true } });
  const visible = hours
    .flatMap((h) => { const person = who.find((p) => p.id === h.personId); return person && canSeeTimeOf(me, person, settings.timeVisibility) ? [{ person, hours: h._sum.hours ?? 0 }] : []; })
    .sort((x, y) => y.hours - x.hours);
  const hidden = hours.length - visible.length;

  // Tâches ouvertes : les miennes, et celles des listes que leur auteur partage avec moi (canReadShared, comme « Tâches ») ;
  // une tâche hors liste ou d'une liste privée reste à son auteur (« Privée : elle n'apparaît que dans votre Ma semaine »).
  const tasks = a.tasks.filter((t) => t.personId === me.id || (t.list !== null && canReadShared(me, t.list.person, t.list.visibility)));
  const achievements = a.achievements.filter((x) => year === null || x.edition.year === year);
  const today = dayjs();
  const stateOpts = REF_DEFAULTS.action_state.map((s) => ({ value: s.code, label: refLabel(refs, "action_state", s.code) }));
  const span = year !== null ? spanLabel(period, year) : years.length > 1 ? yearsLabel(period) : null;
  const multi = years.length > 1;
  // Financements (spec actions § 2) : les lignes liées (toutes années), et à lier celles du projet sur les années couvertes.
  // Les montants des lignes sont déjà lisibles dans l'onglet Budget ; rien de plus ne sort ici.
  const lineSelect = { id: true, scheme: true, amountGranted: true, amountRequested: true, funder: { select: { name: true } }, edition: { select: { year: true } }, convention: { select: { reference: true } }, actionFundings: { select: { amount: true } } } as const;
  const [links, freeLines, expenses] = await Promise.all([
    prisma.actionFunding.findMany({ where: { actionId: a.id }, select: { amount: true, fundingLine: { select: lineSelect } } }),
    can ? prisma.fundingLine.findMany({ where: { edition: { projectId: project.id, year: { in: years } }, actionFundings: { none: { actionId: a.id } } }, select: lineSelect }) : Promise.resolve([]),
    prisma.expense.findMany({ where: { actionId: a.id, ...(year ? { edition: { year } } : {}) }, select: { committed: true, spent: true } }),
  ]);
  const lineName = (l: { funder: { name: string }; scheme: string | null; edition: { year: number } }) => `${l.funder.name} · ${l.edition.year}${l.scheme ? ` · ${l.scheme}` : ""}`;
  const fundingLinks: FundingLinkView[] = links
    .map(({ amount, fundingLine: l }) => ({
      lineId: l.id, funder: l.funder.name, scheme: l.scheme, year: l.edition.year, convention: l.convention?.reference ?? null, amount,
      ceiling: l.amountGranted ?? l.amountRequested, ceilingKind: l.amountGranted != null ? "obtenu" as const : l.amountRequested != null ? "demandé" as const : null,
      allocated: l.actionFundings.reduce((s, x) => s + (x.amount ?? 0), 0), over: fundingOverflow(l, l.actionFundings.map((x) => x.amount)),
    }))
    .sort((x, y) => x.year - y.year || x.funder.localeCompare(y.funder));
  const candidates = freeLines.sort((x, y) => x.edition.year - y.edition.year || x.funder.name.localeCompare(y.funder.name)).map((l) => ({ value: l.id, label: lineName(l), hint: l.convention ? `dossier ${l.convention.reference}` : undefined }));
  // Équilibre de l'année affichée (ou de toute la période) : recettes = montants affectés, dépenses de l'action, temps valorisé
  // (module budget) seulement pour qui voit le détail Personnel — une action d'une seule personne en révélerait le salaire.
  const budgetModule = instanceHas(settings, "budget");
  const valued = budgetModule && canSeePersonnelDetail(me) ? await actionTimeCost(a.id, year) : null;
  // Toute la période : les seules lignes des années que la période couvre (un lien d'une année sortie de la période après
  // un raccourcissement reste affiché, mais ne compte pas).
  const bal = balance({ fundings: fundingLinks.filter((l) => (year === null ? years.includes(l.year) : l.year === year)).map((l) => l.amount), expenses, hours: totalHours, hourlyCost: null, timeCost: valued ? valued.amount : null });
  const balanceView: BalanceView = {
    title: year ? `Équilibre ${year}` : "Équilibre sur toute la période",
    income: bal.income, spending: bal.spending, hours: totalHours, gap: bal.gap,
    gapLabel: valued ? "Écart" : "Écart (hors temps)",
    time: !budgetModule ? null : valued
      ? { cost: bal.timeCost, note: valued.unvaluedHours > 0 ? `${fmtNumber(valued.unvaluedHours, 1)} h sans coût connu` : `${fmtNumber(totalHours, 1)} h` }
      : { cost: null, note: "valorisation réservée à la trésorerie et à la validation du budget" },
  };
  const label = (s: string) => <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s}</span>;

  return (
    <div className="p-4 md:p-6" data-testid="action-page">
      <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid="action-back"><ArrowLeft className="size-3" />{backLabel}</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-[420px] items-start gap-3">
          <SectionIcon className="mt-[3px] hidden size-9 shrink-0 place-items-center rounded-md bg-info-soft text-primary sm:grid print:hidden" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ActionName id={a.id} name={a.name} canEdit={can} />
              {can ? (
                <AutoField model="action" id={a.id} field="state" type="select" value={a.state} options={stateOpts} allowEmpty={false} refreshOnSave testId="action-state" label={`État, ${a.name}`} className="w-36" inputClassName="h-7 rounded-sm bg-info-soft py-0.5 text-[11px] font-semibold text-primary" />
              ) : <StatusBadge label={refLabel(refs, "action_state", a.state)} color={refColor(refs, "action_state", a.state)} />}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground" data-testid="action-summary">
              <span>{`${cap(V.projet)} `}<Link href={`/projets/${project.id}`} className="font-semibold text-foreground hover:underline">{project.name}</Link></span>
              <span aria-hidden>·</span>
              <span data-testid="action-span">{`Du ${fmtDate(a.startDate)} au ${fmtDate(a.endDate)}`}{span && <b className="font-semibold text-foreground">{` · ${span}`}</b>}</span>
              {a.recurrence && <><span aria-hidden>·</span><span>{a.recurrence}</span></>}
              <span aria-hidden>·</span>
              <span>Responsable <b className="font-semibold text-foreground">{a.owner?.name ?? "—"}</b></span>
              {a.people.length > 0 && <><span aria-hidden>·</span><span data-testid="action-associates" title="Personnes associées">avec <b className="font-semibold text-foreground">{a.people.map((x) => (x.person.active ? x.person.name : `${x.person.name} (inactive)`)).join(", ")}</b></span></>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {multi && (
            <span className="inline-flex items-center gap-1 rounded-[5px] border bg-card px-1.5 py-1 text-[11px] max-md:text-[13px]" data-testid="action-years">
              {years.map((y) => <YearLink key={y} href={`/action/${a.id}?annee=${y}`} current={year === y}>{y}</YearLink>)}
              <YearLink href={`/action/${a.id}?annee=tout`} current={all}>Toute la période</YearLink>
            </span>
          )}
          {canDelete && <DeleteActionButton actionId={a.id} name={a.name} backHref={backHref} abandonedLabel={refLabel(refs, "action_state", "abandoned")} />}
        </div>
      </div>

      {outside && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2 text-sm" data-testid="outside-scope">
          <Eye className="size-4 text-muted-foreground" />{`${cap(V.projet)} ${du(V.pole)} `}<strong>{project.pole.name}</strong>{`, hors de votre ${V.pole.one} : vous le consultez, vous n'y intervenez pas.`}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-4">
          <Section title="Contenu et public" testId="action-content">
            <div className="grid gap-3">
              <div className="grid gap-0.5">{label("Contenu")}<AutoField model="action" id={a.id} field="description" type="textarea" rows={3} value={a.description} readOnly={!can} placeholder="Thème, déroulé…" label="Contenu" testId="action-description" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-0.5">{label("Public, bénéficiaires")}<AutoField model="action" id={a.id} field="audience" type="textarea" rows={2} value={a.audience} readOnly={!can} placeholder="Qui en bénéficie ?" label="Public, bénéficiaires" testId="action-audience" /></div>
                <div className="grid gap-0.5">{label("Récurrence")}<AutoField model="action" id={a.id} field="recurrence" type="text" value={a.recurrence} readOnly={!can} refreshOnSave placeholder="12 ateliers de 3,5 h par an…" label="Récurrence" testId="action-recurrence" /></div>
              </div>
            </div>
          </Section>

          <Section title="Ce qui est confié" description={`Ce que la personne responsable porte, et jusqu'où elle décide seule.`} testId="action-entrusted">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-0.5">{label("Ce qui est confié")}<AutoField model="action" id={a.id} field="entrusted" type="textarea" rows={3} value={a.entrusted} readOnly={!can} placeholder="Le résultat attendu, les livrables…" label="Ce qui est confié" testId="action-entrusted-field" /></div>
              <div className="grid gap-0.5">{label("Marge de décision")}<AutoField model="action" id={a.id} field="latitude" type="textarea" rows={3} value={a.latitude} readOnly={!can} placeholder="Ce qui se décide sans en référer…" label="Marge de décision" testId="action-latitude" /></div>
            </div>
          </Section>

          <Section title="Jalons" description={`Les dates qui rythment ${ce(V.action)} ; un jalon hors de la période l'étend.`} testId="action-milestones">
            <Milestones actionId={a.id} readOnly={!can} items={a.milestones.map((m) => ({ id: m.id, date: fmtDateInput(m.date), label: m.label, done: m.done, venue: m.venue, participants: m.participants, isPublic: m.isPublic, isCheckpoint: m.isCheckpoint, late: !m.done && a.state !== "done" && a.state !== "abandoned" && dayjs(m.date).isBefore(today, "day") }))} />
          </Section>

          <Section title="Financements et équilibre" description={`Les lignes qui financent ${ce(V.action)}, avec le montant affecté ; lier une ligne d'un dossier pluriannuel lie ses autres années couvertes.`} testId="action-fundings">
            <Fundings actionId={a.id} canEdit={can} links={fundingLinks} candidates={candidates} balance={balanceView} />
          </Section>

          <Section title="Tâches" description={`Les tâches en cours rattachées à ${ce(V.action)} : les vôtres, et celles des listes partagées avec vous.`} testId="action-tasks"
            actions={edition ? <CreateTaskButton editionId={edition.id} actions={[{ id: a.id, name: a.name }]} actionId={a.id} /> : undefined}>
            {tasks.length === 0 ? <p className="text-sm text-muted-foreground">Aucune tâche en cours.</p> : (
              <ul className="divide-y text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                    <span className="min-w-0 flex-1">{t.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.person.name}{t.dueDate ? ` · ${fmtDate(t.dueDate, "D MMM")}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Section title="Période et personnes" testId="action-frame">
            <div className="grid gap-4">
              <div className="grid gap-0.5">{label("Responsable")}<AutoField model="action" id={a.id} field="ownerId" type="select" value={a.ownerId} options={people.map((p) => ({ value: p.id, label: p.name }))} readOnly={!canManagePeople} refreshOnSave placeholder="—" label="Responsable" testId="action-owner" /></div>
              <div className="grid gap-1" data-testid="action-period">
                {label("Période")}
                {!can && <p className="px-2 text-sm">{`Du ${fmtDate(a.startDate)} au ${fmtDate(a.endDate)}`}</p>}
                <PeriodForm actionId={a.id} start={fmtDateInput(a.startDate)} end={fmtDateInput(a.endDate)} readOnly={!can} />
              </div>
              <div data-testid="action-people">
                <PeopleSection actionId={a.id} people={people.filter((p) => p.id !== a.ownerId).map((p) => ({ id: p.id, name: p.name }))} associates={a.people.map((x) => x.person)} canEdit={canManagePeople} />
              </div>
            </div>
          </Section>

          <Section title="Heures" description={year ? `Saisies sur ${ce(V.action)} en ${year}.` : "Saisies sur toute la période."} testId="action-hours">
            <div className="mb-3 flex items-center gap-3">
              <div className="shrink-0"><div className="text-xl font-bold tabular" data-testid="action-hours-total">{fmtNumber(totalHours, 1)} h</div><div className="text-[11px] text-muted-foreground">{a.timeTarget ? `sur ${fmtNumber(a.timeTarget, 1)} h prévues` : "objectif non fixé"}</div></div>
              <Gauge value={totalHours} max={a.timeTarget} alertPercent={90} className="min-w-0 flex-1" />
            </div>
            <div className="mb-3 grid gap-0.5">{label("Objectif en heures")}<AutoField model="action" id={a.id} field="timeTarget" type="number" value={a.timeTarget} suffix="h" readOnly={!can} refreshOnSave placeholder="non fixé" label="Objectif en heures" testId="action-target" className="w-32" /></div>
            {visible.length === 0 && hidden === 0 ? <p className="text-sm text-muted-foreground">Aucune heure saisie.</p> : (
              <ul className="divide-y text-sm">
                {visible.map((h) => <li key={h.person.id} className="flex items-center justify-between gap-2 py-1"><span>{h.person.name}</span><b className="tabular">{fmtNumber(h.hours, 1)} h</b></li>)}
                {hidden > 0 && <li className="py-1 text-xs text-muted-foreground">{hidden} {hidden > 1 ? "autres personnes" : "autre personne"} : détail non visible.</li>}
              </ul>
            )}
          </Section>

          <Section title="Réalisations" description={year ? `Consignées en ${year}.` : "Sur toute la période."} testId="action-achievements">
            {achievements.length === 0 ? <p className="text-sm text-muted-foreground">{`Aucune : consignez-les dans l'onglet ${cap(pl(V.action))} ${du(V.edition)}, en liant ${ce(V.action)}.`}</p> : (
              <ul className="divide-y text-sm">
                {achievements.map((x) => <li key={x.id} className="py-1"><span className="text-muted-foreground">{fmtDate(x.date, year ? "D MMM" : "D MMM YYYY")} · </span>{x.value != null ? <b className="tabular">{x.value}{x.unit ? ` ${x.unit}` : ""} · </b> : null}{x.label}</li>)}
              </ul>
            )}
          </Section>

          <Section title="Indicateurs" description={`Ceux rattachés à ${ce(V.action)}.`} testId="action-indicators">
            {a.indicators.length === 0 ? <p className="text-sm text-muted-foreground">{`Aucun indicateur rattaché à ${ce(V.action)}.`}</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="py-1">Indicateur</th><th className="w-20 py-1 text-right">Cible</th><th className="w-20 py-1 text-right">Réalisé</th></tr></thead>
                <tbody className="divide-y">
                  {a.indicators.map((i) => <tr key={i.id}><td className="py-1">{i.label}{multi && <span className="text-xs text-muted-foreground">{` · ${i.edition.year}`}</span>}</td><td className="py-1 text-right tabular">{i.target ?? "—"}</td><td className={cn("py-1 text-right tabular font-medium", !i.actual && "text-muted-foreground")}>{i.actual ?? "—"}</td></tr>)}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function YearLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={current ? "page" : undefined} className={cn("inline-flex items-center rounded-sm px-1.5 py-0.5 max-md:min-h-11 max-md:px-2.5", current ? "bg-primary font-semibold text-white" : "text-muted-foreground hover:bg-muted")}>{children}</Link>;
}
