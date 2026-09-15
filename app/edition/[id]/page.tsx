import { SectionIcon } from "@/components/shell/section-icon";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/shell/person-switcher";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { loadEdition } from "@/lib/queries";
import { getCurrentPerson, getRefs, getSettings, getPeople } from "@/lib/session";
import { REF_DEFAULTS, refColor, refLabel } from "@/lib/refs";
import { computeAlerts } from "@/lib/alerts";
import { canAdmin, isCodir } from "@/lib/rights";
import { isLocked } from "@/lib/lock";
import { TabsNav, type TabKey } from "./tabs-nav";
import { ApercuTab } from "./apercu";
import { FilSheet } from "./fil-sheet";
import { fmtDate } from "@/lib/format";
import { EditionPicker } from "./edition-picker";
import { EditionMenu } from "./edition-menu";
import { AlertBar } from "./alert-bar";
import { RequestValidationDialog } from "./request-validation-dialog";
import { CreateTaskButton } from "./create-task-button";
import { FicheTab } from "./fiche";
import { ActionsTab } from "./actions-tab";
import { FinancementsTab } from "./financements";
import { TempsTab } from "./temps";
import { BudgetTab } from "./budget";
import { LedgerBlock } from "./ledger-block";
import { DocumentsTab } from "./documents";
import { prisma } from "@/lib/db";
import { inMyScope, isTransversal } from "@/lib/scope";
import { Eye } from "lucide-react";
import { FocusMode } from "@/components/common/focus-mode";

