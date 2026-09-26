"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAction } from "@/app/actions/actions";
import { V, cap, ce, e } from "@/lib/vocab";

// Supprimer l'action (droits de l'année seulement, voir actionRights) ; la commande refuse quand des heures ou des dépenses y
// sont rattachées. Après suppression, retour à l'année d'où l'on vient.
export function DeleteActionButton({ actionId, name, backHref, abandonedLabel }: { actionId: string; name: string; backHref: string; abandonedLabel: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button type="button" size="sm" variant="ghost" className="text-muted-foreground hover:text-danger" disabled={pending} data-testid="action-delete" title={`Supprimer ${ce(V.action)}`}
      onClick={() => {
        if (!confirm(`Supprimer « ${name} » ?\nSes jalons et ses personnes associées partent avec ${ce(V.action)}. Pour en garder la trace, choisissez plutôt l'état « ${abandonedLabel} ».`)) return;
        start(async () => {
          const r = await deleteAction(actionId);
          if (!r.ok) { toast.error(r.error); return; }
          toast.success(`${cap(V.action)} supprimé${e(V.action)}`);
          router.push(backHref);
        });
      }}><Trash2 />Supprimer</Button>
  );
}
