import { PageHeader } from "@/components/common/page-header";
import { isCodir } from "@/lib/rights";
import { Section } from "@/components/common/section";
import { fmtDate } from "@/lib/format";
import { AutoField } from "@/components/inline/auto-field";
import { Avatar } from "@/components/shell/person-switcher";
import { IcsCard } from "@/components/common/ics-card";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { refLabel } from "@/lib/refs";
import { dayjs } from "@/lib/format";
import { loadRhythms, rhythmAt } from "@/lib/time";
import { modulesOf } from "@/lib/modules";
import { ModulesForm } from "./modules-form";
import { PasswordForm } from "./password-form";
import { getSessionUser } from "@/lib/session";
import { V, cap } from "@/lib/vocab";

// Mon compte : ce que l'outil sait de moi (rôle, pôle, rythme, codes de temps) et mon flux agenda. Rien ne se modifie ici :
// les personnes et leurs rythmes se règlent dans l'admin. Le compte de connexion (mot de passe) se gère ici (lot F).
export default async function ComptePage() {
  const [me, refs, rhythms] = await Promise.all([getCurrentPerson(), getRefs(), loadRhythms()]);
  const full = await prisma.person.findUnique({ where: { id: me.id }, include: { rhythmPeriods: { include: { rhythm: true } }, timeCodes: { include: { timeCode: true }, orderBy: { timeCode: { order: "asc" } } }, pole: true, pilotedProjects: { select: { id: true, name: true }, orderBy: { name: "asc" } } } });
  const rhythm = full ? rhythmAt(full, dayjs(), rhythms) : null;
  // Le compte affiché est celui de la session ; en mode démo, si je « suis » quelqu'un d'autre, ce n'est pas le sien.
  const sessionUser = await getSessionUser();
  const account = sessionUser && full?.userId === sessionUser.id ? await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { email: true, lastLoginAt: true } }) : null;
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Mon compte" subtitle="Ce que l'outil sait de vous. Fonction et téléphone sont à vous ; le reste se règle dans l'admin." />
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Section title="Identité et poste">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={me.name} codir={isCodir(me)} className="size-12 text-base" />
            <div><div className="text-base font-semibold">{me.name}</div><div className="text-xs text-muted-foreground">{refLabel(refs, "role", me.role)}{me.pole ? ` · ${me.pole.name}` : " · transversal"}</div></div>
          </div>
          <dl className="grid gap-3">
            {/* Lot E1 : chacun tient sa fonction et son téléphone ; le reste est à l'administration. */}
            {row("Fonction", <AutoField model="person" id={me.id} field="jobTitle" type="text" value={me.jobTitle} label="Fonction" placeholder="Votre fonction, telle qu'elle s'affiche" testId="me-jobTitle" />)}
            {row("Téléphone", <AutoField model="person" id={me.id} field="phone" type="text" value={me.phone} label="Téléphone" placeholder="06 …" testId="me-phone" />)}
            {row("E-mail", me.email ?? "—")}
            {me.arrivedAt && row("Dans l'équipe depuis", fmtDate(me.arrivedAt))}
            {row("Rôle", refLabel(refs, "role", me.role))}
            {row(`${cap(V.pole)}`, me.pole?.name ?? "Fonction transversale")}
            {row("Rythme de travail", rhythm ? rhythm.label : "Non configuré")}
            {row("Jours disponibles par an", full?.availableDays ?? "—")}
            {row("Codes de temps", full?.timeCodes.length ? full.timeCodes.map((c) => c.timeCode.label).join(", ") : "Aucun code hors projet")}
            {row("Projets pilotés", full?.pilotedProjects.length ? full.pilotedProjects.map((p) => p.name).join(", ") : "Aucun")}
            {row("Temps", me.fixedShare ? <span data-testid="fixed-share"><b>Part fixe</b> — {me.fixedShareNote || "pourcentage déclaré sur lettre de mission"} : aucune répartition hebdomadaire attendue.</span> : "Répartition hebdomadaire par projet")}
          </dl>
        </Section>
        <div className="grid content-start gap-4">
          <Section title="Mon compte de connexion" description={<>{account ? <>Identifiant : <b>{account.email}</b>{account.lastLoginAt ? ` · dernière connexion ${dayjs(account.lastLoginAt).format("D MMM YYYY à HH:mm")}` : ""}.</> : "Vous êtes connecté·e avec un autre compte (mode démo)."} Changer le mot de passe ferme vos autres sessions.</>} testId="account-section">
            <PasswordForm />
          </Section>
          <Section title="Mes modules" description="Ce que l'outil vous montre. Désactivez ce qui ne vous sert pas : rien n'est perdu, tout revient en réactivant.">
            <ModulesForm enabled={[...modulesOf(me)]} />
          </Section>
          <IcsCard kind="me" personId={me.id} />
        </div>
      </div>
    </div>
  );
}
