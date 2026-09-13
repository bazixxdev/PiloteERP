import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { FIELDS } from "@/lib/fields";
import { canWriteLayer, LAYER_OWNER_LABEL, type Layer } from "@/lib/rights";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { inMyPole } from "@/lib/scope";
import { TeamPicker } from "./team-picker";

// Les quatre couches de la fiche (numérotées comme dans la maquette V2), plus le suivi au fil de l'année.
const LAYERS: { key: Layer; no: string; title: string; owner: string; fields: string[] }[] = [
  { key: "strategic", no: "1", title: "Cadre stratégique", owner: "Propriétaire · direction", fields: ["stakes", "axis", "sressMeasure", "yearPriorities", "expectedOutcome"] },
  { key: "means", no: "2", title: "Cadre de moyens", owner: "Propriétaires · RAF et direction", fields: ["plannedFunders", "directExpenseEnvelope", "fte", "imposedIndicators"] },
  { key: "proposal", no: "3", title: "Proposition opérationnelle", owner: "Propriétaire · pilote", fields: ["operationalObjectives", "calendar", "partners", "method", "governance", "ownIndicators", "timeNeed", "budgetNeed"] },
  { key: "validation", no: "4", title: "Validation", owner: "Propriétaires · CODIR puis CA", fields: ["codirDecision", "codirDate", "boardValidated", "boardDate"] },
  { key: "year", no: "↻", title: "Au fil de l'année", owner: "Renseigné par le pilote", fields: ["venues", "equipment", "evidenceToKeep"] },
];

export function FicheTab({ e, me, refs, isPilot, isTeam, people }: TabCtx) {
  const row = e as unknown as Record<string, unknown>;
  const canStatus = me.role === "director" || me.role === "raf";
  const filledLayers = LAYERS.slice(0, 4).filter((l) => l.fields.some((f) => { const v = row[f]; return v !== null && v !== undefined && v !== "" && v !== false; })).length;
  const nextEmpty = LAYERS.slice(0, 4).find((l) => !l.fields.some((f) => { const v = row[f]; return v !== null && v !== undefined && v !== "" && v !== false; }));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-3">
        {filledLayers === 4 ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-mint-soft px-3.5 py-2.5 text-xs text-mint"><span><b>✓ Fiche complète.</b> Les quatre couches sont renseignées.</span><span>Suivi par {e.project.pilot.name}</span></div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-md bg-warning-soft px-3 py-3 text-xs text-warning-foreground"><span>○</span><span><b>{filledLayers} couche{filledLayers > 1 ? "s" : ""} sur 4 renseignée{filledLayers > 1 ? "s" : ""}.</b>{nextEmpty ? ` La couche ${nextEmpty.no} (${nextEmpty.title.toLowerCase()}) est ${LAYER_OWNER_LABEL[nextEmpty.key]}.` : ""}</span></div>
        )}
        {LAYERS.map((layer) => {
          const writable = canWriteLayer(me.role, layer.key, isPilot, isTeam, inMyPole(me, e.project));
          const filled = layer.fields.filter((f) => { const v = row[f]; return v !== null && v !== undefined && v !== "" && v !== false; }).length;
          const empty = filled === 0;
          return (
            <section key={layer.key} data-testid={`layer-${layer.key}`} className={cn("rounded-md border bg-card px-[18px] py-4", empty && "border-dashed bg-muted text-muted-foreground")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn("grid size-[26px] place-items-center rounded-full border font-serif text-sm", empty ? "border-[#c9cdc5] text-muted-foreground" : "border-[#bfccba] text-mint")}>{layer.no}</span>
                  <h4 className="text-sm font-bold text-foreground">{layer.title}</h4>
                  {empty ? <StatusBadge label={`Manquant — ${LAYER_OWNER_LABEL[layer.key]}`} color="warning" dot={false} /> : <StatusBadge label={`${filled}/${layer.fields.length} renseignés`} color={filled === layer.fields.length ? "mint" : "info"} dot={false} />}
                </div>
                <span className="text-[10px] text-muted-foreground">{layer.owner}{!writable && " · lecture seule pour vous"}</span>
              </div>
              {empty && !writable ? (
                <p className="mt-2.5 ml-9 text-xs"><b>{LAYER_OWNER_LABEL[layer.key].replace(/^./, (c) => c.toUpperCase())}.</b> Les champs manquants restent attribués à leur propriétaire.</p>
              ) : null}
              <div className={cn("mt-3 grid gap-3 sm:grid-cols-2 lg:ml-9", empty && !writable && "hidden")}>
                {layer.fields.map((f) => {
                  const def = FIELDS.edition[f];
                  const value = row[f] as string | number | boolean | Date | null;
                  const wide = def.type === "textarea";
                  return (
                    <div key={f} className={cn("grid gap-1", wide && "sm:col-span-2")}>
                      <label className="text-[10px] text-muted-foreground">{def.label}</label>
                      <AutoField
                        model="edition" id={e.id} field={f} type={def.type} value={value} readOnly={!writable} testId={`field-${f}`}
                        placeholder={writable ? "À compléter…" : "Non renseigné"}
                        suffix={def.type === "number" ? (f === "fte" ? "ETP" : "€") : undefined}
                        options={f === "codirDecision" ? REF_DEFAULTS.codir_decision.map((c) => ({ value: c.code, label: refLabel(refs, "codir_decision", c.code) })) : undefined}
                        inputClassName={cn(!writable && "text-foreground/80", def.type === "textarea" && "min-h-[3.5rem]")}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        <p className="text-xs text-muted-foreground">{e.changes[0] ? `Dernière mise à jour : ${e.changes[0].author.name} · ${fmtDate(e.changes[0].createdAt)} · ${FIELDS.edition[e.changes[0].field]?.label?.toLowerCase() ?? e.changes[0].field}.` : "Aucune modification enregistrée pour le moment."}</p>
      </div>

      <div className="grid content-start gap-4">
        <Section title="Cycle de vie">
          <div className="grid gap-3 text-sm">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Date de décision</label>
              <AutoField model="edition" id={e.id} field="decisionDate" type="date" value={e.decisionDate} readOnly={!canStatus} />
            </div>
            <AutoField model="edition" id={e.id} field="conditionalStart" type="bool" value={e.conditionalStart} readOnly={!canStatus} placeholder="Démarrage conditionné à la notification" />
            <p className="text-xs text-muted-foreground">Par défaut, une édition démarre sans attendre la notification du financeur.</p>
          </div>
        </Section>

        <Section title="Équipe projet" description="Choisie par le pilote">
          <TeamPicker editionId={e.id} people={people.map((p) => ({ id: p.id, name: p.name }))} selected={e.team.map((t) => t.personId)} readOnly={!canWriteLayer(me.role, "proposal", isPilot, isTeam)} />
        </Section>

        <Section title="Historique" description="Qui a changé quoi">
          {e.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto text-xs" data-testid="changelog">
              {e.changes.map((c) => (
                <li key={c.id} className="border-l-2 border-secondary pl-2">
                  <div className="font-medium">{FIELDS.edition[c.field]?.label ?? c.field}</div>
                  <div className="text-muted-foreground">{c.author.name} · {fmtDate(c.createdAt, "D MMM YYYY HH:mm")}</div>
                  {c.after && <div className="truncate text-muted-foreground" title={c.after}>→ {c.after}</div>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
