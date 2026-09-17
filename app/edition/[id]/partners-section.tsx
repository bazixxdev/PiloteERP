"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/common/searchable-select";
import { addEditionPartner, removeEditionPartner } from "@/app/actions/organisations";

type P = { organisationId: string; name: string; role: string | null; kinds: string };

// Partenaires liés à l'édition (lot E2) : des organisations de l'annuaire, avec ce qu'elles font sur cette édition. Le texte
// libre « Partenaires » de la fiche reste ; ici c'est le lien qui compte (fiche de l'organisation, bilan, réalisations).
export function PartnersSection({ editionId, partners, organisations, canEdit }: { editionId: string; partners: P[]; organisations: { id: string; name: string }[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  const available = organisations.filter((o) => !partners.some((p) => p.organisationId === o.id));
  return (
    <section id="partenaires" className="scroll-mt-20 rounded-md border bg-card px-[18px] py-4" data-testid="partners-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h4 className="text-sm font-bold">Partenaires</h4>
          <span className="text-[10px] text-muted-foreground">{partners.length ? `${partners.length} organisation${partners.length > 1 ? "s" : ""} liée${partners.length > 1 ? "s" : ""}` : "aucune organisation liée · le texte de la fiche reste le repli"}</span>
        </div>
        {canEdit && !adding && <Button size="xs" variant="outline" onClick={() => setAdding(true)} data-testid="partner-add-open"><Plus />Lier une organisation</Button>}
      </div>
      {partners.length > 0 && (
        <ul className="mt-2.5 grid gap-1 text-sm" data-testid="partners-list">
          {partners.map((p) => (
            <li key={p.organisationId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <a href={`/organisations?organisation=${p.organisationId}`} className="font-medium text-primary underline-offset-2 hover:underline">{p.name}</a>
              {p.role && <span className="text-xs text-muted-foreground">· {p.role}</span>}
              {canEdit && <button type="button" disabled={pending} onClick={() => run(() => removeEditionPartner(editionId, p.organisationId))} className="ml-1 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label={`Retirer ${p.name}`} data-testid={`partner-remove-${p.organisationId}`}><X className="size-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      {adding && canEdit && (
        <form className="mt-3 grid gap-2 rounded-lg border border-dashed p-2 md:grid-cols-[1.4fr_1fr_1.4fr_auto_auto]" data-testid="partner-form" onSubmit={(e) => { e.preventDefault(); run(() => addEditionPartner(editionId, { organisationId: orgId || null, name: orgId ? null : name, role }), () => { setOrgId(""); setName(""); setRole(""); setAdding(false); toast.success("Partenaire lié"); }); }}>
          <Select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="h-8 text-xs" aria-label="Organisation de l'annuaire" placeholder="— dans l'annuaire —" data-testid="partner-org">
            <option value="">— dans l&apos;annuaire —</option>
            {available.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Input value={name} disabled={Boolean(orgId)} onChange={(e) => setName(e.target.value)} placeholder="ou un nouveau nom" className="h-8 text-xs" aria-label="Nouvelle organisation" data-testid="partner-name" />
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="ce qu'elle fait ici (facultatif)" className="h-8 text-xs" aria-label="Rôle du partenaire" data-testid="partner-role" />
          <Button type="submit" size="sm" disabled={pending || (!orgId && !name.trim())} data-testid="partner-submit">Lier</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Annuler</Button>
        </form>
      )}
    </section>
  );
}
