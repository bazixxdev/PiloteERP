import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { FocusMode } from "@/components/common/focus-mode";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { loadNote, loadNotes, NOTE_CONTEXTS } from "@/lib/notes";
import { loadEditionOpts } from "@/lib/tasks";
import { hasModule } from "@/lib/modules";
import { dayjs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NoteEditor } from "./editor";

// Notes (retour du 14/09) : prise de notes propre, rattachée à un projet ou transverse, privée ou partagée. Remplace le OneNote « défouloir ».
export default async function NotesPage({ searchParams }: { searchParams: Promise<{ note?: string; edition?: string; focus?: string }> }) {
  const { note: noteId, edition, focus } = await searchParams;
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
  const [notes, editions] = await Promise.all([loadNotes(me), loadEditionOpts(me, settings)]);
  const current = noteId && noteId !== "nouvelle" ? await loadNote(me, noteId) : null;
  const isNew = noteId === "nouvelle" || (!noteId && notes.length === 0);
  const inFocus = focus === "1";
  const mine = notes.filter((n) => n.mine);
  const shared = notes.filter((n) => !n.mine);
  const ctxLabel = (c: string) => NOTE_CONTEXTS.find((x) => x.value === c)?.label ?? c;

  const NoteLink = ({ n }: { n: (typeof notes)[number] }) => (
    <Link href={`/notes?note=${n.id}`} className={cn("block rounded-md px-3 py-2 hover:bg-muted", current?.id === n.id && "bg-info-soft")} data-testid={`note-link-${n.id}`}>
      <div className="truncate text-xs font-semibold">{n.title || "Sans titre"}</div>
      <div className="truncate text-[10px] text-muted-foreground">{dayjs(n.date).format("D MMM YYYY")} · {n.edition ? `${n.edition.name} · ${n.edition.year}` : ctxLabel(n.context)}{!n.mine ? ` · ${n.author.name}` : ""}</div>
    </Link>
  );

  return (
    <div className={cn("p-4 md:p-6", inFocus && "min-h-screen")}>
      <FocusMode on={inFocus} exitHref={current ? `/notes?note=${current.id}` : "/notes"} />
      {!inFocus && (
        <PageHeader title="Notes" subtitle="Vos notes de réunion, rattachées à un projet ou transverses. Privées par défaut ; partagez-les à votre pôle ou à toute la CRESS." actions={<Button asChild data-testid="new-note"><Link href="/notes?note=nouvelle"><Plus />Nouvelle note</Link></Button>} />
      )}
      <div className={cn("grid gap-4", !inFocus && "lg:grid-cols-[280px_1fr]")}>
        {!inFocus && (
          <div className="grid content-start gap-3">
            <div className="rounded-md border bg-card p-1.5" data-testid="my-notes">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">Mes notes · {mine.length}</div>
              {mine.length === 0 ? <p className="px-3 pb-2 text-[11px] text-muted-foreground">Aucune note encore.</p> : mine.map((n) => <NoteLink key={n.id} n={n} />)}
            </div>
            {shared.length > 0 && (
              <div className="rounded-md border bg-card p-1.5" data-testid="shared-notes">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">Partagées avec moi · {shared.length}</div>
                {shared.map((n) => <NoteLink key={n.id} n={n} />)}
              </div>
            )}
          </div>
        )}
        <div>
          {current || isNew ? (
            <NoteEditor key={current?.id ?? "new"} note={current} editions={editions} defaultEditionId={edition} focus={inFocus} />
          ) : (
            <EmptyState title="Choisissez une note, ou créez-en une" hint="Une note, c'est du texte : ce qui s'est dit, ce qui a été décidé. Rattachez-la à un projet pour la retrouver depuis sa fiche." icon="✎" />
          )}
        </div>
      </div>
    </div>
  );
}