export default async function EditionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string; relecture?: string; focus?: string; validation?: string; fil?: string }> }) {
  const { id } = await params;
  const { onglet, relecture, focus, validation, fil } = await searchParams;
  const [e, me, refs, settings, people] = await Promise.all([loadEdition(id), getCurrentPerson(), getRefs(), getSettings(), getPeople()]);
  if (!e) notFound();
  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  const [funders, conventions] = await Promise.all([prisma.funder.findMany({ orderBy: { name: "asc" } }), prisma.convention.findMany({ include: { lines: { select: { id: true, amountGranted: true, amountRequested: true, editionId: true } } }, orderBy: { reference: "asc" } })]);

  // Anciennes adresses : « validations » ouvre l'Aperçu (à décider), « bilan » la fiche (chapitre Bilan).
  const wanted = onglet === "validations" ? "apercu" : onglet === "bilan" ? "fiche" : onglet === "financements" ? "budget" : onglet;
  // Atterrissage : l'Aperçu une fois la fiche validée (l'année d'exécution) ; la Fiche tant qu'elle se rédige.
  const landing = isLocked(e) ? "apercu" : "fiche";
  const tab = (["apercu", "fiche", "actions", "budget", "temps", "documents"].includes(wanted ?? "") ? wanted : landing) as TabKey;
  const isPilot = e.project.pilotId === me.id;
  const isTeam = e.team.some((t) => t.personId === me.id);
  const alerts = computeAlerts(e, settings);
  // Alertes réglées par une décision d'instance : elles s'éteignent dans la bande d'état, avec la référence de la décision.
  const acks = e.decisions.filter((d) => d.alertKind).map((d) => ({ kind: d.alertKind as (typeof alerts)[number]["kind"], by: `${refLabel(refs, "decision_instance", d.instance)} ${fmtDate(d.decidedAt)}` }));
  const myTasks = await prisma.task.findMany({ where: { personId: me.id, editionId: e.id, done: false }, select: { id: true, label: true, dueDate: true, action: { select: { name: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] });
  const canStatus = me.role === "director" || me.role === "raf";
  const nextYearExists = e.project.editions.some((x) => x.year === e.year + 1);
  const ctx = { e, me, refs, settings, people, funders, conventions, isPilot, isTeam, feedback: relecture === "1", myTasks };

  // Compteurs d'onglet (revue du 15/09) : ce qui reste à faire, pas des totaux ; Documents = fichiers et liens seulement.
  const counts = {
    apercu: e.validations.filter((v) => v.status === "pending").length,
    actions: e.actions.filter((a) => a.state !== "done").length,
    documents: e.docLinks.filter((d) => !d.codirOnly || isCodir(me.role)).length + e.attachments.length,
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
      {/* En-tête en deux lignes (revue du 15/09) : identité et statut ; pôle, code, pilote et garant. Le rare va dans le menu « … ». */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-[420px] items-start gap-3">
          <SectionIcon className="mt-[3px] hidden size-9 shrink-0 place-items-center rounded-md bg-info-soft text-primary sm:grid print:hidden" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[25px] font-bold leading-tight tracking-[-0.7px]">{e.project.name}</h1>
              <EditionPicker currentId={e.id} editions={e.project.editions.map((x) => ({ id: x.id, year: x.year, statusLabel: refLabel(refs, "edition_status", x.status) }))} />
              {canStatus ? (
                <AutoField model="edition" id={e.id} field="status" type="select" value={e.status} allowEmpty={false} refreshOnSave testId="edition-status"
                  options={REF_DEFAULTS.edition_status.map((s) => ({ value: s.code, label: refLabel(refs, "edition_status", s.code) }))} className="w-32" inputClassName="h-7 rounded-sm bg-info-soft py-0.5 text-[11px] font-semibold text-primary" />
              ) : (
                <StatusBadge label={refLabel(refs, "edition_status", e.status)} color={refColor(refs, "edition_status", e.status)} />
              )}
              {e.conditionalStart && <StatusBadge label="Démarrage conditionné à la notification" color="warning" dot={false} />}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span>{e.project.pole.name}{e.project.secondaryPoles.length > 0 && <> · <span title="Pôles associés à ce projet commun">commun avec {e.project.secondaryPoles.map((x) => x.pole.name).join(", ")}</span></>} · {e.project.mission.name} · {e.project.analyticCode}</span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1"><Avatar name={owners.pilot.name} role={owners.pilot.role} className="size-5 text-[8px]" /> Pilote <b className="font-semibold text-foreground">{owners.pilot.name}</b></span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1">{owners.guarantor && <Avatar name={owners.guarantor.name} role={owners.guarantor.role} className="size-5 text-[8px]" />} Garant <b className="font-semibold text-foreground">{owners.guarantor?.name ?? "—"}</b></span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilSheet editionId={e.id} defaultOpen={fil === "1"} comments={e.comments.map((c) => ({ id: c.id, author: c.author.name, when: fmtDate(c.createdAt, c.createdAt.getHours() === 0 && c.createdAt.getMinutes() === 0 ? "D MMM YYYY" : "D MMM YYYY HH:mm"), body: c.body }))} />
          <CreateTaskButton editionId={e.id} actions={e.actions.map((a) => ({ id: a.id, name: a.name }))} />
          <RequestValidationDialog
            editionId={e.id}
            defaultOpen={validation === "1"}
            suppliers={suppliers}
            actions={e.actions.map((a) => ({ id: a.id, name: a.name }))}
            kinds={REF_DEFAULTS.validation_kind.map((k) => ({ value: k.code, label: refLabel(refs, "validation_kind", k.code) }))}
            // Niveau 1 : le pilote, sauf s'il demande lui-même (jamais sa propre demande) ; alors son responsable de pôle.
            recipients={(() => { const lead = owners.guarantor?.name ?? people.find((p) => p.role === "pole_lead" && p.poleId === e.project.poleId)?.name ?? null; const dir = people.find((p) => p.role === "director")?.name ?? null; return { 1: isPilot ? (lead ?? dir) : owners.pilot.name, 2: lead ?? dir, 3: dir }; })()}
          />
          <EditionMenu edition={{ id: e.id, year: e.year, projectName: e.project.name, actions: e.actions.length, fundingLines: e.fundingLines.length, team: e.team.length, conditionalStart: e.conditionalStart }} nextYearExists={nextYearExists} canStatus={canStatus} canRemark={isCodir(me.role)} feedback={relecture === "1"} />
        </div>
      </div>
      <AlertBar editionId={e.id} alerts={alerts} acks={acks} />

      {!isTransversal(me) && !inMyScope(me, e.project, e.team.map((t) => t.personId)) && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2 text-sm" data-testid="outside-scope">
          <Eye className="size-4 text-muted-foreground" />Édition du pôle <strong>{e.project.pole.name}</strong>, hors de votre pôle : vous la consultez, vous n'y intervenez pas.
        </div>
      )}
      <TabsNav editionId={e.id} current={tab} counts={counts} />

      {tab === "apercu" && <ApercuTab {...ctx} />}
      {tab === "fiche" && <FicheTab {...ctx} />}
      {tab === "actions" && <ActionsTab {...ctx} />}
      {/* Budget = l'argent de l'édition (revue du 15/09) : les dépenses (enveloppe, devis, factures) puis les recettes (financeurs, livrables). */}
      {tab === "budget" && (
        <div className="grid gap-4">
          <nav className="flex gap-3 text-xs" aria-label="Sections du budget"><a href="#depenses" className="text-primary hover:underline">Dépenses</a><span className="text-muted-foreground">·</span><a href="#realise" className="text-primary hover:underline">Réalisé comptable</a><span className="text-muted-foreground">·</span><a href="#recettes" className="text-primary hover:underline">Recettes et financeurs</a></nav>
          <div id="depenses" className="scroll-mt-20"><BudgetTab {...ctx} /></div>
          <div id="realise" className="scroll-mt-20"><LedgerBlock e={ctx.e} settings={ctx.settings} canAdmin={canAdmin(me.role)} /></div>
          <div id="recettes" className="scroll-mt-20"><FinancementsTab {...ctx} /></div>
        </div>
      )}
      {tab === "temps" && <TempsTab {...ctx} />}
      {tab === "documents" && <DocumentsTab {...ctx} />}
    </div>
  );
}
