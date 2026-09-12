import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { ValidationCard } from "@/components/common/validation-card";
import { canDecideValidation, canEditFunding } from "@/lib/rights";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { UploadForm } from "@/components/attachments/upload-form";
import type { TabCtx } from "./types";

export function ValidationsTab({ e, me, refs, isPilot }: TabCtx) {
  const kinds = REF_DEFAULTS.attachment_kind.map((k) => ({ value: k.code, label: refLabel(refs, "attachment_kind", k.code) }));
  const pieces = (id: string) => e.attachments.filter((a) => a.validationId === id);
  const canUpload = (requesterId: string) => requesterId === me.id || isPilot || canEditFunding(me.role) || me.role === "pole_lead";
  const pending = e.validations.filter((v) => v.status === "pending");
  const done = e.validations.filter((v) => v.status !== "pending");
  return (
    <div className="grid gap-4">
      <Section title="En attente" description="Utilisez « Demander une validation » en haut de page pour une nouvelle demande.">
        {pending.length === 0 ? (
          <EmptyState title="Aucune validation en attente" hint="Devis, dépense, envoi, changement de périmètre ou jalon financeur : tout passe par une demande datée." />
        ) : (
          <div className="grid gap-2">{pending.map((v, i) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={canDecideValidation(me, { ...v, edition: e })} index={i} attachments={pieces(v.id)} upload={canUpload(v.requesterId) ? <UploadForm editionId={e.id} kinds={kinds} defaultKind="quote" validationId={v.id} compact /> : undefined} />)}</div>
        )}
      </Section>
      {done.length > 0 && (
        <Section title="Décisions" description="Consignées sur l'édition, datées (EF-F4).">
          <div className="grid gap-2">{done.map((v) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={false} attachments={pieces(v.id)} />)}</div>
        </Section>
      )}
    </div>
  );
}
