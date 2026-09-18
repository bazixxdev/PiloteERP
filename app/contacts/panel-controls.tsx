"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/common/searchable-select";
import { deleteContact, setContactOrganisation } from "@/app/actions/contacts";

export function ContactOrganisationPicker({ contactId, organisationId, organisations }: { contactId: string; organisationId: string | null; organisations: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <SearchableSelect options={organisations.map((o) => ({ value: o.id, label: o.name }))} value={organisationId ?? ""} disabled={pending} onChange={(v) => start(async () => { const r = await setContactOrganisation(contactId, v || null); if (!r.ok) toast.error(r.error); router.refresh(); })} emptyOption="— pas dans l'annuaire —" aria-label="Organisation" className="h-8 w-full text-xs" data-testid="contact-organisation" />;
}

export function DeleteContactButton({ id, own, cited, brevo }: { id: string; own: boolean; cited: boolean; brevo?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (cited) return <p className="text-[11px] text-muted-foreground">Cité par des financements : il se détache depuis la fiche de son organisation, il ne se supprime pas.</p>;
  return <div><Button size="sm" variant="ghost" disabled={pending} className="text-danger hover:text-danger" onClick={() => { if (confirm(`Supprimer ce contact ? Il disparaît des listes qui le contiennent.${brevo ? " Il est dans Brevo : il reviendra à la prochaine synchronisation, sauf s'il y est aussi supprimé." : ""}`)) start(async () => { const r = await deleteContact(id); if (!r.ok) { toast.error(r.error); return; } toast.success("Contact supprimé"); router.push("/contacts"); router.refresh(); }); }} data-testid="contact-delete"><Trash2 />Supprimer{own ? "" : " (admin)"}</Button></div>;
}
