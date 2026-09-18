import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { refColor, refLabel } from "@/lib/refs";
import { fmtEuro } from "@/lib/format";
import { AddSimpleForm, ProjectPolesPicker } from "@/app/admin/forms";
import { PROJECT_STATES, projectState } from "@/lib/projects";
import { SectionIcon } from "@/components/shell/section-icon";
import { cn } from "@/lib/utils";

// Fiche projet (lot 1 du 19/09, retour de Gaël) : le projet est ce qui dure — un programme de dix ans a des éditions chaque
// année, financées différemment. Ici : raison d'être, pôle, pilote, garant, code ; puis ses éditions, ses financements, son équipe.
export default async function ProjetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, refs] = await Promise.all([getCurrentPerson(), getRefs()]);
  const rw = canAdmin(me);
  const p = await prisma.project.findUnique({ where: { id }, include: {
    pole: true, pilot: true, guarantor: true, mission: true, secondaryPoles: { include: { pole: true } },
    editions: { orderBy: { year: "desc" }, include: { team: { include: { person: true } }, fundingLines: { include: { funder: { select: { id: true, name: true } } } }, _count: { select: { actions: true } } } },
  } });
  if (!p) notFound();
  const [people, poles, missions] = await Promise.all([
    prisma.person.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.pole.findMany({ orderBy: { name: "asc" } }),
    prisma.mission.findMany({ orderBy: { order: "asc" } }),
  ]);
  const opt = (arr: { id: string; name: string }[]) => arr.map((x) => ({ value: x.id, label: x.name }));
  const state = projectState(p);
  const st = PROJECT_STATES[state];
  const team = Array.from(new Map([[p.pilot.id, { person: p.pilot, roles: new Set(["pilote"]) }], ...(p.guarantor ? [[p.guarantor.id, { person: p.guarantor, roles: new Set(["garant"]) }] as const] : [])]).entries());
  const teamMap = new Map(team);
  for (const e of p.editions) for (const t of e.team) { const cur = teamMap.get(t.personId) ?? { person: t.person, roles: new Set<string>() }; cur.roles.add(`équipe ${e.year}`); teamMap.set(t.personId, cur); }
  const lines = p.editions.flatMap((e) => e.fundingLines.map((l) => ({ ...l, year: e.year, editionId: e.id })));
  const F = ({ field, label, type = "text", value, options, allowEmpty, refresh }: { field: string; label: string; type?: "text" | "select" | "bool"; value: unknown; options?: { value: string; label: string }[]; allowEmpty?: boolean; refresh?: boolean }) => (
    <label className="grid gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><AutoField model="project" id={p.id} field={field} type={type} value={value as string | boolean | null} options={options} allowEmpty={allowEmpty} readOnly={!rw} label={label} refreshOnSave={refresh} testId={`project-${field}`} /></label>
  );
  return (
    <div className="p-4 md:p-6" data-testid="project-page" data-state={state}>
      <Link href="/projets" className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ArrowLeft className="size-3" />Tous les projets</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SectionIcon />
            {rw ? <AutoField model="project" id={p.id} field="name" type="text" value={p.name} inputClassName="text-[25px] font-bold leading-tight tracking-[-0.7px]" className="min-w-[280px]" label="Nom du projet" testId="project-name" /> : <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px]">{p.name}</h1>}
            <StatusBadge label={st.label} color={st.color} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground" data-testid="project-summary"><span className="font-mono">{p.analyticCode}</span> · {p.pole.name}{p.secondaryPoles.length ? ` (+ ${p.secondaryPoles.map((s) => s.pole.name).join(", ")})` : ""} · pilote {p.pilot.name} · {p.editions.length} édition{p.editions.length > 1 ? "s" : ""}{p.recurring ? " · récurrent" : ""}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-4">
          <Section title="Éditions" description="Une édition par année : sa fiche, ses actions, son budget. C'est là qu'on travaille." actions={rw ? <AddSimpleForm kind="edition" projectId={p.id} placeholder="Année" compact /> : undefined} testId="project-editions">
            {p.editions.length === 0 ? <p className="text-sm text-muted-foreground">Aucune édition encore.</p> : (
              <table className="w-full text-[13px]">
                <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="py-1.5 pr-2">Année</th><th className="py-1.5 pr-2">Statut</th><th className="py-1.5 pr-3 text-right">Enveloppe</th><th className="py-1.5 pr-3 text-right">Actions</th><th className="py-1.5">Équipe</th></tr></thead>
                <tbody className="divide-y">
                  {p.editions.map((e) => (
                    <tr key={e.id} data-testid={`project-edition-${e.year}`}>
                      <td className="py-1.5"><Link href={`/edition/${e.id}`} className="font-medium text-primary hover:underline">{e.year}</Link></td>
                      <td className="py-1.5"><StatusBadge label={refLabel(refs, "edition_status", e.status)} color={refColor(refs, "edition_status", e.status)} /></td>
                      <td className="py-1.5 pr-3 text-right tabular text-xs">{e.directExpenseEnvelope != null ? fmtEuro(e.directExpenseEnvelope) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-1.5 pr-3 text-right text-xs">{e._count.actions}</td>
                      <td className="py-1.5 text-xs text-muted-foreground">{e.team.map((t) => t.person.name).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
          <Section title="Financements" description="Les lignes de financement de chaque édition — qui finance quoi, année par année. Le détail et les versements sont sur l'édition (onglet Budget)." testId="project-fundings">
            {lines.length === 0 ? <p className="text-sm text-muted-foreground">Aucun financement rattaché.</p> : (
              <table className="w-full text-[13px]">
                <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="py-1.5">Année</th><th className="py-1.5">Financeur</th><th className="py-1.5">Dispositif</th><th className="py-1.5">Statut</th><th className="py-1.5 text-right">Demandé</th><th className="py-1.5 text-right">Obtenu</th></tr></thead>
                <tbody className="divide-y">
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-1.5"><Link href={`/edition/${l.editionId}?onglet=budget`} className="text-primary hover:underline">{l.year}</Link></td>
                      <td className="py-1.5"><Link href={`/financeurs/${l.funder.id}`} className="hover:underline">{l.funder.name}</Link></td>
                      <td className="py-1.5 text-xs text-muted-foreground">{l.scheme ?? "—"}</td>
                      <td className="py-1.5"><StatusBadge label={refLabel(refs, "funding_status", l.status)} color={refColor(refs, "funding_status", l.status)} /></td>
                      <td className="py-1.5 text-right tabular text-xs">{l.amountRequested != null ? fmtEuro(l.amountRequested) : "—"}</td>
                      <td className="py-1.5 text-right tabular text-xs">{l.amountGranted != null ? fmtEuro(l.amountGranted) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
        <div className="grid content-start gap-4">
          <Section title="Identité" description="Ce qui ne change pas d'une année à l'autre. Modifiable par la direction et la RAF." testId="project-identity">
            <div className="grid gap-3">
              {F({ field: "missionId", label: "Raison d'être (mission du plan opérationnel)", type: "select", value: p.missionId, options: opt(missions), allowEmpty: false })}
              {F({ field: "strategicAxis", label: "Axe stratégique", value: p.strategicAxis })}
              {F({ field: "poleId", label: "Pôle principal", type: "select", value: p.poleId, options: opt(poles), allowEmpty: false, refresh: true })}
              <div className="grid gap-0.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pôles associés (projet commun)</span><ProjectPolesPicker projectId={p.id} mainPoleId={p.poleId} poles={opt(poles)} selected={p.secondaryPoles.map((x) => x.poleId)} readOnly={!rw} /></div>
              {F({ field: "pilotId", label: "Pilote", type: "select", value: p.pilotId, options: opt(people), allowEmpty: false })}
              {F({ field: "guarantorId", label: "Garant (responsable de pôle)", type: "select", value: p.guarantorId, options: opt(people) })}
              {F({ field: "analyticCode", label: "Code analytique", value: p.analyticCode })}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-xs"><AutoField model="project" id={p.id} field="recurring" type="bool" value={p.recurring} readOnly={!rw} label="Récurrent" testId="project-recurring" />Récurrent (une édition par an)</label>
                <label className={cn("flex items-center gap-2 text-xs", p.archived && "text-muted-foreground")}><AutoField model="project" id={p.id} field="archived" type="bool" value={p.archived} readOnly={!rw} label="Archivé" refreshOnSave testId="project-archived" />Archivé</label>
              </div>
            </div>
          </Section>
          <Section title="Équipe" description="Le pilote, le garant, et les personnes des équipes d'édition." testId="project-team">
            <ul className="grid gap-1 text-sm">
              {Array.from(teamMap.values()).map(({ person, roles }) => <li key={person.id} className="flex items-center justify-between gap-2"><span>{person.name}</span><span className="text-[11px] text-muted-foreground">{Array.from(roles).join(" · ")}</span></li>)}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
