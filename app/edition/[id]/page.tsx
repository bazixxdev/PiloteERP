import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { AlertChips } from "@/components/common/alert-chips";
import { AutoField } from "@/components/inline/auto-field";
import { loadEdition } from "@/lib/queries";
import { getCurrentPerson, getRefs, getSettings, getPeople } from "@/lib/session";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { computeAlerts } from "@/lib/alerts";
import { isCodir } from "@/lib/rights";
import { cn } from "@/lib/utils";
import { TabsNav, type TabKey } from "./tabs-nav";
import { RenewDialog } from "./renew-dialog";
import { RequestValidationDialog } from "./request-validation-dialog";
import { FicheTab } from "./fiche";
import { ActionsTab } from "./actions-tab";
import { FinancementsTab } from "./financements";
import { TempsTab } from "./temps";
import { BudgetTab } from "./budget";
import { ValidationsTab } from "./validations-tab";
import { DocumentsTab } from "./documents";
import { BilanTab } from "./bilan";
import { prisma } from "@/lib/db";

export default async function EditionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const { id } = await params;
  const { onglet } = await searchParams;
  const [e, me, refs, settings, people] = await Promise.all([loadEdition(id), getCurrentPerson(), getRefs(), getSettings(), getPeople()]);
  if (!e) notFound();
  const funders = await prisma.funder.findMany({ orderBy: { name: "asc" } });

  const tab = (["fiche", "actions", "financements", "temps", "budget", "validations", "documents", "bilan"].includes(onglet ?? "") ? onglet : "fiche") as TabKey;
  const isPilot = e.project.pilotId === me.id;
  const isTeam = e.team.some((t) => t.personId === me.id);
  const alerts = computeAlerts(e, settings);
  const canStatus = me.role === "director" || me.role === "raf";
  const nextYearExists = e.project.editions.some((x) => x.year === e.year + 1);
  const ctx = { e, me, refs, settings, people, funders, isPilot, isTeam };

  const counts = {
    actions: e.actions.length,
    financements: e.fundingLines.length,
    validations: e.validations.filter((v) => v.status === "pending").length,
    documents: e.docLinks.filter((d) => !d.codirOnly || isCodir(me.role)).length + e.comments.length,
  };

  return (
    <div className="p-6">
      <div className="mb-1 text-xs text-muted-foreground">
        <Link href="/portefeuille" className="hover:underline">Portefeuille</Link> · {e.project.pole.name} · {e.project.mission.name}
      </div>
      <PageHeader
        title={`${e.project.name} · ${e.year}`}
        actions={
          <>
            <RequestValidationDialog editionId={e.id} actions={e.actions.map((a) => ({ id: a.id, name: a.name }))} kinds={REF_DEFAULTS.validation_kind.map((k) => ({ value: k.code, label: refLabel(refs, "validation_kind", k.code) }))} />
            <RenewDialog edition={{ id: e.id, year: e.year, projectName: e.project.name, actions: e.actions.length, fundingLines: e.fundingLines.length, team: e.team.length }} disabled={nextYearExists} />
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground">Statut</span>
            {canStatus ? (
              <AutoField model="edition" id={e.id} field="status" type="select" value={e.status} allowEmpty={false} refreshOnSave testId="edition-status"
                options={REF_DEFAULTS.edition_status.map((s) => ({ value: s.code, label: refLabel(refs, "edition_status", s.code) }))} className="w-40" />
            ) : (
              <StatusBadge label={refLabel(refs, "edition_status", e.status)} color={refColor(refs, "edition_status", e.status)} />
            )}
          </span>
          <span><span className="text-muted-foreground">Pilote</span> <strong>{e.project.pilot.name}</strong></span>
          <span><span className="text-muted-foreground">Garant</span> <strong>{e.project.guarantor?.name ?? "—"}</strong></span>
          <span><span className="text-muted-foreground">Code</span> <span className="tabular">{e.project.analyticCode}</span></span>
          {e.conditionalStart && <StatusBadge label="Démarrage conditionné à la notification" color="warning" dot={false} />}
          <span className="flex items-center gap-1 text-muted-foreground">
            Éditions :
            {e.project.editions.map((x) => (
              <Link key={x.id} href={`/edition/${x.id}`} className={cn("rounded-full px-2 py-0.5 text-xs", x.id === e.id ? "bg-primary text-white" : "bg-muted hover:bg-secondary")}>{x.year}</Link>
            ))}
          </span>
        </div>
        <div className="mt-2"><AlertChips alerts={alerts} max={5} /></div>
      </PageHeader>

      <TabsNav editionId={e.id} current={tab} counts={counts} />

      {tab === "fiche" && <FicheTab {...ctx} />}
      {tab === "actions" && <ActionsTab {...ctx} />}
      {tab === "financements" && <FinancementsTab {...ctx} />}
      {tab === "temps" && <TempsTab {...ctx} />}
      {tab === "budget" && <BudgetTab {...ctx} />}
      {tab === "validations" && <ValidationsTab {...ctx} />}
      {tab === "documents" && <DocumentsTab {...ctx} />}
      {tab === "bilan" && <BilanTab {...ctx} />}
    </div>
  );
}
