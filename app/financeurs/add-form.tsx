"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addFunder } from "@/app/actions/funders";

export function AddFunderForm() {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addFunder(name); if (!r.ok) { toast.error(r.error); return; } setName(""); router.push(`/financeurs/${r.data!.id}`); router.refresh(); }); }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau financeur…" aria-label="Nom du financeur" className="h-8 w-52" data-testid="add-funder-name" />
      <Button type="submit" size="sm" disabled={pending || !name.trim()} data-testid="add-funder-submit"><Plus />Ajouter</Button>
    </form>
  );
}
