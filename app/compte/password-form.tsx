"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPassword } from "@/app/actions/accounts";

// Changer son mot de passe (lot F) : l'ancien est vérifié, les autres sessions du compte sont fermées.
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-2" data-testid="password-form" onSubmit={(e) => { e.preventDefault();
      if (p1 !== p2) { toast.error("Les deux saisies diffèrent."); return; }
      start(async () => { const r = await changeMyPassword(current, p1); if (!r.ok) { toast.error(r.error); return; } toast.success("Mot de passe changé ; vos autres sessions sont fermées."); setCurrent(""); setP1(""); setP2(""); });
    }}>
      <div className="grid gap-1"><Label htmlFor="pw-current" className="text-xs">Mot de passe actuel</Label><Input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="h-8" data-testid="pw-current" /></div>
      <div className="grid gap-1 sm:grid-cols-2">
        <div className="grid gap-1"><Label htmlFor="pw-1" className="text-xs">Nouveau (10 caractères au moins)</Label><Input id="pw-1" type="password" autoComplete="new-password" required minLength={10} value={p1} onChange={(e) => setP1(e.target.value)} className="h-8" data-testid="pw-1" /></div>
        <div className="grid gap-1"><Label htmlFor="pw-2" className="text-xs">Encore une fois</Label><Input id="pw-2" type="password" autoComplete="new-password" required minLength={10} value={p2} onChange={(e) => setP2(e.target.value)} className="h-8" data-testid="pw-2" /></div>
      </div>
      <div><Button type="submit" size="sm" variant="outline" disabled={pending} data-testid="pw-submit">Changer le mot de passe</Button></div>
    </form>
  );
}
