"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveField } from "@/app/actions/fields";
import type { Model, FieldType } from "@/lib/fields";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

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
  onSaved?: (value: unknown) => void;
};

function toInput(type: FieldType, v: Props["value"]): string {
  if (v === null || v === undefined) return "";
  if (type === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  return String(v);
}

// Champ à sauvegarde automatique : enregistre au blur (texte, nombre) ou au changement (liste, date, case).
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

  const base = cn(
    "w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm transition-colors hover:border-border focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20",
    p.readOnly && "cursor-default hover:border-transparent",
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
          data-testid={p.testId}
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
          data-testid={p.testId}
          className={cn(base, "appearance-none pr-6")}
          value={val}
          disabled={p.readOnly}
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
          data-testid={p.testId}
          className={cn(base, "min-h-[2.25rem] resize-y leading-relaxed")}
          rows={p.rows ?? 3}
          value={val}
          readOnly={p.readOnly}
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
        data-testid={p.testId}
        type={p.type === "number" ? "number" : p.type === "date" ? "date" : "text"}
        step={p.type === "number" ? "any" : undefined}
        className={cn(base, p.type === "number" && "tabular text-right", p.suffix && "pr-8")}
        value={val}
        readOnly={p.readOnly}
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
