import Link from "next/link";
import { listFunders } from "@/lib/organisations";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DossiersNav } from "@/components/common/dossiers-nav";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { canEditCalls, canEditFunding, isCodir } from "@/lib/rights";
import { instanceHas } from "@/lib/modules";
import { deadlineState, isNewCall, sortCalls } from "@/lib/calls";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddCallDialog, CallFilters, CallRowActions, CallStatusSelect } from "./controls";

type Search = { financeur?: string; statut?: string; vue?: string };

// Appels à projets (lot B, module « veille ») : ce que la CRESS a repéré chez ses financeurs, l'échéance calculée, le statut
// d'équipe posé en CODIR, et « Étudier » qui ouvre une convention à déposer. Saisie manuelle ; un flux importé viendra plus tard
// et ne touchera jamais le statut d'équipe.
export default async function AppelsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [settings, me, sp] = await Promise.all([getSettings(), getCurrentPerson(), searchParams]);
  if (!instanceHas(settings, "veille")) notFound();
  const [funders, all, people] = await Promise.all([
    listFunders(),
    prisma.call.findMany({ include: { funder: true, convention: { select: { id: true, reference: true, status: true } } } }),
    prisma.person.findMany({ select: { id: true, name: true } }),
  ]);
  const rw = canEditCalls(me);
  const codir = isCodir(me);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  let rows = sortCalls(all, settings.deliverableAlertDays);
  if (!sp.vue) rows = rows.filter((c) => c.active && c.teamStatus !== "dismissed");
  if (sp.financeur) rows = rows.filter((c) => c.funderId === sp.financeur);
  if (sp.statut) rows = rows.filter((c) => (sp.statut === "none" ? !c.teamStatus : c.teamStatus === sp.statut));
  const active = all.filter((c) => c.active);
  const toStudy = active.filter((c) => !c.teamStatus || c.teamStatus === "study").length;
  const applying = active.filter((c) => c.teamStatus === "apply" && !c.conventionId).length;
  const soon = active.filter((c) => c.teamStatus !== "dismissed" && deadlineState(c, settings.deliverableAlertDays).key === "soon").length;

  return (
    <div className="p-4 md:p-6">
      <DossiersNav current="appels" />
      <PageHeader
        title="Appels à projets"
        subtitle={<>{active.length} appel{active.length > 1 ? "s" : ""} en veille · {toStudy} à regarder ou à étudier · {applying} « on dépose » sans convention encore{soon > 0 && <span className="text-warning-foreground"> · {soon} à échéance dans les {settings.deliverableAlertDays} j</span>}. Le CODIR pose le statut ; « Étudier » crée la convention à déposer, pré-remplie, une seule fois.</>}
        actions={rw ? <AddCallDialog funders={funders.map((f) => ({ value: f.id, label: f.name }))} defaultFunderId={sp.financeur} /> : undefined}
      />
      <CallFilters funders={funders.map((f) => ({ value: f.id, label: f.name }))} current={{ financeur: sp.financeur ?? "", statut: sp.statut ?? "", vue: sp.vue ?? "" }} />

      {rows.length === 0 ? (
        <EmptyState title={all.length === 0 ? "Aucun appel repéré" : "Aucun appel pour ces filtres"} hint={all.length === 0 ? "La RAF, la direction ou un responsable de pôle repère un appel ; le CODIR décide ensuite." : "Changez le filtre ou la vue pour retrouver les appels écartés et retirés."} />
      ) : (
        <div className="overflow-auto rounded-md border bg-card" tabIndex={0} aria-label={`Tableau des ${rows.length} appels à projets`}>
          <table className="w-full text-[13px]" style={{ minWidth: 1040 }} data-testid="calls-table">
            <thead className="sticky top-0 z-[2] bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Financeur · appel</th>
                <th className="px-3 py-2.5">Échéance</th>
                <th className="px-3 py-2.5">Montant indicatif</th>
                <th className="px-3 py-2.5">Statut d&apos;équipe</th>
                <th className="px-3 py-2.5">Suite</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const st = deadlineState(c, settings.deliverableAlertDays);
                const fresh = isNewCall(c);
                return (
                  <tr key={c.id} className={cn("border-t border-[#e3e9eb] align-top hover:bg-[#f8f9f3]", (!c.active || c.teamStatus === "dismissed") && "text-muted-foreground")} data-testid={`call-${c.id}`} data-label={c.label} data-status={c.teamStatus ?? ""}>
                    <td className={cn("min-w-[360px] px-3 py-3", st.key === "soon" && c.teamStatus === "apply" ? "border-l-[3px] border-l-warning" : "border-l-[3px] border-l-transparent")}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/financeurs/${c.funderId}`} className="text-[11px] font-semibold text-primary hover:underline">{c.funder.name}</Link>
                        {fresh && <StatusBadge label="Nouveau" color="coral" dot={false} />}
                        {!c.active && <StatusBadge label="Retiré" color="muted" dot={false} />}
                      </div>
                      <div className="mt-0.5 min-w-0">{rw ? <AutoField model="call" id={c.id} field="label" type="text" value={c.label} inputClassName="font-semibold" label={`Intitulé de l'appel ${c.label}`} /> : <span className="block font-semibold">{c.label}</span>}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                        {rw ? <span className="min-w-[160px] flex-1"><AutoField model="call" id={c.id} field="scheme" type="text" value={c.scheme} placeholder="dispositif, axe…" label={`Dispositif de l'appel ${c.label}`} /></span> : c.scheme && <span>{c.scheme}</span>}
                        {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline"><ExternalLink className="size-3" />l&apos;appel</a>}
                        {c.recurring && <span title="Revient chaque année">↻ annuel</span>}
                      </div>
                    </td>
                    <td className="min-w-[170px] px-3 py-3">
                      <StatusBadge label={st.label} color={st.tone} dot={st.key !== "open"} />
                      {rw && !c.rolling && <div className="mt-1 w-36"><AutoField model="call" id={c.id} field="deadline" type="date" value={c.deadline} label={`Date limite de l'appel ${c.label}`} /></div>}
                      {!rw && c.deadline && <div className="mt-1 text-[11px] text-muted-foreground">{fmtDate(c.deadline)}</div>}
                    </td>
                    <td className="min-w-[190px] px-3 py-3 text-xs">{rw ? <AutoField model="call" id={c.id} field="amountHint" type="text" value={c.amountHint} placeholder="—" label={`Montant indicatif de l'appel ${c.label}`} /> : c.amountHint ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="min-w-[170px] px-3 py-3">
                      <CallStatusSelect id={c.id} value={c.teamStatus} readOnly={!codir} />
                      {c.statusAt && <div className="mt-1 text-[10px] text-muted-foreground">{nameOf.get(c.statusById ?? "") ?? "—"} · {fmtDate(c.statusAt)}</div>}
                    </td>
                    <td className="min-w-[150px] px-3 py-3 text-xs">
                      {c.convention ? (
                        <><StatusBadge label="Convention créée" color="mint" /><div className="mt-1"><Link href={`/conventions/${c.convention.id}`} className="font-mono text-[10px] text-primary hover:underline" data-testid={`call-convention-${c.id}`}>{c.convention.reference}</Link></div></>
                      ) : c.teamStatus === "apply" ? <span className="text-warning-foreground">à déposer : cliquez « Étudier »</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <CallRowActions id={c.id} label={c.label} canPromote={canEditFunding(me)} canSpot={rw} promoted={!!c.conventionId} recurringClosed={c.recurring && st.key === "closed"} active={c.active} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2.5 text-[10px] text-muted-foreground">{rows.length} appel{rows.length > 1 ? "s" : ""} affiché{rows.length > 1 ? "s" : ""} sur {all.length} · un appel écarté ou retiré reste en base (vue « Tous ») · le statut d&apos;équipe appartient à la CRESS : un flux importé ne le toucherait jamais.</p>
    </div>
  );
}
