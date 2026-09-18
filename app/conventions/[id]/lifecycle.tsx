"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/common/searchable-select";
import { addDossierNote, addDossierTask, setDossierStatus, toggleDossierTask, uploadDossierFile } from "@/app/actions/dossiers";
import { TRANSITIONS } from "@/lib/dossiers";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { V, au } from "@/lib/vocab";

// Le cycle d'un dossier : les boutons de passage à l'étape suivante ; écarter / refuser demandent le pourquoi, obtenu demande la
// forme du financement et le montant notifié.
export function LifecycleButtons({ id, status, forms }: { id: string; status: string; forms: { value: string; label: string }[] }) {
  const [ask, setAsk] = useState<{ to: string; kind: "reason" | "award"; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState("convention");
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (to: string, extra?: { reason?: string; form?: string; amountNotified?: string }) => start(async () => { const r = await setDossierStatus(id, to, extra); if (!r.ok) { toast.error(r.error); return; } toast.success("Étape enregistrée"); setAsk(null); setReason(""); router.refresh(); });
  const list = TRANSITIONS[status] ?? [];
  if (list.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="dossier-transitions">
      {list.map((t) => <Button key={t.to} size="sm" variant={t.tone === "primary" ? "default" : "outline"} className={cn(t.tone === "danger" && "text-danger")} disabled={pending} onClick={() => (t.ask ? setAsk({ to: t.to, kind: t.ask, label: t.label }) : go(t.to))} data-testid={`dossier-to-${t.to}`}>{t.label}</Button>)}
      <Dialog open={Boolean(ask)} onOpenChange={(o) => { if (!o) setAsk(null); }}>
        <DialogContent className="max-w-md">
          {ask?.kind === "reason" ? (
            <>
              <DialogHeader><DialogTitle>{ask.label} ce dossier</DialogTitle><DialogDescription>Dites pourquoi : c&apos;est ce qui restera dans l&apos;historique, pour la prochaine fois.</DialogDescription></DialogHeader>
              <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="hors critères, calendrier intenable, financement moins élevé qu'annoncé…" className="h-9" data-testid="dossier-reason" />
              <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setAsk(null)}>Annuler</Button><Button size="sm" disabled={pending || !reason.trim()} onClick={() => go(ask.to, { reason })} data-testid="dossier-confirm">{ask.label}</Button></div>
            </>
          ) : ask ? (
            <>
              <DialogHeader><DialogTitle>Financement obtenu</DialogTitle><DialogDescription>Sous quelle forme, et pour combien (le montant notifié peut différer du demandé) — vous pourrez ajuster ensuite.</DialogDescription></DialogHeader>
              <label className="grid gap-1 text-xs"><span className="font-semibold">Forme</span><Select value={form} onChange={(e) => setForm(e.target.value)} className="h-9 text-sm" aria-label="Forme du financement" data-testid="dossier-form">{forms.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</Select></label>
              <label className="grid gap-1 text-xs"><span className="font-semibold">Montant notifié (€)</span><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="facultatif pour l'instant" className="h-9 text-right" data-testid="dossier-award-amount" /></label>
              <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setAsk(null)}>Annuler</Button><Button size="sm" disabled={pending} onClick={() => go(ask.to, { form, amountNotified: amount })} data-testid="dossier-confirm">Obtenu</Button></div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </span>
  );
}

// Les étapes, en frise : celle où l'on est, celles passées, celles à venir.
export function Stepper({ status }: { status: string }) {
  const steps = [["study", "À étudier"], ["drafting", "Réponse"], ["submitted", "Déposé"], ["notified", "Obtenu"], ["contracted", "Signé"], ["justified", "Justifié"]];
  const idx = steps.findIndex(([k]) => k === status);
  const closed = status === "lost" || status === "dismissed";
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px]" data-testid="dossier-stepper" data-status={status}>
      {steps.map(([k, l], i) => <li key={k} className={cn("rounded-full border px-2 py-0.5", i === idx ? "border-primary bg-primary text-primary-foreground" : i < idx && !closed ? "border-mint/50 bg-mint/10 text-mint" : "text-muted-foreground")}>{l}</li>)}
      {closed && <li className="rounded-full border border-danger/50 bg-danger-soft px-2 py-0.5 text-danger">{status === "lost" ? "Refusé" : "Écarté"}</li>}
    </ol>
  );
}

