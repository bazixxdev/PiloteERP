"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FolderInput, Pencil, Trash2, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SearchableSelect, Select } from "@/components/common/searchable-select";
import { bulkAddToList, bulkDeleteContacts, bulkRemoveFromList, bulkUpdateContacts, exportContactsCsv, type BulkPatch } from "@/app/actions/contacts";
import { BREVO_STATUS, type ListField } from "@/lib/contacts";
import { cn } from "@/lib/utils";

// Outils communs aux deux tableaux de contacts (annuaire et liste, 19/09) : tri par colonne, filtres par colonne, sélection
// multiple et actions groupées. Tout se calcule dans le navigateur : quelques centaines de lignes, c'est instantané, et ça vaut
// aussi pour les listes miroir. Les actions groupées appellent les actions serveur de app/actions/contacts.ts.

export type CellValue = string | number | boolean | null;
export type Column<Row> = {
  key: string;
  label: string;
  get: (row: Row) => CellValue;
  // Comment filtrer : texte libre (défaut), choix parmi des valeurs, ou oui / non. `false` = pas de filtre sur cette colonne.
  filter?: "text" | "bool" | { options: string[] } | false;
  sortable?: boolean;
  className?: string;
};

export type Sort = { key: string; dir: "asc" | "desc" } | null;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const text = (v: CellValue) => (v == null ? "" : typeof v === "boolean" ? (v ? "oui" : "non") : String(v));
function compare(a: CellValue, b: CellValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // les vides en dernier
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(b) - Number(a); // cochés d'abord
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
}

