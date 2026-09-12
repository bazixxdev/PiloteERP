import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { FIELDS } from "@/lib/fields";
import { canWriteLayer, LAYER_OWNER_LABEL, type Layer } from "@/lib/rights";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { TeamPicker } from "./team-picker";

const LAYERS: { key: Layer; title: string; fields: string[] }[] = [
  { key: "strategic", title: "Couche 1 · Cadre stratégique", fields: ["stakes", "axis", "sressMeasure", "yearPriorities", "expectedOutcome"] },
  { key: "means", title: "Couche 2 · Cadre de moyens", fields: ["plannedFunders", "directExpenseEnvelope", "fte", "imposedIndicators"] },
  { key: "proposal", title: "Couche 3 · Proposition opérationnelle", fields: ["operationalObjectives", "calendar", "partners", "method", "governance", "ownIndicators", "timeNeed", "budgetNeed"] },
  { key: "validation", title: "Couche 4 · Validation", fields: ["codirDecision", "codirDate", "boardValidated", "boardDate"] },
  { key: "year", title: "Au fil de l'année", fields: ["venues", "equipment", "evidenceToKeep"] },
];

export function FicheTab({ e, me, refs, isPilot, isTeam, people }: TabCtx) {
  const row = e as unknown as Record<string, unknown>;
  const canStatus = me.role === "director" || me.role === "raf";
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-4">
        {LAYERS.map((layer) => {
          const writable = canWriteLayer(me.role, layer.key, isPilot, isTeam, e.project.poleId === me.poleId);
          const filled = layer.fields.filter((f) => { const v = row[f]; return v !== null && v !== undefined && v !== "" && v !== false; }).length;
          const empty = filled === 0;
          return (
            <Section
              key={layer.key}
              title={layer.title}
              description={<span>{LAYER_OWNER_LABEL[layer.key]}{!writable && " · lecture seule pour vous"}</span>}
              actions={empty ? <StatusBadge label={`Manquant — ${LAYER_OWNER_LABEL[layer.key]}`} color="warning" dot={false} /> : <StatusBadge label={`${filled}/${layer.fields.length} renseignés`} color={filled === layer.fields.length ? "mint" : "info"} dot={false} />}
              className={cn(empty && "bg-muted/40")}
              testId={`layer-${layer.key}`}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {layer.fields.map((f) => {
                  const def = FIELDS.edition[f];
                  const value = row[f] as string | number | boolean | Date | null;
                  const wide = def.type === "textarea";
                  return (
                    <div key={f} className={cn("grid gap-1", wide && "sm:col-span-2")}>
                      <label className="text-xs font-medium text-muted-foreground">{def.label}</label>
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
            </Section>
          );
        })}
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
