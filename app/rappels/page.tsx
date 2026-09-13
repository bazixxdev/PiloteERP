import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { inMyScope, isTransversal, perimeterFrom, relevanceTier, TIER_LABEL } from "@/lib/scope";
import { PerimeterChips } from "@/components/common/perimeter";
import { computeReminders } from "@/lib/alerts";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Journal des rappels (EF-C2) : pas de mail dans le prototype, tout s'affiche ici.
export default async function RappelsPage({ searchParams }: { searchParams: Promise<{ perimetre?: string }> }) {
  const { perimetre } = await searchParams;
  const [settings, me] = await Promise.all([getSettings(), getCurrentPerson()]);
  const perimeter = perimeterFrom(me, perimetre);
  const [editions, raf] = await Promise.all([
    prisma.edition.findMany({ where: { status: { in: ["in_progress", "validated"] } }, include: { project: { include: { pilot: true, secondaryPoles: true } }, team: true, actions: true, fundingLines: { include: { funder: true, deliverables: true } }, validations: true, expenses: true } }),
    prisma.person.findFirst({ where: { role: "raf" } }),
  ]);
  const days = settings.reminderDaysBefore.split(",").map(Number);
  const scoped = perimeter === "pole" ? editions.filter((e) => inMyScope(me, e.project, e.team.map((t) => t.personId))) : editions;
  const tierOf = new Map(scoped.map((e) => [e.id, relevanceTier(me, e.project, e.team.map((t) => t.personId), e.actions.map((a) => a.ownerId ?? ""))]));
  const reminders = computeReminders(scoped, raf?.name ?? null, days, settings.horizonDays)
    .map((r) => ({ ...r, tier: tierOf.get(r.editionId) ?? 3 }))
    .sort((a, b) => (isTransversal(me) ? 0 : a.tier - b.tier) || a.daysLeft - b.daysLeft);
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Rappels" subtitle={`Rappels automatiques J-${days.join(" et J-")} avant chaque livrable financeur et chaque jalon interne, horizon ${settings.horizonDays} jours. Dans le prototype, ils s'affichent ici au lieu d'un mail.`} />
      {!isTransversal(me) && <div className="mb-3"><PerimeterChips current={perimeter} poleName={me.pole?.name ?? null} hrefFor={(p) => `/rappels?perimetre=${p}`} /></div>}
      {reminders.length === 0 ? <EmptyState title="Aucun rappel" hint="Rien n'arrive à échéance dans l'horizon." icon={<Bell className="size-5" />} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm" data-testid="reminders">
            <thead className="bg-[#f1f5f6] text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="px-4 py-2.5">Échéance</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Objet</th><th className="px-3 py-2.5">Projet</th><th className="px-3 py-2.5">Destinataires</th></tr>
            </thead>
            <tbody className="divide-y">
              {reminders.map((r, i) => (
                <tr key={i} className={cn(r.daysLeft < 0 && "bg-danger-soft/30")}>
                  <td className="px-4 py-2 tabular">
                    <div>{fmtDate(r.dueDate)}</div>
                    <div className={cn("text-xs", r.daysLeft < 0 ? "text-danger" : "text-muted-foreground")}>{r.daysLeft < 0 ? `${-r.daysLeft} j de retard` : `J-${r.daysLeft}`}</div>
                  </td>
                  <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r.kind === "deliverable" ? "bg-secondary text-primary" : "bg-muted")}>{r.kind === "deliverable" ? "Livrable financeur" : "Jalon interne"}</span></td>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2"><Link href={`/edition/${r.editionId}?onglet=${r.kind === "deliverable" ? "financements" : "actions"}`} className="text-primary hover:underline">{r.project}</Link>{!isTransversal(me) && <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{TIER_LABEL[r.tier]}</span>}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.who.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