// L'état d'un tableau : la vue (filtrée puis triée), le tri, les filtres, la sélection (par identifiant de ligne).
export function useContactsTable<Row>(rows: Row[], columns: Column<Row>[], idOf: (row: Row) => string, quick: (row: Row) => string, initial: { q?: string; filters?: Record<string, string> } = {}) {
  const [sort, setSort] = useState<Sort>(null);
  const [filters, setFilters] = useState<Record<string, string>>(initial.filters ?? {});
  const [q, setQ] = useState(initial.q ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const view = useMemo(() => {
    const nq = norm(q.trim());
    let out = rows.filter((r) => {
      if (nq && !norm(quick(r)).includes(nq)) return false;
      for (const c of columns) {
        const f = filters[c.key];
        if (!f) continue;
        const v = c.get(r);
        if (c.filter === "bool") { if ((f === "oui") !== Boolean(v)) return false; }
        else if (c.filter && typeof c.filter === "object") { if (text(v) !== f) return false; }
        else if (!norm(text(v)).includes(norm(f))) return false;
      }
      return true;
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) out = [...out].sort((a, b) => compare(col.get(a), col.get(b)) * (sort.dir === "asc" ? 1 : -1));
    }
    return out;
  }, [rows, columns, filters, q, sort, quick]);
  const viewIds = useMemo(() => view.map(idOf), [view, idOf]);
  const selectedInView = viewIds.filter((id) => selected.has(id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => (selectedInView.length === viewIds.length ? new Set([...s].filter((id) => !viewIds.includes(id))) : new Set([...s, ...viewIds])));
  const clear = () => setSelected(new Set());
  const setFilter = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const hasFilters = Boolean(q.trim()) || Object.values(filters).some(Boolean);
  const resetFilters = () => { setQ(""); setFilters({}); };
  return { view, sort, setSort, filters, setFilter, q, setQ, hasFilters, resetFilters, selected, selectedInView, toggle, toggleAll, clear, allInViewSelected: viewIds.length > 0 && selectedInView.length === viewIds.length };
}

export function SortTh({ col, sort, setSort, children, className }: { col: { key: string; label: string; sortable?: boolean }; sort: Sort; setSort: (s: Sort) => void; children?: ReactNode; className?: string }) {
  const active = sort?.key === col.key;
  if (col.sortable === false) return <th className={cn("px-2 py-1.5", className)}>{children ?? col.label}</th>;
  const Icon = active ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={cn("px-2 py-1.5", className)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort(active && sort!.dir === "asc" ? { key: col.key, dir: "desc" } : active ? null : { key: col.key, dir: "asc" })} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-primary")} title={`Trier par ${col.label.toLowerCase()}`} data-testid={`sort-${col.key}`}>
        {children ?? col.label}<Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

// La ligne de filtres sous l'en-tête : un champ par colonne filtrable.
export function FilterCell<Row>({ col, value, onChange, rows }: { col: Column<Row>; value: string; onChange: (v: string) => void; rows: Row[] }) {
  if (col.filter === false) return <th className="px-2 py-1" />;
  const testId = `filter-${col.key}`;
  if (col.filter === "bool") {
    return <th className="px-2 py-1 font-normal"><Select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-full text-xs" aria-label={`Filtrer ${col.label}`} data-testid={testId}><option value="">Tout</option><option value="oui">Oui</option><option value="non">Non</option></Select></th>;
  }
  if (col.filter && typeof col.filter === "object") {
    const options = col.filter.options.length ? col.filter.options : Array.from(new Set(rows.map((r) => text(col.get(r))).filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));
    return <th className="px-2 py-1 font-normal"><Select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-full text-xs" aria-label={`Filtrer ${col.label}`} data-testid={testId}><option value="">Tout</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</Select></th>;
  }
  return <th className="px-2 py-1 font-normal"><Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Filtrer…" className="h-7 text-xs" aria-label={`Filtrer ${col.label}`} data-testid={testId} /></th>;
}

export const BREVO_FILTER_OPTIONS = ["Hors Brevo", ...Object.values(BREVO_STATUS).map((s) => s.label)];
export const brevoLabel = (status: string | null) => (status ? BREVO_STATUS[status]?.label ?? status : "Hors Brevo");

// ——— Le bandeau d'actions sur la sélection ———

export type BulkContext = {
  listId?: string | null; // la liste affichée (null = annuaire)
  listCanEdit?: boolean; // je peux modifier cette liste (auteur ou admin, pas un miroir)
  fields?: ListField[]; // colonnes propres de la liste affichée
  myLists: { id: string; name: string }[]; // mes listes (cibles d'ajout / déplacement)
  organisations: { id: string; name: string }[];
  isAdmin: boolean;
  brevoConfigured: boolean;
  hasBrevo: (ids: string[]) => number; // combien de contacts sélectionnés viennent de Brevo
  run: (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (r: { data?: unknown }) => void) => void;
  pending: boolean;
};

export function BulkBar({ ids, total, allSelected, onSelectAll, onClear, ctx }: { ids: string[]; total: number; allSelected: boolean; onSelectAll: () => void; onClear: () => void; ctx: BulkContext }) {
  const [dialog, setDialog] = useState<"add" | "move" | "edit" | "delete" | null>(null);
  if (ids.length === 0) return null;
  const exportCsv = () => ctx.run(() => exportContactsCsv(ids, ctx.listId ?? null), (r) => {
    const d = r.data as { csv: string; name: string };
    const url = URL.createObjectURL(new Blob([d.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = d.name; a.click(); URL.revokeObjectURL(url);
  });
  const removeFromList = () => { if (confirm(`Retirer ${ids.length} contact${ids.length > 1 ? "s" : ""} de cette liste ? Ils restent dans l'annuaire.`)) ctx.run(() => bulkRemoveFromList(ctx.listId!, ids), () => { toast.success("Retirés de la liste"); onClear(); }); };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-info-soft px-4 py-2 text-xs" data-testid="bulk-bar">
      <span className="font-semibold" data-testid="bulk-count">{ids.length} sélectionné{ids.length > 1 ? "s" : ""}</span>
      {!allSelected && <button type="button" onClick={onSelectAll} className="text-primary hover:underline" data-testid="bulk-select-all">Tout sélectionner ({total})</button>}
      <button type="button" onClick={onClear} className="text-muted-foreground hover:underline" data-testid="bulk-clear">Tout désélectionner</button>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {ctx.myLists.length > 0 && <Button size="xs" variant="outline" disabled={ctx.pending} onClick={() => setDialog("add")} data-testid="bulk-add"><FolderInput />Ajouter à une liste</Button>}
        {ctx.listId && ctx.listCanEdit && ctx.myLists.some((l) => l.id !== ctx.listId) && <Button size="xs" variant="outline" disabled={ctx.pending} onClick={() => setDialog("move")} data-testid="bulk-move"><FolderInput />Déplacer</Button>}
        {(ctx.isAdmin || (ctx.listId && ctx.listCanEdit)) && <Button size="xs" variant="outline" disabled={ctx.pending} onClick={() => setDialog("edit")} data-testid="bulk-edit"><Pencil />Modifier</Button>}
        <Button size="xs" variant="outline" disabled={ctx.pending} onClick={exportCsv} data-testid="bulk-export"><Download />Exporter</Button>
        {ctx.listId && ctx.listCanEdit && <Button size="xs" variant="outline" disabled={ctx.pending} onClick={removeFromList} data-testid="bulk-remove"><UserMinus />Retirer de la liste</Button>}
        {ctx.isAdmin && <Button size="xs" variant="outline" className="text-danger hover:text-danger" disabled={ctx.pending} onClick={() => setDialog("delete")} data-testid="bulk-delete"><Trash2 />Supprimer définitivement</Button>}
        <button type="button" onClick={onClear} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Fermer la sélection"><X className="size-3.5" /></button>
      </div>
      {(dialog === "add" || dialog === "move") && <ListPickDialog move={dialog === "move"} ids={ids} ctx={ctx} onClose={() => setDialog(null)} onDone={onClear} />}
      {dialog === "edit" && <BulkEditDialog ids={ids} ctx={ctx} onClose={() => setDialog(null)} />}
      {dialog === "delete" && <BulkDeleteDialog ids={ids} ctx={ctx} onClose={() => setDialog(null)} onDone={onClear} />}
    </div>
  );
}

function ListPickDialog({ move, ids, ctx, onClose, onDone }: { move: boolean; ids: string[]; ctx: BulkContext; onClose: () => void; onDone: () => void }) {
  const targets = ctx.myLists.filter((l) => l.id !== ctx.listId);
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const submit = () => ctx.run(() => bulkAddToList(target, ids, move ? ctx.listId : null), (r) => {
    const d = r.data as { added: number; skipped: number; removed: number };
    toast.success(`${d.added} ajouté${d.added > 1 ? "s" : ""}${d.skipped ? ` · ${d.skipped} déjà dans la liste` : ""}${move ? ` · ${d.removed} retiré${d.removed > 1 ? "s" : ""} d'ici` : ""}`);
    onClose(); onDone();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm" data-testid="bulk-list-dialog">
        <DialogHeader><DialogTitle>{move ? "Déplacer vers une liste" : "Ajouter à une liste"}</DialogTitle><DialogDescription>{ids.length} contact{ids.length > 1 ? "s" : ""}{move ? " — retirés de la liste actuelle une fois ajoutés là-bas." : ". Un contact déjà dans la liste est ignoré."}</DialogDescription></DialogHeader>
        <label className="grid gap-1 text-sm"><span className="font-semibold">Liste</span><SearchableSelect options={targets.map((l) => ({ value: l.id, label: l.name }))} value={target} onChange={setTarget} aria-label="Liste cible" data-testid="bulk-list-target" /></label>
        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button><Button size="sm" disabled={!target || ctx.pending} onClick={submit} data-testid="bulk-list-submit">{move ? "Déplacer" : "Ajouter"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// Modifier : on choisit le champ, puis la valeur — appliquée à toute la sélection.
function BulkEditDialog({ ids, ctx, onClose }: { ids: string[]; ctx: BulkContext; onClose: () => void }) {
  type Choice = { value: string; label: string; group: string };
  const listChoices: Choice[] = ctx.listId && ctx.listCanEdit ? [{ value: "item:role", label: "Rôle dans la liste", group: "Cette liste" }, ...(ctx.fields ?? []).filter((f) => !f.synced).map((f) => ({ value: `item:${f.key}`, label: f.label, group: "Cette liste" }))] : [];
  const contactChoices: Choice[] = ctx.isAdmin ? [
    { value: "contact:organisationId", label: "Structure (de l'annuaire)", group: "Contact" }, { value: "contact:organisationName", label: "Structure (texte libre)", group: "Contact" },
    { value: "contact:role", label: "Fonction", group: "Contact" }, { value: "contact:city", label: "Ville", group: "Contact" }, { value: "contact:postcode", label: "Code postal", group: "Contact" },
    { value: "tags:add", label: "Ajouter un mot-clé", group: "Contact" }, { value: "tags:remove", label: "Retirer un mot-clé", group: "Contact" }, { value: "contact:leftAt", label: "Parti·e (plus en poste)", group: "Contact" },
  ] : [];
  const choices = [...listChoices, ...contactChoices];
  const [choice, setChoice] = useState(choices[0]?.value ?? "");
  const [value, setValue] = useState("");
  const field = choice.startsWith("item:") ? (choice === "item:role" ? { key: "role", label: "Rôle", type: "text" as const } : ctx.fields?.find((f) => `item:${f.key}` === choice)) : null;
  const patch = (): BulkPatch | null => {
    if (choice.startsWith("item:")) return { kind: "item", listId: ctx.listId!, key: choice.slice(5), value: field?.type === "bool" ? (value || "oui") === "oui" : value || null };
    if (choice === "tags:add" || choice === "tags:remove") return { kind: "tags", mode: choice === "tags:add" ? "add" : "remove", value };
    if (choice === "contact:leftAt") return { kind: "contact", field: "leftAt", value: value !== "non" };
    if (choice === "contact:organisationId") return { kind: "contact", field: "organisationId", value: value || null };
    return { kind: "contact", field: choice.slice(8) as "role" | "city" | "postcode" | "organisationName", value: value || null };
  };
  const submit = () => { const p = patch(); if (!p) return; ctx.run(() => bulkUpdateContacts(ids, p), (r) => { toast.success(`${(r.data as { updated: number }).updated} contact${ids.length > 1 ? "s" : ""} modifié${ids.length > 1 ? "s" : ""}`); onClose(); }); };
  const valueInput = () => {
    if (choice === "contact:organisationId") return <SearchableSelect options={ctx.organisations.map((o) => ({ value: o.id, label: o.name }))} value={value} onChange={setValue} emptyOption="— aucune —" aria-label="Structure" data-testid="bulk-edit-value" />;
    if (choice === "contact:leftAt" || field?.type === "bool") return <Select value={value || "oui"} onChange={(e) => setValue(e.target.value)} aria-label="Valeur" data-testid="bulk-edit-value"><option value="oui">Oui</option><option value="non">Non</option></Select>;
    if (field?.type === "select") return <Select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Valeur" data-testid="bulk-edit-value"><option value="">— vide —</option>{field.options?.map((o) => <option key={o} value={o}>{o}</option>)}</Select>;
    return <Input type={field?.type === "date" ? "date" : "text"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={choice.startsWith("tags:") ? "Mot-clé" : "Vide = effacer"} aria-label="Valeur" data-testid="bulk-edit-value" />;
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="bulk-edit-dialog">
        <DialogHeader><DialogTitle>Modifier {ids.length} contact{ids.length > 1 ? "s" : ""}</DialogTitle><DialogDescription>Un champ, une valeur, appliquée à toute la sélection. Un mot-clé s&apos;ajoute ou se retire sans toucher aux autres.</DialogDescription></DialogHeader>
        <label className="grid gap-1 text-sm"><span className="font-semibold">Quel champ ?</span>
          <Select value={choice} onChange={(e) => { setChoice(e.target.value); setValue(""); }} aria-label="Champ à modifier" data-testid="bulk-edit-field">{choices.map((c) => <option key={c.value} value={c.value}>{c.group} · {c.label}</option>)}</Select>
        </label>
        <label className="grid gap-1 text-sm"><span className="font-semibold">Quelle valeur ?</span>{valueInput()}</label>
        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button><Button size="sm" disabled={ctx.pending || !choice || (choice.startsWith("tags:") && !value.trim())} onClick={submit} data-testid="bulk-edit-submit">Appliquer</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function BulkDeleteDialog({ ids, ctx, onClose, onDone }: { ids: string[]; ctx: BulkContext; onClose: () => void; onDone: () => void }) {
  const fromBrevo = ctx.hasBrevo(ids);
  const [alsoBrevo, setAlsoBrevo] = useState(false);
  const submit = () => ctx.run(() => bulkDeleteContacts(ids, alsoBrevo && fromBrevo > 0), (r) => {
    const d = r.data as { deleted: number; kept: number; brevoDeleted: number };
    toast.success(`${d.deleted} supprimé${d.deleted > 1 ? "s" : ""}${d.kept ? ` · ${d.kept} gardé${d.kept > 1 ? "s" : ""} (cités par un financement ou une adhésion)` : ""}${d.brevoDeleted ? ` · ${d.brevoDeleted} supprimé${d.brevoDeleted > 1 ? "s" : ""} dans Brevo` : ""}`);
    onClose(); onDone();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="bulk-delete-dialog">
        <DialogHeader><DialogTitle>Supprimer définitivement {ids.length} contact{ids.length > 1 ? "s" : ""} ?</DialogTitle><DialogDescription>Ils disparaissent de l&apos;annuaire et de toutes les listes. Un contact cité par un financement ou une adhésion est gardé (marquez-le « parti·e »).</DialogDescription></DialogHeader>
        {fromBrevo > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p>{fromBrevo} de ces contacts vien{fromBrevo > 1 ? "nent" : "t"} de Brevo. Par défaut ils ne sont supprimés qu&apos;ici, et la synchronisation ne les ramènera pas.</p>
            {ctx.brevoConfigured && <label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={alsoBrevo} onChange={(e) => setAlsoBrevo(e.target.checked)} className="mt-0.5 size-4 rounded border-border accent-primary" data-testid="bulk-delete-brevo" /><span>Supprimer aussi dans Brevo — <b>irréversible</b> : ils sortent des listes et des campagnes du compte.</span></label>}
          </div>
        )}
        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button><Button size="sm" variant="destructive" disabled={ctx.pending} onClick={submit} data-testid="bulk-delete-submit">Supprimer</Button></div>
      </DialogContent>
    </Dialog>
  );
}
