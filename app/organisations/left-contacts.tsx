"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setContactLeft } from "@/app/actions/organisations";

// « Parti·e » / « De retour » : un contact qui quitte l'organisation se détache, il reste lisible sur les dossiers qui le citent.
export function LeftContacts({ contacts, readOnly }: { contacts: { id: string; name: string; leftAt: string | null }[]; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (readOnly || contacts.length === 0) return null;
  const toggle = (id: string, left: boolean) => start(async () => { const r = await setContactLeft(id, left); if (!r.ok) toast.error(r.error); router.refresh(); });
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" data-testid="contacts-left">
      {contacts.map((c) => (
        <span key={c.id}>{c.name}{c.leftAt ? <> · parti·e le {c.leftAt} · <button type="button" disabled={pending} onClick={() => toggle(c.id, false)} className="underline underline-offset-2" data-testid={`contact-back-${c.id}`}>de retour</button></> : <> · <button type="button" disabled={pending} onClick={() => toggle(c.id, true)} className="underline underline-offset-2" data-testid={`contact-left-${c.id}`}>parti·e</button></>}</span>
      ))}
    </div>
  );
}
