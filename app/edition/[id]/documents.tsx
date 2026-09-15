import { ExternalLink, FolderOpen, Link2, Lock, NotebookPen } from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/common/section";
import { AutoField } from "@/components/inline/auto-field";
import { CopyButton } from "@/components/common/copy-button";
import { HelpTip } from "@/components/common/help-tip";
import { Reveal } from "@/components/common/reveal";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { UploadForm } from "@/components/attachments/upload-form";
import { canEditFunding, canWriteLayer, isCodir } from "@/lib/rights";
import { isWebLink, serverPath } from "@/lib/docs";
import { REF_DEFAULTS, refLabel } from "@/lib/refs";
import { dayjs } from "@/lib/format";
import { loadNotes, NOTE_CONTEXTS } from "@/lib/notes";
import { hasModule } from "@/lib/modules";
import { inMyPole } from "@/lib/scope";
import type { TabCtx } from "./types";
import { AddDocLinkForm } from "./add-forms";

// Documents (revue du 15/09) : une liste de chemins et de liens avec leur famille, les pièces qui font foi, les notes.
// La discussion est dans le Fil (en-tête) ; l'adresse pour Teams dans le menu « … ».
export async function DocumentsTab({ e, me, settings, refs, isPilot, isTeam }: TabCtx) {
  const notes = (await loadNotes(me, { editionId: e.id })).filter((n) => !n.archived);
  const kinds = REF_DEFAULTS.attachment_kind.map((k) => ({ value: k.code, label: refLabel(refs, "attachment_kind", k.code) }));
  const codir = isCodir(me.role);
  const rw = canWriteLayer(me.role, "year", isPilot, isTeam, inMyPole(me, e.project));
  const visible = e.docLinks.filter((d) => !d.codirOnly || codir);
  const defaultPath = serverPath(settings.serverPathTemplate, e.project.analyticCode, e.year);
  const hasPath = visible.some((d) => !isWebLink(d.url));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section
        title="Fichiers et liens"
        description={<span className="inline-flex items-center gap-1.5">Chemins sur le serveur de la CRESS et adresses web (Teams, OneNote, convention en ligne) <HelpTip title="Où va quoi ? Trois familles, une règle chacune" testId="documents-rule">
          <ol className="mt-1 grid gap-1.5">
            <li><b>Ce qui naît dans l'outil</b> — fiche, objectifs, indicateurs, actions, réalisations, décisions, remarques, bilan. <span className="text-muted-foreground">Ici seulement ; le Word est un export, jamais une source.</span></li>
            <li><b>Les pièces qui font foi</b> — devis validé, notification, convention signée, justificatif financeur, bilan remis. <span className="text-muted-foreground">Déposées ici, rattachées à leur objet, jamais supprimées : ce sont celles qu'un contrôle demande.</span></li>
            <li><b>Tout le reste</b> — livrables produits, documents de travail, notes de service, comptes rendus. <span className="text-muted-foreground">Sur le serveur, dans le dossier de l'édition ; l'outil donne le chemin. Teams reste éphémère, OneDrive est arrêté.</span></li>
          </ol>
          <p className="mt-2 text-muted-foreground">Un chemin (\\serveur\…) est rangé comme « Serveur », une adresse https:// comme « Lien » : l'outil trie tout seul.</p>
        </HelpTip></span>}
        actions={rw ? <AddDocLinkForm editionId={e.id} canCodir={codir} /> : undefined}
        testId="doc-links"
      >
        <ul className="divide-y text-sm">
          {!hasPath && (
            <li className="flex items-center gap-2 py-1.5">
              <FolderOpen className="size-4 shrink-0 text-primary" aria-label="Serveur" />
              <div className="min-w-0 flex-1">
                <div>Dossier de référence <span className="text-xs text-muted-foreground">(chemin par convention)</span></div>
                <div className="truncate font-mono text-xs text-muted-foreground" title={defaultPath}>{defaultPath}</div>
              </div>
              <CopyButton text={defaultPath} />
            </li>
          )}
          {visible.map((d) => {
            const web = isWebLink(d.url);
            return (
              <li key={d.id} className="flex items-center gap-2 py-1.5" data-testid={`doclink-${d.id}`}>
                {web ? <Link2 className="size-4 shrink-0 text-primary" aria-label="Lien" /> : <FolderOpen className="size-4 shrink-0 text-primary" aria-label="Serveur" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 flex-1"><AutoField model="docLink" id={d.id} field="label" type="text" value={d.label} readOnly={!rw} /></div>
                    {d.codirOnly && <span className="inline-flex items-center gap-0.5 rounded-sm bg-coral/10 px-1 text-[10px] text-coral"><Lock className="size-2.5" />CODIR</span>}
                  </div>
                  {!web && <AutoField model="docLink" id={d.id} field="url" type="text" value={d.url} readOnly={!rw} inputClassName="font-mono text-xs text-muted-foreground" />}
                </div>
                {web ? <a href={d.url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline" title={d.url}><ExternalLink className="size-3" />ouvrir</a> : <CopyButton text={d.url} />}
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="grid content-start gap-4">
        <Section title="Pièces qui font foi" description="Devis, conventions, notifications, justificatifs, bilans remis (5 Mo au plus) ; le dossier complet reste sur le serveur." actions={(rw || canEditFunding(me.role)) ? <Reveal label="Pièce" size="sm" testId="upload-open"><UploadForm editionId={e.id} kinds={kinds} defaultKind="other" /></Reveal> : undefined} testId="pieces">
          <AttachmentList items={e.attachments} refs={refs} emptyText="Aucune pièce déposée sur cette édition." />
        </Section>

        <Section title="Notes" description="Notes de réunion rattachées à cette édition : les vôtres, et celles que des collègues ont partagées." actions={hasModule(me, "notes") ? <Link href={`/notes?note=nouvelle&edition=${e.id}`} className="text-xs text-primary hover:underline" data-testid="edition-new-note">+ Prendre une note</Link> : undefined} testId="edition-notes">
          {notes.length === 0 ? <p className="text-sm text-muted-foreground">Aucune note rattachée.</p> : (
            <ul className="divide-y text-sm">
              {notes.map((n) => (
                <li key={n.id} className="flex items-center gap-2 py-1.5">
                  <NotebookPen className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1"><Link href={`/notes?note=${n.id}`} className="font-medium hover:underline">{n.title || "Sans titre"}</Link><div className="text-[11px] text-muted-foreground">{dayjs(n.date).format("D MMM YYYY")} · {NOTE_CONTEXTS.find((c) => c.value === n.context)?.label} · {n.mine ? "moi" : n.author.name}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
