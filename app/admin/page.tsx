import Link from "next/link";
import { kindFilter, listFunders } from "@/lib/organisations";
import { redirect } from "next/navigation";
import { withBase } from "@/lib/base-path";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AutoField } from "@/components/inline/auto-field";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { REF_DEFAULTS, REF_FAMILY_LABELS, refLabel, type RefFamily } from "@/lib/refs";
import { canAdmin, canManageRoles } from "@/lib/rights";
import { getRoles } from "@/lib/roles";
import { CreateRoleButton, RoleCard, RolesMatrix } from "./roles-forms";
import { cn } from "@/lib/utils";
import { AddSimpleForm, TimeCodeToggle, ImportForm, RhythmPeriodForm } from "./forms";
import { fmtDate } from "@/lib/format";
import { ApiCard } from "@/components/common/api-card";
import { InstanceModulesForm } from "./instance-modules-form";
import { modulesOf } from "@/lib/modules";
import { LedgerImportForm, PennylaneSyncButton, ClearLedgerButton, TagForm, DeleteTagButton } from "./ledger-forms";
import { loadUnknownCodes } from "@/lib/ledger-db";
import { pennylaneConfig } from "@/lib/pennylane";
import { SOURCE_LABEL } from "@/lib/ledger";
import { AccountActions, OutboxRow } from "./account-forms";
import { PersonPanelBody, personPanelTitle } from "./person-panel";
import { UrlPanel } from "@/components/common/url-panel";
import { DEMO_MODE } from "@/lib/auth";

const SECTIONS = [
  { key: "personnes", label: "Personnes" },
  { key: "comptes", label: "Comptes" },
  { key: "roles", label: "Rôles et droits" },
  { key: "referentiels", label: "Référentiels" },
  { key: "parametres", label: "Paramètres" },
  { key: "donnees", label: "Import / export" },
] as const;

