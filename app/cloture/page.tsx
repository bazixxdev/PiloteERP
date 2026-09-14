import Link from "next/link";
import { withBase } from "@/lib/base-path";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
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
    // Part fixe (lettre de mission) : rien à clôturer, sauf si des heures existent.
    .filter((p) => (p.role !== "assistant" && !p.fixedShare) || entries.some((t) => t.personId === p.id))
    .map((p) => {
      const mine = entries.filter((t) => t.personId === p.id);
      const daysDone = new Set(mine.map((t) => dayjs(t.date).format("YYYY-MM-DD"))).size;
      const hours = mine.reduce((s, t) => s + t.hours, 0);
      const rp = rhythmPeople.find((x) => x.id === p.id)!;
      const exp = expectedDaysOfMonth(rp, month, rhythms);
      const declared = weeksOfMonth.filter((w) => declarations.some((d) => d.personId === p.id && d.week === w)).length;
      // Trois informations distinctes : couverture des saisies (jours attendus sans saisie), déclaration de la personne (semaines), verrouillage.
      // Aucune tolérance cachée : « complet » veut dire que chaque jour attendu porte une saisie (règle à confirmer avec la RAF, decisions.md 13/09).
      const doneSet = new Set(mine.map((t) => dayjs(t.date).format("YYYY-MM-DD")));
      const missingDays = exp.days.filter((d) => !doneSet.has(d.format("YYYY-MM-DD"))).length;
      const lock = locks.find((l) => l.personId === p.id);
      return {
        id: p.id, name: p.name, pole: p.pole?.name ?? "—", hours, expected: exp.hours, daysDone, daysExpected: exp.days.length, missingDays,
        declaredWeeks: declared, weeks: weeksOfMonth.length,
        status: lock ? "locked" : declared === weeksOfMonth.length && weeksOfMonth.length > 0 ? "declared" : exp.days.length > 0 && missingDays === 0 ? "complete" : daysDone > 0 ? "partial" : "missing",
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
        subtitle={`${monthLabel(month)} · ${days.length} jours ouvrés · ${weeksOfMonth.length} semaines · ${summary.partial + summary.missing ? `${summary.missing} sans saisie, ${summary.partial} à compléter` : "aucune anomalie"} · ${summary.locked} verrouillé${summary.locked > 1 ? "s" : ""}, ${summary.complete} complet${summary.complete > 1 ? "s" : ""}.`}
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
      <details className="group mt-4 rounded-md border bg-card px-4 py-3">
        <summary className="cursor-pointer list-none text-sm"><span className="font-semibold">Total du mois</span> · {fmtNumber(entries.reduce((s, t) => s + t.hours, 0), 0)} heures saisies par {new Set(entries.map((t) => t.personId)).size} personnes <span className="text-[11px] text-primary group-open:hidden">· comment lire cet écran</span></summary>
        <p className="mt-2 text-sm text-muted-foreground">Lecture d'une ligne : <b>Saisies</b> compte les jours attendus du rythme de la personne qui portent au moins une saisie ; <b>Déclaration</b> compte les semaines que la personne a déclarées complètes ; <b>État</b> résume les deux, sans tolérance : un jour attendu sans saisie reste « à compléter ». Une fois verrouillé, un mois passe en lecture seule pour la personne ; la RAF peut le déverrouiller pour une correction. « Relancer » envoie une notification dans l'outil à la personne (cloche en haut à droite, et dans « Ma semaine ») et laisse une trace ici ; en V1, un mail part aussi. « Détail » ouvre la grille de la personne, semaine par semaine.</p>
      </details>
    </div>
  );
}
