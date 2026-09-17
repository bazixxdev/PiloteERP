"use client";

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Liste déroulante de l'outil (retours de Gaël, 17/09 : « skiner les menus déroulants », « une search intégrée quand il y a
// beaucoup d'éléments », « tu n'as pas passé tous les déroulants ») : plus aucun <select> natif à l'écran. Le déclencheur a le
// dessin d'un champ ; la liste est la nôtre ; le champ de recherche n'apparaît qu'au-delà de `searchFrom` éléments (accents
// ignorés). Avec `name`, la valeur part dans le formulaire (champ caché). `Select`, plus bas, garde l'API du <select> natif.
export type SelectOption = { value: string; label: string; hint?: string; group?: string };

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function SearchableSelect({
  options, value, onChange, placeholder = "—", emptyOption, name, id, className, contentClassName, searchFrom = 8, disabled, align = "start", autoFocus,
  "aria-label": ariaLabel, "data-testid": testId, "data-highlight": highlight,
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
  autoFocus?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
  "data-highlight"?: string;
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
        data-highlight={highlight}
        autoFocus={autoFocus}
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
          <div ref={listRef} id={listId} role="listbox" data-slot="select-list" tabIndex={-1} onKeyDown={searchable ? undefined : onKey} className="max-h-64 overflow-y-auto outline-none" aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}>
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
                    data-value={o.value}
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

// Remplaçant direct du <select> natif (retour de Gaël, 17/09 : « tu n'as pas passé tous les déroulants ») : même API —
// `value` / `defaultValue`, `onChange` avec `e.target.value`, enfants <option> et <optgroup> — mais notre liste à l'écran.
// Sert à convertir les écrans existants sans les réécrire ; pour un nouveau composant, préférer SearchableSelect.
type OptionEl = ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
type GroupEl = ReactElement<{ label?: string; children?: ReactNode }>;

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function optionsFrom(children: ReactNode, group?: string): SelectOption[] {
  const out: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "optgroup") { out.push(...optionsFrom((child as GroupEl).props.children, (child as GroupEl).props.label)); return; }
    if (child.type === "option") { const o = child as OptionEl; out.push({ value: String(o.props.value ?? textOf(o.props.children)), label: textOf(o.props.children), group }); return; }
    if (Array.isArray((child.props as { children?: ReactNode }).children)) out.push(...optionsFrom((child.props as { children?: ReactNode }).children, group));
  });
  return out;
}

export function Select({
  value, defaultValue, onChange, children, className, name, id, disabled, searchFrom, align, placeholder, autoFocus,
  "aria-label": ariaLabel, "data-testid": testId, "data-highlight": highlight,
}: {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  searchFrom?: number;
  align?: "start" | "end";
  placeholder?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
  "data-highlight"?: string;
}) {
  const options = useMemo(() => optionsFrom(children), [children]);
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = value !== undefined ? String(value) : inner;
  return (
    <SearchableSelect
      options={options}
      value={current}
      onChange={(v) => { setInner(v); onChange?.({ target: { value: v } }); }}
      name={name}
      id={id}
      disabled={disabled}
      searchFrom={searchFrom}
      align={align}
      placeholder={placeholder ?? options[0]?.label ?? "—"}
      className={className}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      data-testid={testId}
      data-highlight={highlight}
    />
  );
}
