"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Liste déroulante habillée avec recherche intégrée (retour de Gaël, 17/09 : « prévoir une search intégrée quand y a beaucoup
// d'éléments »). Pour les listes longues — personnes, projets et éditions, financeurs. Les petites listes (statuts, natures…)
// restent des <select> natifs, habillés en CSS (globals.css). Le déclencheur a le même dessin qu'un <select> ; le champ de
// recherche n'apparaît qu'au-delà de `searchFrom` éléments. Avec `name`, la valeur part dans le formulaire (champ caché).
export type SelectOption = { value: string; label: string; hint?: string; group?: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SearchableSelect({
  options, value, onChange, placeholder = "—", emptyOption, name, id, className, contentClassName, searchFrom = 8, disabled, align = "start",
  "aria-label": ariaLabel, "data-testid": testId,
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string; // texte du déclencheur quand rien n'est choisi
  emptyOption?: string; // si fourni, une première entrée « aucun » qui vaut ""
  name?: string;
  id?: string;
  className?: string;
  contentClassName?: string;
  searchFrom?: number;
  disabled?: boolean;
  align?: "start" | "end";
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const all = useMemo<SelectOption[]>(() => (emptyOption !== undefined ? [{ value: "", label: emptyOption }, ...options] : options), [options, emptyOption]);
  const searchable = all.length > searchFrom;
  const shown = useMemo(() => {
    const q = fold(query.trim());
    return q ? all.filter((o) => fold(`${o.label} ${o.hint ?? ""} ${o.group ?? ""}`).includes(q)) : all;
  }, [all, query]);
  const selected = all.find((o) => o.value === value);

  // À l'ouverture : recherche vide, curseur sur l'entrée choisie ; l'entrée active reste visible au clavier.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, all.findIndex((o) => o.value === value)));
  }, [open, all, value]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (o: SelectOption) => { onChange(o.value); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(shown.length - 1); }
  };

  // Groupes (équivalent des <optgroup>) : un intertitre dès que le groupe change, dans l'ordre reçu.
  let lastGroup: string | undefined;
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value} />}
      <PopoverPrimitive.Trigger
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        data-testid={testId}
        data-value={value}
        disabled={disabled}
        className={cn(
          "inline-flex h-8 max-w-full items-center justify-between gap-2 rounded-lg border bg-card px-2 text-left text-sm text-foreground transition-colors hover:border-[#b8c6cc] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-55",
          !selected?.value && "text-muted-foreground",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={4}
          onOpenAutoFocus={(e) => { if (!searchable) { e.preventDefault(); listRef.current?.focus(); } }}
          className={cn("z-50 flex w-[var(--radix-popover-trigger-width)] min-w-56 max-w-[min(90vw,26rem)] flex-col rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0", contentClassName)}
        >
          {searchable && (
            <div className="mb-1 flex items-center gap-1.5 border-b px-2 pb-1.5 pt-1">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder="Rechercher…"
                aria-label="Rechercher dans la liste"
                data-testid={testId ? `${testId}-search` : undefined}
                className="h-7 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && <span className="shrink-0 text-[11px] text-muted-foreground">{shown.length}</span>}
            </div>
          )}
          <div ref={listRef} id={listId} role="listbox" tabIndex={-1} onKeyDown={searchable ? undefined : onKey} className="max-h-64 overflow-y-auto outline-none" aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}>
            {shown.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Aucun résultat.</p>}
            {shown.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group ?? lastGroup;
              return (
                <div key={`${o.value}|${o.label}`}>
                  {header && <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{header}</div>}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={o.value === value}
                    data-index={i}
                    data-active={i === active || undefined}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5", i === active && "bg-secondary text-primary", o.value === value && "font-semibold text-primary", !o.value && "text-muted-foreground")}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}{o.hint && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{o.hint}</span>}</span>
                    {o.value === value && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                  </div>
                </div>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
