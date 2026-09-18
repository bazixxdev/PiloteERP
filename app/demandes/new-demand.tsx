"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, ShieldCheck, Globe, Megaphone, BarChart3, ClipboardList, Hammer, HelpCircle, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchableSelect } from "@/components/common/searchable-select";
import { addRequest } from "@/app/actions/requests";
import { REQUEST_KINDS } from "@/lib/requests";
import { RequestValidationDialog } from "@/app/edition/[id]/request-validation-dialog";
import { cn } from "@/lib/utils";

type Opt = { id: string; name: string };
const ICONS: Record<string, LucideIcon> = { site: Globe, com: Megaphone, data: BarChart3, assistant: ClipboardList, work: Hammer, other: HelpCircle };

// Une seule entrée « Nouvelle demande » (lot 3 du 19/09, retour de Gaël) : le type d'abord, en grand — la validation (achat,
// devis, dépense, envoi…) est un type de demande comme les autres, marquée d'un bouclier —, puis le formulaire, dans un
// panneau à droite où l'on a de la place.
export function NewDemandPanel({ people, poles, editions, validation }: { people: Opt[]; poles: Opt[]; editions: { id: string; name: string; year: number }[]; validation: Omit<ComponentProps<typeof RequestValidationDialog>, "embedded" | "onClose"> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editionId, setEditionId] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const reset = () => { setKind(null); setTitle(""); setBody(""); setTo(""); setDueDate(""); setEditionId(""); };
  const submit = () => start(async () => {
    const [type, id] = to.split(":");
    const r = await addRequest({ kind: kind ?? "other", title, body, assigneeId: type === "p" ? id : null, poleId: type === "g" ? id : null, editionId: editionId || null, dueDate: dueDate || null });
    if (!r.ok) toast.error(r.error); else { toast.success("Demande envoyée"); setOpen(false); reset(); router.refresh(); }
  });
  const editionOptions = editions.map((e) => ({ value: e.id, label: e.name, hint: String(e.year) }));
  const kindDef = REQUEST_KINDS.find((k) => k.value === kind);
  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button onClick={() => setOpen(true)} data-testid="new-request"><Plus />Nouvelle demande</Button>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl" data-testid="new-demand-panel">
        <SheetHeader>
          <SheetTitle>{kind === null ? "Nouvelle demande" : kind === "validation" ? "Demander une validation" : `Demande · ${kindDef?.label ?? ""}`}</SheetTitle>
          <SheetDescription>{kind === null ? "Qu'est-ce que vous demandez ? Une validation (achat, devis, dépense, envoi…) est une demande comme les autres : elle part au bon valideur." : kind === "validation" ? "Le montant s'engage sur le budget d'une édition ; la demande part au niveau que son montant impose." : kindDef?.hint || "À qui, pour quand, pour quoi faire."}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {kind === null ? (
            <div className="grid gap-2 sm:grid-cols-2" data-testid="demand-types">
              <button type="button" onClick={() => setKind("validation")} className="flex items-start gap-3 rounded-xl border-2 border-primary/40 bg-info-soft/60 p-3 text-left hover:border-primary sm:col-span-2" data-testid="request-kind-validation">
                <ShieldCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
                <span><span className="block text-sm font-semibold">Une validation</span><span className="block text-xs text-muted-foreground">achat, devis, dépense, envoi, changement de périmètre, jalon financeur — engagée sur une édition, validée au niveau du montant</span></span>
              </button>
              {REQUEST_KINDS.map((k) => { const Icon = ICONS[k.value] ?? HelpCircle; return (
                <button key={k.value} type="button" onClick={() => setKind(k.value)} className="flex items-start gap-3 rounded-xl border p-3 text-left hover:border-primary hover:bg-muted/40" data-testid={`request-kind-${k.value}`}>
                  <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span><span className="block text-sm font-semibold">{k.label}</span>{k.hint && <span className="block text-xs text-muted-foreground">{k.hint}</span>}</span>
                </button>
              ); })}
            </div>
          ) : (
            <div className="grid gap-3">
              <button type="button" onClick={() => setKind(null)} className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground" data-testid="demand-back"><ArrowLeft className="size-3" />Autre type</button>
              {kind === "validation" ? (
                <RequestValidationDialog {...validation} embedded onClose={() => { setOpen(false); reset(); }} />
              ) : (
                <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                  <label className="grid gap-1 text-xs"><span className="font-semibold">Quoi ?</span><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Réserver la salle du CA pour le 1er octobre" required data-testid="request-title" /></label>
                  <label className="grid gap-1 text-xs"><span className="font-semibold">Détail <span className="font-normal text-muted-foreground">(pour quoi faire, sous quelle forme)</span></span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="rounded-md border bg-card px-2 py-1.5 text-sm" data-testid="request-body" /></label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs"><span className="font-semibold">À qui ?</span>
                      <SearchableSelect options={[...people.map((p) => ({ value: `p:${p.id}`, label: p.name, group: "Une personne" })), ...poles.map((p) => ({ value: `g:${p.id}`, label: p.name, group: "Un pôle" }))]} value={to} onChange={setTo} placeholder="— choisir —" aria-label="Destinataire" className="h-9 w-full" data-testid="request-to" />
                    </label>
                    <label className="grid gap-1 text-xs"><span className="font-semibold">Pour quand ?</span><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="request-due" /></label>
                  </div>
                  <label className="grid gap-1 text-xs"><span className="font-semibold">Projet concerné <span className="font-normal text-muted-foreground">(facultatif)</span></span>
                    <SearchableSelect options={editionOptions} value={editionId} onChange={setEditionId} emptyOption="— aucun —" aria-label="Projet concerné" className="h-9 w-full" />
                  </label>
                  <div className={cn("flex justify-end gap-2")}><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" disabled={pending || !title.trim() || !to} data-testid="request-submit">Envoyer</Button></div>
                </form>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
