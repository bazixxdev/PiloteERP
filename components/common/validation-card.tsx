import Link from "next/link";
import { StatusBadge } from "@/components/common/status-badge";
import { DecideButtons } from "@/components/common/decide-buttons";
import type { RefMap } from "@/lib/refs";
import { refColor, refLabel } from "@/lib/refs";
import { dayjs, fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ValidationForCard = {
  id: string; kind: string; label: string; amount: number | null; attachmentUrl: string | null; requiredLevel: number; status: string;
  createdAt: Date; decidedAt: Date | null; decisionComment: string | null; targetDelayDays: number;
  requester: { name: string }; decider: { name: string } | null; action: { name: string } | null;
  edition?: { id: string; year: number; project: { name: string } };
};

const LEVEL_LABEL = ["", "niveau 1 · pilote", "niveau 2 · responsable de pôle", "niveau 3 · direction"];

export function ValidationCard({ v, refs, canDecide, showEdition, index }: { v: ValidationForCard; refs: RefMap; canDecide: boolean; showEdition?: boolean; index?: number }) {
  const age = dayjs().diff(dayjs(v.createdAt), "day");
  const overdue = v.status === "pending" && age > v.targetDelayDays;
  return (
    <div className={cn("rounded-xl border bg-card p-3", overdue && "border-danger/40", v.status === "pending" && !overdue && age >= v.targetDelayDays - 1 && "border-warning/60")} data-testid={index !== undefined ? `validation-${index}` : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={refLabel(refs, "validation_kind", v.kind)} color="info" dot={false} />
            <span className="font-medium">{v.label}</span>
            {v.amount != null && <span className="tabular text-sm font-semibold">{fmtEuro(v.amount)}</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {showEdition && v.edition && <><Link href={`/edition/${v.edition.id}?onglet=validations`} className="text-primary hover:underline">{v.edition.project.name} · {v.edition.year}</Link> · </>}
            Demandé par {v.requester.name} le {fmtDate(v.createdAt)}{v.action ? ` · action « ${v.action.name} »` : ""} · {LEVEL_LABEL[v.requiredLevel]}
            {v.attachmentUrl && <> · <a href={v.attachmentUrl} className="text-primary hover:underline">pièce jointe</a></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {v.status === "pending" ? (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", overdue ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground")}>
              {age === 0 ? "aujourd'hui" : `${age} j`} · cible {v.targetDelayDays} j
            </span>
          ) : (
            <StatusBadge label={refLabel(refs, "validation_status", v.status)} color={refColor(refs, "validation_status", v.status)} />
          )}
        </div>
      </div>
      {v.status === "pending" ? (
        canDecide ? <div className="mt-2"><DecideButtons id={v.id} /></div> : <p className="mt-2 text-xs text-muted-foreground">En attente d'un valideur de {LEVEL_LABEL[v.requiredLevel]}.</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{v.decider?.name} · {fmtDate(v.decidedAt)}{v.decisionComment ? ` · « ${v.decisionComment} »` : ""}</p>
      )}
    </div>
  );
}
