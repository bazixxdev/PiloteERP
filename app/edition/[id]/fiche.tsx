import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { AutoField } from "@/components/inline/auto-field";
import { DecisionForm } from "@/app/codir/decision-form";
import { computeAlerts } from "@/lib/alerts";
import { withBase } from "@/lib/base-path";
import { FileDown, Lock, MessageSquareText, X } from "lucide-react";
import Link from "next/link";
import { FIELDS } from "@/lib/fields";
import { LAYER_OWNER_LABEL, canActAsPilot, canWriteLayer, has, type Layer } from "@/lib/rights";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { asDecisions, circuitSteps, currentRound, FICHE_LEVEL_PERMISSIONS, ficheDecisionRefusal, isCircuitComplete, nextLevel, type FicheDecision } from "@/lib/fiche-validation";
import { isPermissionKey } from "@/lib/permissions";
import { FicheValidationSection, type PastDecisionView, type StepView } from "./fiche-validation";
import { fmtDate } from "@/lib/format";
import type { TabCtx } from "./types";
import { inMyPole } from "@/lib/scope";
import { TeamSection } from "./team-section";
import { PartnersSection } from "./partners-section";
import { FicheLayer, type LayerField } from "./fiche-layer";
import { ProposalsPanel, ProposeChangeDialog, type ProposableField, type ProposalView } from "./proposals";
import { readableValue } from "@/lib/readable";
import { isLocked } from "@/lib/lock";
import type { RemarkView } from "./remarks";
import { cn } from "@/lib/utils";
import { isCodir } from "@/lib/rights";
import { V, cap, le, du, de, pl } from "@/lib/vocab";

// Les quatre couches de la fiche (numérotées comme dans la maquette V2), plus la logistique renseignée au fil de l'année.
const LAYERS: { key: Layer; no: string; title: string; owner: string; fields: string[]; optional?: boolean }[] = [
  { key: "strategic", no: "1", title: "Cadre stratégique", owner: `Propriétaire · ${V.direction.one}`, fields: ["stakes", "axis", "sressMeasure", "snessLink", "otherTexts", "yearPriorities", "expectedOutcome"] },
  // Les indicateurs ne sont plus deux champs texte (couches 2 et 3) mais un objet vivant : cible à la rédaction, réalisé dans l'année (revue du 15/09).
  { key: "means", no: "2", title: "Cadre de moyens", owner: `Propriétaires · ${V.raf.one} et ${V.direction.one}`, fields: ["plannedFunders", "directExpenseEnvelope", "fte", "sponsorId"] },
  { key: "proposal", no: "3", title: "Proposition opérationnelle", owner: `Propriétaire · ${V.pilote.one}`, fields: ["operationalObjectives", "quantitativeObjectives", "content", "audience", "calendar", "deliveryDate", "partners", "method", "governance", "timeNeed", "budgetNeed"] },
  // Couche 4 : le circuit de validation par niveaux (FicheValidation, tâche 13) — plus de champs, des décisions.
  { key: "validation", no: "4", title: "Validation", owner: "", fields: [] },
  { key: "year", no: "↻", title: "Logistique", owner: `Renseigné par ${le(V.pilote)} au fil de l'année`, fields: ["venues", "equipment", "evidenceToKeep"], optional: true },
];

const isFilled = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== false;

// Libellés d'historique des champs qui ne sont plus dans FIELDS (couche 4 d'avant le circuit) et des écritures des commandes.
const HISTORY_LABEL: Record<string, string> = {
  validation: "Validation de la fiche",
  décision: "Décision d'instance",
  codirDecision: `Décision ${du(V.codir)} (ancien champ)`,
  codirDate: "Date du séminaire (ancien champ)",
  boardValidated: "Validé par le CA (ancien champ)",
  boardDate: "Date du CA (ancien champ)",
};

