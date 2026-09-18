import Link from "next/link";
import { Section } from "@/components/common/section";
import { HelpTip } from "@/components/common/help-tip";
import { realizedForEdition } from "@/lib/ledger-db";
import { SOURCE_LABEL, isCharge, isProduct, type RawEntry } from "@/lib/ledger";
import { paymentSummary } from "@/lib/payments";
import { fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { V, cap, le, un, du } from "@/lib/vocab";

// Réalisé comptable de l'édition (lot D) : ce que la compta a enregistré sur ses codes analytiques — charges par poste (avec les
// pièces), produits, frais de déplacement, par action et par financement quand un code le permet. Composant serveur : il lit
// le snapshot lui-même. La source qui compte dans les alertes (compta ou saisie RAF) est un réglage ; l'autre s'affiche en regard.
export async function LedgerBlock({ e, settings, canAdmin }: Pick<TabCtx, "e" | "settings"> & { canAdmin: boolean }) {
  const { realized: r, lastImport, hasLedger } = await realizedForEdition(e);
  const fromLedger = settings.realizedSource === "ledger";
  const rafRealized = e.spent + e.expenses.reduce((s, x) => s + x.spent, 0);
  const actionName = new Map(e.actions.map((a) => [a.id, a.name]));
  const lineOf = new Map(e.fundingLines.map((f) => [f.id, f]));
  const codes = [...new Set([e.project.analyticCode, ...e.fundingLines.map((f) => f.analyticCode).filter((c): c is string => !!c)])];
  const card = (label: string, value: string, hint?: string, cls?: string, testId?: string) => (
    <div className={cn("rounded-md border bg-card px-3 py-4", cls)}>
      <small className="text-xs text-muted-foreground">{label}</small>
      <b className="mt-2 block text-[25px] font-semibold leading-tight tracking-[-0.7px] tabular" data-testid={testId}>{value}</b>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );

  return (
    <Section
      title="Réalisé comptable"
      description={<span className="inline-flex flex-wrap items-center gap-1.5">Ce que la compta a enregistré sur les codes {codes.map((c) => <code key={c} className="rounded bg-muted px-1 font-mono text-[11px]">{c}</code>)} en {e.year}{lastImport && <> · {SOURCE_LABEL[lastImport.source] ?? lastImport.source} du {fmtDate(lastImport.importedAt)}</>}
        <HelpTip title="D'où viennent ces chiffres" testId="ledger-help">
          <p>{`Le grand livre analytique du logiciel de compta est importé (fichier exporté, ou Pennylane) et rapproché ${du(V.edition)} par ses codes analytiques : celui du projet, ceux de ses lignes de financement, et les correspondances posées dans l'admin (${un(V.action)}, un code particulier). Aucun lien en dur : une écriture sans code connu apparaît dans « codes à rapprocher » de l'admin.`}</p>
          <p className="mt-1">Charges = comptes 6 (débit − crédit), produits = comptes 7, frais = comptes 625 (déplacements, missions, réceptions — les notes de frais quand elles viennent d&apos;un autre outil). <b>Un seul réalisé compte dans les alertes d&apos;enveloppe</b> : {fromLedger ? `la compta (réglage actuel) ; le réalisé saisi par ${le(V.raf)} s'affiche en regard` : `le réalisé saisi par ${le(V.raf)} (réglage actuel) ; la compta s'affiche en regard`}. Réglable dans admin › Paramètres.</p>
        </HelpTip></span>}
      testId="ledger-block"
    >
      {!hasLedger ? (
        <p className="text-sm text-muted-foreground">Aucun réalisé comptable importé pour {e.year}.{canAdmin && <> <Link href="/admin?section=donnees" className="text-primary hover:underline">Importer le grand livre analytique</Link> (fichier xlsx / csv, ou Pennylane).</>}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {card("Charges comptabilisées", fmtEuro(r.charges), fromLedger ? "compte dans les alertes d'enveloppe" : `réalisé saisi par ${le(V.raf)} : ${fmtEuro(rafRealized)} (c'est lui qui compte)`, fromLedger ? "border-primary/40" : undefined, "ledger-charges")}
            {card("dont frais de déplacement et missions", fmtEuro(r.travel), "comptes 625 · notes de frais", undefined, "ledger-travel")}
            {card("Produits comptabilisés", fmtEuro(r.products), "comptes 7 · subventions, prestations", undefined, "ledger-products")}
            {card("Écart compta / saisie", fmtEuro(Math.abs(r.charges - rafRealized)), r.charges > rafRealized ? `la compta a plus que la saisie ${V.raf.one}` : r.charges < rafRealized ? `la saisie ${V.raf.one} a plus que la compta` : "identiques", Math.abs(r.charges - rafRealized) > 1 ? "border-warning/40" : undefined, "ledger-gap")}
          </div>

          {r.byAccount.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm" data-testid="ledger-accounts">
                <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="py-1.5 pr-2">Compte</th><th className="py-1.5 pr-2">Libellé</th><th className="py-1.5 pr-2 text-right">Montant</th><th className="py-1.5 pr-2">Pièces</th></tr></thead>
                <tbody className="divide-y">
                  {r.byAccount.map((a) => {
                    const pieces: RawEntry[] = a.lines.flatMap((l) => { try { return l.detail ? (JSON.parse(l.detail) as RawEntry[]) : []; } catch { return []; } });
                    return (
                      <tr key={a.accountNumber} className={cn(isProduct(a.accountNumber) && "text-mint")}>
                        <td className="py-1.5 pr-2 font-mono text-xs">{a.accountNumber}</td>
                        <td className="py-1.5 pr-2">{a.accountLabel ?? (isCharge(a.accountNumber) ? "Charge" : "Produit")}</td>
                        <td className="py-1.5 pr-2 text-right tabular font-medium">{fmtEuro(a.amount)}</td>
                        <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                          {pieces.length === 0 ? "—" : (
                            <details className="group"><summary className="cursor-pointer list-none text-primary">{pieces.length} pièce{pieces.length > 1 ? "s" : ""} <span className="group-open:hidden">afficher</span><span className="hidden group-open:inline">masquer</span></summary>
                              <ul className="mt-1 divide-y">{pieces.slice(0, 50).map((p, i) => <li key={i} className="flex flex-wrap gap-x-2 py-0.5"><span className="tabular">{p.date ? fmtDate(p.date) : ""}</span><span className="font-mono">{p.piece ?? ""}</span><span>{p.thirdParty ?? ""}</span><span className="text-foreground">{p.label ?? ""}</span><span className="ml-auto tabular">{fmtEuro(isProduct(a.accountNumber) ? p.credit - p.debit : p.debit - p.credit)}</span></li>)}</ul>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(r.byAction.size > 0 || r.byFundingLine.size > 0) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {r.byAction.size > 0 && (
                <div className="rounded-lg border p-3 text-sm" data-testid="ledger-by-action">
                  <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{`Par ${V.action.one} (codes rapprochés d'${un(V.action)})`}</div>
                  <ul className="divide-y">{[...r.byAction].map(([id, amount]) => <li key={id} className="flex justify-between py-1"><span>{actionName.get(id) ?? `${cap(V.action)}`}</span><span className="tabular font-medium">{fmtEuro(amount)}</span></li>)}</ul>
                </div>
              )}
              {r.byFundingLine.size > 0 && (
                <div className="rounded-lg border p-3 text-sm" data-testid="ledger-by-line">
                  <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Par financement (code de la ligne) · dépenses justifiables, subvention comptabilisée</div>
                  <ul className="divide-y">{[...r.byFundingLine].map(([id, v]) => { const f = lineOf.get(id); const ps = f ? paymentSummary(f.amountGranted, f.payments) : null; return (
                    <li key={id} className="py-1">
                      <div className="flex justify-between"><span>{f?.funder.name ?? "Ligne"}</span><span className="tabular">{v.charges > 0 && <><span className="font-medium">{fmtEuro(v.charges)}</span> de charges</>}{v.charges > 0 && v.products > 0 && " · "}{v.products > 0 && <><span className="font-medium">{fmtEuro(v.products)}</span> de produits</>}</span></div>
                      {ps && v.products > 0 && <div className="text-[11px] text-muted-foreground">{v.products > ps.received + 1 ? `La compta a enregistré ${fmtEuro(v.products - ps.received)} de plus que les versements reçus : un versement à marquer reçu ?` : "Cohérent avec les versements reçus."}</div>}
                    </li>
                  ); })}</ul>
                </div>
              )}
            </div>
          )}
          {r.unknownCodes.length > 0 && canAdmin && <p className="mt-3 text-xs text-muted-foreground">{r.unknownCodes.length} code{r.unknownCodes.length > 1 ? "s" : ""} de l&apos;exercice ne correspond{r.unknownCodes.length > 1 ? "ent" : ""} à rien : <Link href="/admin?section=donnees" className="text-primary hover:underline">à rapprocher dans l&apos;admin</Link>.</p>}
        </>
      )}
    </Section>
  );
}
