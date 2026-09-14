import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { FocusMode } from "@/components/common/focus-mode";
import { getCurrentPerson, getPeople, getSettings } from "@/lib/session";
import { filterNotes, groupByMonth, htmlToText, loadNote, loadNotes, NOTE_COLORS, NOTE_CONTEXTS, noteColor } from "@/lib/notes";
import { loadEditionOpts } from "@/lib/tasks";
import { hasModule } from "@/lib/modules";
import { dayjs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NoteEditor } from "./editor";

// Notes (retour du 14/09) : prise de notes propre, rattachée à un projet ou transverse, privée ou partagée. Remplace le OneNote « défouloir ».
export default async function NotesPage({ searchParams }: { searchParams: Promise<{ note?: string; edition?: string; focus?: string; q?: string; projet?: string; contexte?: string; auteur?: string; couleur?: string }> }) {
  const { note: noteId, edition, focus, q, projet, contexte, auteur, couleur } = await searchParams;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  if (!hasModule(me, "notes")) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader title="Notes" />
        <EmptyState title="Module désactivé" hint="Activez « Notes » dans Mon compte pour prendre des notes ici." />
        <p className="mt-3 text-xs"><Link href="/compte" className="text-primary hover:underline">Ouvrir Mon compte →</Link></p>
      </div>
    );
  }
  const [allNotes, editions, people] = await Promise.all([loadNotes(me), loadEditionOpts(me, settings), getPeople()]);
  const peopleOpts = people.filter((p) => p.id !== me.id && p.active).map((p) => ({ id: p.id, name: p.name, poleName: p.pole?.name ?? null }));
  const current = noteId && noteId !== "nouvelle" ? await loadNote(me, noteId) : null;
  const isNew = noteId === "nouvelle" || (!noteId && allNotes.length === 0);
  const inFocus = focus === "1";
  // Recherche et filtres (retour du 14/09 : « après 12 mois de notes on va galérer à s'y retrouver »).
  const filter = { q, editionId: projet, context: contexte, author: auteur, color: couleur };
  const filtering = Boolean(q || projet || contexte || auteur || couleur);
  const notes = filterNotes(allNotes, filter);
  const mine = notes.filter((n) => n.mine);
  const shared = notes.filter((n) => !n.mine);
  const ctxLabel = (c: string) => NOTE_CONTEXTS.find((x) => x.value === c)?.label ?? c;
  // Les projets et auteurs proposés dans les filtres : seulement ceux qui ont des notes visibles.
  const projectOpts = Array.from(new Map(allNotes.filter((n) => n.edition).map((n) => [n.edition!.id, n.edition!])).values()).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  const authorOpts = Array.from(new Map(allNotes.filter((n) => !n.mine).map((n) => [n.author.id, n.author])).values()).sort((a, b) => a.name.localeCompare(b.name));
  const keep = (over: Record<string, string | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ q, projet, contexte, auteur, couleur, ...over })) if (v) p.set(k, v); return p.toString(); };

  const NoteLink = ({ n }: { n: (typeof notes)[number] }) => (
    <Link href={`/notes?${keep({ note: n.id })}`} className={cn("block min-w-0 rounded-md px-3 py-2 hover:bg-muted", current?.id === n.id && "bg-info-soft")} style={noteColor(n.color) ? { boxShadow: `inset 3px 0 0 ${noteColor(n.color)!.hex}` } : undefined} data-testid={`note-link-${n.id}`} data-color={n.color ?? undefined}>
      <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">{noteColor(n.color) && <span className="size-2 shrink-0 rounded-full" style={{ background: noteColor(n.color)!.hex }} aria-hidden />}<span className="truncate">{n.title || "Sans titre"}</span></div>
      <div className="truncate text-[10px] text-muted-foreground">{dayjs(n.date).format("D MMM")} · {n.edition ? `${n.edition.name} · ${n.edition.year}` : ctxLabel(n.context)}{!n.mine ? ` · ${n.author.name}` : ""}{n.sharedWithMe ? " · pour vous" : ""}</div>
      {q && <div className="truncate text-[10px] text-muted-foreground/80">{snippet(htmlToText(n.body), q)}</div>}
    </Link>
  );
  // Liste groupée par mois : on sait tout de suite « c'était en juin ».
  const Grouped = ({ list }: { list: typeof notes }) => (
    <>{groupByMonth(list).map((g) => (
      <div key={g.key}>
        <div className="sticky top-0 z-[1] bg-card px-3 pt-2 pb-0.5 text-[10px] uppercase tracking-[.5px] text-muted-foreground">{g.label}</div>
        {g.notes.map((n) => <NoteLink key={n.id} n={n} />)}
      </div>
    ))}</>
  );

  return (
    <div className={cn("p-4 md:p-6", inFocus && "min-h-screen")}>
      <FocusMode on={inFocus} exitHref={current ? `/notes?note=${current.id}` : "/notes"} />
      {!inFocus && (
        <PageHeader title="Notes" subtitle="Vos notes de réunion, rattachées à un projet ou transverses. Privées par défaut ; partagez-les à votre pôle ou à toute la CRESS." actions={<Button asChild data-testid="new-note"><Link href="/notes?note=nouvelle"><Plus />Nouvelle note</Link></Button>} />
      )}
      <div className={cn("grid gap-4", !inFocus && "lg:grid-cols-[300px_minmax(0,1fr)]")}>
        {!inFocus && (
          <div className="grid min-w-0 content-start gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <form method="get" action="/notes" className="grid gap-1.5 rounded-md border bg-card p-2" data-testid="notes-filter">
              {current && <input type="hidden" name="note" value={current.id} />}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input type="search" name="q" defaultValue={q ?? ""} placeholder="Rechercher dans mes notes…" aria-label="Rechercher" className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-xs" data-testid="notes-search" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select name="projet" defaultValue={projet ?? ""} aria-label="Projet" className="h-7 min-w-0 rounded-md border bg-background px-1 text-[11px]" data-testid="notes-filter-project">
                  <option value="">Tous les projets</option>
                  {projectOpts.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.year}</option>)}
                </select>
                <select name="contexte" defaultValue={contexte ?? ""} aria-label="Type de note" className="h-7 min-w-0 rounded-md border bg-background px-1 text-[11px]" data-testid="notes-filter-context">
                  <option value="">Tous les types</option>
                  {NOTE_CONTEXTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1 px-0.5" data-testid="notes-filter-colors">
                {NOTE_COLORS.map((k) => (
                  <Link key={k.value} href={`/notes?${keep({ couleur: couleur === k.value ? undefined : k.value, note: current?.id })}`} title={k.label} aria-label={`Couleur ${k.label}`} className={cn("size-4 rounded-full border-2", couleur === k.value ? "border-foreground" : "border-transparent hover:border-border")} style={{ background: k.hex }} data-testid={`notes-filter-color-${k.value}`} />
                ))}
                <span className="ml-1 text-[10px] text-muted-foreground">{couleur ? noteColor(couleur)?.label : "Par couleur"}</span>
              </div>
              {authorOpts.length > 0 && (
                <select name="auteur" defaultValue={auteur ?? ""} aria-label="Auteur" className="h-7 min-w-0 rounded-md border bg-background px-1 text-[11px]" data-testid="notes-filter-author">
                  <option value="">Moi et mes collègues</option>
                  {authorOpts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <button type="submit" className="rounded border px-2 py-0.5 hover:bg-muted">Filtrer</button>
                {filtering && <Link href={current ? `/notes?note=${current.id}` : "/notes"} className="text-primary hover:underline" data-testid="notes-filter-clear">Tout afficher</Link>}
                {filtering && <span data-testid="notes-filter-count">{notes.length} note{notes.length > 1 ? "s" : ""}</span>}
              </div>
            </form>
            <div className="min-w-0 rounded-md border bg-card p-1.5" data-testid="my-notes">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">Mes notes · {mine.length}</div>
              {mine.length === 0 ? <p className="px-3 pb-2 text-[11px] text-muted-foreground">{filtering ? "Aucune de mes notes ne correspond." : "Aucune note encore."}</p> : <Grouped list={mine} />}
            </div>
            {shared.length > 0 && (
              <div className="min-w-0 rounded-md border bg-card p-1.5" data-testid="shared-notes">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">Partagées avec moi · {shared.length}</div>
                <Grouped list={shared} />
              </div>
            )}
          </div>
        )}
        <div className="min-w-0">
          {current || isNew ? (
            <NoteEditor note={current} editions={editions} people={peopleOpts} defaultEditionId={edition} focus={inFocus} />
          ) : (
            <EmptyState title="Choisissez une note, ou créez-en une" hint="Une note, c'est du texte : ce qui s'est dit, ce qui a été décidé. Rattachez-la à un projet pour la retrouver depuis sa fiche." icon="✎" />
          )}
        </div>
      </div>
    </div>
  );
}

// Extrait autour du terme cherché, pour reconnaître la note dans la liste.
function snippet(text: string, q: string): string {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, 80);
  const start = Math.max(0, i - 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, i + q.length + 50)}…`;
}
