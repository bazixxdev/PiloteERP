import { ExternalLink, FolderOpen, Lock } from "lucide-react";
import { Section } from "@/components/common/section";
import { AutoField } from "@/components/inline/auto-field";
import { CopyButton } from "@/components/common/copy-button";
import { canWriteLayer, isCodir } from "@/lib/rights";
import { isWebLink, serverPath } from "@/lib/docs";
import { fmtDate } from "@/lib/format";
import type { TabCtx } from "./types";
import { inMyPole } from "@/lib/scope";
import { AddCommentForm, AddDocLinkForm } from "./add-forms";
import { EditionUrl } from "./edition-url";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { UploadForm } from "@/components/attachments/upload-form";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { canEditFunding } from "@/lib/rights";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { loadNotes, NOTE_CONTEXTS } from "@/lib/notes";
import { hasModule } from "@/lib/modules";
import { dayjs } from "@/lib/format";

export async function DocumentsTab({ e, me, settings, refs, isPilot, isTeam }: TabCtx) {
  const notes = await loadNotes(me, { editionId: e.id });
  const kinds = REF_DEFAULTS.attachment_kind.map((k) => ({ value: k.code, label: refLabel(refs, "attachment_kind", k.code) }));
  const codir = isCodir(me.role);
  const rw = canWriteLayer(me.role, "year", isPilot, isTeam, inMyPole(me, e.project));
  const visible = e.docLinks.filter((d) => !d.codirOnly || codir);
  const paths = visible.filter((d) => !isWebLink(d.url));
  const links = visible.filter((d) => isWebLink(d.url));
  const defaultPath = serverPath(settings.serverPathTemplate, e.project.analyticCode, e.year);

  return (
    <div className="grid gap-4">
      {/* La règle des documents (lot 3), écrite une fois pour toutes : où va quoi, pour ne plus disperser. */}
      <details className="group rounded-md border bg-muted/40 px-4 py-2.5 text-xs" data-testid="documents-rule">
        <summary className="cursor-pointer list-none"><b>Où va quoi ?</b> Trois familles, une règle chacune <span className="text-primary group-open:hidden">· afficher</span><span className="hidden text-primary group-open:inline">· replier</span></summary>
        <ol className="mt-2 grid gap-1.5 sm:grid-cols-3">
          <li className="rounded-md bg-card p-2.5"><b>Ce qui naît dans l'outil</b> — fiche, objectifs, indicateurs, actions, réalisations, décisions, remarques, bilan. <span className="text-muted-foreground">Ici seulement ; le Word est un export, jamais une source.</span></li>
          <li className="rounded-md bg-card p-2.5"><b>Les pièces qui font foi</b> — devis validé, notification, convention signée, justificatif financeur, bilan remis. <span className="text-muted-foreground">Déposées ici, rattachées à leur objet, jamais supprimées : ce sont celles qu'un contrôle demande.</span></li>
          <li className="rounded-md bg-card p-2.5"><b>Tout le reste</b> — livrables produits, documents de travail, notes de service, comptes rendus. <span className="text-muted-foreground">Sur le serveur, dans le dossier de l'édition ; l'outil donne le chemin. Teams reste éphémère, OneDrive est arrêté.</span></li>
        </ol>
      </details>
      <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <Section title="Sur le serveur" description="Les fichiers restent sur le serveur de la CRESS : l'outil donne le chemin, à coller dans l'Explorateur.">
          <ul className="divide-y text-sm">
            {paths.length === 0 && (
              <li className="flex items-center gap-2 py-1.5">
                <FolderOpen className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div>Dossier de référence <span className="text-xs text-muted-foreground">(chemin par convention)</span></div>
                  <div className="truncate font-mono text-xs text-muted-foreground" title={defaultPath}>{defaultPath}</div>
                </div>
                <CopyButton text={defaultPath} />
              </li>
            )}
            {paths.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-1.5">
                {d.codirOnly ? <Lock className="size-4 shrink-0 text-coral" aria-label="CODIR seulement" /> : <FolderOpen className="size-4 shrink-0 text-primary" />}
                <div className="min-w-0 flex-1">
                  <AutoField model="docLink" id={d.id} field="label" type="text" value={d.label} readOnly={!rw} />
                  <AutoField model="docLink" id={d.id} field="url" type="text" value={d.url} readOnly={!rw} inputClassName="font-mono text-xs text-muted-foreground" />
                </div>
                <CopyButton text={d.url} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Liens" description="Canal Teams, OneNote, convention en ligne… tout ce qui s'ouvre dans le navigateur. Pas de lien OneDrive : les fichiers vivent sur le serveur.">
          {links.length === 0 ? <p className="mb-3 text-sm text-muted-foreground">Aucun lien web.</p> : (
            <ul className="mb-3 divide-y text-sm">
              {links.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-1.5">
                  {d.codirOnly && <Lock className="size-3.5 shrink-0 text-coral" aria-label="CODIR seulement" />}
                  <div className="min-w-0 flex-1"><AutoField model="docLink" id={d.id} field="label" type="text" value={d.label} readOnly={!rw} /></div>
                  <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline" title={d.url}><ExternalLink className="size-3" />ouvrir</a>
                </li>
              ))}
            </ul>
          )}
          {rw && <AddDocLinkForm editionId={e.id} canCodir={codir} />}
          <p className="mt-2 text-xs text-muted-foreground">Un chemin (\\serveur\…) va dans « Sur le serveur », une adresse https:// dans « Liens ».</p>
        </Section>

        <Section title="Cette édition dans Teams" description="Dans le canal du projet : Ajouter un onglet → Site web, puis coller cette adresse. La fiche s'ouvre là où l'équipe discute.">
          <EditionUrl editionId={e.id} />
        </Section>
      </div>

      <div className="grid content-start gap-4">
      <Section title="Pièces qui font foi" description="Devis, conventions, notifications, justificatifs, bilans remis : petites pièces gardées avec l'édition (5 Mo au plus). Le dossier complet reste sur le serveur." testId="pieces">
        <AttachmentList items={e.attachments} refs={refs} emptyText="Aucune pièce déposée sur cette édition." />
        {(rw || canEditFunding(me.role)) && <div className="mt-3"><UploadForm editionId={e.id} kinds={kinds} defaultKind="other" /></div>}
      </Section>

      <Section title="Notes" description="Notes de réunion rattachées à cette édition : les vôtres, et celles que des collègues ont partagées." testId="edition-notes">
        {notes.length === 0 ? <p className="mb-2 text-sm text-muted-foreground">Aucune note rattachée.</p> : (
          <ul className="mb-2 divide-y text-sm">
            {notes.map((n) => (
              <li key={n.id} className="flex items-center gap-2 py-1.5">
                <NotebookPen className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1"><Link href={`/notes?note=${n.id}`} className="font-medium hover:underline">{n.title || "Sans titre"}</Link><div className="text-[11px] text-muted-foreground">{dayjs(n.date).format("D MMM YYYY")} · {NOTE_CONTEXTS.find((c) => c.value === n.context)?.label} · {n.mine ? "moi" : n.author.name}</div></div>
              </li>
            ))}
          </ul>
        )}
        {hasModule(me, "notes") && <Link href={`/notes?note=nouvelle&edition=${e.id}`} className="text-xs text-primary hover:underline" data-testid="edition-new-note">+ Prendre une note sur cette édition</Link>}
      </Section>

      <Section title="Discussion" description="Fil de l'édition, en lien ou à la place du canal Teams.">
        <ul className="mb-3 max-h-[420px] space-y-2 overflow-y-auto" data-testid="comments">
          {e.comments.length === 0 && <li className="text-sm text-muted-foreground">Aucun message.</li>}
          {e.comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-muted/60 p-2.5 text-sm">
              <div className="mb-0.5 text-xs text-muted-foreground"><strong className="text-foreground">{c.author.name}</strong> · {fmtDate(c.createdAt, "D MMM YYYY HH:mm")}</div>
              {c.body}
            </li>
          ))}
        </ul>
        <AddCommentForm editionId={e.id} />
      </Section>
      </div>
      </div>
    </div>
  );
}