// La fiche = le document de l'édition, en chapitres : une ligne d'état, les couches lisibles en entier, l'équipe, l'historique.
// Sommaire collant à gauche ; le rare (export, plein écran, relecture) est dans le menu « … » de l'en-tête (revue du 15/09).
export function FicheTab({ e, me, refs, isPilot, isTeam, people, organisations, feedback, settings }: TabCtx) {
  const alerts = computeAlerts(e, settings);
  const row = e as unknown as Record<string, unknown>;
  const layerFilled = (l: (typeof LAYERS)[number]) => l.fields.some((f) => isFilled(row[f]));
  // Les couches 1 à 3 se rédigent ; la 4 se décide (circuit de validation).
  const filledLayers = LAYERS.slice(0, 3).filter(layerFilled).length;
  const nextEmpty = LAYERS.slice(0, 3).find((l) => !layerFilled(l));
  const circuit = circuitView(e, me, people);
  // Remarques : un droit du CODIR (direction, RAF, responsables de pôle) — la relecture des fiches se fait en CODIR ; le pilote et l'équipe les traitent.
  const canRemark = isCodir(me);
  const canResolve = isPilot || isTeam || canRemark;
  const remarks: RemarkView[] = e.remarks.map((r) => ({ id: r.id, field: r.field, body: r.body, reason: r.reason, author: r.author.name, authorId: r.authorId, createdAt: fmtDate(r.createdAt), resolvedAt: r.resolvedAt ? fmtDate(r.resolvedAt) : null, resolvedBy: r.resolvedBy?.name ?? null }));
  const openRemarks = remarks.filter((r) => !r.resolvedAt).length;
  // Fiche validée = verrouillée (retour du 14/09) : les couches 1 à 3 passent par une proposition de modification ; la 4 et la logistique restent vivantes.
  const locked = isLocked(e, e.ficheLevels);
  const canPropose = canRemark || isPilot || isTeam;
  const canDecideProposal = canActAsPilot(me, isPilot);
  const proposals: ProposalView[] = e.proposals.map((p) => ({ id: p.id, field: p.field, fieldLabel: FIELDS.edition[p.field]?.label ?? p.field, proposed: p.proposed, reason: p.reason, author: p.author.name, authorId: p.authorId, createdAt: fmtDate(p.createdAt), status: p.status, decidedBy: p.decidedBy?.name ?? null, decidedAt: p.decidedAt ? fmtDate(p.decidedAt) : null, comment: p.comment }));
  const layerFields = (layer: (typeof LAYERS)[number]): LayerField[] => layer.fields.map((f) => {
    const def = FIELDS.edition[f];
    return {
      key: f, label: def.label ?? f, type: def.type, value: row[f] as LayerField["value"],
      suffix: def.type === "number" ? (f === "fte" ? "ETP" : "€") : undefined,
      options: f === "sponsorId" ? people.filter((p) => p.codir).map((p) => ({ value: p.id, label: p.name })) : undefined,
    };
  });
  const proposable: ProposableField[] = LAYERS.slice(0, 3).flatMap((l) => layerFields(l).filter((f) => f.type !== "bool" && f.type !== "select").map((f) => ({ key: f.key, label: f.label, current: readableValue(f), multiline: f.type === "textarea", group: `${l.no} · ${l.title}` })));
  const toc = [...LAYERS.slice(0, 4).map((l) => ({ id: `couche-${l.key}`, label: `${l.no} ${l.title}` })), { id: "indicateurs", label: "Indicateurs" }, { id: "decisions", label: "Décisions" }, { id: "bilan", label: "Bilan" }, { id: "couche-year", label: "Logistique" }, { id: "equipe", label: "Équipe" }, { id: "historique", label: "Historique" }];
  const canYear = canWriteLayer(me, "year", isPilot, isTeam, inMyPole(me, e.project));
  const instances = REF_DEFAULTS.decision_instance.map((k) => ({ value: k.code, label: refLabel(refs, "decision_instance", k.code) }));
  const alertOpts = alerts.map((a) => ({ value: a.kind, label: a.label }));
  const legacyIndicators = [e.imposedIndicators, e.ownIndicators].filter(Boolean) as string[];

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
              {circuit.approvedSummary.map((a) => <span key={a}>· {a}</span>)}
              {!circuit.complete && circuit.next && <span>· en attente : {circuit.next}</span>}
              <span className="text-muted-foreground">· verrouillée : les couches 1 à 3 changent par proposition, acceptée et tracée</span>
              {circuit.can.rework && circuit.complete && <span className="text-[10px] text-muted-foreground" title="« À retravailler » en couche 4 rouvre la fiche : le circuit repart du premier niveau — tracé.">(rouvrir : « À retravailler » en couche 4)</span>}
            </span>
            {canPropose && <ProposeChangeDialog editionId={e.id} fields={proposable} layerTitle="fiche validée" />}
          </div>
        ) : filledLayers === 3 ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-mint-soft px-3.5 py-2 text-xs text-mint" data-testid="fiche-complete"><span><b>✓ Fiche complète</b>{circuit.next ? ` · en attente de la validation : ${circuit.next} (couche 4).` : " · circuit de validation à régler (couche 4)."}</span><span>Suivi par {e.project.pilot.name}</span></div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-md bg-warning-soft px-3 py-2.5 text-xs text-warning-foreground"><span>○</span><span><b>{filledLayers} couche{filledLayers > 1 ? "s" : ""} sur 3 renseignée{filledLayers > 1 ? "s" : ""}.</b>{nextEmpty ? ` La couche ${nextEmpty.no} (${nextEmpty.title.toLowerCase()}) est ${LAYER_OWNER_LABEL[nextEmpty.key]}.` : ""}</span></div>
        )}
        {/* Mode relecture : réservé à qui peut annoter, seulement quand il est actif ; sinon un lien discret dans le menu « … ». */}
        {canRemark && feedback && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-info-soft px-3.5 py-2 text-xs text-primary" data-testid="feedback-bar">
            <span><b>Mode relecture.</b>{` Cliquez « Remarque » sous une rubrique pour l'annoter ; ${le(V.pilote)} la verra en place et sera prévenu.`}</span>
            <Button asChild size="xs" variant="outline"><Link href={`/edition/${e.id}?onglet=fiche`}><X />Quitter la relecture</Link></Button>
          </div>
        )}
        {canRemark && !feedback && !locked && (
          <p className="text-xs text-muted-foreground"><MessageSquareText className="mr-1 inline size-3.5" />Fiche en rédaction : <Link href={`/edition/${e.id}?onglet=fiche&relecture=1`} className="text-primary hover:underline">relire et annoter</Link> rubrique par rubrique.</p>
        )}
        <ProposalsPanel proposals={proposals} canDecide={canDecideProposal} meId={me.id} isDirector={canActAsPilot(me, false)} />
        {openRemarks > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-warning-soft px-3.5 py-2.5 text-xs text-warning-foreground" data-testid="fiche-remarks-banner"><span><b>{openRemarks} remarque{openRemarks > 1 ? "s" : ""} à traiter</b> sur cette fiche, posée{openRemarks > 1 ? "s" : ""} par {[...new Set(remarks.filter((r) => !r.resolvedAt).map((r) => r.author))].join(", ")}. Elles apparaissent sous les rubriques concernées.</span></div>
        )}
        {LAYERS.map((layer) => {
          const writable = canWriteLayer(me, layer.key, isPilot, isTeam, inMyPole(me, e.project));
          const chapters = layer.key === "validation";
          return (<Fragment key={layer.key}>
            {chapters ? (
              <FicheValidationSection editionId={e.id} no={layer.no} title={layer.title} owner={circuit.owner} steps={circuit.steps} past={circuit.past} complete={circuit.complete} closed={e.status === "closed"} can={circuit.can} blocked={circuit.blocked} deadEnd={circuit.deadEnd} />
            ) : <FicheLayer
              key={layer.key} editionId={e.id} layerKey={layer.key} no={layer.no} title={layer.title} owner={layer.owner}
              ownerMissingLabel={LAYER_OWNER_LABEL[layer.key]} fields={layerFields(layer)} writable={writable} defaultEditing={writable && !layerFilled(layer)} optional={layer.optional} hideCount={locked}
              remarks={remarks.filter((r) => layer.fields.includes(r.field))} canRemark={canRemark && Boolean(feedback)} canResolve={canResolve} meId={me.id} isDirector={canActAsPilot(me, false)}
              locked={locked && ["strategic", "means", "proposal"].includes(layer.key)} pendingProposals={proposals.filter((p) => p.status === "pending" && layer.fields.includes(p.field)).length}
            />}
            {chapters && (
              <>
                {/* Indicateurs : la cible se fixe ici, le réalisé se met à jour dans Actions ; un seul objet, lu aux deux endroits. */}
                <section id="indicateurs" className="scroll-mt-20 rounded-md border bg-card px-[18px] py-4" data-testid="fiche-indicators">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5"><span className="grid size-[26px] place-items-center rounded-full border border-[#bfccba] font-serif text-sm text-mint">◎</span><h4 className="text-sm font-bold">Indicateurs</h4><span className="text-[10px] text-muted-foreground">cible fixée à la rédaction · réalisé mis à jour dans l'année</span></div>
                    <Link href={`/edition/${e.id}?onglet=actions#realisations`} className="text-xs text-primary hover:underline">{`Mettre à jour dans ${cap(pl(V.action))} →`}</Link>
                  </div>
                  {e.indicators.length === 0 ? <p className="mt-2 text-xs text-muted-foreground lg:ml-9">{`Aucun indicateur : ajoutez-les depuis l'onglet ${cap(pl(V.action))} (cible, imposé par un financeur ou propre au projet).`}</p> : (
                    <ul className="mt-2.5 grid gap-1 text-sm lg:ml-9">
                      {e.indicators.map((i) => <li key={i.id} className="flex items-baseline justify-between gap-2 border-b border-dashed py-1"><span className="min-w-0 truncate">{i.label}{i.imposed && <span className="ml-1 rounded-sm bg-info-soft px-1 text-[10px] text-primary">imposé</span>}</span><span className="shrink-0 text-xs tabular text-muted-foreground">cible <b className="text-foreground">{i.target ?? "—"}</b>{i.actual ? <> · réalisé <b className="text-foreground">{i.actual}</b></> : null}</span></li>)}
                    </ul>
                  )}
                  {legacyIndicators.length > 0 && <p className="mt-2 text-xs text-muted-foreground lg:ml-9"><b>Texte d'origine :</b> {legacyIndicators.join(" · ")}</p>}
                </section>
                {/* Décisions d'instance : CODIR, réunion de pôle, revue trimestrielle, CA — datées, avec la suite à donner ; une décision peut régler une alerte. */}
                <section id="decisions" className="scroll-mt-20 rounded-md border bg-card px-[18px] py-4" data-testid="instance-decisions">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5"><span className="grid size-[26px] place-items-center rounded-full border border-[#bfccba] font-serif text-sm text-mint">⚖</span><h4 className="text-sm font-bold">Décisions des instances</h4><span className="text-[10px] text-muted-foreground">{`${V.codir.one}, réunion ${de(V.pole)}, revue trimestrielle, CA`}</span></div>
                    {isCodir(me) && <DecisionForm editionId={e.id} people={people.map((p) => ({ id: p.id, name: p.name }))} instances={instances} alerts={alertOpts} />}
                  </div>
                  {e.decisions.length === 0 ? <p className="mt-2 text-xs text-muted-foreground lg:ml-9">Aucune décision consignée.</p> : (
                    <ul className="mt-2.5 divide-y text-sm lg:ml-9">
                      {e.decisions.map((d) => (
                        <li key={d.id} className="py-1.5">
                          <span className="rounded-sm bg-secondary px-1.5 text-[11px] font-medium text-primary">{refLabel(refs, "decision_instance", d.instance)}</span> {d.body}
                          <span className="text-xs text-muted-foreground"> · {fmtDate(d.decidedAt)} · {d.author.name}{d.followUp ? ` · suite : ${d.followUp.name}${d.dueDate ? ` pour le ${fmtDate(d.dueDate)}` : ""}` : ""}{d.alertKind ? " · règle une alerte" : ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {/* Bilan : le dernier chapitre du document de l'édition, rédigé en fin d'année, exporté tel quel. */}
                <section id="bilan" className="scroll-mt-20 rounded-md border bg-card px-[18px] py-4" data-testid="fiche-bilan">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5"><span className="grid size-[26px] place-items-center rounded-full border border-[#bfccba] font-serif text-sm text-mint">✎</span><h4 className="text-sm font-bold">{`Bilan ${du(V.edition)}`}</h4><span className="text-[10px] text-muted-foreground">{e.report ? "réutilisé tel quel pour le rapport d'activité et les bilans financeurs" : "à rédiger en fin d'année"}</span></div>
                    <Button asChild size="xs" variant="outline"><a href={withBase(`/edition/${e.id}/export?format=docx`)} data-testid="export-docx"><FileDown />Exporter le bilan (Word)</a></Button>
                  </div>
                  <div className="mt-3 grid gap-3 lg:ml-9">
                    <div className="grid gap-1">
                      <label htmlFor={`edition-${e.id}-evaluation`} className="text-[10px] text-muted-foreground">Évaluation</label>
                      <AutoField model="edition" id={e.id} field="evaluation" type="textarea" rows={e.evaluation ? 4 : 2} value={e.evaluation} readOnly={!canYear} inputId={`edition-${e.id}-evaluation`} placeholder="Ce qui a marché, ce qui a moins marché, écarts avec le cadre validé…" />
                    </div>
                    <div className="grid gap-1">
                      <label htmlFor={`edition-${e.id}-report`} className="text-[10px] text-muted-foreground">Bilan (texte long)</label>
                      <AutoField model="edition" id={e.id} field="report" type="textarea" rows={e.report ? 12 : 3} value={e.report} readOnly={!canYear} inputId={`edition-${e.id}-report`} placeholder="À rédiger en fin d'année : ce texte servira tel quel dans le rapport d'activité." testId="field-report" />
                    </div>
                  </div>
                </section>
              </>
            )}
          </Fragment>);
        })}

        <TeamSection editionId={e.id} people={people.map((p) => ({ id: p.id, name: p.name, role: p.role, codir: p.codir }))} selected={e.team.map((t) => t.personId)} canEdit={canWriteLayer(me, "proposal", isPilot, isTeam)} />

        <PartnersSection editionId={e.id} partners={e.partnerLinks.map((p) => ({ organisationId: p.organisationId, name: p.organisation.name, role: p.role, kinds: p.organisation.kinds }))} organisations={organisations} canEdit={canYear} />

        <details id="historique" className="group scroll-mt-20 rounded-md border bg-card px-[18px] py-3" data-testid="history">
          <summary className="cursor-pointer list-none text-sm font-bold text-foreground">
            Historique <span className="text-xs font-normal text-muted-foreground">· {e.changes.length === 0 ? "aucune modification" : `${e.changes.length} modification${e.changes.length > 1 ? "s" : ""} · dernière : ${e.changes[0].author.name}, ${fmtDate(e.changes[0].createdAt)}`} · <span className="group-open:hidden">afficher</span><span className="hidden group-open:inline">masquer</span></span>
          </summary>
          {e.changes.length > 0 && (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-xs lg:ml-9" data-testid="changelog">
              {e.changes.map((c) => (
                <li key={c.id} className="border-l-2 border-secondary pl-2">
                  <div className="font-medium">{FIELDS.edition[c.field]?.label ?? HISTORY_LABEL[c.field] ?? c.field}</div>
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

// Couche 4 vue par la personne courante : les niveaux et leurs décisions du tour courant, les tours précédents, ce que je peux
// décider (la garde de decideFiche, ficheDecisionRefusal, appelée ici pour les boutons — la commande la rejoue), et l'impasse
// d'un niveau que seul le pilote du projet pourrait décider (ou personne).
function circuitView(e: TabCtx["e"], me: TabCtx["me"], people: TabCtx["people"]) {
  const levels = e.ficheLevels;
  const rows = asDecisions(e.ficheValidations);
  const steps = circuitSteps(levels, rows);
  const round = new Set(currentRound(rows).map((d) => d.id));
  const complete = isCircuitComplete(levels, rows);
  const next = nextLevel(levels, rows);
  const isPilot = e.project.pilotId === me.id;
  const holds = (permission: string) => isPermissionKey(permission) && has(me, permission);
  const refusal = (decision: FicheDecision) => ficheDecisionRefusal({ levels, decisions: rows, status: e.status, isPilot, holds, decision, comment: "—" });
  const can = { approved: refusal("approved") === null, rework: refusal("rework") === null, refused: refusal("refused") === null };
  // Le niveau en attente : qui d'autre que le pilote en tient le droit ? Personne → on le dit, avec où le régler.
  const holders = next ? people.filter((p) => isPermissionKey(next.permission) && p.permissions.includes(next.permission)) : [];
  const others = holders.filter((p) => p.id !== e.project.pilotId);
  const deadEnd = !next || e.status === "closed" || others.length > 0 ? null
    : holders.length > 0 ? `Seul·e ${e.project.pilot.name}, ${V.pilote.one} ${du(V.projet)}, tient le droit du niveau « ${next.label} » : on ne décide pas sa propre fiche, personne ne peut donc la valider. Donnez ce droit à un autre rôle (Admin › Rôles et droits).`
    : `Personne ne tient le droit du niveau « ${next.label} » : donnez-le à un rôle (Admin › Rôles et droits) pour que la fiche puisse être validée.`;
  // Pourquoi je ne décide pas : dit au pilote et à qui tient un droit du circuit ; les autres n'ont rien à décider ici.
  const blocked = next && !can.approved && (isPilot || FICHE_LEVEL_PERMISSIONS.some(holds)) ? refusal("approved") : null;
  const view = (d: (typeof rows)[number]) => ({ decider: d.decider.name, date: fmtDate(d.decidedAt), comment: d.comment });
  return {
    steps: steps.map((s): StepView => ({ levelId: s.level.id, order: s.level.order, label: s.level.label, decision: s.decision?.decision ?? null, isNext: s.isNext, ...(s.decision ? view(s.decision) : { decider: null, date: null, comment: null }) })),
    past: rows.filter((d) => !round.has(d.id)).reverse().map((d): PastDecisionView => ({ id: d.id, label: d.level.label, decision: d.decision, ...view(d) })),
    complete,
    next: next?.label ?? null,
    approvedSummary: steps.filter((s) => s.decision?.decision === "approved").map((s) => `${s.level.label} ${fmtDate(s.decision!.decidedAt)}`),
    owner: steps.length ? `Circuit · ${steps.map((s) => s.level.label).join(" puis ")}` : "Circuit à régler",
    can, blocked, deadEnd,
  };
}
