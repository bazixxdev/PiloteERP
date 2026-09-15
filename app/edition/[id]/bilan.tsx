import { FileDown } from "lucide-react";
import { withBase } from "@/lib/base-path";
import { Section } from "@/components/common/section";
import { AutoField } from "@/components/inline/auto-field";
import { Button } from "@/components/ui/button";
import { canWriteLayer } from "@/lib/rights";
import type { TabCtx } from "./types";
import { inMyPole } from "@/lib/scope";
import { AddIndicatorForm } from "./add-forms";
import { Achievements } from "./achievements";
import { dayjs } from "@/lib/format";

export function BilanTab({ e, me, isPilot, isTeam }: TabCtx) {
  const rw = canWriteLayer(me.role, "year", isPilot, isTeam, inMyPole(me, e.project));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Section
        title="Bilan de l'édition"
        description="Texte réutilisé tel quel pour le rapport d'activité et les bilans financeurs ; visé par le responsable de pôle."
        actions={<Button asChild size="sm" variant="outline"><a href={withBase(`/edition/${e.id}/export?format=docx`)}><FileDown />Exporter (Word)</a></Button>}
      >
        <div className="grid gap-3">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Évaluation</label>
            <AutoField model="edition" id={e.id} field="evaluation" type="textarea" rows={3} value={e.evaluation} readOnly={!rw} placeholder="Ce qui a marché, ce qui a moins marché, écarts avec le cadre validé…" />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Bilan (texte long)</label>
            <AutoField model="edition" id={e.id} field="report" type="textarea" rows={e.report ? 14 : 5} value={e.report} readOnly={!rw} placeholder="À rédiger en fin d'année : ce texte servira tel quel dans le rapport d'activité." testId="field-report" />
          </div>
        </div>
      </Section>

      <div className="grid content-start gap-4">
      <Section title="Réalisations au fil de l'année" description="Ce qui a été fait, avec un chiffre quand il y en a un : inscrits, publics, livrables produits. Repris dans l'export du bilan." testId="achievements-section">
        <Achievements editionId={e.id} items={e.achievements.map((a) => ({ id: a.id, kind: a.kind, label: a.label, value: a.value, unit: a.unit, date: dayjs(a.date).format("YYYY-MM-DD"), author: a.author.name, authorId: a.authorId, action: a.action?.name ?? null }))} actions={e.actions.map((a) => ({ id: a.id, name: a.name }))} canWrite={rw} meId={me.id} canDeleteAll={me.role === "director" || isPilot} />
      </Section>
      <Section title="Indicateurs" description="Cible et réalisé, imposés par les financeurs ou propres au projet.">
        <table className="mb-3 w-full text-sm" data-testid="indicators">
          <thead className="text-left text-[10px] font-semibold text-muted-foreground">
            <tr><th className="py-1">Indicateur</th><th className="w-20 py-1">Cible</th><th className="w-20 py-1">Réalisé</th><th className="w-10 py-1" title="Imposé par un financeur">Imp.</th></tr>
          </thead>
          <tbody className="divide-y">
            {e.indicators.map((i) => (
              <tr key={i.id}>
                <td className="py-0.5"><AutoField model="indicator" id={i.id} field="label" type="text" value={i.label} readOnly={!rw} /></td>
                <td className="py-0.5"><AutoField model="indicator" id={i.id} field="target" type="text" value={i.target} readOnly={!rw} inputClassName="text-right tabular" /></td>
                <td className="py-0.5"><AutoField model="indicator" id={i.id} field="actual" type="text" value={i.actual} readOnly={!rw} inputClassName="text-right tabular font-medium" placeholder="—" /></td>
                <td className="py-0.5 text-center"><AutoField model="indicator" id={i.id} field="imposed" type="bool" value={i.imposed} readOnly={!rw} /></td>
              </tr>
            ))}
            {e.indicators.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">Aucun indicateur.</td></tr>}
          </tbody>
        </table>
        {rw && <AddIndicatorForm editionId={e.id} />}
      </Section>
      </div>
    </div>
  );
}
