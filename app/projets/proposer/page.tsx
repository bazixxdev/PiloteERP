import { PageHeader } from "@/components/common/page-header";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { ProposeProjectForm } from "./form";

// Tout chargé de mission peut proposer un projet : une fiche en statut « proposée », le cycle relecture → validation → CA fait le reste.
export default async function ProposerPage() {
  const me = await getCurrentPerson();
  const [missions, poles] = await Promise.all([prisma.mission.findMany({ orderBy: { order: "asc" } }), prisma.pole.findMany({ orderBy: { name: "asc" } })]);
  const y = new Date().getFullYear();
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Proposer un projet" subtitle="Une idée, un partenaire qui vous sollicite, une action à structurer : posez-la ici. C'est l'équivalent du « fais-moi une fiche projet », sans attendre janvier." />
      <ProposeProjectForm missions={missions.map((m) => ({ id: m.id, name: m.name }))} poles={poles.map((p) => ({ id: p.id, name: p.name }))} defaultPoleId={me.poleId} years={[y, y + 1]} />
    </div>
  );
}
