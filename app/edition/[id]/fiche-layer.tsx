"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { AutoField, readableValue, type Option } from "@/components/inline/auto-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import type { FieldType } from "@/lib/fields";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LayerField = { key: string; label: string; type: FieldType; value: string | number | boolean | Date | null; options?: Option[]; suffix?: string };

type Props = {
  editionId: string;
  layerKey: string;
  no: string;
  title: string;
  owner: string;
  ownerMissingLabel: string;
  fields: LayerField[];
  writable: boolean;
  // Une couche vide que je peux remplir s'ouvre directement en saisie ; une couche remplie se lit, et se modifie sur demande.
  defaultEditing: boolean;
};

const filledOf = (f: LayerField) => f.value !== null && f.value !== undefined && f.value !== "" && f.value !== false;

// Une couche de la fiche : lecture compacte par défaut, « Modifier cette couche » pour son propriétaire.
export function FicheLayer(p: Props) {
  const [editing, setEditing] = useState(p.defaultEditing);
  const filled = p.fields.filter(filledOf).length;
  const empty = filled === 0;
  const edit = p.writable && editing;
  const fieldId = (key: string) => `edition-${p.editionId}-${key}`;

  return (
    <section data-testid={`layer-${p.layerKey}`} className={cn("rounded-md border bg-card px-[18px] py-4", empty && !edit && "border-dashed bg-muted text-muted-foreground")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("grid size-[26px] place-items-center rounded-full border font-serif text-sm", empty ? "border-[#c9cdc5] text-muted-foreground" : "border-[#bfccba] text-mint")}>{p.no}</span>
          <h4 className="text-sm font-bold text-foreground">{p.title}</h4>
          {empty ? <StatusBadge label={`Manquant — ${p.ownerMissingLabel}`} color="warning" dot={false} /> : <StatusBadge label={`${filled}/${p.fields.length} renseignés`} color={filled === p.fields.length ? "mint" : "info"} dot={false} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{p.owner}{!p.writable && " · lecture seule pour vous"}</span>
          {p.writable && (
            edit ? (
              <Button size="xs" variant="outline" onClick={() => setEditing(false)} data-testid={`layer-done-${p.layerKey}`}><Check />Terminer</Button>
            ) : (
              <Button size="xs" variant="outline" onClick={() => setEditing(true)} data-testid={`layer-edit-${p.layerKey}`}><Pencil />Modifier cette couche</Button>
            )
          )}
        </div>
      </div>

      {empty && !edit ? (
        <p className="mt-2.5 ml-9 text-xs"><b>{p.ownerMissingLabel.replace(/^./, (c) => c.toUpperCase())}.</b> {p.writable ? "Cliquez sur « Modifier cette couche » pour la remplir." : "Les champs manquants restent attribués à leur propriétaire."}</p>
      ) : edit ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:ml-9">
          {p.fields.map((f) => {
            const wide = f.type === "textarea";
            const isBool = f.type === "bool";
            return (
              <div key={f.key} className={cn("grid gap-1", wide && "sm:col-span-2")}>
                {!isBool && <label htmlFor={fieldId(f.key)} className="text-[10px] text-muted-foreground">{f.label}</label>}
                <AutoField
                  model="edition" id={p.editionId} field={f.key} type={f.type} value={f.value} testId={`field-${f.key}`} inputId={fieldId(f.key)}
                  placeholder={isBool ? f.label : "À compléter…"} suffix={f.suffix} options={f.options}
                  inputClassName={cn(f.type === "textarea" && "min-h-[3.5rem]")}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:ml-9">
          {readRows(p.fields).map((r) => (
            <div key={r.key} className={cn("min-w-0", r.wide && "sm:col-span-2")}>
              <dt className="text-[10px] text-muted-foreground">{r.label}</dt>
              <dd data-testid={`field-${r.key}`} data-readonly="true" className={cn("mt-0.5 whitespace-pre-line text-sm leading-relaxed", r.empty ? "italic text-muted-foreground" : "text-foreground")}>{r.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

// Lignes de lecture : un booléen daté se lit en une phrase (« Validé par le CA le 18 décembre 2025 »), jamais comme un champ vide.
function readRows(fields: LayerField[]) {
  const out: { key: string; label: string; text: string; empty: boolean; wide: boolean }[] = [];
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  for (const f of fields) {
    if (f.key === "boardDate" && byKey.boardValidated) continue; // absorbé dans la ligne « Validation par le CA »
    if (f.key === "boardValidated") {
      const date = byKey.boardDate?.value as Date | string | null | undefined;
      const codirDone = filledOf(byKey.codirDecision ?? f);
      const text = f.value
        ? `Validé par le CA${date ? ` le ${fmtDate(date, "D MMMM YYYY")}` : " (date non renseignée)"}`
        : codirDone ? "En attente du CA" : "Non renseigné";
      out.push({ key: f.key, label: "Validation par le CA", text, empty: !f.value && !codirDone, wide: false });
      continue;
    }
    const text = readableValue(f);
    out.push({ key: f.key, label: f.label, text: text || "Non renseigné", empty: text === "", wide: f.type === "textarea" && text.length > 80 });
  }
  return out;
}
