import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/base-path";
import { FileDown, MessageSquareText, X } from "lucide-react";
import Link from "next/link";
import { FIELDS } from "@/lib/fields";
import { canWriteLayer, LAYER_OWNER_LABEL, type Layer } from "@/lib/rights";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { fmtDate } from "@/lib/format";
import type { TabCtx } from "./types";
import { inMyPole } from "@/lib/scope";
import { TeamPicker } from "./team-picker";
import { FicheLayer, type LayerField } from "./fiche-layer";
import type { RemarkView } from "./remarks";
import { cn } from "@/lib/utils";
import { isCodir } from "@/lib/rights";

// Les quatre couches de la fiche (numérotées comme dans la maquette V2), plus le suivi au fil de l'année.
const LAYERS: { key: Layer; no: string; title: string; owner: string; fields: string[] }[] = [
  { key: "strategic", no: "1", title: "Cadre stratégique", owner: "Propriétaire · direction", fields: ["stakes", "axis", "sressMeasure", "snessLink", "otherTexts", "yearPriorities", "expectedOutcome"] },
  { key: "means", no: "2", title: "Cadre de moyens", owner: "Propriétaires · RAF et direction", fields: ["plannedFunders", "directExpenseEnvelope", "fte", "imposedIndicators", "sponsorId"] },
  { key: "proposal", no: "3", title: "Proposition opérationnelle", owner: "Propriétaire · pilote", fields: ["operationalObjectives", "quantitativeObjectives", "content", "audience", "calendar", "deliveryDate", "partners", "method", "governance", "ownIndicators", "timeNeed", "budgetNeed"] },
  { key: "validation", no: "4", title: "Validation", owner: "Propriétaires · CODIR puis CA", fields: ["codirDecision", "codirDate", "boardValidated", "boardDate"] },
  { key: "year", no: "↻", title: "Au fil de l'année", owner: "Renseigné par le pilote", fields: ["venues", "equipment", "evidenceToKeep"] },
];

const isFilled = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== false;