// Tâches du dossier : qui fait quoi pour répondre, cochables ; notes rapides ; pièces.
export function DossierWorkspace({ id, tasks, notes, files, rw }: { id: string; tasks: { id: string; label: string; done: boolean; dueDate: Date | string | null; person: { name: string } }[]; notes: { id: string; title: string; body: string; date: Date | string; author: { name: string } }[]; files: { id: string; label: string; fileName: string; uploadedBy: { name: string } }[]; rw: boolean }) {
  const [label, setLabel] = useState("");
  const [due, setDue] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [fileLabel, setFileLabel] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  const fmt = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return (
    <div className="grid gap-4 text-xs">
      <div data-testid="dossier-tasks">
        <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Tâches <span className="font-normal">· pour s&apos;organiser, chacun coche les siennes</span></div>
        <ul className="grid gap-1">{tasks.map((t) => <li key={t.id} className={cn("flex items-center gap-2", t.done && "text-muted-foreground line-through")}><input type="checkbox" checked={t.done} disabled={pending} onChange={(e) => run(() => toggleDossierTask(t.id, e.target.checked))} className="size-3.5 accent-primary" aria-label={t.label} data-testid={`dossier-task-${t.id}`} /><span>{t.label}</span><span className="text-[10px] text-muted-foreground">{t.person.name}{t.dueDate ? ` · ${fmt(t.dueDate)}` : ""}</span></li>)}</ul>
        <form className="mt-1.5 flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => addDossierTask(id, label, due || null), () => { setLabel(""); setDue(""); }); }}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Relire le cahier des charges, demander le budget ${au(V.pilote)}…`} className="h-7 w-72 text-[11px]" aria-label="Nouvelle tâche" data-testid="dossier-task-label" />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-36 text-[11px]" aria-label="Échéance" />
          <Button type="submit" size="xs" variant="outline" disabled={pending || !label.trim()} data-testid="dossier-task-submit">Ajouter</Button>
        </form>
      </div>
      <div data-testid="dossier-notes">
        <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Notes</div>
        {notes.length === 0 && <p className="text-muted-foreground">Aucune note.</p>}
        <ul className="grid gap-1.5">{notes.map((n) => <li key={n.id} className="rounded-md border bg-card px-2 py-1.5"><b className="font-medium">{n.title}</b> <span className="text-[10px] text-muted-foreground">· {n.author.name} · {fmt(n.date)}</span><p className="mt-0.5 whitespace-pre-line">{n.body}</p></li>)}</ul>
        <form className="mt-1.5 grid gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => addDossierNote(id, noteTitle, noteBody), () => { setNoteTitle(""); setNoteBody(""); }); }}>
          <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Titre (échange avec le financeur, point d'équipe…)" className="h-7 text-[11px]" aria-label="Titre de la note" data-testid="dossier-note-title" />
          <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="La note…" rows={2} className="rounded-md border bg-card px-2 py-1 text-[11px]" aria-label="Note" data-testid="dossier-note-body" />
          <div><Button type="submit" size="xs" variant="outline" disabled={pending || !noteBody.trim()} data-testid="dossier-note-submit">Ajouter la note</Button></div>
        </form>
      </div>
      <div data-testid="dossier-files">
        <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Pièces <span className="font-normal">· cahier des charges, réponse déposée, notification, convention signée</span></div>
        {files.length === 0 && <p className="text-muted-foreground">Aucune pièce.</p>}
        <ul className="grid gap-0.5">{files.map((a) => <li key={a.id}><a href={withBase(`/api/pieces/${a.id}`)} target="_blank" rel="noreferrer" className="text-primary hover:underline">{a.label}</a> <span className="text-[10px] text-muted-foreground">{a.fileName} · {a.uploadedBy.name}</span></li>)}</ul>
        {rw && (
          <form className="mt-1.5 flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set("conventionId", id); fd.set("label", fileLabel); const form = e.currentTarget; start(async () => { const r = await uploadDossierFile(fd); if (!r.ok) { toast.error(r.error); return; } setFileLabel(""); form.reset(); toast.success("Pièce déposée"); router.refresh(); }); }}>
            <Input value={fileLabel} onChange={(e) => setFileLabel(e.target.value)} placeholder="Intitulé" className="h-7 w-44 text-[11px]" aria-label="Intitulé de la pièce" data-testid="dossier-file-label" />
            <input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt" className="text-[11px]" aria-label="Fichier" data-testid="dossier-file-input" />
            <Button type="submit" size="xs" variant="outline" disabled={pending} data-testid="dossier-file-submit">Déposer</Button>
          </form>
        )}
      </div>
    </div>
  );
}
