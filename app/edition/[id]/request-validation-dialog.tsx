"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { explainRequiredLevel, requestValidation } from "@/app/actions/edition";
import { uploadAttachment } from "@/app/actions/attachments";

const LEVELS = ["1 · pilote", "2 · responsable de pôle", "3 · direction"];

// Qui reçoit la demande à chaque niveau : le circuit de validation, en noms.
export type Recipients = { 1: string | null; 2: string | null; 3: string | null };
const LEVEL_ROLE: Record<number, string> = { 1: "pilote de l'édition", 2: "responsable de pôle", 3: "direction" };

export type SupplierOpt = { id: string; name: string; email: string | null };
// Depuis Demandes (retour du 15/09) : le même formulaire, avec le choix de l'édition en premier ; chaque édition apporte ses actions et son circuit.
export type EditionChoice = { id: string; name: string; year: number; actions: { id: string; name: string }[]; recipients: Recipients };

const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function RequestValidationDialog({ editionId: fixedEditionId, actions: fixedActions, kinds, recipients: fixedRecipients, canOverride, defaultOpen, suppliers = [], editions, afterHref, triggerLabel }: { editionId?: string; actions?: { id: string; name: string }[]; kinds: { value: string; label: string }[]; recipients?: Recipients; canOverride?: boolean; defaultOpen?: boolean; suppliers?: SupplierOpt[]; editions?: EditionChoice[]; afterHref?: string; triggerLabel?: string }) {
  const [open, setOpen] = useState(Boolean(defaultOpen)); // ?validation=1 depuis « Nouvelle demande › Achat / devis »
  const [chosenEditionId, setChosenEditionId] = useState("");
  const editionId = fixedEditionId ?? chosenEditionId;
  const chosen = editions?.find((e) => e.id === chosenEditionId);
  const actions = fixedActions ?? chosen?.actions ?? [];
  const recipients: Recipients = fixedRecipients ?? chosen?.recipients ?? { 1: null, 2: null, 3: null };
  // Fournisseur : recherche dans la base en tapant ; un nom inconnu peut y être ajouté (case cochée par défaut).
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [saveSupplier, setSaveSupplier] = useState(true);
  const [supplierFocus, setSupplierFocus] = useState(false);
  const [kind, setKind] = useState("quote");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [actionId, setActionId] = useState("");
  const [url, setUrl] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [fileName, setFileName] = useState("");
  const [level, setLevel] = useState(1);
  const [computed, setComputed] = useState<{ level: number; reason: string }>({ level: 1, reason: "" });
  const [delay, setDelay] = useState("5");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open || !editionId) return;
    const n = amount === "" ? null : Number(amount.replace(",", "."));
    explainRequiredLevel(editionId, n).then((r) => { setComputed(r); setLevel(r.level); });
  }, [amount, editionId, open]);
  const supplierMatches = supplier.trim() ? suppliers.filter((x) => norm(x.name).includes(norm(supplier.trim()))).slice(0, 6) : suppliers.slice(0, 6);
  const supplierKnown = suppliers.some((x) => norm(x.name) === norm(supplier.trim()));

  const sel = "h-8 w-full rounded-lg border bg-card px-2 text-sm";
  const recipient = recipients[level as 1 | 2 | 3];
  const kindLabel = kinds.find((k) => k.value === kind)?.label ?? kind;
  const amountNumber = amount === "" ? null : Number(amount.replace(",", "."));
  const reset = () => { setLabel(""); setAmount(""); setUrl(""); setFileName(""); setSupplier(""); setSupplierEmail(""); setSupplierId(null); setActionId(""); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="request-validation-open" variant={editions ? "outline" : "default"}><ShieldCheck />{triggerLabel ?? "Demander une validation"}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Demander une validation</DialogTitle>
          <DialogDescription>Dites ce que vous demandez, joignez la pièce ; la demande part au bon valideur selon le montant.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {editions && (
            <div className="grid gap-1">
              <Label htmlFor="rv-edition">Édition concernée <span className="font-normal text-muted-foreground">(le montant s'engage sur son budget)</span></Label>
              <select id="rv-edition" className={sel} value={chosenEditionId} onChange={(e) => { setChosenEditionId(e.target.value); setActionId(""); }} data-testid="rv-edition">
                <option value="">— choisir l'édition —</option>
                {editions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.year}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-1">
            <Label htmlFor="rv-label">Objet de la demande</Label>
            <Input id="rv-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Devis traiteur pour la soirée…" data-testid="rv-label" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label htmlFor="rv-kind">Nature</Label>
              <select id="rv-kind" className={sel} value={kind} onChange={(e) => setKind(e.target.value)} data-testid="rv-kind">
                {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="rv-amount">Montant (€)</Label>
              <Input id="rv-amount" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" data-testid="rv-amount" />
            </div>
          </div>
          {(kind === "quote" || kind === "expense") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="relative grid gap-1">
                <Label htmlFor="rv-supplier">Fournisseur <span className="font-normal text-muted-foreground">(cherchez dans la base)</span></Label>
                <Input id="rv-supplier" value={supplier} autoComplete="off" onChange={(e) => { setSupplier(e.target.value); setSupplierId(null); }} onFocus={() => setSupplierFocus(true)} onBlur={() => setTimeout(() => setSupplierFocus(false), 120)} placeholder="Imprimerie Duval…" data-testid="rv-supplier" aria-autocomplete="list" aria-expanded={supplierFocus && supplierMatches.length > 0} />
                {supplierFocus && supplierMatches.length > 0 && (
                  <ul className="absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-md border bg-card py-1 shadow-lg" role="listbox" aria-label="Fournisseurs connus" data-testid="rv-supplier-list">
                    {supplierMatches.map((x) => (
                      <li key={x.id} role="option" aria-selected={x.id === supplierId}>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); setSupplier(x.name); setSupplierEmail(x.email ?? supplierEmail); setSupplierId(x.id); setSupplierFocus(false); }} className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted" data-testid={`rv-supplier-pick-${x.id}`}>
                          <span className="truncate">{x.name}</span>{x.email && <span className="shrink-0 truncate text-muted-foreground">{x.email}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {supplier.trim() && !supplierId && !supplierKnown && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" checked={saveSupplier} onChange={(e) => setSaveSupplier(e.target.checked)} className="size-3.5 accent-primary" data-testid="rv-supplier-save" />Ajouter « {supplier.trim()} » à la base des fournisseurs</label>
                )}
                {supplierId && <span className="text-[11px] text-mint">Fournisseur de la base.</span>}
              </div>
              <div className="grid gap-1">
                <Label htmlFor="rv-supplier-email">Son adresse mail <span className="font-normal text-muted-foreground">(pour le bon pour accord)</span></Label>
                <Input id="rv-supplier-email" type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} placeholder="contact@…" data-testid="rv-supplier-email" />
              </div>
            </div>
          )}
          <div className="grid gap-1">
            <Label htmlFor="rv-action">Action concernée</Label>
            <select id="rv-action" className={sel} value={actionId} onChange={(e) => setActionId(e.target.value)}>
              <option value="">— l'édition entière —</option>
              {actions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* La pièce se joint avant l'envoi ; le lien vers le serveur ou Teams reste possible en alternative. */}
          <div className="grid gap-1 rounded-lg border bg-muted/40 p-2.5">
            <Label className="text-xs">Pièce à faire valider (devis, justificatif)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm">
                <Paperclip className="size-3.5" />{fileName || "Joindre le fichier"}
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.doc,.xls,.txt,.csv" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} data-testid="rv-file" aria-label="Joindre le fichier" />
              </label>
              <span className="text-xs text-muted-foreground">ou</span>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="lien Teams, OneNote ou chemin serveur" aria-label="Lien vers la pièce" className="h-8 min-w-0 flex-1" />
            </div>
            <p className="text-[11px] text-muted-foreground">Facultatif, mais le valideur décide plus vite avec la pièce sous les yeux. 5 Mo au plus.</p>
          </div>

          {/* Le destinataire réel et la raison, avant tout réglage technique. */}
          <div className="rounded-lg bg-info-soft px-3 py-2.5 text-sm" data-testid="rv-recipient">
            <div><span className="text-muted-foreground">Sera transmis à</span> <b>{recipient ?? LEVEL_ROLE[level]}</b> <span className="text-muted-foreground">· {LEVEL_ROLE[level]}</span></div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {level === computed.level ? <>Niveau {level} : {computed.reason || "calculé depuis le montant, les seuils et l'enveloppe restante"}.</> : <>Niveau {level} choisi à la main (calculé : {computed.level}, {computed.reason}).</>}
              {" "}Réponse attendue sous {Number(delay) || 5} jours.
            </div>
          </div>

          {(canOverride ?? true) && (
            <details className="rounded-lg border px-2.5 py-1.5 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Paramètres du circuit · niveau et délai</summary>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="rv-level">Niveau requis <span className="text-xs text-muted-foreground">(calculé : {computed.level})</span></Label>
                  <select id="rv-level" className={sel} value={level} onChange={(e) => setLevel(Number(e.target.value))} data-testid="rv-level">
                    {LEVELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="rv-delay">Délai cible (jours)</Label>
                  <Input id="rv-delay" type="number" value={delay} onChange={(e) => setDelay(e.target.value)} />
                </div>
              </div>
            </details>
          )}

          {label.trim() && (
            <p className="rounded-lg border border-dashed px-3 py-2 text-xs" data-testid="rv-summary">
              <b>Récapitulatif :</b> {kindLabel.toLowerCase()} « {label.trim()} »{amountNumber ? ` de ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amountNumber)}` : ""}{actionId ? ` pour l'action « ${actions.find((a) => a.id === actionId)?.name ?? ""} »` : ""}, {fileName ? `avec la pièce « ${fileName} »` : url ? "avec un lien vers la pièce" : "sans pièce jointe"}, transmis à {recipient ?? LEVEL_ROLE[level]}.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            data-testid="rv-submit"
            disabled={pending || !label.trim() || !editionId}
            onClick={() =>
              start(async () => {
                const res = await requestValidation({ editionId, actionId, kind, label, amount: amountNumber, attachmentUrl: url, requiredLevel: level, targetDelayDays: Number(delay) || 5, supplier, supplierEmail, supplierId, saveSupplier: saveSupplier && !supplierKnown });
                if (!res.ok) { toast.error(res.error); return; }
                const file = fileRef.current?.files?.[0];
                if (file) {
                  const form = new FormData();
                  form.set("editionId", editionId); form.set("kind", kind === "quote" ? "quote" : kind === "expense" ? "receipt" : "other"); form.set("label", file.name); form.set("file", file); form.set("validationId", res.data!.id);
                  const up = await uploadAttachment(form);
                  if (!up.ok) toast.error(`Demande envoyée, mais la pièce n'a pas été déposée : ${up.error}`);
                }
                toast.success(`Demande transmise à ${recipient ?? LEVEL_ROLE[res.data!.requiredLevel]}${file ? ", pièce jointe" : ""}`);
                setOpen(false); reset();
                router.push(afterHref ?? `/edition/${editionId}?onglet=validations`);
                router.refresh();
              })
            }
          >
            {pending ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
