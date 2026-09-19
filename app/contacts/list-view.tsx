"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, RefreshCw, Send, Settings2, Trash2, Upload, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect, Select } from "@/components/common/searchable-select";
import { visibilityIcon } from "@/components/common/visibility-icon";
import { addListField, addToList, deleteContactList, previewImport, removeFromList, removeListField, runImport, setItemValue, updateContactList, type ImportMapping, type ImportPreview } from "@/app/actions/contacts";
import { BREVO_STATUS, CONTACT_COLUMNS, contactName, FIELD_TYPES, tagsOf, type ContactListFull, type ListField, type ListFieldType } from "@/lib/contacts";
import { pushListToBrevo, syncBrevo, unfollowBrevoList } from "@/app/actions/brevo";
import { syncHelloAsso, unfollowHelloAssoForm } from "@/app/actions/helloasso";
import { fmtDate } from "@/lib/format";
import { VISIBILITIES } from "@/lib/modules";
import { NOTE_COLORS, noteColor } from "@/lib/notes";
import { withBase } from "@/lib/base-path";
import type { EditionOpt } from "@/components/tasks/task-list";
import { cn } from "@/lib/utils";
import { ContactForm } from "./controls";
import { BulkBar, FilterCell, SortTh, useContactsTable, type BulkContext, type Column } from "./table-tools";
import { V, cap } from "@/lib/vocab";

type Run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (r: { data?: unknown }) => void) => void;
function useRun(): [boolean, Run] {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run: Run = (fn, after) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(r); router.refresh(); });
  return [pending, run];
}

