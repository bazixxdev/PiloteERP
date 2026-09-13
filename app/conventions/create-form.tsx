"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createConvention } from "@/app/actions/edition";

export function CreateConventionForm({ funders }: { funders: { value: string; label: string }[] }) {
  const y = new Date().getFullYear();
  const [funderId, setFunderId] = useState(funders[0]?.value ?? "");
  const [reference, setReference] = useState("");
  const [scheme, setScheme] = useState("");
  const [start, setStart] = useState(String(y));
  const [end, setEnd] = useState(String(y + 2));
  const [notified, setNotified] = useState("");
  const [pending, startT] = useTransition();
  const router = useRouter();
  return (
    <form className="flex flex-wrap items-center gap-1.5" data-testid="create-convention" onSubmit={(e) => { e.preventDefault(); startT(async () => { const r = await createConvention({ funderId, reference, scheme, startYear: Number(start), endYear: Number(end), amountNotified: notified ? Number(notified) : null }); if (!r.ok) { toast.error(r.error); return; } toast.success("Convention créée"); setReference(""); setScheme(""); setNotified(""); router.refresh(); }); }}>
      <select className="h-8 rounded-lg border bg-card px-2 text-sm" value={funderId} onChange={(e) => setFunderId(e.target.value)} aria-label="Financeur" data-testid="cc-funder">{funders.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
      <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence (FSE-2026-2028)" className="h-8 w-44" data-testid="cc-reference" />
      <Input value={scheme} onChange={(e) => setScheme(e.target.value)} placeholder="Dispositif" className="h-8 w-40" />
      <Input type="number" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 w-20" aria-label="Début" />
      <Input type="number" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 w-20" aria-label="Fin" />
      <Input type="number" value={notified} onChange={(e) => setNotified(e.target.value)} placeholder="Notifié €" className="h-8 w-28" data-testid="cc-notified" />
      <Button type="submit" size="sm" disabled={pending || !reference.trim()} data-testid="cc-submit"><Plus />Créer la convention</Button>
    </form>
  );
}
