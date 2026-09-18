import { AutoField } from "@/components/inline/auto-field";
import { Section } from "@/components/common/section";
import { canActAsPilot, canTrackExpenses, canWriteLayer } from "@/lib/rights";
import { budgetOf } from "@/lib/budget";
import { fmtDate, fmtEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TabCtx } from "./types";
import { AddExpenseForm } from "./add-forms";
import { HelpTip } from "@/components/common/help-tip";
import { ClickToEdit } from "@/components/inline/click-to-edit";
import { InvoiceCell } from "./invoice-cell";
import { RowPanel } from "@/components/common/row-panel";
import Link from "next/link";
import { V, cap, le, du, ce } from "@/lib/vocab";

// Budget des dépenses directes : quatre montants, formules sans double comptage (devis → engagement, facture rattachée → réalisé).
export function BudgetTab({ e, me, settings, isPilot, isTeam }: TabCtx) {
  const rw = canWriteLayer(me, "budget", isPilot, isTeam);
  const b = budgetOf(e);
  const lastUpdate = e.expenses.reduce<Date | null>((m, x) => (!m || x.updatedAt > m ? x.updatedAt : m), null);
  const statusOpts = [{ value: "open", label: "En cours" }, { value: "closed", label: "Soldée" }];
  const natureOpts = [{ value: "purchase", label: "Achat" }, { value: "investment", label: "Investissement" }, { value: "service", label: "Prestation" }];
  // Circuit facture : la RAF, la direction ou l'assistante suivent ; le pilote et l'équipe confirment le service fait.
  const canTrack = rw || canTrackExpenses(me);
  const canConfirm = canActAsPilot(me, isPilot, isTeam);
  // Cellules de budget V2 : libellé discret, montant en grand, lecture en dessous.
  const card = (label: string, value: string, hint?: string, cls?: string, testId?: string) => (
    <div className={cn("rounded-md border bg-card px-3 py-4", cls)}>
      <small className="text-xs text-muted-foreground">{label}</small>
      <b className="mt-2 block text-[25px] font-semibold leading-tight tracking-[-0.7px] tabular" data-testid={testId}>{value}</b>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
  // Le pourcentage écrit ne se plafonne jamais (101 % reste 101 %) ; seule la longueur de la jauge s'arrête à 100 %.
  const pct = e.budgetEnvelope ? Math.round((b.used / e.budgetEnvelope) * 100) : 0;
  const barSpent = e.budgetEnvelope ? Math.min(100, (b.realized / e.budgetEnvelope) * 100) : 0;
  const barCommitted = e.budgetEnvelope ? Math.min(100 - barSpent, (b.remainingCommitments / e.budgetEnvelope) * 100) : 0;
  const overrun = b.available !== null && b.available < 0 ? -b.available : 0;
  const pendingQuotes = e.validations.filter((v) => v.status === "pending" && (v.kind === "quote" || v.kind === "expense"));
  const envelopeAck = e.decisions.find((d) => d.alertKind === "envelope");
  return (
    <div className="grid gap-4">
      {/* Une phrase au plus sous le titre ; la règle de calcul et l'exemple se lisent dans le « ? » (revue du 15/09). */}
      <Section title="Enveloppe de dépenses directes" description={<span className="inline-flex items-center gap-1.5">{`Tenue par ${le(V.raf)} · réalisé + engagements restants, sans double comptage `}<HelpTip title="Comment se calcule le reste" testId="budget-help">
        <p className="mt-1">{`Réalisé = factures (y compris celles rattachées à un devis) + réalisé hors devis saisi par ${le(V.raf)}. Engagements restant à réaliser = devis approuvés non encore facturés. Reste = enveloppe − réalisé − engagements restants. Le même calcul sert au portefeuille, à l'en-tête ${du(V.edition)} et à l'écran ${V.codir.one}.`}</p>
        <p className="mt-2">Exemple : enveloppe 8 000 €, devis validé 1 000 € → réalisé 0, engagement restant 1 000, reste 7 000. Facture partielle de 400 € → réalisé 400, engagement restant 600, reste toujours 7 000. Facture finale 900 € et reliquat soldé → réalisé 900, engagement restant 0, reste 7 100.</p>
        {lastUpdate && <p className="mt-2 text-muted-foreground">Dernière actualisation {fmtDate(lastUpdate)}.</p>}
      </HelpTip></span>}>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border bg-card px-3 py-4">
            <small className="text-xs text-muted-foreground">Enveloppe validée</small>
            {/* Fixée une fois par an : se lit en grand, se modifie au crayon (RAF, direction). */}
            <ClickToEdit canEdit={rw} testId="budget-budgetEnvelope-edit" hint="Modifier l'enveloppe" className="mt-2"
              value={<b className="block text-[25px] font-semibold leading-tight tracking-[-0.7px] tabular" data-testid="budget-envelope">{e.budgetEnvelope != null ? fmtEuro(e.budgetEnvelope) : <span className="text-base font-normal text-warning-foreground">À renseigner</span>}</b>}
              editor={<AutoField model="edition" id={e.id} field="budgetEnvelope" type="number" value={e.budgetEnvelope} suffix="€" inputClassName="text-[25px] font-semibold tracking-[-0.7px] text-left" refreshOnSave testId="budget-budgetEnvelope" placeholder="À renseigner" label="Enveloppe validée en euros" />} />
          </div>
          {card("Réalisé", fmtEuro(b.realized), `dont ${fmtEuro(b.realizedLinked)} rattachés à un devis`, undefined, "budget-realized")}
          {card("Engagements restant à réaliser", fmtEuro(b.remainingCommitments), "devis approuvés non encore facturés", undefined, "budget-committed")}
          {card("Reste", b.available === null ? "—" : fmtEuro(b.available), b.available !== null && b.available < 0 ? (envelopeAck ? `dépassement de ${fmtEuro(-b.available)} accepté (${fmtDate(envelopeAck.decidedAt)})` : `enveloppe dépassée de ${fmtEuro(-b.available)}`) : "enveloppe − réalisé − engagements restants", b.available !== null && b.available < 0 ? "border-danger bg-danger-soft/50" : pct >= settings.envelopeAlertPercent ? "[&>b]:text-warning-foreground" : undefined, "budget-remaining")}
        </div>
        {e.budgetEnvelope ? (
          <>
            <div className="mt-4 flex items-baseline justify-between text-xs"><span>Consommation · réalisé + engagements restant à réaliser</span><b className={cn("tabular", pct >= 100 ? "text-danger" : pct >= settings.envelopeAlertPercent ? "text-warning-foreground" : "")} data-testid="budget-pct">{pct} %{overrun > 0 && <span className="ml-2 font-semibold">· Enveloppe dépassée de {fmtEuro(overrun)}</span>}</b></div>
            <div className="mt-1.5 flex h-[5px] overflow-hidden rounded-[3px] bg-[#e8e9e1]" title="Réalisé, puis engagé restant ; la barre s'arrête à 100 %, le pourcentage écrit ne se plafonne pas" role="presentation">
              <i className={cn("block h-full", pct >= 100 ? "bg-danger" : pct >= settings.envelopeAlertPercent ? "bg-warning" : "bg-mint")} style={{ width: `${barSpent}%` }} />
              <i className="block h-full bg-[#abc1af]" style={{ width: `${barCommitted}%` }} />
            </div>
          </>
        ) : (
          <p className="mt-4 text-xs text-warning-foreground">Enveloppe à renseigner{b.used > 0 ? ` · ${fmtEuro(b.used)} déjà consommés` : ""}.</p>
        )}
      </Section>

      <Section title="Dépenses" description={<span className="inline-flex items-center gap-1.5">Devis approuvés et factures ; la facture arrive à l'adresse de facturation <HelpTip title="Le circuit d'une dépense" testId="expenses-help">
        <p className="mt-1">{`Un devis approuvé crée l'engagement une seule fois. ${cap(le(V.raf))} rattache le réalisé (les factures) à cette ligne, la marque reçue puis payée ; ${le(V.pilote)} est prévenu et confirme le service fait, sans bloquer. Aucun fichier facture ici : la facture arrive à l'adresse de facturation.`}</p>
      </HelpTip></span>} actions={rw ? <AddExpenseForm editionId={e.id} /> : undefined}>
        {/* Un devis encore en attente de validation n'est pas une dépense : on le dit ici, sans l'engager (revue du 15/09). */}
        {pendingQuotes.length > 0 && (
          <p className="mb-3 rounded-md bg-warning-soft/60 px-3 py-2 text-xs text-warning-foreground" data-testid="budget-pending-quotes">
            {pendingQuotes.length} devis en attente de validation, non engagé{pendingQuotes.length > 1 ? "s" : ""} : {pendingQuotes.map((v) => `${v.label}${v.amount != null ? ` (${fmtEuro(v.amount)})` : ""}`).join(", ")} · <Link href={`/edition/${e.id}?onglet=apercu`} className="underline">à décider dans l'Aperçu</Link>
          </p>
        )}
        {e.expenses.length === 0 ? <p className="text-sm text-muted-foreground">{`Aucune dépense sur ${ce(V.edition)}.`}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm" data-testid="expenses">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr><th className="py-1.5 pr-2">Objet</th><th className="py-1.5 pr-2">Fournisseur</th><th className="py-1.5 pr-2 text-right">Engagé</th><th className="py-1.5 pr-2 text-right">Réalisé</th><th className="py-1.5 pr-2 text-right">Reste engagé</th><th className="py-1.5 pr-2">Facture</th><th className="py-1.5" /></tr>
              </thead>
              <tbody className="divide-y">
                {/* Six colonnes lisibles ; nature, référence, origine et état se tiennent dans le panneau de la ligne (revue du 15/09). */}
                {e.expenses.map((x) => {
                  const rest = x.status === "open" ? Math.max(0, x.committed - x.spent) : 0;
                  return (
                    <tr key={x.id} className="align-top">
                      <td className="min-w-[180px] py-1.5 pr-2"><div className="font-medium">{x.label}</div><div className="text-[10px] text-muted-foreground">{natureOpts.find((n) => n.value === x.nature)?.label ?? "—"}{x.reference ? ` · ${x.reference}` : ""}{x.status === "closed" ? " · soldée" : ""}</div></td>
                      <td className="min-w-[120px] py-1.5 pr-2 text-muted-foreground">{x.supplier || "—"}</td>
                      <td className="w-24 py-1.5 pr-2 text-right tabular">{fmtEuro(x.committed)}</td>
                      <td className="w-24 py-1.5 pr-2 text-right tabular font-medium">{fmtEuro(x.spent)}</td>
                      <td className={cn("w-24 py-1.5 pr-2 text-right tabular", x.spent > x.committed && x.committed > 0 && "text-danger font-medium")} title={x.spent > x.committed && x.committed > 0 ? "Facture supérieure à l'engagement : écart à faire remonter" : undefined}>{fmtEuro(rest)}</td>
                      <td className="min-w-[210px] py-1.5 pr-2"><InvoiceCell id={x.id} receivedAt={x.invoiceReceivedAt ? fmtDate(x.invoiceReceivedAt) : null} paidAt={x.paidAt ? fmtDate(x.paidAt) : null} serviceDoneAt={x.serviceDoneAt ? fmtDate(x.serviceDoneAt) : null} serviceDoneBy={x.serviceDoneBy?.name ?? null} canTrack={canTrack} canConfirm={canConfirm} /></td>
                      <td className="py-1.5 text-right">
                        <RowPanel testId={`expense-panel-${x.id}`} label={rw ? "Gérer" : "Détail"} title={x.label} description={x.validation ? <>Devis validé · {x.validation.requester.name} · {fmtDate(x.validation.decidedAt)} · <Link href={`/validations/${x.validation.id}/bon-pour-accord`} className="text-primary hover:underline">bon pour accord</Link></> : `Dépense saisie par ${le(V.raf)}, sans devis.`}>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Field label="Objet"><AutoField model="expense" id={x.id} field="label" type="text" value={x.label} readOnly={!rw} inputClassName="font-medium" /></Field>
                            <Field label="Fournisseur"><AutoField model="expense" id={x.id} field="supplier" type="text" value={x.supplier} readOnly={!rw} placeholder="—" /></Field>
                            <Field label="Engagé">{x.validationId ? <div className="px-2 py-1 tabular">{fmtEuro(x.committed)} <span className="text-xs text-muted-foreground">(devis validé)</span></div> : <AutoField model="expense" id={x.id} field="committed" type="number" value={x.committed} readOnly={!rw} suffix="€" refreshOnSave />}</Field>
                            <Field label="Réalisé (factures)"><AutoField model="expense" id={x.id} field="spent" type="number" value={x.spent} readOnly={!rw} suffix="€" refreshOnSave testId={`expense-spent-${x.id}`} /></Field>
                            <Field label="Nature"><AutoField model="expense" id={x.id} field="nature" type="select" value={x.nature} options={natureOpts} readOnly={!rw} placeholder="—" /></Field>
                            <Field label="État"><AutoField model="expense" id={x.id} field="status" type="select" value={x.status} options={statusOpts} allowEmpty={false} readOnly={!rw} refreshOnSave /></Field>
                            <div className="sm:col-span-2"><Field label="Référence (n° de facture, ligne de l'Excel)"><AutoField model="expense" id={x.id} field="reference" type="text" value={x.reference} readOnly={!rw} placeholder="—" /></Field></div>
                          </div>
                        </RowPanel>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
