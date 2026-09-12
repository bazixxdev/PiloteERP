import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/session";
import { computeReminders } from "@/lib/alerts";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Journal des rappels (EF-C2) : pas de mail dans le prototype, tout s'affiche ici.
export default async function RappelsPage() {
  const settings = await getSettings();
  const [editions, raf] = await Promise.all([
    prisma.edition.findMany({ where: { status: { in: ["in_progress", "validated"] } }, include: { project: { include: { pilot: true } }, actions: true, fundingLines: { include: { funder: true, deliverables: true } }, validations: true } }),
    prisma.person.findFirst({ where: { role: "raf" } }),
  ]);
  const days = settings.reminderDaysBefore.split(",").map(Number);
  const reminders = computeReminders(editions, raf?.name ?? null, days, settings.horizonDays);
  return (
    <div className="p-6">
      <PageHeader title="Rappels" subtitle={`Rappels automatiques J-${days.join(" et J-")} avant chaque livrable financeur et chaque jalon interne, horizon ${settings.horizonDays} jours. Dans le prototype, ils s'affichent ici au lieu d'un mail.`} />
      {reminders.length === 0 ? <EmptyState title="Aucun rappel" hint="Rien n'arrive à échéance dans l'horizon." icon={<Bell className="size-5" />} /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm" data-testid="reminders">
            <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                  <td className="px-3 py-2"><Link href={`/edition/${r.editionId}?onglet=${r.kind === "deliverable" ? "financements" : "actions"}`} className="text-primary hover:underline">{r.project}</Link></td>
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
