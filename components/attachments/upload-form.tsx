"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadAttachment } from "@/app/actions/attachments";

type Opt = { value: string; label: string };

// Dépôt d'une pièce : nature, libellé facultatif, fichier. Le contexte (ligne, livrable, validation) est passé en champs cachés.
export function UploadForm({ editionId, kinds, defaultKind, fundingLineId, deliverableId, validationId, compact }: { editionId: string; kinds: Opt[]; defaultKind: string; fundingLineId?: string; deliverableId?: string; validationId?: string; compact?: boolean }) {
  const [kind, setKind] = useState(defaultKind);
  const [label, setLabel] = useState("");
  const [fileName, setFileName] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const sel = compact ? "h-7 rounded-lg border bg-card px-2 text-xs" : "h-8 rounded-lg border bg-card px-2 text-sm";
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      data-testid="upload-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = fileRef.current?.files?.[0];
        if (!f) return;
        const form = new FormData();
        form.set("editionId", editionId); form.set("kind", kind); form.set("label", label); form.set("file", f);
        if (fundingLineId) form.set("fundingLineId", fundingLineId);
        if (deliverableId) form.set("deliverableId", deliverableId);
        if (validationId) form.set("validationId", validationId);
        start(async () => {
          const r = await uploadAttachment(form);
          if (!r.ok) { toast.error(r.error); return; }
          toast.success("Pièce déposée");
          setLabel(""); setFileName(""); if (fileRef.current) fileRef.current.value = "";
          router.refresh();
        });
      }}
    >
      <select className={sel} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Nature de la pièce" data-testid="upload-kind">
        {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>
      {!compact && <input className={sel + " w-44"} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (facultatif)" aria-label="Libellé" />}
      <label className={"inline-flex cursor-pointer items-center gap-1 rounded-lg border bg-card px-2 " + (compact ? "h-7 text-xs" : "h-8 text-sm")}>
        <Paperclip className="size-3.5" />{fileName || "Choisir un fichier"}
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.doc,.xls,.txt,.csv" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} data-testid="upload-file" />
      </label>
      <Button type="submit" size={compact ? "xs" : "sm"} variant="outline" disabled={pending || !fileName} data-testid="upload-submit">{pending ? "Dépôt…" : "Déposer"}</Button>
    </form>
  );
}
