"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { withBase } from "@/lib/base-path";
import { V } from "@/lib/vocab";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return (
    <div className="grid gap-3 text-sm" data-testid="forgot-done">
      <p>Si cette adresse correspond à un compte, un lien a été préparé.</p>
      <p className="text-muted-foreground">{`Les mails ne sont pas encore branchés dans le prototype : le lien est dans la boîte d'envoi de l'administration (${V.direction.one}, ${V.raf.one}), qui vous le remet.`}</p>
      <Link href="/connexion" className="text-primary hover:underline">Retour à la connexion</Link>
    </div>
  );
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
      // Même réponse que le compte existe ou non : pas d'énumération des adresses.
      await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}${withBase("/reinitialiser")}` }).catch(() => null);
      setDone(true);
    }); }}>
      <div className="grid gap-1"><Label htmlFor="email">Adresse e-mail</Label><Input id="email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" /></div>
      <Button type="submit" disabled={pending} data-testid="forgot-submit">Préparer le lien</Button>
      <p className="text-center text-xs"><Link href="/connexion" className="text-primary hover:underline">Retour à la connexion</Link></p>
    </form>
  );
}
