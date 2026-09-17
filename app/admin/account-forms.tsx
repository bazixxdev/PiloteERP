"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, MailCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/copy-button";
import { createAccount, markMailHanded, revokeAllSessions, sendResetLink } from "@/app/actions/accounts";

type R = { ok: true } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error); return; } after?.(); router.refresh(); });
  return { pending, run };
}

// Actions sur le compte d'une personne (admin › Comptes) : créer, lien de mot de passe, déconnecter partout.
export function AccountActions({ personId, hasAccount, hasEmail, active, sessions }: { personId: string; hasAccount: boolean; hasEmail: boolean; active: boolean; sessions: number }) {
  const { pending, run } = useRun();
  if (!hasAccount) return <Button size="xs" variant="outline" disabled={pending || !hasEmail || !active} title={!hasEmail ? "Renseignez d'abord l'adresse e-mail" : !active ? "Personne désactivée" : "Créer le compte et préparer le lien d'accès"} data-testid={`account-create-${personId}`} onClick={() => run(() => createAccount(personId), () => toast.success("Compte créé : le lien d'accès est dans la boîte d'envoi"))}><UserPlus />Créer le compte</Button>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button size="xs" variant="ghost" disabled={pending} title="Préparer un lien de nouveau mot de passe" data-testid={`account-reset-${personId}`} onClick={() => run(() => sendResetLink(personId), () => toast.success("Lien préparé dans la boîte d'envoi"))}><KeyRound />Lien mot de passe</Button>
      <Button size="xs" variant="ghost" disabled={pending || sessions === 0} title={sessions ? `Fermer ${sessions} session${sessions > 1 ? "s" : ""} ouverte${sessions > 1 ? "s" : ""}` : "Aucune session ouverte"} data-testid={`account-revoke-${personId}`} onClick={() => run(() => revokeAllSessions(personId), () => toast.success("Sessions fermées"))}><LogOut />Déconnecter partout</Button>
    </div>
  );
}

// Boîte d'envoi : un courrier = un lien à remettre à la personne (copier, puis « remis »).
export function OutboxRow({ id, link }: { id: string; link: string | null }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {link && <CopyButton text={link} label="Copier le lien" />}
      <Button size="xs" variant="ghost" disabled={pending} title="Marquer comme remis" data-testid={`mail-handed-${id}`} onClick={() => run(() => markMailHanded(id), () => toast.success("Courrier marqué remis"))}><MailCheck />Remis</Button>
    </div>
  );
}
