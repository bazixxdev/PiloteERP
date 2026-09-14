"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Lock, Users, Eye, Maximize2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/common/rich-editor";
import { ShareWith, type PersonOpt } from "./share";
import { ColorPicker } from "./color-picker";
import { addNote, deleteNote, updateNote } from "@/app/actions/notes";
import { NOTE_CONTEXTS, noteColor, type NoteView } from "@/lib/notes";
import type { EditionOpt } from "@/components/tasks/task-list";
import { dayjs } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";

const VIS = [
  { value: "private", label: "Privée", icon: Lock },
  { value: "pole", label: "Mon pôle", icon: Eye },
  { value: "all", label: "Toute la CRESS", icon: Users },
];

// Éditeur de note : texte mis en forme (Tiptap), enregistré à la volée. En lecture pour une note partagée par un collègue.
export function NoteEditor({ note, editions, people, defaultEditionId, focus }: { note: NoteView | null; editions: EditionOpt[]; people: PersonOpt[]; defaultEditionId?: string; focus?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [date, setDate] = useState(note?.date ?? dayjs().format("YYYY-MM-DD"));
  const [context, setContext] = useState(note?.context ?? (defaultEditionId ? "project" : "team"));
  const [editionId, setEditionId] = useState(note?.edition?.id ?? defaultEditionId ?? "");
  const [visibility, setVisibility] = useState(note?.visibility ?? "private");
  const [color, setColor] = useState<string | null>(note?.color ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const idRef = useRef<string | null>(note?.id ?? null);
  const lastSaved = useRef(note?.body ?? "");
  const readOnly = Boolean(note && !note.mine);
  useEffect(() => { idRef.current = note?.id ?? null; }, [note?.id]);

  // Première sauvegarde = création ; les suivantes = mise à jour. Rien ne se perd si on quitte : chaque champ enregistre en le quittant.
  // Si une création est en cours (titre quitté, puis contenu quitté juste après), on l'attend au lieu de créer une deuxième note.
  const creating = useRef<Promise<string | null> | null>(null);
  const save = (patch: Parameters<typeof updateNote>[1]) => {
    if (readOnly) return;
    start(async () => {
      if (!idRef.current && creating.current) await creating.current;
      if (idRef.current) {
        const r = await updateNote(idRef.current, patch);
        if (!r.ok) { toast.error(r.error); return; }
      } else {
        if (!(patch.title ?? title).trim() && !(patch.body ?? body).replace(/<[^>]+>/g, "").trim()) return;
        creating.current = addNote({ title, body, date, context, editionId: editionId || null, visibility, ...patch }).then((r) => {
          if (!r.ok) { toast.error(r.error); return null; }
          idRef.current = r.data!.id;
          return r.data!.id;
        });
        const id = await creating.current;
        creating.current = null;
        if (!id) return;
        router.replace(`/notes?note=${id}${focus ? "&focus=1" : ""}`);
      }
      setSavedAt(dayjs().format("HH:mm"));
      router.refresh();
    });
  };

  return (
    <div className={cn("flex h-full flex-col rounded-md border bg-card", focus && "mx-auto max-w-3xl")} style={noteColor(color) ? { borderTop: `4px solid ${noteColor(color)!.hex}` } : undefined} data-testid="note-editor">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-[11px]">
        <Input type="date" value={date} disabled={readOnly || pending} onChange={(e) => { setDate(e.target.value); save({ date: e.target.value }); }} aria-label="Date de la note" className="h-7 w-36 text-[11px]" />
        <select value={context} disabled={readOnly || pending} onChange={(e) => { setContext(e.target.value); save({ context: e.target.value }); }} aria-label="Contexte" className="h-7 rounded-md border bg-card px-1.5 text-[11px]" data-testid="note-context">
          {NOTE_CONTEXTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={editionId} disabled={readOnly || pending} onChange={(e) => { setEditionId(e.target.value); save({ editionId: e.target.value || null }); }} aria-label="Projet rattaché" className="h-7 max-w-[220px] rounded-md border bg-card px-1.5 text-[11px]" data-testid="note-edition">
          <option value="">Transverse — sans projet</option>
          {editions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.year}</option>)}
        </select>
        {readOnly ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">{(() => { const V = VIS.find((v) => v.value === visibility) ?? VIS[0]; return note!.sharedWithMe ? <><UserPlus className="size-3" />Partagée avec vous · note de {note!.author.name}</> : <><V.icon className="size-3" />{V.label} · note de {note!.author.name}</>; })()}</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border px-1.5 text-muted-foreground">{(() => { const V = VIS.find((v) => v.value === visibility) ?? VIS[0]; return <V.icon className="size-3" aria-hidden />; })()}
            <select value={visibility} disabled={pending} onChange={(e) => { setVisibility(e.target.value); save({ visibility: e.target.value }); }} aria-label="Visibilité de la note" className="h-7 bg-transparent text-[11px]" data-testid="note-visibility">
              {VIS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </span>
        )}
        {!readOnly && <ColorPicker value={color} disabled={pending} onChange={(v) => { setColor(v); save({ color: v }); }} />}
        {!readOnly && <ShareWith key={note?.id ?? "new"} noteId={note?.id ?? null} people={people} sharedWith={note?.sharedWith ?? []} disabled={pending} />}
        <span className="ml-auto flex items-center gap-2 text-muted-foreground">
          {savedAt && <span data-testid="note-saved">Enregistrée à {savedAt}</span>}
          {!focus && <Link href={`/notes?note=${note?.id ?? "nouvelle"}&focus=1`} title="Mode focus : rien d'autre à l'écran (Échap pour revenir)" className="inline-flex items-center gap-1 rounded p-1 hover:bg-muted" data-testid="note-focus"><Maximize2 className="size-3.5" /></Link>}
          {note?.mine && <button type="button" aria-label="Supprimer la note" disabled={pending} onClick={() => { if (confirm("Supprimer cette note ?")) start(async () => { const r = await deleteNote(note.id); if (!r.ok) toast.error(r.error); else { toast.success("Note supprimée"); router.push("/notes"); router.refresh(); } }); }} className="rounded p-1 hover:bg-muted hover:text-danger"><Trash2 className="size-3.5" /></button>}
        </span>
      </div>
      <input value={title} readOnly={readOnly} onChange={(e) => setTitle(e.target.value)} onBlur={() => save({ title })} placeholder="Titre de la note" aria-label="Titre" className={cn("border-0 bg-transparent px-5 pt-4 pb-1 font-bold outline-none placeholder:text-muted-foreground/60", focus ? "text-2xl" : "text-lg")} data-testid="note-title" />
      <RichEditor value={body} readOnly={readOnly} onChange={setBody} onBlur={(html) => { if (html !== lastSaved.current) { lastSaved.current = html; save({ body: html }); } }} placeholder="Ce qui s'est dit, ce qui a été décidé, ce qu'il reste à faire…" className={cn(focus && "[&_.prose-note]:min-h-[70vh] [&_.prose-note]:text-[15px]")} testId="note-body" />
      {!readOnly && <div className="border-t px-4 py-2 text-[10px] text-muted-foreground">Enregistrement automatique en quittant un champ. {pending ? "Enregistrement…" : ""}</div>}
      {readOnly && <div className="border-t px-4 py-2 text-[10px] text-muted-foreground">Note partagée par {note!.author.name} : en lecture.</div>}
      {!readOnly && note && note.sharedWith.length > 0 && <div className="border-t px-4 py-2 text-[10px] text-muted-foreground">Partagée nominativement avec {note.sharedWith.map((p) => p.name).join(", ")}.</div>}
    </div>
  );
}
