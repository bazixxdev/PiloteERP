import { ExternalLink, Lock } from "lucide-react";
import { Section } from "@/components/common/section";
import { AutoField } from "@/components/inline/auto-field";
import { canWriteLayer, isCodir } from "@/lib/rights";
import { fmtDate } from "@/lib/format";
import type { TabCtx } from "./types";
import { AddCommentForm, AddDocLinkForm } from "./add-forms";

export function DocumentsTab({ e, me, isPilot, isTeam }: TabCtx) {
  const codir = isCodir(me.role);
  const rw = canWriteLayer(me.role, "year", isPilot, isTeam, e.project.poleId === me.poleId);
  const links = e.docLinks.filter((d) => !d.codirOnly || codir);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Documents" description="Liens vers les dossiers de référence : pas de copie de fichiers ici.">
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun lien.</p>
        ) : (
          <ul className="mb-3 divide-y text-sm">
            {links.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-1.5">
                {d.codirOnly && <Lock className="size-3.5 text-coral" aria-label="CODIR seulement" />}
                <div className="flex-1"><AutoField model="docLink" id={d.id} field="label" type="text" value={d.label} readOnly={!rw} /></div>
                <a href={d.url} className="flex items-center gap-1 text-xs text-primary hover:underline" title={d.url}><ExternalLink className="size-3" />ouvrir</a>
              </li>
            ))}
          </ul>
        )}
        {rw && <AddDocLinkForm editionId={e.id} canCodir={codir} />}
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
  );
}
