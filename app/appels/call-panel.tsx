import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AutoField } from "@/components/inline/auto-field";
import { StatusBadge } from "@/components/common/status-badge";
import { fmtDate } from "@/lib/format";
import type { DeadlineState } from "@/lib/calls";
import { CallRowActions, CallStatusSelect } from "./controls";

type Call = {
  id: string; funderId: string; label: string; scheme: string | null; deadline: Date | null; rolling: boolean; recurring: boolean;
  amountValue: number | null; amountKind: string; durationYears: number | null; targetProjectId: string | null; link: string | null; description: string | null;
  teamStatus: string | null; statusAt: Date | null; active: boolean; conventionId: string | null; createdAt: Date;
  funder: { id: string; name: string }; convention: { id: string; reference: string; status: string } | null;
};
type Opt = { value: string; label: string };

// La fiche d'un appel à projets, en panneau (19/09, retour de Gaël : « des champs que je retrouve pas dans le tableau ») : tout ce
// qui a été saisi, modifiable en place ; le statut d'équipe et la suite (dossier) en bas.
export function CallPanel({ call: c, rw, codir, canPromote, funders, projects, amountKinds, statusBy, dossierStatus, deadline }: { call: Call; rw: boolean; codir: boolean; canPromote: boolean; funders: Opt[]; projects: Opt[]; amountKinds: Opt[]; statusBy: string | null; dossierStatus: string | null; deadline: DeadlineState }) {
  const fid = (f: string) => `call-${c.id}-${f}`;
  const Field = ({ label, field, type, options, placeholder, hint, refresh, allowEmpty = true }: { label: string; field: keyof Call; type: "text" | "number" | "date" | "select" | "textarea" | "bool"; options?: Opt[]; placeholder?: string; hint?: string; refresh?: boolean; allowEmpty?: boolean }) => (
    <div className="grid gap-1">
      <label htmlFor={fid(field)} className="text-[10px] font-semibold text-muted-foreground">{label}</label>
      <AutoField model="call" id={c.id} field={field} type={type} value={c[field] as string | number | boolean | Date | null} readOnly={!rw} options={options} placeholder={placeholder ?? (type === "bool" ? "" : "—")} inputId={fid(field)} refreshOnSave={refresh} allowEmpty={allowEmpty} testId={`call-field-${field}`} />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
  return (
    <div className="grid gap-4 text-sm" data-testid="call-panel-body">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={deadline.label} color={deadline.tone} dot={deadline.key !== "open"} />
        {c.recurring && <StatusBadge label="Revient chaque année" color="muted" dot={false} />}
        {!c.active && <StatusBadge label="Retiré" color="muted" dot={false} />}
        <span className="text-[10px] text-muted-foreground">repéré le {fmtDate(c.createdAt)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Financeur" field="funderId" type="select" options={funders} refresh allowEmpty={false} />
        <Field label="Intitulé" field="label" type="text" refresh />
        <div className="sm:col-span-2"><Field label="Programme du financeur (dispositif, axe)" field="scheme" type="text" placeholder="FSE+ axe inclusion, Axe 2 · économie circulaire…" hint="Le cadre dans lequel l'appel s'inscrit chez le financeur : sert à retrouver les appels d'un même programme d'une année sur l'autre, et pré-remplit le dossier." /></div>
        <Field label="Date limite de dépôt" field="deadline" type="date" refresh />
        <div className="grid gap-2 pt-4">
          <Field label="Au fil de l'eau (pas de date limite)" field="rolling" type="bool" refresh />
          <Field label="Revient chaque année" field="recurring" type="bool" refresh />
        </div>
        <Field label="Montant visé (€)" field="amountValue" type="number" refresh />
        <Field label="Ce montant est" field="amountKind" type="select" options={amountKinds} refresh allowEmpty={false} />
        <Field label="Durée (ans)" field="durationYears" type="number" refresh />
        <Field label="Projet visé" field="targetProjectId" type="select" options={projects} placeholder="— à préciser —" refresh />
        <div className="sm:col-span-2"><Field label="Lien vers l'appel" field="link" type="text" placeholder="https://…" />{c.link && <a href={c.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="size-3" />ouvrir l&apos;appel</a>}</div>
        <div className="sm:col-span-2"><Field label="Description" field="description" type="textarea" placeholder="Ce qui est financé, les conditions, ce qu'on en pense… (repris dans le dossier à l'ouverture)" /></div>
      </div>
      <div className="grid gap-2 border-t pt-3">
        <div className="text-[10px] font-semibold text-muted-foreground">Statut d&apos;équipe</div>
        <div className="flex flex-wrap items-center gap-2">
          <CallStatusSelect id={c.id} value={c.teamStatus} readOnly={!codir} />
          {c.statusAt && <span className="text-[10px] text-muted-foreground">{statusBy ?? "—"} · {fmtDate(c.statusAt)}</span>}
        </div>
      </div>
      <div className="grid gap-2 border-t pt-3">
        <div className="text-[10px] font-semibold text-muted-foreground">Suite</div>
        {c.convention ? (
          <p className="text-xs">Dossier ouvert : <Link href={`/conventions/${c.convention.id}`} className="font-mono text-primary hover:underline" data-testid="call-panel-convention">{c.convention.reference}</Link>{dossierStatus && <> · {dossierStatus}</>}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{c.teamStatus === "apply" || c.teamStatus === "study" ? "Pas de dossier encore : « Ouvrir un dossier » crée le dossier de financement avec le programme, le montant visé et la description de l'appel." : "Pas de dossier."}</p>
        )}
        <div><CallRowActions id={c.id} label={c.label} canPromote={canPromote} canSpot={rw} promoted={!!c.conventionId} recurringClosed={c.recurring && deadline.key === "closed"} active={c.active} /></div>
      </div>
    </div>
  );
}
