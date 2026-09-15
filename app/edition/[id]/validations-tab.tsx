import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { ValidationCard } from "@/components/common/validation-card";
import { canDecideValidation, canEditFunding } from "@/lib/rights";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { UploadForm } from "@/components/attachments/upload-form";
import { Reveal } from "@/components/common/reveal";
import { DecisionForm } from "@/app/codir/decision-form";
import { isCodir } from "@/lib/rights";
import { fmtDate } from "@/lib/format";
import type { TabCtx } from "./types";

export function ValidationsTab({ e, me, refs, isPilot, people }: TabCtx) {
  const instances = REF_DEFAULTS.decision_instance.map((k) => ({ value: k.code, label: refLabel(refs, "decision_instance", k.code) }));
  const kinds = REF_DEFAULTS.attachment_kind.map((k) => ({ value: k.code, label: refLabel(refs, "attachment_kind", k.code) }));
  const pieces = (id: string) => e.attachments.filter((a) => a.validationId === id);
  const canUpload = (requesterId: string) => requesterId === me.id || isPilot || canEditFunding(me.role) || me.role === "pole_lead";
  const pending = e.validations.filter((v) => v.status === "pending");
  const done = e.validations.filter((v) => v.status !== "pending");
  return (
    <div className="grid gap-4">
      <Section title="Décisions des instances" description="CODIR, réunion de pôle, revue trimestrielle, CA : consignées ici, datées, avec la suite à donner." actions={isCodir(me.role) ? <DecisionForm editionId={e.id} people={people.map((p) => ({ id: p.id, name: p.name }))} instances={instances} /> : undefined} testId="instance-decisions">
        {e.decisions.length === 0 ? <p className="text-sm text-muted-foreground">Aucune décision consignée.</p> : (
          <ul className="divide-y text-sm">
            {e.decisions.map((d) => (
              <li key={d.id} className="py-1.5">
                <span className="rounded-sm bg-secondary px-1.5 text-[11px] font-medium text-primary">{refLabel(refs, "decision_instance", d.instance)}</span> {d.body}
                <span className="text-xs text-muted-foreground"> · {fmtDate(d.decidedAt)} · {d.author.name}{d.followUp ? ` · suite : ${d.followUp.name}${d.dueDate ? ` pour le ${fmtDate(d.dueDate)}` : ""}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="En attente">
        {pending.length === 0 ? (
          <EmptyState title="Aucune validation en attente" hint="Devis, dépense, envoi, changement de périmètre ou jalon financeur : tout passe par une demande datée." />
        ) : (
          <div className="grid gap-2">{pending.map((v, i) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={canDecideValidation(me, { ...v, edition: e })} index={i} attachments={pieces(v.id)} upload={canUpload(v.requesterId) ? <Reveal label="Pièce" size="xs" testId={`validation-upload-open-${i}`}><UploadForm editionId={e.id} kinds={kinds} defaultKind="quote" validationId={v.id} compact /></Reveal> : undefined} />)}</div>
        )}
      </Section>
      {done.length > 0 && (
        <Section title="Décisions" description="Consignées sur l'édition, datées.">
          <div className="grid gap-2">{done.map((v) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={false} attachments={pieces(v.id)} />)}</div>
        </Section>
      )}
    </div>
  );
}
