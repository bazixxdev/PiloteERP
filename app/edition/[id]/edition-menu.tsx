"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CopyPlus, Ellipsis, FileDown, History, Link2, Maximize2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { withBase } from "@/lib/base-path";
import { saveField } from "@/app/actions/fields";
import { RenewDialog } from "./renew-dialog";
import { V, cap, le } from "@/lib/vocab";

type Props = {
  edition: { id: string; year: number; projectName: string; actions: number; fundingLines: number; team: number; conditionalStart: boolean };
  nextYearExists: boolean;
  canStatus: boolean;
  canRemark: boolean;
  feedback: boolean;
};

// Le menu « … » de l'édition (revue du 15/09) : tout ce qu'on fait une fois par an ou rarement — reconduire, exporter,
// l'adresse pour Teams, le plein écran, le démarrage conditionné, l'historique — sort de l'en-tête et se range ici.
export function EditionMenu({ edition, nextYearExists, canStatus, canRemark, feedback }: Props) {
  const [renew, setRenew] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const next = edition.year + 1;
  const copyTeams = async () => {
    const url = `${window.location.origin}${withBase(`/edition/${edition.id}`)}`;
    try { await navigator.clipboard.writeText(url); toast.success("Adresse copiée : dans Teams, Ajouter un onglet → Site web, puis coller."); } catch { toast.error("Copie impossible : " + url); }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Autres actions" title="Autres actions" data-testid="edition-menu" /* vocab-ok : sens générique */><Ellipsis /></Button></DropdownMenuTrigger>
        {/* Pas de retour du focus sur le bouton à la fermeture : les entrées naviguent, et le focus rendu tardivement fermait le premier popover ouvert sur la page suivante. */}
        <DropdownMenuContent align="end" className="w-72" onCloseAutoFocus={(ev) => ev.preventDefault()}>
          <DropdownMenuItem disabled={nextYearExists} onSelect={() => setRenew(true)} data-testid="renew-open" title={nextYearExists ? `${cap(le(V.edition))} ${next} existe déjà` : undefined}><CopyPlus />Reconduire en {next}{nextYearExists && <span className="ml-auto text-[10px] text-muted-foreground">existe déjà</span>}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">Exporter</DropdownMenuLabel>
          <DropdownMenuItem asChild><a href={withBase(`/edition/${edition.id}/export?format=fiche`)} data-testid="export-fiche"><FileDown />{`La fiche (Word, gabarit ${V.org.one})`}</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={withBase(`/edition/${edition.id}/export?format=docx`)} data-testid="export-docx"><FileDown />Le bilan (Word)</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={withBase(`/plan-operationnel/export?annee=${edition.year}`)}><FileDown />Le plan opérationnel {edition.year} (Word)</a></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={copyTeams} data-testid="copy-teams"><Link2 />Copier l'adresse pour l'onglet Teams</DropdownMenuItem>
          <DropdownMenuItem asChild><Link href={`/edition/${edition.id}?onglet=fiche&focus=1${feedback ? "&relecture=1" : ""}`} data-testid="fiche-focus"><Maximize2 />Rédiger la fiche en plein écran</Link></DropdownMenuItem>
          {canRemark && <DropdownMenuItem asChild><Link href={`/edition/${edition.id}?onglet=fiche${feedback ? "" : "&relecture=1"}`} data-testid="feedback-toggle"><MessageSquareText />{feedback ? "Quitter la relecture" : "Relire et annoter la fiche"}</Link></DropdownMenuItem>}
          <DropdownMenuItem asChild><Link href={`/edition/${edition.id}?onglet=fiche#historique`}><History />Historique des modifications</Link></DropdownMenuItem>
          {canStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={edition.conditionalStart} disabled={pending} onCheckedChange={(v) => start(async () => { const r = await saveField("edition", edition.id, "conditionalStart", Boolean(v)); if (!r.ok) toast.error(r.error); else router.refresh(); })} data-testid="conditional-start">
                Démarrage conditionné à la notification
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <RenewDialog edition={edition} disabled={nextYearExists} open={renew} onOpenChange={setRenew} hideTrigger />
    </>
  );
}
