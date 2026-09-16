"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveField } from "@/app/actions/fields";
import type { Model, FieldType } from "@/lib/fields";
import { cn } from "@/lib/utils";

import { readableValue, type Option } from "@/lib/readable";
export { readableValue, type Option };

type Props = {
  model: Model;
  id: string;
  field: string;
  type: FieldType;
  value: string | number | boolean | Date | null | undefined;
  options?: Option[];
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  rows?: number;
  suffix?: string;
  revalidate?: string;
  refreshOnSave?: boolean;
  allowEmpty?: boolean;
  testId?: string;
  // Nom accessible du contrôle (« Objectif en heures, Atelier de lancement ») ; sinon le champ compte sur un <label htmlFor>.
  label?: string;
  // Identifiant DOM, pour associer un <label htmlFor>.
  inputId?: string;
  onSaved?: (value: unknown) => void;
  // Champ « d'où l'on vient » (clic sur un chiffre d'une autre page) : surligné et focalisé à l'ouverture du panneau.
  highlight?: boolean;
};

function toInput(type: FieldType, v: Props["value"]): string {
  if (v === null || v === undefined) return "";
  if (type === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    // Date locale, pas UTC : un 15/10 à minuit (Paris) resterait un 15/10.
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return String(v);
}

// Champ à sauvegarde automatique : enregistre au blur (texte, nombre) ou au changement (liste, date, case).
// En lecture seule, il s'affiche en texte compact plutôt qu'en champ grisé.
export function AutoField(p: Props) {
  const [val, setVal] = useState(toInput(p.type, p.value));
  const [checked, setChecked] = useState(p.type === "bool" ? Boolean(p.value) : false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const lastSent = useRef(toInput(p.type, p.value));
  const router = useRouter();

  useEffect(() => {
    setVal(toInput(p.type, p.value));
    lastSent.current = toInput(p.type, p.value);
    if (p.type === "bool") setChecked(Boolean(p.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.value]);

  const send = (next: string | boolean) => {
    if (p.readOnly) return;
    const asString = String(next);
    if (asString === lastSent.current) return;
    lastSent.current = asString;
    start(async () => {
      const res = await saveField(p.model, p.id, p.field, next, p.revalidate);
      if (!res.ok) {
        toast.error(res.error);
        setVal(toInput(p.type, p.value));
        lastSent.current = toInput(p.type, p.value);
        if (p.type === "bool") setChecked(Boolean(p.value));
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      p.onSaved?.(next);
      if (p.refreshOnSave) router.refresh();
    });
  };

  if (p.readOnly && p.type !== "bool") {
    const text = readableValue(p);
    const empty = text === "";
    return (
      <div
        data-testid={p.testId}
        data-readonly="true"
        id={p.inputId}
        aria-label={p.label}
        className={cn(
          "min-h-7 whitespace-pre-line rounded-lg px-2 py-1 text-sm leading-relaxed",
          p.type === "number" && "tabular text-right",
          empty ? "text-muted-foreground italic" : "text-foreground",
          p.highlight && "bg-warning-soft/60 ring-2 ring-coral/40",
          p.className,
          p.inputClassName,
        )}
        data-highlight={p.highlight ? "true" : undefined}
      >
        {empty ? (p.placeholder ?? "Non renseigné") : text}
      </div>
    );
  }

  const base = cn(
    "w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm transition-colors hover:border-border focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20",
    p.highlight && "border-coral bg-warning-soft/60 ring-2 ring-coral/40",
    p.inputClassName,
  );

  const status = (
    <span className={cn("pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-mint transition-opacity", saved || pending ? "opacity-100" : "opacity-0")}>
      {pending ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : <Check className="size-3" />}
    </span>
  );

  if (p.type === "bool") {
    return (
      <label className={cn("inline-flex items-center gap-2 text-sm", p.className)}>
        <input
          type="checkbox"
          id={p.inputId}
          data-testid={p.testId}
          data-readonly={p.readOnly ? "true" : undefined}
          aria-label={p.label}
          className="size-4 rounded border-border accent-primary"
          checked={checked}
          disabled={p.readOnly}
          onChange={(e) => { setChecked(e.target.checked); send(e.target.checked); }}
        />
        {p.placeholder}
        {saved && <Check className="size-3 text-mint" />}
      </label>
    );
  }

  if (p.type === "select") {
    return (
      <div className={cn("relative", p.className)}>
        <select
          id={p.inputId}
          data-testid={p.testId}
          data-highlight={p.highlight ? "true" : undefined}
          autoFocus={p.highlight}
          aria-label={p.label}
          className={cn(base, "appearance-none pr-6")}
          value={val}
          onChange={(e) => { setVal(e.target.value); send(e.target.value); }}
        >
          {(p.allowEmpty ?? true) && <option value="">{p.placeholder ?? "—"}</option>}
          {(p.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {status}
      </div>
    );
  }

  if (p.type === "textarea") {
    return (
      <div className={cn("relative", p.className)}>
        <textarea
          id={p.inputId}
          data-testid={p.testId}
          data-highlight={p.highlight ? "true" : undefined}
          autoFocus={p.highlight}
          aria-label={p.label}
          className={cn(base, "min-h-[2.25rem] resize-y leading-relaxed")}
          rows={p.rows ?? 3}
          value={val}
          placeholder={p.placeholder}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => send(val)}
        />
        {status}
      </div>
    );
  }

  return (
    <div className={cn("relative", p.className)}>
      <input
        id={p.inputId}
        data-testid={p.testId}
        data-highlight={p.highlight ? "true" : undefined}
        autoFocus={p.highlight}
        aria-label={p.label}
        type={p.type === "number" ? "number" : p.type === "date" ? "date" : "text"}
        step={p.type === "number" ? "any" : undefined}
        className={cn(base, p.type === "number" && "tabular min-w-[6.5rem] text-right", p.suffix && "pr-8")}
        value={val}
        placeholder={p.placeholder}
        onChange={(e) => { setVal(e.target.value); if (p.type === "date") send(e.target.value); }}
        onBlur={() => send(val)}
        onKeyDown={(e) => { if (e.key === "Enter" && p.type !== "date") (e.target as HTMLInputElement).blur(); }}
      />
      {p.suffix && !saved && !pending && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">{p.suffix}</span>}
      {status}
    </div>
  );
}
