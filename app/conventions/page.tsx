import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { canEditFunding } from "@/lib/rights";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { allocationOf } from "@/lib/conventions";
import { daysFromNow, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateConventionForm } from "./create-form";

// Conventions partagées (EF-C3) : une FSE 2026-2028 ou une CPO existe une fois ; les éditions y sont affectées.
export default async function ConventionsPage() {
  const [me, refs, funders, conventions] = await Promise.all([
    getCurrentPerson(), getRefs(), prisma.funder.findMany({ orderBy: { name: "asc" } }),
    prisma.convention.findMany({ include: { funder: true, lines: { include: { edition: { include: { project: true } }, deliverables: { where: { done: false }, orderBy: { dueDate: "asc" } } } } }, orderBy: [{ endYear: "desc" }, { reference: "asc" }] }),
  ]);
  const rw = canEditFunding(me.role);
  const statusOpts = REF_DEFAULTS.funding_status.map((s) => ({ value: s.code, label: refLabel(refs, "funding_status", s.code) }));
  const multi = conventions.filter((c) => c.endYear > c.startYear || c.lines.length > 1);
  const annual = conventions.filter((c) => !multi.includes(c));

  const Card = ({ c }: { c: (typeof conventions)[number] }) => {
    const a = allocationOf(c);
    const next = c.lines.flatMap((l) => l.deliverables.map((d) => ({ d, l }))).sort((x, y) => x.d.dueDate.getTime() - y.d.dueDate.getTime())[0];
    return (
      <div className="rounded-xl border bg-card p-3" data-testid={`convention-${c.reference}`}>
        <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr]">
          <div><div className="text-[11px] text-muted-foreground">Financeur · référence</div><div className="font-semibold">{c.funder.name}</div><AutoField model="convention" id={c.id} field="reference" type="text" value={c.reference} readOnly={!rw} inputClassName="font-mono text-xs" /></div>
          <div><div className="text-[11px] text-muted-foreground">Dispositif</div><AutoField model="convention" id={c.id} field="scheme" type="text" value={c.scheme} readOnly={!rw} placeholder="—" /></div>
          <div><div className="text-[11px] text-muted-foreground">Période</div><div className="flex items-center gap-1"><AutoField model="convention" id={c.id} field="startYear" type="number" value={c.startYear} readOnly={!rw} refreshOnSave /><span>→</span><AutoField model="convention" id={c.id} field="endYear" type="number" value={c.endYear} readOnly={!rw} refreshOnSave /></div></div>
          <div><div className="text-[11px] text-muted-foreground">Statut</div>{rw ? <AutoField model="convention" id={c.id} field="status" type="select" value={c.status} options={statusOpts} allowEmpty={false} /> : <div className="py-1"><StatusBadge label={refLabel(refs, "funding_status", c.status)} color={refColor(refs, "funding_status", c.status)} /></div>}</div>
          <div><div className="text-[11px] text-muted-foreground">Demandé</div><AutoField model="convention" id={c.id} field="amountRequested" type="number" value={c.amountRequested} readOnly={!rw} suffix="€" /></div>
          <div><div className="text-[11px] text-muted-foreground">Notifié</div><AutoField model="convention" id={c.id} field="amountNotified" type="number" value={c.amountNotified} readOnly={!rw} suffix="€" refreshOnSave testId={`notified-${c.reference}`} /></div>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_1fr_2fr]">
          <div><div className="text-[11px] text-muted-foreground">Dépôt · notification · signature</div><div className="flex gap-1"><AutoField model="convention" id={c.id} field="submittedAt" type="date" value={c.submittedAt} readOnly={!rw} /><AutoField model="convention" id={c.id} field="notifiedAt" type="date" value={c.notifiedAt} readOnly={!rw} /><AutoField model="convention" id={c.id} field="signedAt" type="date" value={c.signedAt} readOnly={!rw} /></div></div>
          <div>
            <div className="text-[11px] text-muted-foreground">Affecté aux éditions</div>
            <div className={cn("py-1 text-sm tabular", a.over && "font-semibold text-danger")} data-testid={`allocated-${c.reference}`}>{fmtEuro(a.granted)}{a.ceiling !== null && <span className="text-muted-foreground"> / {fmtEuro(a.ceiling)}</span>}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Reste à affecter</div>
            <div className={cn("py-1 text-sm font-medium tabular", a.remaining !== null && a.remaining < 0 ? "text-danger" : "text-mint")}>{a.remaining === null ? "montant notifié inconnu" : a.remaining < 0 ? `dépassement ${fmtEuro(-a.remaining)}` : fmtEuro(a.remaining)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Éditions couvertes · prochaine obligation</div>
            <div className="flex flex-wrap items-center gap-1 py-1 text-sm">
              {c.lines.length === 0 && <span className="text-muted-foreground">aucune — rattachez-la depuis l'onglet Financements d'une édition</span>}
              {c.lines.map((l) => <Link key={l.id} href={`/edition/${l.editionId}?onglet=financements`} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-primary hover:underline" title={`${fmtEuro(l.amountGranted)} obtenus`}>{l.edition.project.name} · {l.edition.year}</Link>)}
              {next && <span className={cn("ml-1 text-xs", daysFromNow(next.d.dueDate) < 0 ? "text-danger" : "text-[#8a5a00]")}>· {next.d.label} le {fmtDate(next.d.dueDate)} ({next.l.edition.project.name})</span>}
            </div>
          </div>
        </div>
        <div className="mt-2"><AutoField model="convention" id={c.id} field="notes" type="textarea" rows={1} value={c.notes} readOnly={!rw} placeholder="Notes : conditions, avenants, clés de répartition (référence à l'Excel RAF)…" /></div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <PageHeader title="Conventions" subtitle="Une convention existe une fois, même sur plusieurs années et plusieurs projets ; les éditions y sont affectées et la somme des affectations ne dépasse pas le montant notifié. Les clés de répartition restent dans l'Excel de la RAF." actions={rw ? <CreateConventionForm funders={funders.map((f) => ({ value: f.id, label: f.name }))} /> : undefined} />
      <Section title="Pluriannuelles ou partagées" description="FSE, CPO, dispositifs couvrant plusieurs éditions." className="mb-4" testId="conventions-shared">
        {multi.length === 0 ? <EmptyState title="Aucune convention partagée" hint="Créez-la ici (RAF), puis rattachez-y les éditions depuis leur onglet Financements." /> : <div className="grid gap-3">{multi.map((c) => <Card key={c.id} c={c} />)}</div>}
      </Section>
      <Section title="Annuelles" description="Une édition, une année.">
        {annual.length === 0 ? <p className="text-sm text-muted-foreground">Aucune. Les financements annuels vivent sur les lignes de chaque édition ; on les élève en convention quand ils deviennent pluriannuels.</p> : <div className="grid gap-3">{annual.map((c) => <Card key={c.id} c={c} />)}</div>}
      </Section>
    </div>
  );
}
