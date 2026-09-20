"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Heading2, List, ListOrdered, ListChecks, Quote, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Éditeur riche (retour de Gaël, 14/09 : « tu peux pas proposer du wysiwyg ? »). Tiptap : titres, gras, italique,
// listes, cases à cocher pour les « à faire », citation. Le contenu est du HTML, enregistré en quittant l'éditeur.
export function RichEditor({ value, onChange, onBlur, readOnly, placeholder, className, testId }: { value: string; onChange?: (html: string) => void; onBlur?: (html: string) => void; readOnly?: boolean; placeholder?: string; className?: string; testId?: string }) {
  const safeValue = value.replace(/<a\b([^>]*?)>/gi, (_match, attrs: string) => {
    const href = attrs.match(/href\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    if (!/^(https?:|mailto:)/i.test(href)) return `<a${attrs}>`;
    const withoutRel = attrs.replace(/\srel\s*=\s*["'][^"']*["']/gi, "").replace(/\starget\s*=\s*["'][^"']*["']/gi, "");
    return `<a${withoutRel} target="_blank" rel="noopener noreferrer">`;
  });
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }), Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }), TaskList, TaskItem.configure({ nested: true }), Placeholder.configure({ placeholder: placeholder ?? "" })],
    content: safeValue,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: { attributes: { class: "prose-note min-h-[420px] px-5 pb-5 text-sm leading-relaxed outline-none", ...(testId ? { "data-testid": testId } : {}), "aria-label": "Contenu de la note" } },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    onBlur: ({ editor }) => onBlur?.(editor.getHTML()),
  });
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);
  // Contenu changé de l'extérieur (autre note affichée) : on remplace, sans toucher à ce que l'utilisateur est en train de taper.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (safeValue !== editor.getHTML()) editor.commands.setContent(safeValue, { emitUpdate: false });
  }, [editor, safeValue]);

  return (
    <div className={cn("flex flex-1 flex-col", className)}>
      {!readOnly && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const B = ({ on, active, label, children }: { on: () => void; active?: boolean; label: string; children: React.ReactNode }) => (
    <button type="button" title={label} aria-label={label} aria-pressed={active} onMouseDown={(e) => { e.preventDefault(); on(); }} className={cn("rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground", active && "bg-info-soft text-primary")}>{children}</button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="mx-5 mb-2 flex flex-wrap items-center gap-0.5 rounded-md border bg-muted/40 px-1 py-0.5" data-testid="note-toolbar">
      <B label="Titre" on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="size-4" /></B>
      <B label="Gras (Ctrl+B)" on={() => c().toggleBold().run()} active={editor.isActive("bold")}><Bold className="size-4" /></B>
      <B label="Italique (Ctrl+I)" on={() => c().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="size-4" /></B>
      <span className="mx-1 h-4 w-px bg-border" />
      <B label="Liste à puces" on={() => c().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="size-4" /></B>
      <B label="Liste numérotée" on={() => c().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="size-4" /></B>
      <B label="Cases à cocher (à faire)" on={() => c().toggleTaskList().run()} active={editor.isActive("taskList")}><ListChecks className="size-4" /></B>
      <span className="mx-1 h-4 w-px bg-border" />
      <B label="Citation" on={() => c().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="size-4" /></B>
      <B label="Séparateur" on={() => c().setHorizontalRule().run()}><Minus className="size-4" /></B>
      <span className="ml-auto pr-1 text-[10px] text-muted-foreground">Tapez « - » ou « [] » en début de ligne pour une liste, « # » pour un titre.</span>
    </div>
  );
}
