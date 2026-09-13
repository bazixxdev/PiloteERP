import { FileText, Paperclip } from "lucide-react";
import type { RefMap } from "@/lib/refs";
import { refLabel } from "@/lib/refs";
import { fmtDate } from "@/lib/format";
import { fmtSize } from "@/lib/attachments";
import { cn } from "@/lib/utils";

export type AttachmentRow = { id: string; kind: string; label: string; fileName: string; size: number; createdAt: Date; uploadedBy: { name: string }; fundingLineId?: string | null; validationId?: string | null; deliverableId?: string | null };

export function AttachmentList({ items, refs, compact, emptyText = "Aucune pièce." }: { items: AttachmentRow[]; refs: RefMap; compact?: boolean; emptyText?: string }) {
  if (items.length === 0) return <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>{emptyText}</p>;
  return (
    <ul className={cn("divide-y", compact ? "text-xs" : "text-sm")} data-testid="attachments">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-2 py-1">
          {compact ? <Paperclip className="size-3 shrink-0 text-primary" /> : <FileText className="size-4 shrink-0 text-primary" />}
          <span className="rounded-sm bg-secondary px-1.5 text-[11px] font-medium text-primary">{refLabel(refs, "attachment_kind", a.kind)}</span>
          <a href={`/api/pieces/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium hover:underline" title={a.fileName}>{a.label}</a>
          <span className="shrink-0 text-muted-foreground">{fmtSize(a.size)} · {a.uploadedBy.name} · {fmtDate(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