// Une liste de contacts : en-tête (nom, visibilité, projet, réglages), ligne compacte (compteur, ajouter, importer, exporter),
// puis le tableau — colonnes communes, rôle dans la liste, colonnes propres modifiables en place.
export function ContactListView({ list, canEdit, isAdmin, brevoConfigured, editions, organisations, myLists }: { list: ContactListFull; meId: string; canEdit: boolean; isAdmin: boolean; brevoConfigured: boolean; editions: EditionOpt[]; myLists: { id: string; name: string }[]; organisations: { id: string; name: string }[] }) {
  const [pending, run] = useRun();
  const router = useRouter();
  const mirror = list.source === "brevo" || list.source === "helloasso"; // miroir : membres et colonnes tenus par la synchronisation
  const sourceLabel = list.source === "helloasso" ? "HelloAsso" : "Brevo";
  const base = list.source === "base"; // liste de base : calculée (interlocuteurs d'un genre d'organisation), sans auteur ni réglages
  type Item = ContactListFull["items"][number];
  // Colonnes du tableau (19/09) : communes, rôle, colonnes propres — pour le tri et les filtres ; l'édition en place reste dans ValueCell.
  const columns = useMemo<Column<Item>[]>(() => [
    { key: "name", label: "Contact", get: (i) => `${i.contact.lastName} ${i.contact.firstName ?? ""}`.trim(), className: "px-4" },
    { key: "organisation", label: "Structure", get: (i) => i.contact.organisation?.name ?? i.contact.organisationName ?? null },
    { key: "email", label: "Coordonnées", get: (i) => [i.contact.email, i.contact.phone, i.contact.city].filter(Boolean).join(" ") || null },
    ...(base ? [] : [{ key: "role", label: "Rôle dans la liste", get: (i: Item) => i.role } as Column<Item>]),
    ...list.fields.map((f): Column<Item> => ({ key: `f:${f.key}`, label: f.label, get: (i) => { const v = i.values[f.key]; return f.type === "bool" ? Boolean(v) : v == null ? null : String(v); }, filter: f.type === "bool" ? "bool" : f.type === "select" ? { options: f.options ?? [] } : "text" })),
  ], [list.fields, base]);
  const idOf = useCallback((i: Item) => i.contact.id, []);
  const quick = useCallback((i: Item) => `${contactName(i.contact)} ${i.contact.email ?? ""} ${i.contact.organisation?.name ?? i.contact.organisationName ?? ""} ${i.contact.city ?? ""} ${i.role ?? ""}`, []);
  const t = useContactsTable(list.items, columns, idOf, quick);
  const rows = t.view;
  const byId = useMemo(() => new Map(list.items.map((i) => [i.contact.id, i])), [list.items]);
  const selectedIds = [...t.selected].filter((id) => byId.has(id));
  const bulk: BulkContext = { listId: base ? null : list.id, listCanEdit: canEdit && !mirror && !base, fields: list.fields, myLists, organisations, isAdmin, brevoConfigured, hasBrevo: (ids) => ids.filter((id) => byId.get(id)?.contact.brevoStatus).length, run, pending };
  const Icon = visibilityIcon(list.visibility);
  const vis = VISIBILITIES.find((v) => v.value === list.visibility);
  const color = noteColor(list.color);
  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pb-2 pt-3" data-testid={`contact-list-header-${list.id}`}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[19px] font-bold">{color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: color.hex }} aria-hidden />}<span className="truncate">{list.name}</span></h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            {!canEdit && !base && <span>Liste de {list.owner.name} ·</span>}
            <span className="inline-flex items-center gap-1" title={vis?.hint} data-testid={`contact-list-visibility-${list.id}`} data-value={list.visibility}><Icon className="size-3" aria-hidden />{vis?.label}</span>
            {!base && (list.edition ? <span>· <Link href={`/edition/${list.edition.id}`} className="text-primary hover:underline">{list.edition.project.name} · {list.edition.year}</Link></span> : <span>· sans projet</span>)}
            {list.description && !base && <span>· {list.description}</span>}
            {mirror && <span data-testid="contact-list-mirror">· synchronisée {list.brevoSyncedAt ? `le ${fmtDate(list.brevoSyncedAt)}` : "pas encore"} · membres tenus par {sourceLabel}</span>}
            {!mirror && list.brevoListId && <span data-testid="contact-list-pushed">· dans Brevo{list.brevoSyncedAt ? ` depuis le ${fmtDate(list.brevoSyncedAt)}` : ""}</span>}
            {base && <span data-testid="contact-list-base">· liste de base, tenue automatiquement : pour la compléter, rattachez un contact à son organisation (fiche du contact, ou fiche de l&apos;organisation)</span>}
            {!canEdit && !base && <span>· en lecture</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mirror && isAdmin && <Button variant="outline" size="sm" className="text-xs" disabled={pending} onClick={() => run(() => list.source === "helloasso" ? syncHelloAsso() : syncBrevo(), () => toast.success(`${sourceLabel} : liste mise à jour`))} data-testid="brevo-sync-list"><RefreshCw className="size-3.5" />Mettre à jour</Button>}
          {mirror && isAdmin && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" disabled={pending} onClick={() => { if (confirm(`Ne plus suivre « ${list.name} » ? Les contacts restent dans l'annuaire.`)) run(() => list.source === "helloasso" ? unfollowHelloAssoForm(list.id) : unfollowBrevoList(list.id), () => router.push("/contacts")); }} data-testid="brevo-unfollow">Ne plus suivre</Button>}
          {canEdit && <ListSettings list={list} editions={editions} pending={pending} run={run} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-y px-4 py-2">
        <span className="text-sm text-muted-foreground" data-testid="contact-list-count">{t.hasFilters ? `${rows.length} sur ${list.items.length}` : `${list.items.length} contact${list.items.length > 1 ? "s" : ""}`}</span>
        <Input value={t.q} onChange={(e) => t.setQ(e.target.value)} placeholder="Filtrer…" className="h-8 w-44 text-xs" aria-label="Filtrer la liste" data-testid="contact-list-filter" />
        {t.hasFilters && <Button variant="ghost" size="xs" onClick={t.resetFilters}>Effacer les filtres</Button>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm"><a href={withBase(`/contacts/export?liste=${list.id}`)} title="Exporter la liste en CSV (colonnes communes et propres)" data-testid="contact-list-export"><Download />Exporter</a></Button>
          {canEdit && !mirror && brevoConfigured && <PushDialog list={list} />}
          {canEdit && !mirror && <ImportDialog list={list} />}
          {canEdit && !mirror && <AddToListDialog list={list} organisations={organisations} pending={pending} run={run} />}
        </div>
      </div>
      <BulkBar ids={selectedIds} total={rows.length} allSelected={t.allInViewSelected} onSelectAll={t.toggleAll} onClear={t.clear} ctx={bulk} />
      {/* Le tableau reste, même vide : on voit ses colonnes (et celles qu'on vient d'ajouter). */}
      {(
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" data-testid="contact-list-table">
            <thead className="text-left text-[10px] font-semibold text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-1.5"><input type="checkbox" checked={t.allInViewSelected} onChange={t.toggleAll} aria-label="Sélectionner toutes les lignes affichées" className="size-4 rounded border-border accent-primary" data-testid="select-all" /></th>
                {columns.map((c) => {
                  const f = c.key.startsWith("f:") ? list.fields.find((x) => `f:${x.key}` === c.key) : null;
                  return (
                    <SortTh key={c.key} col={c} sort={t.sort} setSort={t.setSort} className={cn(c.className, f && "whitespace-nowrap")}>
                      {f ? <span data-testid={`col-${f.key}`} title={f.synced ? "Colonne synchronisée, en lecture" : undefined}>{f.label}</span> : c.label}
                      {f && canEdit && !f.synced && <span role="button" tabIndex={0} title="Retirer la colonne" aria-label={`Retirer la colonne ${f.label}`} onClick={(e) => { e.stopPropagation(); if (!pending && confirm(`Retirer la colonne « ${f.label} » ?`)) run(() => removeListField(list.id, f.key)); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); if (!pending && confirm(`Retirer la colonne « ${f.label} » ?`)) run(() => removeListField(list.id, f.key)); } }} className="ml-1 rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-danger"><X className="size-3" /></span>}
                    </SortTh>
                  );
                })}
                {canEdit && !mirror && <th className="px-2 py-1.5" />}
              </tr>
              <tr className="border-t bg-muted/30">
                <th />
                {columns.map((c) => <FilterCell key={c.key} col={c} value={t.filters[c.key] ?? ""} onChange={(v) => t.setFilter(c.key, v)} rows={list.items} />)}
                {canEdit && !mirror && <th />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && <tr><td colSpan={columns.length + 2} className="px-4 py-6 text-sm text-muted-foreground">{list.items.length === 0 ? (mirror ? `Aucun contact dans cette liste ${sourceLabel} pour l'instant.` : base ? "Aucun contact rattaché à une organisation de ce genre pour l'instant." : "Aucun contact dans cette liste : ajoutez-en, ou importez votre fichier.") : "Rien ne correspond au filtre."}</td></tr>}
              {rows.map((i) => {
                const c = i.contact;
                return (
                  <tr key={c.id} data-testid={`contact-item-${c.id}`} className={cn(t.selected.has(c.id) && "bg-info-soft/60")} aria-selected={t.selected.has(c.id) || undefined}>
                    <td className="px-3 py-1.5"><input type="checkbox" checked={t.selected.has(c.id)} onChange={() => t.toggle(c.id)} aria-label={`Sélectionner ${contactName(c)}`} className="size-4 rounded border-border accent-primary" data-testid={`select-${c.id}`} /></td>
                    <td className="px-4 py-1.5"><Link href={`/contacts?liste=${list.id}&contact=${c.id}`} scroll={false} className="font-medium text-primary underline-offset-2 hover:underline">{contactName(c)}</Link>{c.brevoStatus && c.brevoStatus !== "active" && <span className="ml-1.5 inline-block whitespace-nowrap rounded-sm bg-warning-soft px-1 text-[10px] text-warning" title={BREVO_STATUS[c.brevoStatus]?.hint} data-testid={`brevo-status-${c.id}`}>{BREVO_STATUS[c.brevoStatus]?.label}</span>}{c.role && <div className="text-[11px] text-muted-foreground">{c.role}</div>}{tagsOf(c).length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{tagsOf(c).map((t) => <span key={t} className="rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">{t}</span>)}</div>}</td>
                    <td className="px-2 py-1.5 text-xs">{c.organisation ? <Link href={`/organisations?organisation=${c.organisation.id}`} className="hover:underline">{c.organisation.name}</Link> : c.organisationName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{c.email && <a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a>}{c.email && c.phone && <br />}{c.phone}{c.city && <div>{[c.postcode, c.city].filter(Boolean).join(" ")}</div>}</td>
                    {!base && <td className="px-2 py-1.5"><ValueCell key={`role:${i.role ?? ""}`} listId={list.id} contactId={c.id} field={{ key: "role", label: "Rôle", type: "text" }} value={i.role} canEdit={canEdit} pending={pending} run={run} /></td>}
                    {list.fields.map((f) => <td key={f.key} className="px-2 py-1.5"><ValueCell key={`${f.key}:${String(i.values[f.key] ?? "")}`} listId={list.id} contactId={c.id} field={f} value={i.values[f.key] ?? null} canEdit={canEdit && !f.synced} pending={pending} run={run} /></td>)}
                    {canEdit && !mirror && <td className="px-2 py-1.5 text-right"><button type="button" aria-label={`Retirer ${contactName(c)} de la liste`} disabled={pending} onClick={() => run(() => removeFromList(list.id, c.id))} className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-danger" data-testid={`contact-item-remove-${c.id}`}><X className="size-3.5" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Une cellule de colonne propre (ou le rôle) : case, texte, date ou liste, enregistrée en quittant la cellule. Sa `key` porte la
// valeur : une modification groupée (19/09) la remonte à la valeur du serveur.
function ValueCell({ listId, contactId, field, value, canEdit, pending, run }: { listId: string; contactId: string; field: ListField; value: string | boolean | null; canEdit: boolean; pending: boolean; run: Run }) {
  const [v, setV] = useState<string>(typeof value === "string" ? value : "");
  const [checked, setChecked] = useState(Boolean(value)); // coche immédiate, confirmée par le rafraîchissement
  const save = (next: string | boolean | null) => run(() => setItemValue(listId, contactId, field.key, next));
  const testId = `cell-${field.key}-${contactId}`;
  if (field.type === "bool") return <input type="checkbox" checked={checked} disabled={!canEdit || pending} onChange={(e) => { setChecked(e.target.checked); save(e.target.checked); }} className="size-4 rounded border-border accent-primary" aria-label={field.label} data-testid={testId} />;
  if (!canEdit) return <span className="text-xs" data-testid={testId} data-value={typeof value === "string" ? value : ""}>{typeof value === "string" && value ? value : <span className="text-muted-foreground">—</span>}</span>;
  if (field.type === "select") return (
    <Select value={typeof value === "string" ? value : ""} disabled={pending} onChange={(e) => save(e.target.value || null)} className="h-7 min-w-[8rem] text-xs" aria-label={field.label} data-testid={testId}>
      <option value="">—</option>
      {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
    </Select>
  );
  return <Input type={field.type === "date" ? "date" : "text"} value={v} disabled={pending} onChange={(e) => { setV(e.target.value); if (field.type === "date") save(e.target.value || null); }} onBlur={() => { if (field.type !== "date" && v !== (value ?? "")) save(v); }} className="h-7 min-w-[7rem] text-xs" aria-label={field.label} data-testid={testId} />;
}

// Réglages : nom, description, visibilité, couleur, projet, colonnes propres, suppression.
function ListSettings({ list, editions, pending, run }: { list: ContactListFull; editions: EditionOpt[]; pending: boolean; run: Run }) {
  const router = useRouter();
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ListFieldType>("bool");
  const [options, setOptions] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="text-xs" onClick={() => setOpen(true)} data-testid={`contact-list-settings-${list.id}`}><Settings2 className="size-3.5" />Réglages</Button>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Réglages de la liste</DialogTitle></DialogHeader>
        <div className="grid gap-3 text-xs">
          <label className="grid gap-1"><span className="font-semibold">Nom</span><Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== list.name) run(() => updateContactList(list.id, { name })); }} className="h-8" disabled={pending} data-testid={`contact-list-name-${list.id}`} /></label>
          <label className="grid gap-1"><span className="font-semibold">À quoi elle sert</span><Input value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => { if (description !== (list.description ?? "")) run(() => updateContactList(list.id, { description })); }} className="h-8" disabled={pending} /></label>
          <div className="grid gap-1"><span className="font-semibold">Projet</span><SearchableSelect aria-label={`${cap(V.edition)} rattachée`} options={editions.map((e) => ({ value: e.id, label: e.name, hint: String(e.year) }))} value={list.edition?.id ?? ""} disabled={pending} onChange={(v) => run(() => updateContactList(list.id, { editionId: v || null }))} emptyOption="Sans projet" className="w-full text-xs" /></div>
          <div className="grid gap-1"><span className="font-semibold">Couleur</span><div className="flex items-center gap-1.5">{NOTE_COLORS.map((k) => <button key={k.value} type="button" title={k.label} aria-label={k.label} aria-pressed={list.color === k.value} disabled={pending} onClick={() => run(() => updateContactList(list.id, { color: list.color === k.value ? null : k.value }))} className={cn("size-6 rounded-full border-2", list.color === k.value ? "border-foreground" : "border-transparent hover:border-border")} style={{ background: k.hex }} />)}</div></div>
          <fieldset className="grid gap-1"><legend className="mb-1 font-semibold">Qui la lit</legend>
            {VISIBILITIES.map((v) => <label key={v.value} className="flex items-start gap-2"><input type="radio" name={`clvis-${list.id}`} value={v.value} checked={list.visibility === v.value} disabled={pending} onChange={() => run(() => updateContactList(list.id, { visibility: v.value }), () => toast.success(v.value === "private" ? "Liste privée" : "Liste partagée"))} className="mt-0.5 accent-primary" data-testid={`contact-list-vis-${list.id}-${v.value}`} /><span><b className="font-medium">{v.label}</b> <span className="text-muted-foreground">· {v.hint}</span></span></label>)}
          </fieldset>
          <div className="grid gap-1.5 border-t pt-2">
            <span className="font-semibold">Colonnes propres à cette liste</span>
            {list.fields.length > 0 && <ul className="grid gap-0.5 text-[11px] text-muted-foreground">{list.fields.map((f) => <li key={f.key}>· {f.label} <span className="opacity-70">({f.synced ? "colonne synchronisée" : FIELD_TYPES.find((t) => t.value === f.type)?.label}{f.options ? ` : ${f.options.join(", ")}` : ""})</span></li>)}</ul>}
            <form className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => addListField(list.id, { label, type, options }), () => { setLabel(""); setOptions(""); toast.success("Colonne ajoutée"); }); }} data-testid="add-field-form">
              <div className="grid grid-cols-[1fr_auto] gap-1.5">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom de la colonne (Charte, Séminaire 2025…)" className="h-8" data-testid="add-field-label" />
                <Select value={type} onChange={(e) => setType(e.target.value as ListFieldType)} className="h-8 text-xs" aria-label="Type de colonne" data-testid="add-field-type">{FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
              </div>
              {type === "select" && <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Valeurs possibles, séparées par des virgules" className="h-8" data-testid="add-field-options" />}
              <div><Button type="submit" size="xs" variant="outline" disabled={pending || !label.trim()} data-testid="add-field-submit"><Plus />Ajouter la colonne</Button></div>
            </form>
          </div>
          <div className="border-t pt-2"><Button variant="ghost" size="sm" disabled={pending} className="text-danger hover:text-danger" onClick={() => { if (confirm(`Supprimer la liste « ${list.name} » ? Les contacts restent dans l'annuaire.`)) run(() => deleteContactList(list.id), () => router.push("/contacts")); }} data-testid={`contact-list-delete-${list.id}`}><Trash2 className="size-3.5" />Supprimer la liste</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Ajouter : un contact de l'annuaire (recherche), ou un nouveau.
function AddToListDialog({ list, organisations, pending, run }: { list: ContactListFull; organisations: { id: string; name: string }[]; pending: boolean; run: Run }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [contactId, setContactId] = useState("");
  const [role, setRole] = useState("");
  const [all, setAll] = useState<{ id: string; label: string }[] | null>(null);
  const load = async () => { if (all) return; const r = await fetch(withBase("/contacts/export?annuaire=1")); setAll(await r.json()); };
  const inList = new Set(list.items.map((i) => i.contactId));
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) void load(); }}>
      <Button size="sm" onClick={() => { setOpen(true); void load(); }} data-testid="contact-list-add"><UserPlus />Ajouter un contact</Button>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ajouter à « {list.name} »</DialogTitle></DialogHeader>
        <div className="flex gap-1 rounded-md bg-muted p-0.5 text-xs">
          <button type="button" onClick={() => setMode("existing")} className={cn("flex-1 rounded px-2 py-1", mode === "existing" && "bg-card font-semibold shadow-sm")} data-testid="add-mode-existing">De l&apos;annuaire</button>
          <button type="button" onClick={() => setMode("new")} className={cn("flex-1 rounded px-2 py-1", mode === "new" && "bg-card font-semibold shadow-sm")} data-testid="add-mode-new">Nouveau contact</button>
        </div>
        {mode === "existing" ? (
          <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addToList(list.id, { contactId, role }), () => { setContactId(""); setRole(""); toast.success("Ajouté à la liste"); }); }}>
            <SearchableSelect options={(all ?? []).filter((c) => !inList.has(c.id)).map((c) => ({ value: c.id, label: c.label }))} value={contactId} onChange={setContactId} emptyOption="— choisir un contact —" searchFrom={1} aria-label="Contact" className="h-9 w-full" data-testid="add-existing-contact" />
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rôle dans la liste (facultatif) : invité, intervenant…" className="h-8 text-xs" data-testid="add-existing-role" />
            <div className="flex justify-end"><Button type="submit" size="sm" disabled={pending || !contactId} data-testid="add-existing-submit">Ajouter</Button></div>
          </form>
        ) : (
          <ContactForm organisations={organisations} pending={pending} submitLabel="Créer et ajouter" testPrefix="add-new" onSubmit={(c) => run(() => addToList(list.id, { contact: c }), () => { setOpen(false); toast.success("Contact créé et ajouté"); })} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Import en deux temps : le fichier, puis la correspondance des colonnes (proposée d'après les en-têtes), puis l'import.
function ImportDialog({ list }: { list: ContactListFull }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const targets = [{ value: "", label: "— ignorer —" }, ...CONTACT_COLUMNS.map((c) => ({ value: c.key, label: c.label })), { value: "role:list", label: "Rôle dans la liste" }, ...list.fields.map((f) => ({ value: `field:${f.key}`, label: `Colonne « ${f.label} »` }))];
  const reset = () => { setFile(null); setPreview(null); setMapping({}); };
  const analyse = () => { if (!file) return; const fd = new FormData(); fd.set("listId", list.id); fd.set("file", file); start(async () => { const r = await previewImport(fd); if (!r.ok) { toast.error(r.error); return; } setPreview(r.data!); setMapping(r.data!.guesses); }); };
  const go = () => { if (!file) return; const fd = new FormData(); fd.set("listId", list.id); fd.set("file", file); start(async () => { const r = await runImport(fd, mapping); if (!r.ok) { toast.error(r.error); return; } const d = r.data!; toast.success(`${d.added} ajouté${d.added > 1 ? "s" : ""} à la liste · ${d.created} contact${d.created > 1 ? "s" : ""} créé${d.created > 1 ? "s" : ""} · ${d.updated} complété${d.updated > 1 ? "s" : ""}${d.skipped ? ` · ${d.skipped} ligne${d.skipped > 1 ? "s" : ""} sans nom ni e-mail` : ""}`); setOpen(false); reset(); router.refresh(); }); };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="contact-list-import"><Upload />Importer</Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importer dans « {list.name} »</DialogTitle></DialogHeader>
        {!preview ? (
          <div className="grid gap-3 text-xs">
            <p className="text-muted-foreground">Un fichier .csv ou .xlsx (la première feuille), une ligne par personne. Les titres et logos au-dessus de l&apos;en-tête sont ignorés. Un contact déjà connu (même e-mail, sinon même nom et prénom) est complété, pas dupliqué ; les autres sont créés dans l&apos;annuaire — tous entrent dans la liste.</p>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-9" aria-label="Fichier à importer" data-testid="import-file" />
            <div className="flex justify-end"><Button size="sm" disabled={pending || !file} onClick={analyse} data-testid="import-analyse">Lire le fichier</Button></div>
          </div>
        ) : (
          <div className="grid gap-3 text-xs">
            <p className="text-muted-foreground">{preview.total} ligne{preview.total > 1 ? "s" : ""} trouvée{preview.total > 1 ? "s" : ""}. Dites où va chaque colonne ; ce qui est proposé vient des en-têtes. Il faut au moins le nom ou l&apos;e-mail.</p>
            <div className="max-h-80 overflow-auto rounded-md border">
              <table className="w-full text-[11px]" data-testid="import-mapping">
                <thead className="bg-muted/40 text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="px-2 py-1">Colonne du fichier</th><th className="px-2 py-1">Exemple</th><th className="px-2 py-1">Va dans</th></tr></thead>
                <tbody className="divide-y">
                  {preview.headers.map((h, i) => (
                    <tr key={h}>
                      <td className="px-2 py-1 font-medium">{h}</td>
                      <td className="max-w-[14rem] truncate px-2 py-1 text-muted-foreground">{preview.rows.map((r) => r[i]).filter(Boolean).slice(0, 2).join(" · ")}</td>
                      <td className="px-2 py-1"><Select value={mapping[h] ?? ""} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })} className="h-7 w-52 text-[11px]" aria-label={`Destination de ${h}`} data-testid={`import-map-${i}`}>{targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between"><Button size="sm" variant="ghost" onClick={reset}>Autre fichier</Button><Button size="sm" disabled={pending || !Object.values(mapping).some((v) => v === "lastName" || v === "email")} onClick={go} data-testid="import-run">Importer {preview.total} ligne{preview.total > 1 ? "s" : ""}</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Envoyer vers Brevo : la liste y est créée (dossier « Pilote ») ou mise à jour ; on dit avant ce qui partira et ce qui ne partira pas.
function PushDialog({ list }: { list: ContactListFull }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const withEmail = list.items.filter((i) => i.contact.email);
  const blocked = withEmail.filter((i) => i.contact.brevoStatus === "unsubscribed" || i.contact.brevoStatus === "deleted").length;
  const sendable = withEmail.length - blocked;
  const noEmail = list.items.length - withEmail.length;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} title={list.brevoListId ? "Mettre à jour la liste dans Brevo" : "Envoyer la liste vers Brevo"} data-testid="contact-list-push"><Send />{list.brevoListId ? "Brevo · à jour" : "Vers Brevo"}</Button>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{list.brevoListId ? "Mettre à jour dans Brevo" : "Envoyer vers Brevo"}</DialogTitle></DialogHeader>
        <div className="grid gap-2 text-xs" data-testid="push-summary">
          <p>{list.brevoListId ? <>La liste Brevo liée est mise à jour avec le contenu de « {list.name} ».</> : <>Une liste « {list.name}{` » est créée dans Brevo (dossier « Pilote »).`}</>}</p>
          <ul className="grid gap-1 text-muted-foreground">
            <li>· <b className="text-foreground">{sendable}</b> contact{sendable > 1 ? "s" : ""} avec e-mail : créé{sendable > 1 ? "s" : ""} ou complété{sendable > 1 ? "s" : ""} dans Brevo (nom, prénom, téléphone, structure…), puis inscrit{sendable > 1 ? "s" : ""} à la liste.</li>
            {noEmail > 0 && <li>· {noEmail} sans e-mail : ignoré{noEmail > 1 ? "s" : ""}.</li>}
            {blocked > 0 && <li>· {blocked} désinscrit{blocked > 1 ? "s" : ""} ou supprimé{blocked > 1 ? "s" : ""} dans Brevo : jamais renvoyé{blocked > 1 ? "s" : ""} (RGPD).</li>}
            {list.brevoListId && <li>· Un contact retiré ici sort de la liste Brevo (il reste dans Brevo).</li>}
          </ul>
        </div>
        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button><Button size="sm" disabled={pending || sendable === 0} onClick={() => start(async () => { const r = await pushListToBrevo(list.id); if (!r.ok) { toast.error(r.error); return; } const d = r.data!; toast.success(`Brevo : ${d.sent} contact${d.sent > 1 ? "s" : ""} envoyé${d.sent > 1 ? "s" : ""}${d.removed ? ` · ${d.removed} retiré${d.removed > 1 ? "s" : ""}` : ""}`); setOpen(false); router.refresh(); })} data-testid="push-run">{list.brevoListId ? "Mettre à jour" : "Envoyer"}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
