import { SectionIcon } from "@/components/shell/section-icon";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/shell/person-switcher";
import { StatusBadge } from "@/components/common/status-badge";
import { AlertChips } from "@/components/common/alert-chips";
import { AutoField } from "@/components/inline/auto-field";
import { loadEdition } from "@/lib/queries";
import { getCurrentPerson, getRefs, getSettings, getPeople } from "@/lib/session";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { computeAlerts } from "@/lib/alerts";
import { isCodir } from "@/lib/rights";
import { TabsNav, type TabKey } from "./tabs-nav";
import { EditionPicker } from "./edition-picker";
import { RenewDialog } from "./renew-dialog";
import { RequestValidationDialog } from "./request-validation-dialog";
import { CreateTaskButton } from "./create-task-button";
import { FicheTab } from "./fiche";
import { ActionsTab } from "./actions-tab";
import { FinancementsTab } from "./financements";
import { TempsTab } from "./temps";
import { BudgetTab } from "./budget";
import { ValidationsTab } from "./validations-tab";
import { DocumentsTab } from "./documents";
import { BilanTab } from "./bilan";
import { prisma } from "@/lib/db";
import { inMyScope, isTransversal } from "@/lib/scope";
import { Eye, Maximize2 } from "lucide-react";
import { FocusMode } from "@/components/common/focus-mode";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function EditionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string; relecture?: string; focus?: string; validation?: string }> }) {
  const { id } = await params;
  const { onglet, relecture, focus, validation } = await searchParams;
  const [e, me, refs, settings, people] = await Promise.all([loadEdition(id), getCurrentPerson(), getRefs(), getSettings(), getPeople()]);
  if (!e) notFound();
  const [funders, conventions] = await Promise.all([prisma.funder.findMany({ orderBy: { name: "asc" } }), prisma.convention.findMany({ include: { lines: { select: { id: true, amountGranted: true, amountRequested: true, editionId: true } } }, orderBy: { reference: "asc" } })]);

  const tab = (["fiche", "actions", "financements", "temps", "budget", "validations", "documents", "bilan"].includes(onglet ?? "") ? onglet : "fiche") as TabKey;
  const isPilot = e.project.pilotId === me.id;
  const isTeam = e.team.some((t) => t.personId === me.id);
  const alerts = computeAlerts(e, settings);
  const canStatus = me.role === "director" || me.role === "raf";
  const nextYearExists = e.project.editions.some((x) => x.year === e.year + 1);
  const ctx = { e, me, refs, settings, people, funders, conventions, isPilot, isTeam, feedback: relecture === "1" };

  const counts = {
    actions: e.actions.length,
    financements: e.fundingLines.length,
    validations: e.validations.filter((v) => v.status === "pending").length,
    documents: e.docLinks.filter((d) => !d.codirOnly || isCodir(me.role)).length + e.comments.length + e.attachments.length,
  };

  const owners = { pilot: e.project.pilot, guarantor: e.project.guarantor };
  // Mode focus sur la fiche (retour du 14/09) : rédiger sans le reste de l'interface ; Échap ramène à l'onglet.
  if (focus === "1" && tab === "fiche") {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <FocusMode on exitHref={`/edition/${e.id}?onglet=fiche${relecture === "1" ? "&relecture=1" : ""}`} />
        <h1 className="mb-1 text-[22px] font-bold leading-tight tracking-[-0.5px]">{e.project.name} · {e.year}</h1>
        <p className="mb-5 text-xs text-muted-foreground">Fiche en mode focus : la rédaction seulement. Chaque champ s'enregistre en le quittant.</p>
        <FicheTab {...ctx} />
      </div>
    );
  }
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <SectionIcon className="mt-[3px] hidden size-9 shrink-0 place-items-center rounded-md bg-info-soft text-primary sm:grid print:hidden" />
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px]">{e.project.name}</h1>
            <EditionPicker currentId={e.id} editions={e.project.editions.map((x) => ({ id: x.id, year: x.year, statusLabel: refLabel(refs, "edition_status", x.status) }))} />
            {canStatus ? (
              <AutoField model="edition" id={e.id} field="status" type="select" value={e.status} allowEmpty={false} refreshOnSave testId="edition-status"
                options={REF_DEFAULTS.edition_status.map((s) => ({ value: s.code, label: refLabel(refs, "edition_status", s.code) }))} className="w-40" />
            ) : (
              <StatusBadge label={refLabel(refs, "edition_status", e.status)} color={refColor(refs, "edition_status", e.status)} />
            )}
            {e.conditionalStart && <StatusBadge label="Démarrage conditionné à la notification" color="warning" dot={false} />}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{e.project.pole.name}{e.project.secondaryPoles.length > 0 && <> · <span title="Pôles associés à ce projet commun">Projet commun avec {e.project.secondaryPoles.map((x) => x.pole.name).join(", ")}</span></>} · {e.project.mission.name} · {e.project.recurring ? "Projet récurrent" : "Projet ponctuel"} · Code {e.project.analyticCode}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateTaskButton editionId={e.id} actions={e.actions.map((a) => ({ id: a.id, name: a.name }))} />
          <RenewDialog edition={{ id: e.id, year: e.year, projectName: e.project.name, actions: e.actions.length, fundingLines: e.fundingLines.length, team: e.team.length }} disabled={nextYearExists} />
          <RequestValidationDialog
            editionId={e.id}
            defaultOpen={validation === "1"}
            actions={e.actions.map((a) => ({ id: a.id, name: a.name }))}
            kinds={REF_DEFAULTS.validation_kind.map((k) => ({ value: k.code, label: refLabel(refs, "validation_kind", k.code) }))}
            // Niveau 1 : le pilote, sauf s'il demande lui-même (jamais sa propre demande) ; alors son responsable de pôle.
            recipients={(() => { const lead = owners.guarantor?.name ?? people.find((p) => p.role === "pole_lead" && p.poleId === e.project.poleId)?.name ?? null; const dir = people.find((p) => p.role === "director")?.name ?? null; return { 1: isPilot ? (lead ?? dir) : owners.pilot.name, 2: lead ?? dir, 3: dir }; })()}
          />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5"><Avatar name={owners.pilot.name} role={owners.pilot.role} /> Pilote <b className="font-semibold">{owners.pilot.name}</b></span>
        <span className="inline-flex items-center gap-1.5">{owners.guarantor && <Avatar name={owners.guarantor.name} role={owners.guarantor.role} />} Responsable de pôle garant <b className="font-semibold">{owners.guarantor?.name ?? "—"}</b></span>
        <span className="text-muted-foreground">{e.fundingLines.length} ligne{e.fundingLines.length > 1 ? "s" : ""} de financement</span>
        <AlertChips alerts={alerts} max={5} />
      </div>

      {!isTransversal(me) && !inMyScope(me, e.project, e.team.map((t) => t.personId)) && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2 text-sm" data-testid="outside-scope">
          <Eye className="size-4 text-muted-foreground" />Édition du pôle <strong>{e.project.pole.name}</strong>, hors de votre pôle : vous la consultez, vous n'y intervenez pas.
        </div>
      )}
      <div className="relative">
        <TabsNav editionId={e.id} current={tab} counts={counts} />
        {tab === "fiche" && <Button asChild variant="outline" size="icon" className="absolute top-0.5 right-0 size-8 shrink-0" title="Mode focus : rédiger la fiche sans le reste de l'interface"><Link href={`/edition/${e.id}?onglet=fiche&focus=1${relecture === "1" ? "&relecture=1" : ""}`} data-testid="fiche-focus"><Maximize2 /></Link></Button>}
      </div>

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
