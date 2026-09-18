import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Users } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { AutoField } from "@/components/inline/auto-field";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { instanceHas } from "@/lib/modules";
import { canManageMembers } from "@/lib/rights";
import { fmtDate, fmtEuro } from "@/lib/format";
import { withBase } from "@/lib/base-path";
import { contactName } from "@/lib/contacts";
import { helloAssoConfig } from "@/lib/helloasso";
import { isCurrent, loadMemberships, MEMBERSHIP_METHODS, MEMBERSHIP_STATUS, memberName, membershipYears, statusOf, summarize } from "@/lib/members";
import { cn } from "@/lib/utils";
import { DeleteMembershipButton, HelloAssoSyncButton, MembersToolbar, NewMembershipDialog, PayButton, RenewButton } from "./controls";
import { V, le } from "@/lib/vocab";

// Adhérents (module « adherents », 18/09) : les adhésions d'une année — structures ou personnes de l'annuaire, collège,
// cotisation, règlement —, la reconduction N → N+1, l'export, le connecteur HelloAsso. La vue « Cotisations » regarde la
// même année côté argent : par collège, et ce qui reste à encaisser.
export default async function AdherentsPage({ searchParams }: { searchParams: Promise<{ annee?: string; vue?: string; statut?: string; q?: string; college?: string }> }) {
  const sp = await searchParams;
  const [me, settings, refs] = await Promise.all([getCurrentPerson(), getSettings(), getRefs()]);
  if (!instanceHas(settings, "adherents")) notFound();
  const rw = canManageMembers(me);
  const years = await membershipYears();
  const year = sp.annee && /^\d{4}$/.test(sp.annee) ? Number(sp.annee) : new Date().getFullYear();
  const all = await loadMemberships(year);
  const money = sp.vue === "cotisations";
  const colleges = Array.from(new Set([...Object.values(refs.college ?? {}).map((r) => r.label), ...all.map((m) => m.college).filter((c): c is string => Boolean(c))])).sort((a, b) => a.localeCompare(b, "fr"));
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = sp.q ? norm(sp.q) : "";
  const rows = all.filter((m) => (!sp.statut || m.status === sp.statut) && (!sp.college || m.college === sp.college) && (!q || norm(`${memberName(m)} ${m.contact ? contactName(m.contact) : ""} ${m.contact?.email ?? ""} ${m.college ?? ""}`).includes(q)));
  const sum = summarize(all);
  const [organisations, previousYearCount] = await Promise.all([
    prisma.organisation.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.membership.count({ where: { year: year - 1, status: { not: "cancelled" } } }),
  ]);
  const href = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ annee: String(year), vue: sp.vue, statut: sp.statut, college: sp.college, q: sp.q, ...patch })) if (v) p.set(k, v); return `/adherents?${p.toString()}`; };
  const byCollege = Array.from(all.filter((m) => m.status !== "cancelled").reduce((map, m) => { const k = m.college ?? "— sans collège —"; const e = map.get(k) ?? { n: 0, current: 0, amount: 0, paid: 0 }; e.n++; if (isCurrent(m)) e.current++; e.amount += m.amount; if (m.status === "paid") e.paid += m.amount; map.set(k, e); return map; }, new Map<string, { n: number; current: number; amount: number; paid: number }>())).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  const Tile = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) => <div className={cn("rounded-md border bg-card px-4 py-3", tone)}><div className="text-[22px] font-bold leading-tight tabular">{value}</div><div className="text-[11px] text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</div></div>;
  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Users className="size-5 text-primary" aria-hidden />{money ? "Cotisations" : "Adhérents"}</span>}
        subtitle={<>{sum.members} adhérent{sum.members > 1 ? "s" : ""} en {year} · {sum.current} à jour · {sum.due} à régler{settings.helloAssoSyncedAt ? ` · HelloAsso synchronisé le ${fmtDate(settings.helloAssoSyncedAt)}` : ""}</>}
        actions={<>
          <Button asChild variant="outline" size="sm"><a href={withBase(`/adherents/export?annee=${year}`)} data-testid="members-export"><Download />Exporter</a></Button>
          {rw && helloAssoConfig() && <HelloAssoSyncButton />}
          {rw && <RenewButton fromYear={year - 1} toYear={year} previousCount={previousYearCount} />}
          {rw && <NewMembershipDialog year={year} organisations={organisations} colleges={colleges} />}
        </>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b" data-testid="members-years">
        {years.map((y) => <Link key={y} href={href({ annee: String(y) })} className={cn("-mb-px border-b-2 px-3 py-1.5 text-sm", y === year ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")} aria-current={y === year ? "page" : undefined} data-testid={`members-year-${y}`}>{y}</Link>)}
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="members-tiles">
        <Tile label="adhérents" value={String(sum.members)} hint={previousYearCount ? `${previousYearCount} en ${year - 1}` : undefined} />
        <Tile label="à jour" value={String(sum.current)} hint="réglées ou exonérées" tone={sum.members && sum.current === sum.members ? "border-mint/40" : undefined} />
        <Tile label="à régler" value={String(sum.due)} hint={sum.dueAmount ? fmtEuro(sum.dueAmount) : undefined} tone={sum.due ? "border-warning/40" : undefined} />
        <Tile label="encaissé" value={fmtEuro(sum.paidAmount)} hint={`cotisations ${year}`} />
      </div>

      {money ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-md border bg-card" data-testid="members-by-college">
            <div className="px-4 pb-2 pt-3"><h2 className="text-[15px] font-bold">Par collège</h2><p className="text-[11px] text-muted-foreground">Adhésions {year} hors annulées ; le collège se règle sur chaque adhésion, les libellés dans Admin › Référentiels.</p></div>
            <table className="w-full text-[13px]">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="px-4 py-1.5">Collège</th><th className="px-2 py-1.5 text-right">Adhérents</th><th className="px-2 py-1.5 text-right">À jour</th><th className="px-2 py-1.5 text-right">Attendu</th><th className="px-4 py-1.5 text-right">Encaissé</th></tr></thead>
              <tbody className="divide-y">
                {byCollege.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-sm text-muted-foreground">Aucune adhésion en {year}.</td></tr>}
                {byCollege.map(([k, e]) => <tr key={k}><td className="px-4 py-1.5"><Link href={href({ vue: undefined, college: k.startsWith("—") ? undefined : k })} className="hover:underline">{k}</Link></td><td className="px-2 py-1.5 text-right tabular">{e.n}</td><td className="px-2 py-1.5 text-right tabular">{e.current}</td><td className="px-2 py-1.5 text-right tabular">{fmtEuro(e.amount)}</td><td className="px-4 py-1.5 text-right tabular">{fmtEuro(e.paid)}</td></tr>)}
                {byCollege.length > 0 && <tr className="font-semibold"><td className="px-4 py-1.5">Total</td><td className="px-2 py-1.5 text-right tabular">{sum.members}</td><td className="px-2 py-1.5 text-right tabular">{sum.current}</td><td className="px-2 py-1.5 text-right tabular">{fmtEuro(byCollege.reduce((n, [, e]) => n + e.amount, 0))}</td><td className="px-4 py-1.5 text-right tabular">{fmtEuro(sum.paidAmount)}</td></tr>}
              </tbody>
            </table>
          </section>
          <section className="rounded-md border bg-card" data-testid="members-due">
            <div className="px-4 pb-2 pt-3"><h2 className="text-[15px] font-bold">Reste à encaisser</h2><p className="text-[11px] text-muted-foreground">{sum.due} cotisation{sum.due > 1 ? "s" : ""} à régler · {fmtEuro(sum.dueAmount)}</p></div>
            <ul className="divide-y text-[13px]">
              {all.filter((m) => m.status === "due").length === 0 && <li className="px-4 py-4 text-sm text-mint">Tout est encaissé pour {year}.</li>}
              {all.filter((m) => m.status === "due").map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5" data-testid={`due-${m.id}`}>
                  <span><b>{memberName(m)}</b>{m.college && <span className="text-muted-foreground"> · {m.college}</span>}{m.contact && m.organisation && <span className="block text-[11px] text-muted-foreground">{contactName(m.contact)}{m.contact.email ? ` · ${m.contact.email}` : ""}</span>}</span>
                  <span className="flex items-center gap-2 tabular">{fmtEuro(m.amount)}{rw && <PayButton id={m.id} />}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <MembersToolbar q={sp.q ?? ""} statut={sp.statut ?? ""} college={sp.college ?? ""} colleges={colleges} year={year} />
          {rows.length === 0 ? <div className="p-4"><EmptyState title={all.length === 0 ? `Aucune adhésion en ${year}` : "Rien ne correspond"} hint={all.length === 0 ? (rw ? `Enregistrez une adhésion, reconduisez celles de ${year - 1}, ou synchronisez HelloAsso.` : `Les adhésions se tiennent par ${le(V.raf)} ou ${le(V.direction)}.`) : "Changez le filtre."} icon={<Users className="size-5" />} /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" data-testid="members-table">
                <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                  <tr><th className="px-4 py-1.5">Adhérent</th><th className="px-2 py-1.5">Collège</th><th className="px-2 py-1.5 text-right">Cotisation</th><th className="px-2 py-1.5">Statut</th><th className="px-2 py-1.5">Réglée le</th><th className="px-2 py-1.5">Moyen</th><th className="px-2 py-1.5">Référent·e</th><th className="px-2 py-1.5">Notes</th>{rw && <th className="px-2 py-1.5"></th>}</tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((m) => {
                    const st = statusOf(m.status);
                    return (
                      <tr key={m.id} className={cn("align-top", m.status === "cancelled" && "opacity-60")} data-testid={`membership-${m.id}`} data-member={memberName(m)} data-status={m.status}>
                        <td className="min-w-[12rem] px-4 py-1.5">
                          {m.organisation ? <Link href={`/organisations?organisation=${m.organisation.id}`} className="font-medium text-primary hover:underline">{m.organisation.name}</Link> : m.contact ? <Link href={`/contacts?contact=${m.contact.id}`} className="font-medium text-primary hover:underline">{contactName(m.contact)}</Link> : <span className="text-muted-foreground">(adhérent inconnu)</span>}
                          <div className="text-[10px] text-muted-foreground">{m.organisation ? `Structure${m.organisation.address ? ` · ${m.organisation.address}` : ""}` : "Personne physique"}{m.helloAssoItemId ? " · HelloAsso" : ""}</div>
                        </td>
                        <td className="px-2 py-1.5 min-w-[9rem]"><AutoField model="membership" id={m.id} field="college" type="text" value={m.college} readOnly={!rw} placeholder="—" label={`Collège, ${memberName(m)}`} inputClassName="text-xs" testId={`membership-college-${m.id}`} /></td>
                        <td className="px-2 py-1.5 text-right tabular"><AutoField model="membership" id={m.id} field="amount" type="number" value={m.amount} readOnly={!rw} suffix="€" label={`Cotisation, ${memberName(m)}`} inputClassName="w-24 text-right text-xs" testId={`membership-amount-${m.id}`} /></td>
                        <td className="px-2 py-1.5">
                          {rw ? <AutoField model="membership" id={m.id} field="status" type="select" value={m.status} options={MEMBERSHIP_STATUS.map((s) => ({ value: s.value, label: s.label }))} allowEmpty={false} label={`Statut, ${memberName(m)}`} inputClassName="text-xs" testId={`membership-status-${m.id}`} /> : <StatusBadge label={st.label} color={st.color} />}
                          {rw && m.status === "due" && <div className="mt-1"><PayButton id={m.id} /></div>}
                        </td>
                        <td className="px-2 py-1.5 text-xs whitespace-nowrap">{rw ? <AutoField model="membership" id={m.id} field="paidAt" type="date" value={m.paidAt} label={`Réglée le, ${memberName(m)}`} inputClassName="text-xs" allowEmpty testId={`membership-paidAt-${m.id}`} /> : m.paidAt ? fmtDate(m.paidAt) : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1.5 text-xs">{rw ? <AutoField model="membership" id={m.id} field="method" type="select" value={m.method} options={MEMBERSHIP_METHODS} label={`Moyen, ${memberName(m)}`} inputClassName="text-xs" testId={`membership-method-${m.id}`} /> : MEMBERSHIP_METHODS.find((x) => x.value === m.method)?.label ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1.5 text-xs">{m.contact && m.organisation ? <Link href={`/contacts?contact=${m.contact.id}`} className="text-primary hover:underline">{contactName(m.contact)}</Link> : <span className="text-muted-foreground">—</span>}{m.contact?.email && m.organisation && <div className="text-[10px] text-muted-foreground">{m.contact.email}</div>}</td>
                        <td className="px-2 py-1.5 min-w-[10rem]"><AutoField model="membership" id={m.id} field="notes" type="text" value={m.notes} readOnly={!rw} placeholder={rw ? "note…" : ""} label={`Notes, ${memberName(m)}`} inputClassName="text-[11px] text-muted-foreground" /></td>
                        {rw && <td className="px-2 py-1.5 text-right"><DeleteMembershipButton id={m.id} name={memberName(m)} helloAsso={Boolean(m.helloAssoItemId)} /></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
