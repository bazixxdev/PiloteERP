"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { renewEdition } from "@/app/actions/edition";
import { V, cap, le, pl, aucun, e as fem } from "@/lib/vocab";

type Renewable = { id: string; name: string; years: string };

// Reconduction N → N+1 avec relecture avant création (EF-A2). Les actions qui continuent l'année suivante y sont déjà :
// seules celles qui finissent dans l'année sont proposées, cochées par défaut (spec actions § 2).
export function RenewDialog({ edition, disabled, open: openProp, onOpenChange, hideTrigger }: { edition: { id: string; year: number; projectName: string; renewable: Renewable[]; continuing: string[]; fundingLines: number; team: number }; disabled: boolean; open?: boolean; onOpenChange?: (o: boolean) => void; hideTrigger?: boolean }) {
  const [openState, setOpenState] = useState(false);
  // Contrôlé depuis le menu « … » de l'édition (revue du 15/09) ou autonome avec son bouton.
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const [pending, start] = useTransition();
  const router = useRouter();
  const next = edition.year + 1;
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());
  const chosen = edition.renewable.filter((a) => !unchecked.has(a.id));
  const toggle = (id: string, on: boolean) => setUnchecked((cur) => { const s = new Set(cur); if (on) s.delete(id); else s.add(id); return s; });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" disabled={disabled} title={disabled ? `${cap(le(V.edition))} ${next} existe déjà` : undefined} data-testid="renew-open"><CopyPlus />Reconduire en {next}</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reconduire « {edition.projectName} » en {next}</DialogTitle>
          <DialogDescription>{`Relisez ce qui sera copié avant de créer ${le(V.edition)} `}{next}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm" data-testid="renew-actions">
          <div className="font-semibold">{`${cap(pl(V.action))} qui finissent en ${edition.year}`}</div>
          {edition.renewable.length === 0 ? (
            <p className="text-muted-foreground">{`${cap(aucun(V.action))} ne finit en ${edition.year} : rien à recopier.`}</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {edition.renewable.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!unchecked.has(a.id)} onChange={(ev) => toggle(a.id, ev.target.checked)} className="size-4 accent-primary" data-testid={`renew-action-${a.id}`} />
                    <span>{a.name}</span><span className="text-xs text-muted-foreground">{a.years}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {edition.continuing.length > 0 && (
            <p className="text-muted-foreground" data-testid="renew-continuing">{`Les ${pl(V.action)} qui continuent en ${next} sont déjà là : ${edition.continuing.join(", ")}.`}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-mint-soft p-3">
            <div className="mb-1 font-semibold text-accent-foreground">Copié tel quel</div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Couche 1 · cadre stratégique</li>
              <li>Couche 2 · cadre de moyens</li>
              <li>Couche 3 · proposition opérationnelle</li>
              <li>{chosen.length}{` ${chosen.length > 1 ? pl(V.action) : V.action.one} coché${fem(V.action)}${chosen.length > 1 ? "s" : ""}`} (période et jalons +1 an, pas avant le 1er janvier {next} ; état « à faire »)</li>
              <li>{edition.fundingLines} ligne{edition.fundingLines > 1 ? "s" : ""} de financement (statut « à déposer », montants vidés)</li>
              <li>Équipe de {edition.team} personne{edition.team > 1 ? "s" : ""}, jours vendus, indicateurs (cibles), liens</li>
            </ul>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <div className="mb-1 font-semibold">Remis à zéro</div>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>Couche 4 · validation (décision, dates, CA)</li>
              <li>Budget (enveloppe, engagé, réalisé)</li>
              <li>Temps saisi</li>
              <li>Livrables financeurs et validations</li>
              <li>Bilan, évaluation, indicateurs réalisés</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            data-testid="renew-confirm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await renewEdition(edition.id, { actionIds: chosen.map((a) => a.id) });
                if (!res.ok) { toast.error(res.error); return; }
                toast.success(`${cap(V.edition)} ${next} créée`);
                setOpen(false);
                router.push(`/edition/${res.data!.id}`);
              })
            }
          >
            {pending ? "Création…" : `Créer ${le(V.edition)} ${next}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
