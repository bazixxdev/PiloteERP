import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { ValidationCard } from "@/components/common/validation-card";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { canDecideValidation, validationLevelOf } from "@/lib/rights";
import { attachmentInclude } from "@/lib/attachments";
import { fmtEuro } from "@/lib/format";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LEVELS = [
  { level: 1, label: "Niveau 1 · pilote" },
  { level: 2, label: "Niveau 2 · responsable de pôle" },
  { level: 3, label: "Niveau 3 · direction" },
];

// File des validations par valideur, âge et délai cible (EF-F1, EF-F3).
export default async function ValidationsPage({ searchParams }: { searchParams: Promise<{ niveau?: string }> }) {
  const { niveau } = await searchParams;
  const [me, refs, settings] = await Promise.all([getCurrentPerson(), getRefs(), getSettings()]);
  const myLevel = validationLevelOf(me.role);
  const all = await prisma.validationRequest.findMany({
    include: { requester: true, decider: true, action: true, edition: { include: { project: { include: { pole: true } } } }, attachments: { include: attachmentInclude, orderBy: { createdAt: "desc" } } },
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
  });
  const pending = all.filter((v) => v.status === "pending");
  const decided = all.filter((v) => v.status !== "pending").slice(0, 12);
  const forMe = pending.filter((v) => canDecideValidation(me, v));
  const levelFilter = niveau ? Number(niveau) : null;
  const byLevel = levelFilter ? pending.filter((v) => v.requiredLevel === levelFilter) : pending;

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Validations"
        subtitle={`${pending.length} en attente · seuils : ${fmtEuro(settings.validationThresholdLevel1)} (niveau 2) et ${fmtEuro(settings.validationThresholdLevel2)} (niveau 3) ; au-delà de l'enveloppe restante, niveau 3.`}
      />

      <Section title="À traiter par moi" description={`${me.name} · ${me.role === "assistant" || me.role === "contributor" ? "vous ne validez pas" : `vous validez jusqu'au niveau ${myLevel}${me.role === "pilot" ? " sur vos projets" : me.role === "pole_lead" ? " sur votre pôle" : ""}`}.`} className="mb-4" testId="for-me">
        {forMe.length === 0 ? <EmptyState title="Rien à valider pour vous" hint="Les demandes de votre niveau apparaîtront ici avec leur âge et le délai cible." /> : (
          <div className="grid gap-2">{forMe.map((v, i) => <ValidationCard key={v.id} v={v} refs={refs} canDecide showEdition index={i} attachments={v.attachments} />)}</div>
        )}
      </Section>

      <div className="mb-3 flex flex-wrap gap-1">
        <Link href="/validations" className={cn("rounded-full border px-3 py-1 text-sm", !levelFilter ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted")}>Toute la file ({pending.length})</Link>
        {LEVELS.map((l) => (
          <Link key={l.level} href={`/validations?niveau=${l.level}`} className={cn("rounded-full border px-3 py-1 text-sm", levelFilter === l.level ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted")}>
            {l.label} ({pending.filter((v) => v.requiredLevel === l.level).length})
          </Link>
        ))}
      </div>

      <Section title="File complète par valideur" description="Toutes les demandes en attente, les plus anciennes en premier." className="mb-4">
        {byLevel.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande à ce niveau.</p> : (
          <div className="grid gap-2">{byLevel.map((v) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={canDecideValidation(me, v)} showEdition attachments={v.attachments} />)}</div>
        )}
      </Section>

      <Section title="Décisions récentes" description="Chaque décision est consignée sur l'édition, datée ; un devis approuvé s'ajoute à l'engagé.">
        {decided.length === 0 ? <p className="text-sm text-muted-foreground">Aucune décision.</p> : <div className="grid gap-2">{decided.map((v) => <ValidationCard key={v.id} v={v} refs={refs} canDecide={false} showEdition attachments={v.attachments} />)}</div>}
      </Section>
    </div>
  );
}
