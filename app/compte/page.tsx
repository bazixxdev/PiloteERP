import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { Avatar } from "@/components/shell/person-switcher";
import { IcsCard } from "@/components/common/ics-card";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { refLabel } from "@/lib/refs";
import { dayjs } from "@/lib/format";
import { loadRhythms, rhythmAt } from "@/lib/time";
import { modulesOf } from "@/lib/modules";
import { ModulesForm } from "./modules-form";

// Mon compte : ce que l'outil sait de moi (rôle, pôle, rythme, codes de temps) et mon flux agenda. Rien ne se modifie ici :
// les personnes et leurs rythmes se règlent dans l'admin ; en V1, l'identité viendra du compte Microsoft.
export default async function ComptePage() {
  const [me, refs, rhythms] = await Promise.all([getCurrentPerson(), getRefs(), loadRhythms()]);
  const full = await prisma.person.findUnique({ where: { id: me.id }, include: { rhythmPeriods: { include: { rhythm: true } }, timeCodes: { include: { timeCode: true }, orderBy: { timeCode: { order: "asc" } } }, pole: true, pilotedProjects: { select: { id: true, name: true }, orderBy: { name: "asc" } } } });
  const rhythm = full ? rhythmAt(full, dayjs(), rhythms) : null;
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Mon compte" subtitle="Ce que l'outil sait de vous. Les réglages se font dans l'admin ; en V1, l'identité viendra du compte Microsoft." />
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Section title="Identité et poste">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={me.name} role={me.role} className="size-12 text-base" />
            <div><div className="text-base font-semibold">{me.name}</div><div className="text-xs text-muted-foreground">{refLabel(refs, "role", me.role)}{me.pole ? ` · ${me.pole.name}` : " · transversal"}</div></div>
          </div>
          <dl className="grid gap-3">
            {row("Rôle", refLabel(refs, "role", me.role))}
            {row("Pôle", me.pole?.name ?? "Fonction transversale")}
            {row("Rythme de travail", rhythm ? rhythm.label : "Non configuré")}
            {row("Jours disponibles par an", full?.availableDays ?? "—")}
            {row("Codes de temps", full?.timeCodes.length ? full.timeCodes.map((c) => c.timeCode.label).join(", ") : "Aucun code hors projet")}
            {row("Projets pilotés", full?.pilotedProjects.length ? full.pilotedProjects.map((p) => p.name).join(", ") : "Aucun")}
            {row("Temps", me.fixedShare ? <span data-testid="fixed-share"><b>Part fixe</b> — {me.fixedShareNote || "pourcentage déclaré sur lettre de mission"} : aucune répartition hebdomadaire attendue.</span> : "Répartition hebdomadaire par projet")}
          </dl>
        </Section>
        <div className="grid content-start gap-4">
          <Section title="Mes modules" description="Ce que l'outil vous montre. Désactivez ce qui ne vous sert pas : rien n'est perdu, tout revient en réactivant.">
            <ModulesForm enabled={[...modulesOf(me)]} />
          </Section>
          <IcsCard kind="me" personId={me.id} />
        </div>
      </div>
    </div>
  );
}
