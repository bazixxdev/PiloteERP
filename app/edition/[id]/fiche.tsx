import { Button } from "@/components/ui/button";
import { Lock, MessageSquareText, X } from "lucide-react";
import Link from "next/link";
import { FIELDS } from "@/lib/fields";
import { canWriteLayer, LAYER_OWNER_LABEL, type Layer } from "@/lib/rights";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { fmtDate } from "@/lib/format";
import type { TabCtx } from "./types";
import { inMyPole } from "@/lib/scope";
import { TeamSection } from "./team-section";
import { FicheLayer, type LayerField } from "./fiche-layer";
import { ProposalsPanel, ProposeChangeDialog, type ProposableField, type ProposalView } from "./proposals";
import { readableValue } from "@/lib/readable";
import { isLocked, LOCKED_STATUSES } from "@/lib/lock";
import type { RemarkView } from "./remarks";
import { cn } from "@/lib/utils";
import { isCodir } from "@/lib/rights";

// Les quatre couches de la fiche (numérotées comme dans la maquette V2), plus la logistique renseignée au fil de l'année.
const LAYERS: { key: Layer; no: string; title: string; owner: string; fields: string[]; optional?: boolean }[] = [
  { key: "strategic", no: "1", title: "Cadre stratégique", owner: "Propriétaire · direction", fields: ["stakes", "axis", "sressMeasure", "snessLink", "otherTexts", "yearPriorities", "expectedOutcome"] },
  { key: "means", no: "2", title: "Cadre de moyens", owner: "Propriétaires · RAF et direction", fields: ["plannedFunders", "directExpenseEnvelope", "fte", "imposedIndicators", "sponsorId"] },
  { key: "proposal", no: "3", title: "Proposition opérationnelle", owner: "Propriétaire · pilote", fields: ["operationalObjectives", "quantitativeObjectives", "content", "audience", "calendar", "deliveryDate", "partners", "method", "governance", "ownIndicators", "timeNeed", "budgetNeed"] },
  { key: "validation", no: "4", title: "Validation", owner: "Propriétaires · CODIR puis CA", fields: ["codirDecision", "codirDate", "boardValidated", "boardDate"] },
  { key: "year", no: "↻", title: "Logistique", owner: "Renseigné par le pilote au fil de l'année", fields: ["venues", "equipment", "evidenceToKeep"], optional: true },
];

const isFilled = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== false;

