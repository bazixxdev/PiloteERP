import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getPeople, getRefs } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { refLabel } from "@/lib/refs";
import { fmtDate } from "@/lib/format";
import { loadResponsibilities } from "@/lib/people";
import { DepartureForm } from "./departure-form";

// « Préparer un départ » (lot E1, EF-K3) : tout ce que la personne porte, bloc par bloc, avec un repreneur ; puis la date et,
// au choix, la désactivation. Rien n'est effacé — l'historique reste à son nom.
export default async function DeparturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, refs, people] = await Promise.all([getCurrentPerson(), getRefs(), getPeople()]);
  if (!canAdmin(me)) return <div className="p-6 text-sm text-muted-foreground">Réservé à l&apos;administration (direction, RAF).</div>;
  const p = await prisma.person.findUnique({ where: { id }, include: { pole: true } });
  if (!p) notFound();
  const r = await loadResponsibilities(id);
  const others = people.filter((x) => x.id !== id).map((x) => ({ value: x.id, label: x.name, hint: `${refLabel(refs, "role", x.role)}${x.pole ? ` · ${x.pole.name}` : ""}`, poleId: x.poleId, role: x.role }));
  return (
    <div className="p-4 md:p-6">
      <PageHeader title={`Préparer le départ de ${p.name}`} subtitle={<>{[p.jobTitle, refLabel(refs, "role", p.role), p.pole?.name ?? "transversal"].filter(Boolean).join(" · ")}{p.arrivedAt ? ` · arrivée le ${fmtDate(p.arrivedAt)}` : ""}. Ce qu&apos;elle porte passe à quelqu&apos;un d&apos;autre en une fois ; son historique (temps, validations, remarques) reste à son nom.</>} actions={<Link href={`/admin?section=personnes&personne=${p.id}`} className="text-sm text-primary underline-offset-2 hover:underline">← Sa fiche</Link>} />
      <Section title="Réattribuer, dater, désactiver">
        <DepartureForm
          person={{ id: p.id, name: p.name, firstName: p.firstName || p.name, poleId: p.poleId, active: p.active, leftAt: p.leftAt ? p.leftAt.toISOString().slice(0, 10) : null }}
          others={others}
          blocks={{
            piloted: r.piloted.map((x) => `${x.name}${x.editions.length ? ` (${x.editions.map((e) => e.year).join(", ")})` : ""}`),
            guaranteed: r.guaranteed.map((x) => x.name),
            ledPoles: r.ledPoles.map((x) => x.name),
            sponsored: r.sponsored.map((x) => `${x.project.name} · ${x.year}`),
            actions: r.actions.map((x) => `${x.name} — ${x.edition.project.name} ${x.edition.year}${x.milestoneDate ? ` · ${fmtDate(x.milestoneDate)}` : ""}`),
            requests: r.requests.map((x) => `${x.title}${x.dueDate ? ` · pour le ${fmtDate(x.dueDate)}` : ""}`),
            teams: r.teams.map((x) => `${x.edition.project.name} · ${x.edition.year}`),
            tasks: r.tasks,
          }}
        />
      </Section>
    </div>
  );
}
