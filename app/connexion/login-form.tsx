"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

// Connexion e-mail / mot de passe. Le message d'erreur reste générique : on ne dit pas si l'adresse existe.
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="grid gap-3" data-testid="login-form" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => {
      const r = await authClient.signIn.email({ email: email.trim(), password });
      if (r.error) { setError(r.error.status === 429 ? "Trop d'essais : attendez une minute." : r.error.message?.includes("désactivé") || r.error.message?.includes("rattaché") ? r.error.message : "Adresse ou mot de passe incorrect."); return; }
      router.push(next); router.refresh();
    }); }}>
      <div className="grid gap-1"><Label htmlFor="email">Adresse e-mail</Label><Input id="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" /></div>
      <div className="grid gap-1"><Label htmlFor="password">Mot de passe</Label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" /></div>
      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert" data-testid="login-error">{error}</p>}
      <Button type="submit" disabled={pending} data-testid="login-submit">{pending ? "Connexion…" : "Se connecter"}</Button>
      <p className="text-center text-xs"><Link href="/mot-de-passe-oublie" className="text-primary hover:underline">Mot de passe oublié ?</Link></p>
    </form>
  );
}
