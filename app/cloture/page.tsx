import Link from "next/link";
import { withBase } from "@/lib/base-path";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getPeople, getSettings } from "@/lib/session";
import { canLockMonths } from "@/lib/rights";
import { dayjs, fmtNumber, monthLabel } from "@/lib/format";
import { expectedDaysOfMonth, loadRhythms, weekKey, workingDaysOfMonth } from "@/lib/time";
import { ClotureTable, type ClotureRow } from "./table";
import { TimeNav } from "@/components/common/time-nav";

export default async function CloturePage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { mois } = await searchParams;
  const me = await getCurrentPerson();
  if (!canLockMonths(me.role)) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader title="Clôture mensuelle" />
        <EmptyState title="Réservé à la RAF et à la direction" hint="Choisissez « Nadia Ferrand (RAF) » dans le sélecteur en haut à droite pour voir cet écran." />
      </div>
    );
  }
  const month = /^\d{4}-\d{2}$/.test(mois ?? "") ? mois! : dayjs().subtract(1, "month").format("YYYY-MM");
  const start = dayjs(month + "-01");
  const range = { gte: start.toDate(), lt: start.add(1, "month").toDate() };
  const [people, entries, locks, settings, rhythms, rhythmPeople, declarations] = await Promise.all([
    getPeople(),
    prisma.timeEntry.findMany({ where: { date: range }, select: { personId: true, date: true, hours: true } }),
    prisma.monthLock.findMany({ where: { month }, include: { lockedBy: true } }),
    getSettings(),
    loadRhythms(),
    prisma.person.findMany({ include: { rhythmPeriods: { include: { rhythm: true } } } }),
    prisma.weekDeclaration.findMany(),
  ]);
  const reminders = await prisma.notification.findMany({ where: { kind: "time_reminder", title: { contains: monthLabel(month).toLowerCase() } }, include: { sender: true }, orderBy: { createdAt: "desc" } });
  const weeksOfMonth = [...new Set(workingDaysOfMonth(month).map((d) => weekKey(d)))];
  const jeton = settings.apiToken ? `&jeton=${settings.apiToken}` : "";
  const days = workingDaysOfMonth(month);
  const rows: ClotureRow[] = people
    .filter((p) => p.role !== "assistant" || entries.some((t) => t.personId === p.id))
    .map((p) => {
      const mine = entries.filter((t) => t.personId === p.id);
      const daysDone = new Set(mine.map((t) => dayjs(t.date).format("YYYY-MM-DD"))).size;
      const hours = mine.reduce((s, t) => s + t.hours, 0);
      const rp = rhythmPeople.find((x) => x.id === p.id)!;
      const exp = expectedDaysOfMonth(rp, month, rhythms);
      const declared = weeksOfMonth.filter((w) => declarations.some((d) => d.personId === p.id && d.week === w)).length;
      const ratio = exp.days.length ? daysDone / exp.days.length : 0;
      const lock = locks.find((l) => l.personId === p.id);
      return {
        id: p.id, name: p.name, pole: p.pole?.name ?? "—", hours, expected: exp.hours, daysDone, daysExpected: exp.days.length,
        declaredWeeks: declared, weeks: weeksOfMonth.length,
        status: lock ? "locked" : declared === weeksOfMonth.length && weeksOfMonth.length > 0 ? "declared" : ratio >= 0.9 ? "complete" : ratio > 0 ? "partial" : "missing",
        lockedBy: lock ? `${lock.lockedBy.name} · ${dayjs(lock.lockedAt).format("D MMM")}` : null,
        remindedAt: (() => { const r = reminders.find((n) => n.personId === p.id); return r ? `${dayjs(r.createdAt).format("D MMM")} par ${r.sender?.name ?? "—"}` : null; })(),
        detailHref: `/temps?personne=${p.id}&semaine=${weekKey(start)}`,
      } as ClotureRow;
    });
  const summary = { complete: rows.filter((r) => r.status === "complete" || r.status === "declared").length, partial: rows.filter((r) => r.status === "partial").length, missing: rows.filter((r) => r.status === "missing").length, locked: rows.filter((r) => r.status === "locked").length };
  const prev = start.subtract(1, "month").format("YYYY-MM");
  const next = start.add(1, "month").format("YYYY-MM");

  return (
    <div className="p-4 md:p-6">
      <TimeNav current="cloture" showTeam showCloture />
      <PageHeader
        title="Clôture mensuelle"
        subtitle={`${monthLabel(month)} · ${days.length} jours ouvrés écoulés · ${weeksOfMonth.length} semaines · ${summary.locked} verrouillé${summary.locked > 1 ? "s" : ""}, ${summary.complete} complet${summary.complete > 1 ? "s" : ""}, ${summary.partial} partiel${summary.partial > 1 ? "s" : ""}, ${summary.missing} manquant${summary.missing > 1 ? "s" : ""}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" aria-label="Mois précédent"><Link href={`/cloture?mois=${prev}`}><ChevronLeft /></Link></Button>
            <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span>
            <Button asChild variant="outline" size="icon" aria-label="Mois suivant"><Link href={`/cloture?mois=${next}`}><ChevronRight /></Link></Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <Button asChild variant="outline" size="sm"><a href={withBase(`/cloture/export?mois=${month}&par=projet${jeton}`)}><Download />CSV par projet</a></Button>
            <Button asChild variant="outline" size="sm"><a href={withBase(`/cloture/export?mois=${month}&par=personne${jeton}`)}><Download />CSV par personne</a></Button>
          </div>
        }
      />
      <ClotureTable month={month} rows={rows} />
      <Section title="Total du mois" className="mt-4">
        <p className="text-sm text-muted-foreground">{fmtNumber(entries.reduce((s, t) => s + t.hours, 0), 0)} heures saisies par {new Set(entries.map((t) => t.personId)).size} personnes. Une fois verrouillé, un mois passe en lecture seule pour la personne ; la RAF peut le déverrouiller pour une correction. « Relancer » envoie une notification dans l'outil à la personne (cloche en haut à droite, et dans « Ma semaine ») et laisse une trace ici ; en V1, un mail part aussi. « Détail » ouvre la grille de la personne, semaine par semaine.</p>
      </Section>
    </div>
  );
}
