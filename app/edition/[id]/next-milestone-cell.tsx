"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setNextMilestoneDate } from "@/app/actions/edition";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const toInput = (d: Date | null) => {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Colonne « Prochain jalon » de l'onglet (en attendant la page de l'action) : la date du prochain jalon non fait, modifiable ;
// son libellé dessous quand il ne répète pas le nom de l'action. Enregistre au changement, comme un champ date d'AutoField.
export function NextMilestoneCell({ actionId, actionName, date, label, lastDone, late, readOnly }: { actionId: string; actionName: string; date: Date | null; label: string | null; lastDone: Date | null; late: boolean; readOnly: boolean }) {
  const iso = toInput(date);
  const [val, setVal] = useState(iso);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const lastSent = useRef(iso);
  const router = useRouter();
  useEffect(() => { setVal(iso); lastSent.current = iso; }, [iso]);

  // Libellé du prochain jalon s'il ne répète pas le nom ; sans jalon à venir, le dernier tenu.
  const sub = label && label !== actionName ? <div className="truncate px-2 text-[10px] text-muted-foreground" title={label}>{label}</div>
    : !date && lastDone ? <div className="px-2 text-[10px] text-muted-foreground">{`dernier jalon tenu le ${fmtDate(lastDone)}`}</div> : null;
  if (readOnly) return <div data-readonly="true" className={cn("px-2 py-1 text-sm", late ? "font-medium text-danger" : date ? "text-foreground" : "italic text-muted-foreground")}>{date ? fmtDate(date) : "—"}{sub}</div>;

  // N'envoie qu'une date complète et plausible : un champ vidé ou en cours de frappe (« 0002-… ») n'écrit rien.
  const send = (next: string) => {
    if (!/^(19|20)\d\d-\d\d-\d\d$/.test(next) || next === lastSent.current) return;
    lastSent.current = next;
    start(async () => {
      const r = await setNextMilestoneDate(actionId, next);
      if (!r.ok) { toast.error(r.error); setVal(iso); lastSent.current = iso; return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  };
  return (
    <div className="relative">
      <input type="date" value={val} onChange={(e) => { setVal(e.target.value); send(e.target.value); }} onBlur={() => { if (val !== lastSent.current) setVal(lastSent.current); }} aria-label={`Prochain jalon, ${actionName}`}
        className={cn("w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm transition-colors hover:border-border focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20", late && "font-medium text-danger")} />
      {(pending || saved) && <span className="pointer-events-none absolute top-1.5 right-7 text-muted-foreground">{pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-mint" />}</span>}
      {sub}
    </div>
  );
}
