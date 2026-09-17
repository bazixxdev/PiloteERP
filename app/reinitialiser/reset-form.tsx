"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ResetForm({ token }: { token: string }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); setError(null);
      if (p1.length < 10) { setError("Dix caractères au moins."); return; }
      if (p1 !== p2) { setError("Les deux saisies diffèrent."); return; }
      start(async () => {
        const r = await authClient.resetPassword({ newPassword: p1, token });
        if (r.error) { setError("Ce lien n'est plus valable. Demandez-en un nouveau."); return; }
        toast.success("Mot de passe enregistré : connectez-vous.");
        router.push("/connexion");
      }); }}>
      <div className="grid gap-1"><Label htmlFor="p1">Nouveau mot de passe</Label><Input id="p1" type="password" autoComplete="new-password" required autoFocus value={p1} onChange={(e) => setP1(e.target.value)} data-testid="reset-p1" /></div>
      <div className="grid gap-1"><Label htmlFor="p2">Encore une fois</Label><Input id="p2" type="password" autoComplete="new-password" required value={p2} onChange={(e) => setP2(e.target.value)} data-testid="reset-p2" /></div>
      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" disabled={pending} data-testid="reset-submit">Enregistrer</Button>
    </form>
  );
}
