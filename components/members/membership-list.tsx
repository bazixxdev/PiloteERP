"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/status-badge";
import { createMembership, setMembershipStatus } from "@/app/actions/members";
import { MEMBERSHIP_METHODS, statusOf } from "@/lib/members";
import { fmtDate, fmtEuro } from "@/lib/format";

export type MembershipView = { id: string; year: number; college: string | null; amount: number; status: string; paidAt: Date | string | null; method: string | null; helloAssoItemId: string | null };

// Les adhésions d'une organisation ou d'une personne, sur sa fiche : une ligne par année, règlement en un clic, ajout d'une
// année. Le détail (collège, moyen, notes) se tient sur la page Adhérents.
export function MembershipList({ memberships, rw, organisationId, contactId }: { memberships: MembershipView[]; rw: boolean; organisationId?: string; contactId?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error ?? "Erreur"); return; } after?.(); router.refresh(); });
  const rows = [...memberships].sort((a, b) => b.year - a.year);
  return (
    <div className="grid gap-1.5 text-xs" data-testid="memberships">
      {rows.length === 0 && <p className="text-muted-foreground">Aucune adhésion enregistrée.</p>}
      {rows.map((m) => {
        const st = statusOf(m.status);
        return (
          <div key={m.id} className="flex flex-wrap items-center gap-2" data-testid={`membership-row-${m.year}`} data-status={m.status}>
            <Link href={`/adherents?annee=${m.year}`} className="font-semibold text-primary hover:underline">{m.year}</Link>
            <StatusBadge label={st.label} color={st.color} />
            <span className="tabular">{fmtEuro(m.amount)}</span>
            {m.college && <span className="text-muted-foreground">· {m.college}</span>}
            {m.paidAt && <span className="text-muted-foreground">· réglée le {fmtDate(m.paidAt)}{m.method ? ` (${MEMBERSHIP_METHODS.find((x) => x.value === m.method)?.label ?? m.method})` : ""}</span>}
            {m.helloAssoItemId && <span className="text-[10px] text-muted-foreground">· HelloAsso</span>}
            {rw && m.status === "due" && <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => setMembershipStatus(m.id, "paid", "transfer"), () => toast.success("Cotisation réglée (virement) — le moyen se corrige sur la page Adhérents"))} data-testid={`membership-row-pay-${m.year}`}>Régler</Button>}
          </div>
        );
      })}
      {rw && (
        <form className="mt-1 flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => createMembership({ year: Number(year), amount: amount ? Number(amount.replace(",", ".")) : 0, organisationId: organisationId ?? null, contactId: contactId ?? null }), () => { setAmount(""); toast.success(`Adhésion ${year} enregistrée`); }); }} data-testid="membership-add-form">
          <Input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} className="h-7 w-20 text-xs" aria-label="Année" data-testid="membership-add-year" />
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Cotisation €" className="h-7 w-28 text-xs" aria-label="Cotisation" data-testid="membership-add-amount" />
          <Button type="submit" size="xs" variant="outline" disabled={pending} data-testid="membership-add-submit"><Plus />Adhésion</Button>
        </form>
      )}
    </div>
  );
}
