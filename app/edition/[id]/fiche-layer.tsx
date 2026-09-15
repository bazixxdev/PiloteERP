"use client";

import { useState } from "react";
import { Pencil, Check, ChevronDown } from "lucide-react";
import { AutoField, readableValue, type Option } from "@/components/inline/auto-field";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import type { FieldType } from "@/lib/fields";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FieldRemarks, type RemarkView } from "./remarks";

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
  // Remarques accrochées aux rubriques de cette couche, et droits associés.
  remarks: RemarkView[];
  canRemark: boolean;
  canResolve: boolean;
  meId: string;
  isDirector: boolean;
  // Fiche validée : couche verrouillée ; le texte reste lisible en entier, « Replier » le ramène à la liste de ses rubriques.
  locked?: boolean;
  pendingProposals?: number;
  // Couche facultative (logistique) : jamais de couleur d'alerte quand elle est vide, jamais ouverte en saisie d'office.
  optional?: boolean;
  // Fiche validée : plus de compteur « n/m » nulle part, même sur la couche 4.
  hideCount?: boolean;
};

const filledOf = (f: LayerField) => f.value !== null && f.value !== undefined && f.value !== "" && f.value !== false;

// Une couche de la fiche : lecture d'abord, « Modifier cette couche » pour son propriétaire.
export function FicheLayer(p: Props) {
  const [editing, setEditing] = useState(p.defaultEditing && !p.optional);
  // Fiche validée : texte lisible en entier (la Fiche n'est plus l'onglet d'atterrissage, on vient pour la lire) ; replié à la demande.
  const [expanded, setExpanded] = useState(true);
  const filled = p.fields.filter(filledOf).length;
  const empty = filled === 0;
  const edit = p.writable && !p.locked && editing;
  const fieldId = (key: string) => `edition-${p.editionId}-${key}`;
  const openRemarks = p.remarks.filter((r) => !r.resolvedAt).length;
  const remarksOf = (key: string, label: string) => (
    <FieldRemarks editionId={p.editionId} field={key} fieldLabel={label} remarks={p.remarks.filter((r) => r.field === key)} canWrite={p.canRemark} canResolve={p.canResolve} meId={p.meId} isDirector={p.isDirector} />
  );

  return (
    <section id={`couche-${p.layerKey}`} data-testid={`layer-${p.layerKey}`} className={cn("min-w-0 scroll-mt-20 overflow-hidden rounded-md border bg-card px-[18px] py-4", empty && !edit && "border-dashed bg-muted/40")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className={cn("grid size-[26px] shrink-0 place-items-center rounded-full border font-serif text-sm", empty ? "border-[#c9cdc5] text-muted-foreground" : "border-[#bfccba] text-mint")}>{p.no}</span>
          <h4 className="text-sm font-bold text-foreground">{p.title}</h4>
          {/* Après validation, plus de compteur « n/m » : la fiche est ce qu'elle est. En rédaction, il guide. */}
          {empty ? (
            <StatusBadge label={p.optional ? "À compléter au fil de l'année" : `Manquant — ${p.ownerMissingLabel}`} color={p.optional ? "muted" : "warning"} dot={false} />
          ) : !p.locked && !p.optional && !p.hideCount ? (
            <StatusBadge label={`${filled}/${p.fields.length} renseignés`} color={filled === p.fields.length ? "mint" : "info"} dot={false} />
          ) : null}
          {openRemarks > 0 && <span data-testid={`layer-remarks-${p.layerKey}`}><StatusBadge label={`${openRemarks} remarque${openRemarks > 1 ? "s" : ""} à traiter`} color="warning" /></span>}
          {(p.pendingProposals ?? 0) > 0 && <StatusBadge label={`${p.pendingProposals} proposition${p.pendingProposals! > 1 ? "s" : ""}`} color="info" dot={false} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{p.owner}{!p.writable && !p.locked && " · lecture seule pour vous"}</span>
          {p.locked && !empty && <Button size="xs" variant="ghost" onClick={() => setExpanded((x) => !x)} data-testid={`layer-toggle-${p.layerKey}`}><ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />{expanded ? "Replier" : "Déplier"}</Button>}
          {p.writable && !p.locked && (
            edit ? (
              <Button size="xs" variant="outline" onClick={() => setEditing(false)} data-testid={`layer-done-${p.layerKey}`}><Check />Terminer</Button>
            ) : (
              <Button size="xs" variant={empty && !p.optional ? "default" : "outline"} onClick={() => setEditing(true)} data-testid={`layer-edit-${p.layerKey}`}><Pencil />{empty ? "Compléter" : "Modifier"}</Button>
            )
          )}
        </div>
      </div>

      {empty && !edit ? (
        <div className="mt-2 ml-9 grid gap-1 text-xs text-muted-foreground">
          {p.optional
            ? <p>{p.fields.map((f) => f.label).join(" · ")} — à renseigner quand c'est utile.</p>
            : <p><b className="text-foreground">{p.ownerMissingLabel.replace(/^./, (c) => c.toUpperCase())}.</b> {p.writable ? "Cliquez sur « Compléter » pour la remplir." : "Les champs manquants restent attribués à leur propriétaire."}</p>}
          {p.fields.filter((f) => p.remarks.some((r) => r.field === f.key)).map((f) => <div key={f.key}><span className="text-[10px]">{f.label}</span>{remarksOf(f.key, f.label)}</div>)}
        </div>
      ) : p.locked && !expanded ? (
        <p className="mt-2 ml-9 text-xs text-muted-foreground" data-testid={`layer-summary-${p.layerKey}`}>{readRows(p.fields).filter((r) => !r.empty).map((r) => r.label).join(" · ")}</p>
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
                {remarksOf(f.key, f.label)}
              </div>
            );
          })}
        </div>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:ml-9">
          {/* En lecture, les rubriques vides d'une fiche validée ne s'affichent pas : on lit ce qui a été écrit. */}
          {readRows(p.fields).filter((r) => !(p.locked && r.empty && !p.remarks.some((k) => k.field === r.key))).map((r) => (
            <div key={r.key} className={cn("min-w-0", r.wide && "sm:col-span-2")}>
              <dt className="text-[10px] text-muted-foreground">{r.label}</dt>
              <dd data-testid={`field-${r.key}`} data-readonly="true" className={cn("mt-0.5 whitespace-pre-line text-sm leading-relaxed", r.empty ? "italic text-muted-foreground" : "text-foreground")}>{r.text}</dd>
              {remarksOf(r.key, r.label)}
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
