"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NOTE_COLORS, noteColor } from "@/lib/notes";
import { cn } from "@/lib/utils";

// Pastille de couleur de la note : un repère visuel pour ranger et retrouver, pas un statut.
export function ColorPicker({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const c = noteColor(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} title="Couleur de la note" aria-label={`Couleur : ${c?.label ?? "aucune"}`} className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50" data-testid="note-color">
          <span className="size-3 rounded-full border" style={c ? { background: c.hex, borderColor: c.hex } : { background: "repeating-linear-gradient(45deg, transparent 0 2px, var(--border) 2px 3px)" }} />{c?.label ?? "Couleur"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="mb-1.5 text-[11px] font-semibold">Couleur</div>
        <div className="flex items-center gap-1.5">
          <button type="button" title="Aucune" aria-label="Aucune couleur" onClick={() => onChange(null)} className={cn("size-6 rounded-full border-2", !value ? "border-foreground" : "border-transparent")} style={{ background: "repeating-linear-gradient(45deg, transparent 0 3px, var(--border) 3px 4px)" }} data-testid="note-color-none" />
          {NOTE_COLORS.map((k) => (
            <button key={k.value} type="button" title={k.label} aria-label={k.label} aria-pressed={value === k.value} onClick={() => onChange(k.value)} className={cn("size-6 rounded-full border-2", value === k.value ? "border-foreground" : "border-transparent hover:border-border")} style={{ background: k.hex }} data-testid={`note-color-${k.value}`} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
