"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addFunder } from "@/app/actions/funders";

// Nouveau financeur : un bouton en haut à droite, le nom se saisit dans un petit panneau (règle de Gaël, 17/09), puis on
// atterrit sur sa fiche pour compléter contacts et conventions.
export function AddFunderForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button size="sm" data-testid="add-funder-open"><Plus />Nouveau financeur</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2.5">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addFunder(name); if (!r.ok) { toast.error(r.error); return; } setName(""); setOpen(false); router.push(`/financeurs/${r.data!.id}`); router.refresh(); }); }}>
          <label className="grid gap-1 text-xs"><span className="font-semibold">Nom du financeur</span><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Fondation de France" className="h-8" data-testid="add-funder-name" /></label>
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" size="xs" disabled={pending || !name.trim()} data-testid="add-funder-submit"><Plus />Ajouter</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
