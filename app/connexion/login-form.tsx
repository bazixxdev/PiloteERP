"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

// Connexion e-mail / mot de passe. Le message d'erreur reste générique : on ne dit pas si l'adresse existe.
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="grid gap-3" data-testid="login-form" onSubmit={(e) => { e.preventDefault(); setError(null); start(async () => {
      const r = await authClient.signIn.email({ email: email.trim(), password, rememberMe: remember });
      if (r.error) { setError(r.error.status === 429 ? "Trop d'essais : attendez une minute." : r.error.message?.includes("désactivé") || r.error.message?.includes("rattaché") ? r.error.message : "Adresse ou mot de passe incorrect."); return; }
      router.push(next); router.refresh();
    }); }}>
      <div className="grid gap-1"><Label htmlFor="email">Adresse e-mail</Label><Input id="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" /></div>
      <div className="grid gap-1">
        <div className="flex items-center justify-between"><Label htmlFor="password">Mot de passe</Label><Link href="/mot-de-passe-oublie" className="text-xs text-primary hover:underline">Mot de passe oublié ?</Link></div>
        <div className="relative">
          <Input id="password" type={shown ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" className="pr-10" />
          <button type="button" aria-controls="password" aria-pressed={shown} aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"} data-testid="login-toggle-password" className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground" onClick={() => setShown((s) => !s)}>
            {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert" data-testid="login-error">{error}</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--brand-ink)]" data-testid="login-remember" />Rester connecté</label>
      <Button type="submit" disabled={pending} data-testid="login-submit" className="h-12 w-full">{pending ? "Connexion…" : "Se connecter"}</Button>
    </form>
  );
}
