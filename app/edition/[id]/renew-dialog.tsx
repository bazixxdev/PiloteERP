"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { renewEdition } from "@/app/actions/edition";
import { V, cap, le } from "@/lib/vocab";

// Reconduction N → N+1 avec relecture avant création (EF-A2).
export function RenewDialog({ edition, disabled, open: openProp, onOpenChange, hideTrigger }: { edition: { id: string; year: number; projectName: string; actions: number; fundingLines: number; team: number }; disabled: boolean; open?: boolean; onOpenChange?: (o: boolean) => void; hideTrigger?: boolean }) {
  const [openState, setOpenState] = useState(false);
  // Contrôlé depuis le menu « … » de l'édition (revue du 15/09) ou autonome avec son bouton.
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const [pending, start] = useTransition();
  const router = useRouter();
  const next = edition.year + 1;
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
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-mint-soft p-3">
            <div className="mb-1 font-semibold text-accent-foreground">Copié tel quel</div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Couche 1 · cadre stratégique</li>
              <li>Couche 2 · cadre de moyens</li>
              <li>Couche 3 · proposition opérationnelle</li>
              <li>{edition.actions}{` ${V.action.one}`}{edition.actions > 1 ? "s" : ""} (jalons +1 an, état « à faire »)</li>
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
                const res = await renewEdition(edition.id);
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
