import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { inMyScope, isTransversal, perimeterFrom, relevanceTier, TIER_LABEL, type Tier } from "@/lib/scope";
import { PerimeterChips } from "@/components/common/perimeter";
import { computeReminders, type Reminder } from "@/lib/alerts";
import { instanceHas } from "@/lib/modules";
import { daysFromNow } from "@/lib/format";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Radar des échéances (EF-C2) : livrables financeurs et jalons internes qui arrivent, calculés à la volée, pour toute la CRESS.
// Ce n'est pas une boîte de réception : ce qui a été envoyé à chacun (J-30, J-7, retard) vit dans la cloche et /notifications.
export default async function EcheancesPage({ searchParams }: { searchParams: Promise<{ perimetre?: string }> }) {
  const { perimetre } = await searchParams;
  const [settings, me] = await Promise.all([getSettings(), getCurrentPerson()]);
  const perimeter = perimeterFrom(me, perimetre);
  const [editions, raf, director] = await Promise.all([
    prisma.edition.findMany({ where: { status: { in: ["in_progress", "validated"] } }, include: { project: { include: { pilot: true, secondaryPoles: true } }, team: true, actions: true, fundingLines: { include: { funder: true, deliverables: true, payments: true } }, validations: true, expenses: true } }),
    prisma.person.findFirst({ where: { role: "raf", active: true }, orderBy: { order: "asc" } }),
    prisma.person.findFirst({ where: { role: "director", active: true }, orderBy: { order: "asc" } }),
  ]);
  const days = settings.reminderDaysBefore.split(",").map(Number);
  const scoped = perimeter === "pole" ? editions.filter((e) => inMyScope(me, e.project, e.team.map((t) => t.personId))) : editions;
  const tierOf = new Map(scoped.map((e) => [e.id, relevanceTier(me, e.project, e.team.map((t) => t.personId), e.actions.map((a) => a.ownerId ?? ""))]));
  // Appels à projets « on dépose » (module veille) : la date limite de dépôt est une échéance de la RAF et de la direction.
  // Tant que la convention n'est pas créée (« Étudier »), l'appel reste dans le radar ; ensuite c'est la convention qui vit.
  const money = [raf, director].filter((p): p is NonNullable<typeof p> => !!p);
  const calls = instanceHas(settings, "veille") && perimeter !== "pole"
    ? (await prisma.call.findMany({ where: { active: true, teamStatus: "apply", conventionId: null, deadline: { not: null } }, include: { funder: true } }))
        .map((c) => ({ c, n: daysFromNow(c.deadline!) }))
        .filter(({ n }) => n <= settings.horizonDays)
        .map(({ c, n }): Reminder & { tier: Tier } => ({ editionId: "", project: c.funder.name, label: c.label, dueDate: c.deadline!, daysLeft: n, stage: n < 0 ? "retard" : (days.filter((d) => n <= d).sort((a, b) => a - b)[0] ?? days[0]), kind: "call", who: money.map((m) => m.name), whoIds: money.map((m) => m.id), tier: 3 }))
    : [];
  const reminders = [...computeReminders(scoped, raf ? { id: raf.id, name: raf.name } : null, days, settings.horizonDays, director ? { id: director.id, name: director.name } : null)
    .map((r) => ({ ...r, tier: (tierOf.get(r.editionId) ?? 3) as Tier })), ...calls]
    .sort((a, b) => (isTransversal(me) ? 0 : a.tier - b.tier) || a.daysLeft - b.daysLeft);
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Échéances" subtitle={`Livrables financeurs, jalons internes, versements attendus et dépôts d'appels à projets à ${settings.horizonDays} jours. Le pilote (et la RAF pour les livrables) est prévenu à J-${days.join(", J-")} puis en cas de retard ; la RAF et la direction quand un versement attendu est dépassé — dans la cloche ici, par mail en V1.`} />
      {!isTransversal(me) && <div className="mb-3"><PerimeterChips current={perimeter} poleName={me.pole?.name ?? null} hrefFor={(p) => `/echeances?perimetre=${p}`} /></div>}
      {reminders.length === 0 ? <EmptyState title="Aucune échéance" hint="Rien n'arrive à échéance dans l'horizon." icon={<CalendarClock className="size-5" />} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm" data-testid="reminders">
            <thead className="bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="px-4 py-2.5">Échéance</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Objet</th><th className="px-3 py-2.5">Projet</th><th className="px-3 py-2.5">Prévenus</th></tr>
            </thead>
            <tbody className="divide-y">
              {reminders.map((r, i) => (
                <tr key={i} className={cn(r.daysLeft < 0 && "bg-danger-soft/30")}>
                  <td className="px-4 py-2 tabular">
                    <div>{fmtDate(r.dueDate)}</div>
                    <div className={cn("text-xs", r.daysLeft < 0 ? "text-danger" : "text-muted-foreground")}>{r.daysLeft < 0 ? `${-r.daysLeft} j de retard` : `J-${r.daysLeft}`}</div>
                  </td>
                  <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r.kind === "deliverable" ? "bg-secondary text-primary" : r.kind === "payment" ? "bg-warning-soft text-warning-foreground" : r.kind === "call" ? "bg-coral/10 text-coral" : "bg-muted")}>{r.kind === "deliverable" ? "Livrable financeur" : r.kind === "payment" ? "Versement attendu" : r.kind === "call" ? "Dépôt d'appel à projets" : "Jalon interne"}</span></td>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2"><Link href={r.kind === "call" ? "/appels?statut=apply" : `/edition/${r.editionId}?onglet=${r.kind === "milestone" ? "actions" : "budget"}`} className="text-primary hover:underline">{r.project}</Link>{!isTransversal(me) && <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{TIER_LABEL[r.tier]}</span>}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.who.join(", ")}<span className="ml-1 text-xs">· {r.stage === "retard" ? "retard" : `J-${r.stage}`}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
