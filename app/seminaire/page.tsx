import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { refColor, refLabel } from "@/lib/refs";
import { dayjs, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BatchForm } from "./batch-form";

// Séminaire : création en série des éditions N+1 puis contrôle de charge (EF-A5, EF-B3b, EF-H4).
export default async function SeminairePage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const sp = await searchParams;
  const target = Number(sp.annee) || dayjs().year() + 1;
  const [me, refs] = await Promise.all([getCurrentPerson(), getRefs()]);
  const codir = ["director", "raf", "pole_lead"].includes(me.role);
  const projects = await prisma.project.findMany({
    include: { pole: true, pilot: true, editions: { orderBy: { year: "desc" } } },
    orderBy: [{ pole: { name: "asc" } }, { name: "asc" }],
  });
  const rows = projects.map((p) => {
    const next = p.editions.find((e) => e.year === target);
    const source = p.editions.find((e) => e.year === target - 1) ?? p.editions.find((e) => e.year < target);
    return { project: p, next, source };
  });
  const people = await prisma.person.findMany({
    where: { active: true },
    include: { pole: true, personDays: { where: { edition: { year: target } }, include: { edition: { include: { project: true } } } } },
    orderBy: [{ pole: { name: "asc" } }, { order: "asc" }],
  });
  const load = people.map((p) => ({ p, planned: p.personDays.reduce((s, d) => s + d.plannedDays, 0), sold: p.personDays.reduce((s, d) => s + d.soldDays, 0) })).filter((x) => x.planned > 0 || x.sold > 0 || x.p.role !== "assistant");
  const over = load.filter((x) => x.planned > x.p.availableDays);
  const canDays = ["raf", "director", "pole_lead"].includes(me.role);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title={`Séminaire · éditions ${target}`} subtitle={`${rows.filter((r) => r.next).length} sur ${rows.length} projets ont déjà leur édition ${target}. Décidez pour chaque projet, créez en lot, puis vérifiez la charge par personne.`} />

      <Section title="1 · Décisions par projet" description="Reconduire copie l'édition précédente (couches 1 à 3, actions, financements, équipe). Ajuster fait pareil et marque l'édition « re-challengée ». Arrêter ne crée rien." className="mb-4">
        <BatchForm
          year={target}
          canRun={codir}
          rows={rows.map((r) => ({
            projectId: r.project.id, name: r.project.name, pole: r.project.pole.name, pilot: r.project.pilot.name,
            sourceId: r.source?.id ?? null, sourceYear: r.source?.year ?? null, sourceStatus: r.source ? refLabel(refs, "edition_status", r.source.status) : null,
            nextId: r.next?.id ?? null, nextStatus: r.next ? refLabel(refs, "edition_status", r.next.status) : null, nextColor: r.next ? refColor(refs, "edition_status", r.next.status) : null,
            decision: r.source?.codirDecision ?? null,
          }))}
        />
      </Section>

      <Section title="2 · Contrôle de charge" description={`Charge planifiée ${target} (jours prévus, toutes éditions) contre les jours disponibles ; les jours conventionnés sont une référence de financement, pas une charge — 20 jours cofinancés restent 20 jours. ${over.length ? `${over.length} personne${over.length > 1 ? "s" : ""} en dépassement.` : "Personne en dépassement."} Le détail mois par mois est dans le plan de charge.`} testId="load-control">
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <table className="w-full text-sm" data-testid="load-table">
            <thead className="text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="py-1.5">Personne</th><th className="py-1.5 text-right">Prévus</th><th className="py-1.5 text-right" title="Référence financeur">Conv.</th><th className="py-1.5 text-right">Dispo.</th><th className="py-1.5 pl-3">Charge</th></tr>
            </thead>
            <tbody className="divide-y">
              {load.map(({ p, planned, sold }) => {
                const pct = p.availableDays ? Math.round((planned / p.availableDays) * 100) : 0;
                const isOver = planned > p.availableDays;
                return (
                  <tr key={p.id} className={cn(isOver && "bg-danger-soft/40")} data-testid={`load-row-${p.id}`}>
                    <td className="py-1.5"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.pole?.name ?? "transversal"}</div></td>
                    <td className={cn("py-1.5 text-right tabular", isOver && "font-semibold text-danger")}>{fmtNumber(planned, 0)} j</td>
                    <td className="py-1.5 text-right tabular text-muted-foreground">{fmtNumber(sold, 0)} j</td>
                    <td className="py-1.5 text-right tabular text-muted-foreground">{p.availableDays ? `${p.availableDays} j` : "non renseigné"}</td>
                    <td className="py-1.5 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", isOver ? "bg-danger" : pct >= 90 ? "bg-warning" : "bg-mint")} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                        <span className={cn("text-xs tabular", isOver ? "text-danger" : "text-muted-foreground")}>{pct} %</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div>
            <div className="mb-2 text-[10px] font-semibold text-muted-foreground">Détail par édition · prévus / conventionnés {canDays ? "(modifiable)" : "(saisi par la RAF et les responsables de pôle)"}</div>
            <div className="max-h-[520px] overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {people.flatMap(({ personDays, ...p }) =>
                    personDays.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/30">
                        <td className="px-3 py-1 text-muted-foreground">{p.name}</td>
                        <td className="px-3 py-1"><Link href={`/edition/${d.editionId}`} className="hover:underline">{d.edition.project.name}</Link> <StatusBadge label={refLabel(refs, "edition_status", d.edition.status)} color={refColor(refs, "edition_status", d.edition.status)} className="ml-1" /></td>
                        <td className="w-24 px-2 py-1" title="Jours prévus (charge)"><AutoField model="editionPersonDays" id={d.id} field="plannedDays" type="number" value={d.plannedDays} readOnly={!canDays} suffix="j" refreshOnSave /></td>
                        <td className="w-24 px-2 py-1 text-muted-foreground" title="Jours conventionnés (référence)"><AutoField model="editionPersonDays" id={d.id} field="soldDays" type="number" value={d.soldDays} readOnly={!canDays} suffix="j" refreshOnSave /></td>
                      </tr>
                    )),
                  )}
                  {people.every((p) => p.personDays.length === 0) && <tr><td className="px-3 py-3 text-muted-foreground">Aucune édition {target} : créez-les à l'étape 1.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