const COLOR_OPTS = ["primary", "info", "mint", "warning", "danger", "coral", "muted"].map((c) => ({ value: c, label: c }));

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ section?: string; personne?: string }> }) {
  const { section, personne } = await searchParams;
  if (section === "projets") redirect("/projets");
  const current = SECTIONS.some((s) => s.key === section) ? section! : "personnes";
  const [me, refs, settings] = await Promise.all([getCurrentPerson(), getRefs(), getSettings()]);
  const rw = canAdmin(me);
  const roles = await getRoles();
  const suppliers = await prisma.organisation.findMany({ where: { active: true, ...kindFilter("supplier") }, include: { _count: { select: { validations: true } } }, orderBy: { name: "asc" } });
  const [people, poles, funders, missions, timeCodes, refValues, rhythms] = await Promise.all([
    prisma.person.findMany({ include: { timeCodes: true, rhythmPeriods: { include: { rhythm: true }, orderBy: { from: "desc" } } }, orderBy: [{ active: "desc" }, { order: "asc" }] }),
    prisma.pole.findMany({ include: { lead: true }, orderBy: { name: "asc" } }),
    listFunders(),
    prisma.mission.findMany({ orderBy: { order: "asc" } }),
    prisma.timeCode.findMany({ orderBy: { order: "asc" } }),
    prisma.refValue.findMany({ orderBy: [{ family: "asc" }, { order: "asc" }] }),
    prisma.rhythm.findMany({ orderBy: { order: "asc" } }),
  ]);
  const opt = (arr: { id: string; name: string }[]) => arr.map((x) => ({ value: x.id, label: x.name }));
  const refOpt = (fam: RefFamily) => (fam === "role" ? roles.map((r) => ({ value: r.code, label: r.label })) : REF_DEFAULTS[fam].map((r) => ({ value: r.code, label: refLabel(refs, fam, r.code) })));
  // Comptes (lot F) : qui a un compte, dernière connexion, sessions ouvertes ; courriers à remettre (liens de mot de passe).
  const accounts = current === "comptes" ? await (async () => {
    const [persons, outbox] = await Promise.all([
      prisma.person.findMany({ include: { pole: true, user: { include: { _count: { select: { sessions: true } } } } }, orderBy: [{ active: "desc" }, { order: "asc" }] }),
      prisma.mailOutbox.findMany({ where: { handedAt: null }, orderBy: { createdAt: "desc" } }),
    ]);
    return { persons, outbox };
  })() : null;
  // Réalisé comptable (lot D) : journal des imports, snapshots présents, codes à rapprocher, cibles possibles.
  const ledger = current === "donnees" ? await (async () => {
    const [imports, snapshots, unknown, tags, editions, actions, projects, lines] = await Promise.all([
      prisma.ledgerImport.findMany({ orderBy: { importedAt: "desc" }, take: 10 }),
      prisma.ledgerLine.groupBy({ by: ["source", "year"], _count: { _all: true }, _sum: { debit: true, credit: true }, orderBy: [{ year: "desc" }, { source: "asc" }] }),
      loadUnknownCodes(),
      prisma.analyticTag.findMany({ orderBy: { code: "asc" } }),
      prisma.edition.findMany({ include: { project: { select: { name: true } } }, orderBy: [{ year: "desc" }, { project: { name: "asc" } }] }),
      prisma.action.findMany({ include: { edition: { include: { project: { select: { name: true } } } } }, orderBy: { name: "asc" } }),
      prisma.project.findMany({ orderBy: { name: "asc" } }),
      prisma.fundingLine.findMany({ include: { funder: true, edition: { include: { project: { select: { name: true } } } } } }),
    ]);
    const people = new Map((await prisma.person.findMany({ select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    return { imports, snapshots, unknown, tags, people,
      editionOpts: editions.map((e) => ({ value: e.id, label: `${e.project.name} · ${e.year}` })),
      actionOpts: actions.map((a) => ({ value: a.id, label: `${a.edition.project.name} ${a.edition.year} · ${a.name}` })),
      projectOpts: projects.map((p) => ({ value: p.id, label: `${p.name} (${p.analyticCode})` })),
      lineOpts: lines.map((l) => ({ value: l.id, label: `${l.edition.project.name} ${l.edition.year} · ${l.funder.name}` })),
      targetLabel: (kind: string, id: string | null) => kind === "ignore" ? "ignoré (fonctionnement)" : (kind === "edition" ? editions.find((e) => e.id === id) && `${editions.find((e) => e.id === id)!.project.name} · ${editions.find((e) => e.id === id)!.year}` : kind === "action" ? actions.find((a) => a.id === id)?.name : kind === "project" ? projects.find((p) => p.id === id)?.name : lines.find((l) => l.id === id) && `${lines.find((l) => l.id === id)!.edition.project.name} · ${lines.find((l) => l.id === id)!.funder.name}`) ?? "cible introuvable",
    };
  })() : null;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Admin" subtitle={rw ? "Référentiels, seuils, personnes : paramétrable par le référent CRESS sans prestataire." : "Lecture seule : l'administration est réservée à la direction et à la RAF."} />
      <nav className="subnav mb-5 flex flex-wrap gap-1 border-b" data-testid="admin-tabs">
        {SECTIONS.map((s) => (
          <Link key={s.key} href={`/admin?section=${s.key}`} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", s.key === current ? "border-coral" : "border-transparent text-muted-foreground hover:text-foreground")}>{s.label}</Link>
        ))}
      </nav>

      {current === "personnes" && (
        <div className="grid gap-4">
          <Section title="Personnes" description="Rôle, pôle, rythme de travail et jours disponibles dans l'année." actions={rw ? <AddSimpleForm kind="person" placeholder="Prénom Nom" /> : undefined}>
            <table className="w-full text-sm" data-testid="people-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr><th className="py-1.5">Nom</th><th className="py-1.5"></th><th className="py-1.5">Pôle</th><th className="py-1.5">Rôle</th><th className="py-1.5">Rythme · en vigueur depuis</th><th className="py-1.5 text-right">Jours dispo.</th><th className="py-1.5">Actif</th></tr>
              </thead>
              <tbody className="divide-y">
                {people.map((p) => (
                  <tr key={p.id} className={cn(!p.active && "opacity-50")}>
                    <td className="min-w-[180px] py-0.5"><AutoField model="person" id={p.id} field="name" type="text" value={p.name} readOnly={!rw} inputClassName="font-medium" /></td>
                    {/* La fiche (lot E1) s'ouvre en panneau sur la page, comme les lignes de la matrice. */}
                    <td className="w-14 py-0.5"><Link href={`/admin?section=personnes&personne=${p.id}`} scroll={false} className="text-xs text-primary underline-offset-2 hover:underline" data-testid={`person-open-${p.id}`}>Fiche</Link></td>
                    <td className="min-w-[200px] py-0.5"><AutoField model="person" id={p.id} field="poleId" type="select" value={p.poleId} options={opt(poles)} readOnly={!rw} placeholder="— transversal —" /></td>
                    <td className="min-w-[180px] py-0.5"><AutoField model="person" id={p.id} field="role" type="select" value={p.role} options={refOpt("role")} allowEmpty={false} readOnly={!rw} testId={`role-${p.id}`} /></td>
                    <td className="min-w-[260px] py-0.5">
                      <div className="text-xs">
                        {p.rhythmPeriods.length === 0 ? <span className="text-muted-foreground">{rhythms.find((r) => r.code === p.workRhythm)?.label ?? "Référence non configurée"}</span> : p.rhythmPeriods.slice(0, 2).map((rp) => (
                          <div key={rp.id} className={cn(rp.to && "text-muted-foreground")}>{rp.rhythm.label.split(" · ")[0]} <span className="text-muted-foreground">depuis le {fmtDate(rp.from)}{rp.to ? ` jusqu'au ${fmtDate(rp.to)}` : ""}</span></div>
                        ))}
                      </div>
                      {rw && <RhythmPeriodForm personId={p.id} rhythms={rhythms.map((r) => ({ value: r.id, label: r.label.split(" · ")[0] }))} />}
                    </td>
                    <td className="w-28 py-0.5"><AutoField model="person" id={p.id} field="availableDays" type="number" value={p.availableDays} readOnly={!rw} suffix="j" /></td>
                    <td className="py-0.5"><AutoField model="person" id={p.id} field="active" type="bool" value={p.active} readOnly={!rw} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Pôles" actions={rw ? <AddSimpleForm kind="pole" placeholder="Nom du pôle" /> : undefined}>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {poles.map((p) => (
                    <tr key={p.id}>
                      <td className="py-0.5"><AutoField model="pole" id={p.id} field="name" type="text" value={p.name} readOnly={!rw} inputClassName="font-medium" /></td>
                      <td className="w-56 py-0.5"><AutoField model="pole" id={p.id} field="leadId" type="select" value={p.leadId} options={opt(people)} readOnly={!rw} placeholder="Responsable…" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Rythmes de travail" description="Heures attendues par jour, lundi → dimanche, semaine paire puis impaire (option B : un vendredi sur deux). Informatif : aucun solde." actions={rw ? <AddSimpleForm kind="rhythm" placeholder="Nouveau rythme" compact /> : undefined}>
              <table className="w-full text-xs" data-testid="rhythms">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1">Rythme</th><th className="py-1">Semaine paire (L,M,M,J,V,S,D)</th><th className="py-1">Semaine impaire</th></tr></thead>
                <tbody className="divide-y">
                  {rhythms.map((r) => (
                    <tr key={r.id}>
                      <td className="min-w-[180px] py-0.5"><AutoField model="rhythm" id={r.id} field="label" type="text" value={r.label} readOnly={!rw} /></td>
                      <td className="min-w-[150px] py-0.5"><AutoField model="rhythm" id={r.id} field="hoursEven" type="text" value={r.hoursEven} readOnly={!rw} inputClassName="font-mono" /></td>
                      <td className="min-w-[150px] py-0.5"><AutoField model="rhythm" id={r.id} field="hoursOdd" type="text" value={r.hoursOdd} readOnly={!rw} inputClassName="font-mono" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 grid items-center gap-2 text-sm sm:grid-cols-[1fr_120px]"><span>Coefficient heures → jours (réalisé, exports)</span><AutoField model="settings" id="1" field="hoursPerDay" type="number" value={settings.hoursPerDay} readOnly={!rw} suffix="h/j" /></div>
              <div className="mt-2 grid items-center gap-2 text-sm sm:grid-cols-[1fr_120px]"><span>Jours de fonctionnement par mois déduits de la capacité du plan de charge <span className="text-xs text-muted-foreground">(réunions transverses, café, entretiens · un chargé de mission y passe environ 1 jour sur 7)</span></span><AutoField model="settings" id="1" field="operatingDaysPerMonth" type="number" value={settings.operatingDaysPerMonth} readOnly={!rw} suffix="j/mois" testId="operating-days" /></div>
              <div className="mt-2 grid items-center gap-2 text-sm sm:grid-cols-[1fr_260px]"><span>Adresse de facturation <span className="text-xs text-muted-foreground">(écrite sur chaque bon pour accord : les factures y arrivent, pas chez le pilote)</span></span><AutoField model="settings" id="1" field="billingEmail" type="text" value={settings.billingEmail} readOnly={!rw} testId="billing-email" /></div>
              <div className="mt-2 grid gap-1 text-sm"><span>Consigne de facturation (dans le bon pour accord)</span><AutoField model="settings" id="1" field="billingNote" type="textarea" rows={2} value={settings.billingNote} readOnly={!rw} /></div>
            </Section>

            <Section title="Codes de temps par poste" description="Codes « fonctionnement » et « non travaillé » proposés à chaque personne dans sa grille de saisie.">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr><th className="py-1 text-left">Personne</th>{timeCodes.map((t) => <th key={t.id} className="px-1 py-1 text-center" title={t.label}>{t.code}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {people.filter((p) => p.active).map((p) => (
                      <tr key={p.id}>
                        <td className="py-1">{p.name}</td>
                        {timeCodes.map((t) => <td key={t.id} className="px-1 py-1 text-center"><TimeCodeToggle personId={p.id} timeCodeId={t.id} on={p.timeCodes.some((x) => x.timeCodeId === t.id)} readOnly={!rw} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </div>
      )}


      {current === "referentiels" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Financeurs" description="Les financeurs et leurs contacts se tiennent dans « Projets et financements ».">
            <p className="text-sm text-muted-foreground">{funders.length} financeur{funders.length > 1 ? "s" : ""} · <Link href="/financeurs" className="text-primary hover:underline">ouvrir la liste des financeurs</Link>. Les projets et leurs éditions sont aussi dans <Link href="/projets" className="text-primary hover:underline">Projets et éditions</Link>.</p>
          </Section>
          <Section title="Fournisseurs" description={<>Organisations de genre « fournisseur » (lot E2) : alimentées depuis les demandes de validation (un nom inconnu s'y ajoute d'une case à cocher), tenues dans l'<Link href="/organisations" className="text-primary hover:underline">annuaire des organisations</Link>.</>} actions={rw ? <AddSimpleForm kind="supplier" placeholder="Nouveau fournisseur" compact /> : undefined} testId="suppliers">
            {suppliers.length === 0 ? <p className="text-sm text-muted-foreground">Aucun fournisseur encore.</p> : (
              <ul className="divide-y text-sm">
                {suppliers.map((x) => (
                  <li key={x.id} className="grid gap-1 py-1.5 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                    <AutoField model="organisation" id={x.id} field="name" type="text" value={x.name} readOnly={!rw} />
                    <AutoField model="organisation" id={x.id} field="email" type="text" value={x.email} readOnly={!rw} placeholder="adresse pour le bon pour accord" />
                    <span className="text-[11px] text-muted-foreground">{x._count.validations} devis</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Missions du plan opérationnel" actions={rw ? <AddSimpleForm kind="mission" placeholder="Nouvelle mission" compact /> : undefined}>
            <ul className="divide-y text-sm">{missions.map((m) => <li key={m.id}><AutoField model="mission" id={m.id} field="name" type="text" value={m.name} readOnly={!rw} /></li>)}</ul>
          </Section>
          <Section title="Codes de temps hors projet" actions={rw ? <AddSimpleForm kind="timeCode" placeholder="Nouveau code" compact /> : undefined}>
            <ul className="divide-y text-sm">
              {timeCodes.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-xs font-semibold tabular text-muted-foreground">{t.code}</span>
                  <div className="flex-1"><AutoField model="timeCode" id={t.id} field="label" type="text" value={t.label} readOnly={!rw} /></div>
                  <div className="w-36"><AutoField model="timeCode" id={t.id} field="kind" type="select" value={t.kind} allowEmpty={false} readOnly={!rw} options={[{ value: "operating", label: "Fonctionnement" }, { value: "non_worked", label: "Non travaillé" }]} /></div>
                </li>
              ))}
            </ul>
          </Section>
          {(Object.keys(REF_FAMILY_LABELS) as RefFamily[]).filter((fam) => fam !== "role").map((fam) => (
            <Section key={fam} title={REF_FAMILY_LABELS[fam]} description="Le code reste stable ; le libellé et la couleur se modifient." actions={rw ? <AddSimpleForm kind="refValue" family={fam} placeholder="Nouvelle valeur" compact /> : undefined}>
              <ul className="divide-y text-sm">
                {refValues.filter((r) => r.family === fam).map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-xs tabular text-muted-foreground" title={r.code}>{r.code}</span>
                    <div className="flex-1"><AutoField model="refValue" id={r.id} field="label" type="text" value={r.label} readOnly={!rw} /></div>
                    {["edition_status", "action_state", "funding_status", "validation_status", "codir_decision"].includes(fam) && <div className="w-28"><AutoField model="refValue" id={r.id} field="color" type="select" value={r.color} options={COLOR_OPTS} readOnly={!rw} placeholder="couleur" /></div>}
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </div>
      )}

      {current === "personnes" && personne && (() => {
        const p = people.find((x) => x.id === personne);
        if (!p) return null;
        const head = personPanelTitle({ ...p, pole: poles.find((x) => x.id === p.poleId) ?? null }, refs);
        return (
          <UrlPanel title={head.title} description={head.description} closeHref="/admin?section=personnes" testId="person-panel-sheet">
            <PersonPanelBody id={p.id} refs={refs} rw={rw} poles={poles} rhythms={rhythms} />
          </UrlPanel>
        );
      })()}

      {current === "roles" && (
        <div className="grid gap-4">
          <Section title="Rôles" description="Chaque personne a un rôle ; un rôle porte des droits (ci-dessous) et un niveau de validation. Les six rôles d'origine sont fixes, on peut en créer d'autres." actions={canManageRoles(me) ? <CreateRoleButton /> : undefined}>
            <div className="grid gap-2 lg:grid-cols-2" data-testid="roles-list">
              {roles.map((r) => <RoleCard key={r.code} role={r} readOnly={!canManageRoles(me)} />)}
            </div>
          </Section>
          <Section title="Droits par rôle" description="Ce qu'un rôle peut faire au-delà de son propre périmètre. Ce qui dépend du contexte — je pilote cette édition, j'en suis l'équipe, c'est mon pôle — est toujours accordé, quel que soit le rôle. Enregistré à chaque case.">
            <RolesMatrix roles={roles} readOnly={!canManageRoles(me)} />
          </Section>
        </div>
      )}

      {current === "comptes" && accounts && (
        <div className="grid gap-4">
          <Section title="Comptes de connexion" description={<>Une personne se connecte avec son adresse e-mail et son mot de passe. Créer le compte prépare un <b>lien d&apos;accès</b> (la personne choisit son mot de passe) ; désactiver une personne ferme ses sessions. Les liens sont dans la boîte d&apos;envoi ci-dessous tant que les mails ne sont pas branchés (V1).{DEMO_MODE && <> · <b>Mode démo</b> : « Changer d&apos;utilisateur » est ouvert aux personnes connectées.</>}</>} testId="accounts">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="accounts-table">
                <thead className="text-left text-[10px] font-semibold text-muted-foreground"><tr><th className="py-1.5 pr-2">Personne</th><th className="py-1.5 pr-2">Adresse e-mail (identifiant)</th><th className="py-1.5 pr-2">Compte</th><th className="py-1.5 pr-2">Dernière connexion</th><th className="py-1.5 pr-2">Sessions</th><th className="py-1.5" /></tr></thead>
                <tbody className="divide-y">
                  {accounts.persons.map((p) => (
                    <tr key={p.id} className={cn(!p.active && "text-muted-foreground")} data-testid={`account-row-${p.name}`}>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{p.name}{!p.active && <span className="ml-1 rounded-sm bg-muted px-1 text-[10px]">désactivée</span>}<div className="text-[10px] text-muted-foreground">{refLabel(refs, "role", p.role)}{p.pole ? ` · ${p.pole.name}` : ""}</div></td>
                      <td className="min-w-[220px] py-1.5 pr-2"><AutoField model="person" id={p.id} field="email" type="text" value={p.email} readOnly={!rw} placeholder="prenom.nom@…" label={`Adresse e-mail de ${p.name}`} testId={`email-${p.id}`} /></td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{p.user ? <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold", p.active ? "bg-mint-soft text-mint" : "bg-muted")}>{p.active ? "actif" : "fermé"}</span> : <span className="text-xs text-muted-foreground">aucun</span>}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-xs text-muted-foreground">{p.user?.lastLoginAt ? fmtDate(p.user.lastLoginAt, "D MMM YYYY à HH:mm") : "—"}</td>
                      <td className="py-1.5 pr-2 text-xs tabular">{p.user?._count.sessions ?? 0}</td>
                      <td className="py-1.5 text-right">{rw && <AccountActions personId={p.id} hasAccount={!!p.user} hasEmail={!!p.email} active={p.active} sessions={p.user?._count.sessions ?? 0} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="Boîte d'envoi" description="Courriers que l'outil aurait envoyés : liens d'accès et de nouveau mot de passe, valables une heure. Copiez le lien, remettez-le à la personne, marquez « remis ». En V1, un envoi de mail vide cette boîte tout seul." testId="outbox">
            {accounts.outbox.length === 0 ? <p className="text-sm text-muted-foreground">Rien à remettre.</p> : (
              <ul className="divide-y text-sm" data-testid="outbox-list">
                {accounts.outbox.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid={`mail-${m.id}`} data-kind={m.kind}>
                    <div className="min-w-0"><div className="font-medium">{m.subject} <span className="font-normal text-muted-foreground">→ {m.to}</span></div><div className="text-[11px] text-muted-foreground">{fmtDate(m.createdAt, "D MMM YYYY à HH:mm")} · {m.kind === "invitation" ? "lien d'accès" : "nouveau mot de passe"}{m.link && <> · <a href={m.link} className="break-all font-mono text-[10px] text-primary hover:underline" data-testid={`mail-link-${m.id}`}>{m.link.length > 90 ? `${m.link.slice(0, 90)}…` : m.link}</a></>}</div></div>
                    {rw && <OutboxRow id={m.id} link={m.link} />}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {current === "parametres" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Validations" description="Niveau requis : sous le seuil 1 le pilote valide ; entre les deux, le responsable de pôle ; au-dessus ou hors enveloppe, la direction.">
            <div className="grid gap-3">
              <Row label="Seuil niveau 1 → 2 (€)"><AutoField model="settings" id="1" field="validationThresholdLevel1" type="number" value={settings.validationThresholdLevel1} readOnly={!rw} suffix="€" /></Row>
              <Row label="Seuil niveau 2 → 3 (€)"><AutoField model="settings" id="1" field="validationThresholdLevel2" type="number" value={settings.validationThresholdLevel2} readOnly={!rw} suffix="€" /></Row>
            </div>
          </Section>
          <Section title="Alertes et rappels">
            <div className="grid gap-3">
              <Row label="Rappels avant échéance (jours, séparés par une virgule)"><AutoField model="settings" id="1" field="reminderDaysBefore" type="text" value={settings.reminderDaysBefore} readOnly={!rw} /></Row>
              <Row label="Horizon des échéances (jours)"><AutoField model="settings" id="1" field="horizonDays" type="number" value={settings.horizonDays} readOnly={!rw} suffix="j" /></Row>
              <Row label="Alerte livrable financeur à (jours)"><AutoField model="settings" id="1" field="deliverableAlertDays" type="number" value={settings.deliverableAlertDays} readOnly={!rw} suffix="j" /></Row>
              <Row label="Alerte enveloppe à (%)"><AutoField model="settings" id="1" field="envelopeAlertPercent" type="number" value={settings.envelopeAlertPercent} readOnly={!rw} suffix="%" /></Row>
            </div>
          </Section>
          <Section title="Visibilité du temps saisi" description="Qui voit les temps de qui Le temps agrégé par projet et par action reste lisible par tous ceux qui pilotent.">
            <AutoField model="settings" id="1" field="timeVisibility" type="select" value={settings.timeVisibility} options={refOpt("time_visibility")} allowEmpty={false} readOnly={!rw} testId="setting-time-visibility" />
          </Section>
          <Section title="Dossier de référence sur le serveur" description="Gabarit du chemin proposé sur chaque édition ; {code} et {annee} sont remplacés.">
            <AutoField model="settings" id="1" field="serverPathTemplate" type="text" value={settings.serverPathTemplate} readOnly={!rw} inputClassName="font-mono text-xs" />
          </Section>
          <Section title="Règles de saisie du temps" description="Affichées à chaque personne dans « Temps », sous « Aide et règles de saisie ».">
            <AutoField model="settings" id="1" field="timeRules" type="textarea" rows={6} value={settings.timeRules} readOnly={!rw} placeholder="Qui saisit, où vont les réunions transverses, quels codes par poste…" />
          </Section>
          <Section title="Réalisé comptable" description="Quelle source compte dans les alertes d'enveloppe, le portefeuille et le niveau des validations : le réalisé saisi par la RAF sur les dépenses, ou les charges du grand livre importé. L'autre s'affiche en regard dans l'onglet Budget ; jamais les deux additionnés." testId="realized-source">
            <div className="grid gap-3">
              <Row label="Source du réalisé"><AutoField model="settings" id="1" field="realizedSource" type="select" value={settings.realizedSource} options={[{ value: "raf", label: "Saisi par la RAF (dépenses)" }, { value: "ledger", label: "Grand livre importé (compta)" }]} readOnly={!rw} allowEmpty={false} testId="realized-source-select" /></Row>
              <Row label="Axes analytiques Pennylane (préfixes, séparés par des virgules ; vide = tout)"><AutoField model="settings" id="1" field="pennylaneAxes" type="text" value={settings.pennylaneAxes} readOnly={!rw} placeholder="PROJETS, FINANCEMENT" /></Row>
            </div>
          </Section>
          <Section title="Modules de l'installation" description="Ce que cette installation utilise. Un module éteint disparaît de la navigation ; ses données restent. Chacun règle aussi ses propres modules dans Mon compte." testId="instance-modules">
            <InstanceModulesForm enabled={[...modulesOf(settings)]} readOnly={!rw} />
          </Section>
        </div>
      )}

      {current === "donnees" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Export" description="Réversibilité : toutes les données, à tout moment (ENF-5).">
            <div className="flex flex-wrap gap-2">
              {["personnes", "projets", "editions", "actions", "financements", "livrables", "temps", "depenses", "validations"].map((t) => (
                <Button key={t} asChild size="sm" variant="outline"><a href={withBase(`/admin/export?table=${t}${settings.apiToken ? `&jeton=${settings.apiToken}` : ""}`)}><Download />{t}.csv</a></Button>
              ))}
              <Button asChild size="sm"><a href={withBase(`/admin/export?table=tout&format=json${settings.apiToken ? `&jeton=${settings.apiToken}` : ""}`)}><Download />Tout (JSON)</a></Button>
            </div>
          </Section>
          <Section title="Connexions externes" description="Jeton d'API : il protège les exports ouverts depuis Excel ou un autre outil (dans l'outil, aucun jeton n'est nécessaire).">
            <div className="mb-4 grid items-center gap-2 sm:grid-cols-[1fr_320px]">
              <span className="text-sm">Jeton d'API</span>
              <AutoField model="settings" id="1" field="apiToken" type="text" value={settings.apiToken} readOnly={!rw} inputClassName="font-mono text-xs" refreshOnSave testId="setting-api-token" />
            </div>
            <ApiCard apiToken={settings.apiToken} />
          </Section>
          {ledger && (
            <Section title="Réalisé comptable" description="Le grand livre analytique du logiciel de compta, importé par exercice et rapproché des éditions par le code analytique. Réimporter un exercice remplace ses lignes (aucun doublon). Colonnes attendues : code analytique, compte, débit, crédit ; libellé, date, pièce, tiers facultatifs." testId="ledger-admin" className="lg:col-span-2">
              {rw ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <LedgerImportForm defaultYear={new Date().getFullYear()} />
                    <PennylaneSyncButton configured={!!pennylaneConfig()} year={new Date().getFullYear()} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Snapshots présents</div>
                      {ledger.snapshots.length === 0 ? <p className="text-xs text-muted-foreground">Aucun réalisé importé.</p> : (
                        <ul className="divide-y text-sm" data-testid="ledger-snapshots">
                          {ledger.snapshots.map((sn) => <li key={`${sn.source}-${sn.year}`} className="flex items-center justify-between py-1"><span>{SOURCE_LABEL[sn.source] ?? sn.source} · {sn.year} <span className="text-xs text-muted-foreground">· {sn._count._all} lignes · {fmtEuroShort(sn._sum.debit ?? 0)} au débit</span></span><ClearLedgerButton source={sn.source} year={sn.year} /></li>)}
                        </ul>
                      )}
                      <div className="mt-3 mb-1 text-[11px] font-semibold text-muted-foreground">Derniers imports</div>
                      {ledger.imports.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : <ul className="divide-y text-xs text-muted-foreground" data-testid="ledger-imports">{ledger.imports.map((i) => <li key={i.id} className="py-1">{fmtDate(i.importedAt)} · {SOURCE_LABEL[i.source] ?? i.source} {i.year}{i.fileName ? ` · ${i.fileName}` : ""} · {i.rows} écritures → {i.lines} lignes · {ledger.people.get(i.byId ?? "") ?? "—"}</li>)}</ul>}
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Codes à rapprocher <span className="font-normal">· présents dans la compta, inconnus de l&apos;outil</span></div>
                      {ledger.unknown.length === 0 ? <p className="text-xs text-mint">Tous les codes du réalisé sont reconnus.</p> : (
                        <ul className="divide-y text-sm" data-testid="ledger-unknown">
                          {ledger.unknown.map((u) => <li key={`${u.code}-${u.year}`} className="grid gap-1 py-2"><div><code className="rounded bg-muted px-1 font-mono text-xs">{u.code}</code> <span className="text-xs text-muted-foreground">· {u.year} · {fmtEuroShort(u.amount)}{u.sample ? ` · ${u.sample}` : ""}</span></div><TagForm code={u.code} editions={ledger.editionOpts} actions={ledger.actionOpts} projects={ledger.projectOpts} lines={ledger.lineOpts} /></li>)}
                        </ul>
                      )}
                      {ledger.tags.length > 0 && (
                        <>
                          <div className="mt-3 mb-1 text-[11px] font-semibold text-muted-foreground">Correspondances posées</div>
                          <ul className="divide-y text-xs" data-testid="ledger-tags">{ledger.tags.map((t) => <li key={t.code} className="flex items-center justify-between py-1"><span><code className="rounded bg-muted px-1 font-mono">{t.code}</code> → {ledger.targetLabel(t.targetKind, t.targetId)}</span><DeleteTagButton code={t.code} /></li>)}</ul>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Réservé à l'administration.</p>}
            </Section>
          )}
          <Section title="Import CSV" description="Création seulement (les doublons sont ignorés). Première ligne = en-têtes.">
            {rw ? <ImportForm /> : <p className="text-sm text-muted-foreground">Réservé à l'administration.</p>}
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p><strong>personnes</strong> : nom ; pole ; role (director, raf, pole_lead, pilot, contributor, assistant) ; rythme (option_a, option_b, part_time, apprentice) ; jours</p>
              <p><strong>financeurs</strong> : nom</p>
              <p><strong>projets</strong> : nom ; code ; pole ; pilote ; mission</p>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

const fmtEuroShort = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_180px]">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