// Fiche en lecture d'abord : texte compact par couche, chaque propriétaire retrouve « Modifier cette couche » ; équipe et historique en retrait.
export function FicheTab({ e, me, refs, isPilot, isTeam, people, feedback }: TabCtx) {
  const row = e as unknown as Record<string, unknown>;
  const canStatus = me.role === "director" || me.role === "raf";
  const layerFilled = (l: (typeof LAYERS)[number]) => l.fields.some((f) => isFilled(row[f]));
  const filledLayers = LAYERS.slice(0, 4).filter(layerFilled).length;
  const nextEmpty = LAYERS.slice(0, 4).find((l) => !layerFilled(l));
  const codirOpts = REF_DEFAULTS.codir_decision.map((c) => ({ value: c.code, label: refLabel(refs, "codir_decision", c.code) }));
  const teamNames = e.team.map((t) => t.person.name);
  // Remarques : un droit du CODIR (direction, RAF, responsables de pôle) — la relecture des fiches se fait en CODIR ; le pilote et l'équipe les traitent.
  const canRemark = isCodir(me.role);
  const canResolve = isPilot || isTeam || canRemark;
  const remarks: RemarkView[] = e.remarks.map((r) => ({ id: r.id, field: r.field, body: r.body, author: r.author.name, authorId: r.authorId, createdAt: fmtDate(r.createdAt), resolvedAt: r.resolvedAt ? fmtDate(r.resolvedAt) : null, resolvedBy: r.resolvedBy?.name ?? null }));
  const openRemarks = remarks.filter((r) => !r.resolvedAt).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="grid gap-3">
        {/* Mode relecture : réservé à qui peut annoter ; hors de ce mode, la fiche reste propre, seules les remarques posées se voient. */}
        {canRemark && (
          <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md px-3.5 py-2 text-xs", feedback ? "border border-primary/40 bg-info-soft text-primary" : "bg-muted text-muted-foreground")} data-testid="feedback-bar">
            <span>{feedback ? <><b>Mode relecture.</b> Cliquez « Remarque » sous une rubrique pour l'annoter ; le pilote la verra en place et sera prévenu.</> : "Relire cette fiche et laisser des remarques au pilote, rubrique par rubrique ?"}</span>
            <Button asChild size="xs" variant={feedback ? "outline" : "default"}>
              <Link href={`/edition/${e.id}?onglet=fiche${feedback ? "" : "&relecture=1"}`} data-testid="feedback-toggle">{feedback ? <><X />Quitter la relecture</> : <><MessageSquareText />Relire et annoter</>}</Link>
            </Button>
          </div>
        )}
        {openRemarks > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-warning-soft px-3.5 py-2.5 text-xs text-warning-foreground" data-testid="fiche-remarks-banner"><span><b>{openRemarks} remarque{openRemarks > 1 ? "s" : ""} à traiter</b> sur cette fiche, posée{openRemarks > 1 ? "s" : ""} par {[...new Set(remarks.filter((r) => !r.resolvedAt).map((r) => r.author))].join(", ")}. Elles apparaissent sous les rubriques concernées.</span></div>
        )}
        {filledLayers === 4 ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-mint-soft px-3.5 py-2.5 text-xs text-mint"><span><b>✓ Fiche complète.</b> Les quatre couches sont renseignées.</span><span>Suivi par {e.project.pilot.name}</span></div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-md bg-warning-soft px-3 py-3 text-xs text-warning-foreground"><span>○</span><span><b>{filledLayers} couche{filledLayers > 1 ? "s" : ""} sur 4 renseignée{filledLayers > 1 ? "s" : ""}.</b>{nextEmpty ? ` La couche ${nextEmpty.no} (${nextEmpty.title.toLowerCase()}) est ${LAYER_OWNER_LABEL[nextEmpty.key]}.` : ""}</span></div>
        )}
        {LAYERS.map((layer) => {
          const writable = canWriteLayer(me.role, layer.key, isPilot, isTeam, inMyPole(me, e.project));
          const fields: LayerField[] = layer.fields.map((f) => {
            const def = FIELDS.edition[f];
            return {
              key: f, label: def.label ?? f, type: def.type, value: row[f] as LayerField["value"],
              suffix: def.type === "number" ? (f === "fte" ? "ETP" : "€") : undefined,
              options: f === "codirDecision" ? codirOpts : f === "sponsorId" ? people.filter((p) => ["director", "raf", "pole_lead"].includes(p.role)).map((p) => ({ value: p.id, label: p.name })) : undefined,
            };
          });
          return (
            <FicheLayer
              key={layer.key} editionId={e.id} layerKey={layer.key} no={layer.no} title={layer.title} owner={layer.owner}
              ownerMissingLabel={LAYER_OWNER_LABEL[layer.key]} fields={fields} writable={writable} defaultEditing={writable && !layerFilled(layer)}
              remarks={remarks.filter((r) => layer.fields.includes(r.field))} canRemark={canRemark && Boolean(feedback)} canResolve={canResolve} meId={me.id} isDirector={me.role === "director"}
            />
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button asChild size="sm" variant="outline"><a href={withBase(`/edition/${e.id}/export?format=fiche`)} data-testid="export-fiche"><FileDown />Exporter la fiche (Word, gabarit CRESS)</a></Button>
        </div>
        <p className="text-xs text-muted-foreground">{e.changes[0] ? `Dernière mise à jour : ${e.changes[0].author.name} · ${fmtDate(e.changes[0].createdAt)} · ${FIELDS.edition[e.changes[0].field]?.label?.toLowerCase() ?? e.changes[0].field}.` : "Aucune modification enregistrée pour le moment."}</p>
      </div>

      <div className="grid content-start gap-3">
        <Section title="Cycle de vie" className="p-4">
          <div className="grid gap-2.5 text-sm">
            <div className="grid gap-1">
              <label htmlFor={`edition-${e.id}-decisionDate`} className="text-xs font-medium text-muted-foreground">Date de décision</label>
              <AutoField model="edition" id={e.id} field="decisionDate" type="date" value={e.decisionDate} readOnly={!canStatus} inputId={`edition-${e.id}-decisionDate`} placeholder="Non renseignée" />
            </div>
            {canStatus ? (
              <AutoField model="edition" id={e.id} field="conditionalStart" type="bool" value={e.conditionalStart} placeholder="Démarrage conditionné à la notification" />
            ) : (
              <p className="text-xs">{e.conditionalStart ? "Démarrage conditionné à la notification du financeur." : "Démarre sans attendre la notification du financeur."}</p>
            )}
          </div>
        </Section>

        <Section title="Équipe projet" description={teamNames.length ? `${teamNames.length} personne${teamNames.length > 1 ? "s" : ""} · choisie par le pilote` : "Choisie par le pilote"} className="p-4">
          {canWriteLayer(me.role, "proposal", isPilot, isTeam) ? (
            <TeamPicker editionId={e.id} people={people.map((p) => ({ id: p.id, name: p.name }))} selected={e.team.map((t) => t.personId)} readOnly={false} />
          ) : (
            <p className="text-sm">{teamNames.length ? teamNames.join(", ") : <span className="italic text-muted-foreground">Aucune personne affectée.</span>}</p>
          )}
        </Section>

        <details className="group rounded-2xl border bg-card p-4" data-testid="history">
          <summary className="cursor-pointer list-none text-[15px] font-bold text-foreground">
            Historique <span className="text-xs font-normal text-muted-foreground">· {e.changes.length} modification{e.changes.length > 1 ? "s" : ""} · <span className="group-open:hidden">afficher</span><span className="hidden group-open:inline">masquer</span></span>
          </summary>
          {e.changes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucune modification enregistrée.</p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-xs" data-testid="changelog">
              {e.changes.map((c) => (
                <li key={c.id} className="border-l-2 border-secondary pl-2">
                  <div className="font-medium">{FIELDS.edition[c.field]?.label ?? c.field}</div>
                  <div className="text-muted-foreground">{c.author.name} · {fmtDate(c.createdAt, "D MMM YYYY HH:mm")}</div>
                  {c.after && <div className="truncate text-muted-foreground" title={c.after}>→ {c.after}</div>}
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </div>
  );
}
