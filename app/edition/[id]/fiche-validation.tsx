"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { decideFiche } from "@/app/actions/fiche-validation";
import type { FicheDecision } from "@/lib/fiche-validation";
import { cn } from "@/lib/utils";

export type StepView = { levelId: string; order: number; label: string; decision: FicheDecision | null; decider: string | null; date: string | null; comment: string | null; isNext: boolean };
export type PastDecisionView = { id: string; label: string; decision: FicheDecision; decider: string; date: string; comment: string | null };

const BADGE: Record<FicheDecision, { label: string; color: "mint" | "warning" | "danger" }> = {
  approved: { label: "Validé", color: "mint" },
  rework: { label: "À retravailler", color: "warning" },
  refused: { label: "Refusé", color: "danger" },
};

type Props = {
  editionId: string;
  no: string;
  title: string;
  owner: string;
  steps: StepView[];
  // Décisions des tours précédents (avant le dernier « à retravailler ») : lisibles, repliées.
  past: PastDecisionView[];
  complete: boolean;
  // Ce que je peux faire ici, calculé côté serveur par la garde de decideFiche (ficheDecisionRefusal) — la commande revérifie.
  can: { approved: boolean; rework: boolean; refused: boolean };
  // Pourquoi je ne décide pas le niveau en attente (sa propre fiche, pas le droit…), et l'impasse éventuelle du niveau
  // (seul le pilote tient son droit, ou personne) : dite en clair, jamais un bouton absent sans explication.
  blocked: string | null;
  deadEnd: string | null;
};

// Couche 4 de la fiche : le circuit de validation, niveau par niveau (spec vocabulaire § 3). Pour le niveau à décider, si j'en
// ai le droit : Valider, À retravailler, Refuser (+ commentaire, obligatoire pour les deux derniers).
export function FicheValidationSection(p: Props) {
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const next = p.steps.find((s) => s.isNext) ?? null;
  const decide = (decision: FicheDecision) => start(async () => {
    const r = await decideFiche(p.editionId, decision, comment);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(decision === "approved" ? "Validation enregistrée" : decision === "rework" ? "Fiche renvoyée à retravailler" : "Refus enregistré");
    setComment("");
    // Rester sur la fiche : une fiche qui vient d'être validée atterrirait sinon sur l'Aperçu.
    router.replace(`${pathname}?onglet=fiche#couche-validation`, { scroll: false });
    router.refresh();
  });
  const anyAction = p.can.approved || p.can.rework || p.can.refused;
  const decideForm = (
    <form className="mt-3 grid gap-2 rounded-md border bg-muted/40 p-3" onSubmit={(e) => e.preventDefault()} data-testid="fiche-decide">
      <label className="grid gap-1 text-xs">
        <span className="font-semibold">{p.complete ? "Rouvrir la fiche validée : dites quoi reprendre" : `Décision au niveau « ${next?.label ?? ""} »`} <span className="font-normal text-muted-foreground">(commentaire obligatoire pour « À retravailler » et « Refuser »)</span></span>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={2000} className="rounded-md border bg-card p-2 text-sm" placeholder="Ce qui est validé, ce qui est à reprendre, pourquoi…" data-testid="fiche-decide-comment" />
      </label>
      <div className="flex flex-wrap gap-2">
        {p.can.approved && <Button type="button" size="sm" disabled={pending} onClick={() => decide("approved")} data-testid="fiche-decide-approved"><Check />Valider</Button>}
        {p.can.rework && <Button type="button" size="sm" variant="outline" disabled={pending || !comment.trim()} onClick={() => decide("rework")} data-testid="fiche-decide-rework"><RotateCcw />À retravailler</Button>}
        {p.can.refused && <Button type="button" size="sm" variant="outline" disabled={pending || !comment.trim()} onClick={() => decide("refused")} data-testid="fiche-decide-refused"><X />Refuser</Button>}
      </div>
    </form>
  );
  const empty = p.steps.every((s) => !s.decision);

  return (
    <section id="couche-validation" data-testid="layer-validation" className={cn("min-w-0 scroll-mt-20 overflow-hidden rounded-md border bg-card px-[18px] py-4", empty && !anyAction && "border-dashed bg-muted/40")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className={cn("grid size-[26px] shrink-0 place-items-center rounded-full border font-serif text-sm", empty ? "border-[#c9cdc5] text-muted-foreground" : "border-[#bfccba] text-mint")}>{p.no}</span>
          <h4 className="text-sm font-bold text-foreground">{p.title}</h4>
          {p.complete ? <StatusBadge label="Circuit terminé" color="mint" dot={false} /> : next ? <StatusBadge label={`À décider : ${next.label}`} color="info" dot={false} /> : null}
        </div>
        <span className="text-[10px] text-muted-foreground">{p.owner}</span>
      </div>

      {p.steps.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground lg:ml-9" data-testid="fiche-levels-none">Aucun niveau de validation actif : le circuit se règle dans Admin › Paramètres.</p>
      ) : (
        <ol className="mt-3 grid gap-2 lg:ml-9" data-testid="fiche-levels">
          {p.steps.map((s, i) => (
            <li key={s.levelId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-dashed pb-2 text-sm last:border-0" data-testid={`fiche-level-${i + 1}`}>
              <span className="font-semibold">{i + 1}. {s.label}</span>
              {s.decision ? (
                <>
                  <StatusBadge label={BADGE[s.decision].label} color={BADGE[s.decision].color} dot={false} />
                  <span className="text-xs text-muted-foreground">{s.decider} · {s.date}</span>
                  {s.comment && <span className="basis-full text-xs text-muted-foreground">« {s.comment} »</span>}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{s.isNext ? "à décider" : "en attente du niveau précédent"}</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {p.deadEnd && <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-foreground lg:ml-9" data-testid="fiche-level-dead-end">{p.deadEnd}</p>}
      {p.blocked && !anyAction && <p className="mt-2 text-xs text-muted-foreground lg:ml-9" data-testid="fiche-decide-blocked">{p.blocked}</p>}

      {anyAction && (p.complete ? (
        // Fiche validée : rouvrir reste possible (« À retravailler » au dernier niveau), replié pour ne pas encombrer la lecture.
        <details className="mt-3 text-xs lg:ml-9" data-testid="fiche-reopen">
          <summary className="cursor-pointer text-primary">Rouvrir la fiche (à retravailler)</summary>
          {decideForm}
        </details>
      ) : <div className="lg:ml-9">{decideForm}</div>)}

      {p.past.length > 0 && (
        <details className="mt-3 text-xs lg:ml-9" data-testid="fiche-levels-past">
          <summary className="cursor-pointer text-muted-foreground">Tours précédents · {p.past.length} décision{p.past.length > 1 ? "s" : ""}</summary>
          <ul className="mt-1.5 grid gap-1 text-muted-foreground">
            {p.past.map((d) => <li key={d.id}>{d.date} · {d.label} : <b className="text-foreground">{BADGE[d.decision].label.toLowerCase()}</b> · {d.decider}{d.comment ? ` — « ${d.comment} »` : ""}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