// La fiche = le document de l'édition, en chapitres : une ligne d'état, les couches lisibles en entier, l'équipe, l'historique.
// Sommaire collant à gauche ; le rare (export, plein écran, relecture) est dans le menu « … » de l'en-tête (revue du 15/09).
export function FicheTab({ e, me, refs, isPilot, isTeam, people, feedback }: TabCtx) {
  const row = e as unknown as Record<string, unknown>;
  const canStatus = me.role === "director" || me.role === "raf";
  const layerFilled = (l: (typeof LAYERS)[number]) => l.fields.some((f) => isFilled(row[f]));
  const filledLayers = LAYERS.slice(0, 4).filter(layerFilled).length;
  const nextEmpty = LAYERS.slice(0, 4).find((l) => !layerFilled(l));
  const codirOpts = REF_DEFAULTS.codir_decision.map((c) => ({ value: c.code, label: refLabel(refs, "codir_decision", c.code) }));
  // Remarques : un droit du CODIR (direction, RAF, responsables de pôle) — la relecture des fiches se fait en CODIR ; le pilote et l'équipe les traitent.
  const canRemark = isCodir(me.role);
  const canResolve = isPilot || isTeam || canRemark;
  const remarks: RemarkView[] = e.remarks.map((r) => ({ id: r.id, field: r.field, body: r.body, reason: r.reason, author: r.author.name, authorId: r.authorId, createdAt: fmtDate(r.createdAt), resolvedAt: r.resolvedAt ? fmtDate(r.resolvedAt) : null, resolvedBy: r.resolvedBy?.name ?? null }));
  const openRemarks = remarks.filter((r) => !r.resolvedAt).length;
  // Fiche validée = verrouillée (retour du 14/09) : les couches 1 à 3 passent par une proposition de modification ; la 4 et la logistique restent vivantes.
  const locked = isLocked(e);
  const canPropose = canRemark || isPilot || isTeam;
  const canDecideProposal = me.role === "director" || isPilot;
  const proposals: ProposalView[] = e.proposals.map((p) => ({ id: p.id, field: p.field, fieldLabel: FIELDS.edition[p.field]?.label ?? p.field, proposed: p.proposed, reason: p.reason, author: p.author.name, authorId: p.authorId, createdAt: fmtDate(p.createdAt), status: p.status, decidedBy: p.decidedBy?.name ?? null, decidedAt: p.decidedAt ? fmtDate(p.decidedAt) : null, comment: p.comment }));
  // Une seule date de décision : celle du CODIR (couche 4) ; l'ancienne « date de décision » ne sert plus que de repli.
  const validatedAt = e.codirDate ?? e.changes.find((c) => (c.field === "codirDecision" && c.after) || (c.field === "status" && c.after && LOCKED_STATUSES.includes(c.after)))?.createdAt ?? e.decisionDate ?? null;
  const layerFields = (layer: (typeof LAYERS)[number]): LayerField[] => layer.fields.map((f) => {
    const def = FIELDS.edition[f];
    return {
      key: f, label: def.label ?? f, type: def.type, value: row[f] as LayerField["value"],
      suffix: def.type === "number" ? (f === "fte" ? "ETP" : "€") : undefined,
      options: f === "codirDecision" ? codirOpts : f === "sponsorId" ? people.filter((p) => ["director", "raf", "pole_lead"].includes(p.role)).map((p) => ({ value: p.id, label: p.name })) : undefined,
    };
  });
  const proposable: ProposableField[] = LAYERS.slice(0, 3).flatMap((l) => layerFields(l).filter((f) => f.type !== "bool" && f.type !== "select").map((f) => ({ key: f.key, label: f.label, current: readableValue(f), multiline: f.type === "textarea", group: `${l.no} · ${l.title}` })));
  const toc = [...LAYERS.map((l) => ({ id: `couche-${l.key}`, label: `${l.no} ${l.title}` })), { id: "equipe", label: "Équipe" }, { id: "historique", label: "Historique" }];

  return (
    <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
      <nav className="hidden lg:block" aria-label="Sommaire de la fiche">
        <ol className="sticky top-4 grid gap-0.5 text-xs">
          {toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">{t.label}</a></li>)}
        </ol>
      </nav>
      <div className="grid min-w-0 gap-3">
        {/* Une ligne d'état, pas trois bandeaux : validée quand, par qui, verrouillée ; ou l'avancement de la rédaction. */}
        {locked ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/60 px-3.5 py-2 text-xs" data-testid="fiche-locked">
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <Lock className="size-3.5 text-muted-foreground" />
              <b>Validée</b>
              {e.codirDecision && <span>· CODIR{validatedAt ? ` ${fmtDate(validatedAt)}` : ""} ({refLabel(refs, "codir_decision", e.codirDecision).toLowerCase()})</span>}
              {!e.codirDecision && validatedAt && <span>· le {fmtDate(validatedAt)}</span>}
              {e.boardValidated ? <span>· CA{e.boardDate ? ` ${fmtDate(e.boardDate)}` : ""}</span> : e.codirDecision ? <span>· en attente du CA</span> : null}
              <span className="text-muted-foreground">· verrouillée : les couches 1 à 3 changent par proposition, acceptée et tracée</span>
              {canStatus && <span className="text-[10px] text-muted-foreground" title="Effacer la décision du CODIR (couche 4) et repasser le statut à « proposée » rouvre la fiche en direct — tracé.">(rouvrir : effacer la décision du CODIR)</span>}
            </span>
            {canPropose && <ProposeChangeDialog editionId={e.id} fields={proposable} layerTitle="fiche validée" />}
          </div>
        ) : filledLayers === 4 ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-mint-soft px-3.5 py-2 text-xs text-mint"><span><b>✓ Fiche complète</b> · en attente de la décision du CODIR (couche 4).</span><span>Suivi par {e.project.pilot.name}</span></div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-md bg-warning-soft px-3 py-2.5 text-xs text-warning-foreground"><span>○</span><span><b>{filledLayers} couche{filledLayers > 1 ? "s" : ""} sur 4 renseignée{filledLayers > 1 ? "s" : ""}.</b>{nextEmpty ? ` La couche ${nextEmpty.no} (${nextEmpty.title.toLowerCase()}) est ${LAYER_OWNER_LABEL[nextEmpty.key]}.` : ""}</span></div>
        )}
        {/* Mode relecture : réservé à qui peut annoter, seulement quand il est actif ; sinon un lien discret dans le menu « … ». */}
        {canRemark && feedback && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-info-soft px-3.5 py-2 text-xs text-primary" data-testid="feedback-bar">
            <span><b>Mode relecture.</b> Cliquez « Remarque » sous une rubrique pour l'annoter ; le pilote la verra en place et sera prévenu.</span>
            <Button asChild size="xs" variant="outline"><Link href={`/edition/${e.id}?onglet=fiche`}><X />Quitter la relecture</Link></Button>
          </div>
        )}
        {canRemark && !feedback && !locked && (
          <p className="text-xs text-muted-foreground"><MessageSquareText className="mr-1 inline size-3.5" />Fiche en rédaction : <Link href={`/edition/${e.id}?onglet=fiche&relecture=1`} className="text-primary hover:underline">relire et annoter</Link> rubrique par rubrique.</p>
        )}
        <ProposalsPanel proposals={proposals} canDecide={canDecideProposal} meId={me.id} isDirector={me.role === "director"} />
        {openRemarks > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-warning-soft px-3.5 py-2.5 text-xs text-warning-foreground" data-testid="fiche-remarks-banner"><span><b>{openRemarks} remarque{openRemarks > 1 ? "s" : ""} à traiter</b> sur cette fiche, posée{openRemarks > 1 ? "s" : ""} par {[...new Set(remarks.filter((r) => !r.resolvedAt).map((r) => r.author))].join(", ")}. Elles apparaissent sous les rubriques concernées.</span></div>
        )}
        {LAYERS.map((layer) => {
          const writable = canWriteLayer(me.role, layer.key, isPilot, isTeam, inMyPole(me, e.project));
          return (
            <FicheLayer
              key={layer.key} editionId={e.id} layerKey={layer.key} no={layer.no} title={layer.title} owner={layer.owner}
              ownerMissingLabel={LAYER_OWNER_LABEL[layer.key]} fields={layerFields(layer)} writable={writable} defaultEditing={writable && !layerFilled(layer)} optional={layer.optional} hideCount={locked}
              remarks={remarks.filter((r) => layer.fields.includes(r.field))} canRemark={canRemark && Boolean(feedback)} canResolve={canResolve} meId={me.id} isDirector={me.role === "director"}
              locked={locked && ["strategic", "means", "proposal"].includes(layer.key)} pendingProposals={proposals.filter((p) => p.status === "pending" && layer.fields.includes(p.field)).length}
            />
          );
        })}

        <TeamSection editionId={e.id} people={people.map((p) => ({ id: p.id, name: p.name, role: p.role }))} selected={e.team.map((t) => t.personId)} canEdit={canWriteLayer(me.role, "proposal", isPilot, isTeam)} />

        <details id="historique" className="group scroll-mt-20 rounded-md border bg-card px-[18px] py-3" data-testid="history">
          <summary className="cursor-pointer list-none text-sm font-bold text-foreground">
            Historique <span className="text-xs font-normal text-muted-foreground">· {e.changes.length === 0 ? "aucune modification" : `${e.changes.length} modification${e.changes.length > 1 ? "s" : ""} · dernière : ${e.changes[0].author.name}, ${fmtDate(e.changes[0].createdAt)}`} · <span className="group-open:hidden">afficher</span><span className="hidden group-open:inline">masquer</span></span>
          </summary>
          {e.changes.length > 0 && (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-xs lg:ml-9" data-testid="changelog">
              {e.changes.map((c) => (
                <li key={c.id} className="border-l-2 border-secondary pl-2">
                  <div className="font-medium">{FIELDS.edition[c.field]?.label ?? c.field}</div>
                  <div className="text-muted-foreground">{c.author.name} · {fmtDate(c.createdAt, "D MMM YYYY HH:mm")}</div>
                  {c.after && <div className={cn("truncate text-muted-foreground")} title={c.after}>→ {c.after}</div>}
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </div>
  );
}
