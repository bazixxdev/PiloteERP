import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AutoField } from "@/components/inline/auto-field";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs, getSettings } from "@/lib/session";
import { REF_DEFAULTS, REF_FAMILY_LABELS, refLabel, type RefFamily } from "@/lib/refs";
import { canAdmin } from "@/lib/rights";
import { cn } from "@/lib/utils";
import { AddSimpleForm, CreateProjectForm, TimeCodeToggle, ImportForm, RhythmPeriodForm } from "./forms";
import { fmtDate } from "@/lib/format";
import { ApiCard } from "@/components/common/api-card";

const SECTIONS = [
  { key: "personnes", label: "Personnes" },
  { key: "projets", label: "Projets et éditions" },
  { key: "referentiels", label: "Référentiels" },
  { key: "parametres", label: "Paramètres" },
  { key: "donnees", label: "Import / export" },
] as const;

const COLOR_OPTS = ["primary", "info", "mint", "warning", "danger", "coral", "muted"].map((c) => ({ value: c, label: c }));

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  const current = SECTIONS.some((s) => s.key === section) ? section! : "personnes";
  const [me, refs, settings] = await Promise.all([getCurrentPerson(), getRefs(), getSettings()]);
  const rw = canAdmin(me.role);
  const [people, poles, projects, funders, missions, timeCodes, refValues, rhythms] = await Promise.all([
    prisma.person.findMany({ include: { timeCodes: true, rhythmPeriods: { include: { rhythm: true }, orderBy: { from: "desc" } } }, orderBy: [{ active: "desc" }, { order: "asc" }] }),
    prisma.pole.findMany({ include: { lead: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ include: { pole: true, pilot: true, mission: true, editions: { orderBy: { year: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.funder.findMany({ orderBy: { name: "asc" } }),
    prisma.mission.findMany({ orderBy: { order: "asc" } }),
    prisma.timeCode.findMany({ orderBy: { order: "asc" } }),
    prisma.refValue.findMany({ orderBy: [{ family: "asc" }, { order: "asc" }] }),
    prisma.rhythm.findMany({ orderBy: { order: "asc" } }),
  ]);
  const opt = (arr: { id: string; name: string }[]) => arr.map((x) => ({ value: x.id, label: x.name }));
  const refOpt = (fam: RefFamily) => REF_DEFAULTS[fam].map((r) => ({ value: r.code, label: refLabel(refs, fam, r.code) }));

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Admin" subtitle={rw ? "Référentiels, seuils, personnes : paramétrable par le référent CRESS sans prestataire." : "Lecture seule : l'administration est réservée à la direction et à la RAF."} />
      <nav className="mb-5 flex flex-wrap gap-1 border-b" data-testid="admin-tabs">
        {SECTIONS.map((s) => (
          <Link key={s.key} href={`/admin?section=${s.key}`} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", s.key === current ? "border-coral" : "border-transparent text-muted-foreground hover:text-foreground")}>{s.label}</Link>
        ))}
      </nav>

      {current === "personnes" && (
        <div className="grid gap-4">
          <Section title="Personnes" description="Rôle, pôle, rythme de travail et jours disponibles dans l'année." actions={rw ? <AddSimpleForm kind="person" placeholder="Prénom Nom" /> : undefined}>
            <table className="w-full text-sm" data-testid="people-table">
              <thead className="text-left text-[10px] font-semibold text-muted-foreground">
                <tr><th className="py-1.5">Nom</th><th className="py-1.5">Pôle</th><th className="py-1.5">Rôle</th><th className="py-1.5">Rythme</th><th className="py-1.5 text-right">Jours dispo.</th><th className="py-1.5">Actif</th></tr>
              </thead>
              <tbody className="divide-y">
                {people.map((p) => (
                  <tr key={p.id} className={cn(!p.active && "opacity-50")}>
                    <td className="min-w-[180px] py-0.5"><AutoField model="person" id={p.id} field="name" type="text" value={p.name} readOnly={!rw} inputClassName="font-medium" /></td>
                    <td className="min-w-[200px] py-0.5"><AutoField model="person" id={p.id} field="poleId" type="select" value={p.poleId} options={opt(poles)} readOnly={!rw} placeholder="— transversal —" /></td>
                    <td className="min-w-[180px] py-0.5"><AutoField model="person" id={p.id} field="role" type="select" value={p.role} options={refOpt("role")} allowEmpty={false} readOnly={!rw} /></td>
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

      {current === "projets" && (
        <Section title="Projets" description="Objets permanents ; chaque année une édition. Créer un projet crée aussi sa première édition." actions={rw ? <CreateProjectForm poles={opt(poles)} people={opt(people.filter((p) => p.active))} missions={opt(missions)} /> : undefined}>
          <table className="w-full text-sm" data-testid="projects-table">
            <thead className="text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="py-1.5">Projet</th><th className="py-1.5">Code</th><th className="py-1.5">Pôle</th><th className="py-1.5">Pilote</th><th className="py-1.5">Garant</th><th className="py-1.5">Mission</th><th className="py-1.5">Récurrent</th><th className="py-1.5">Éditions</th></tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="min-w-[200px] py-0.5"><AutoField model="project" id={p.id} field="name" type="text" value={p.name} readOnly={!rw} inputClassName="font-medium" /></td>
                  <td className="w-24 py-0.5"><AutoField model="project" id={p.id} field="analyticCode" type="text" value={p.analyticCode} readOnly={!rw} inputClassName="tabular" /></td>
                  <td className="min-w-[160px] py-0.5"><AutoField model="project" id={p.id} field="poleId" type="select" value={p.poleId} options={opt(poles)} allowEmpty={false} readOnly={!rw} /></td>
                  <td className="min-w-[150px] py-0.5"><AutoField model="project" id={p.id} field="pilotId" type="select" value={p.pilotId} options={opt(people)} allowEmpty={false} readOnly={!rw} /></td>
                  <td className="min-w-[150px] py-0.5"><AutoField model="project" id={p.id} field="guarantorId" type="select" value={p.guarantorId} options={opt(people)} readOnly={!rw} /></td>
                  <td className="min-w-[180px] py-0.5"><AutoField model="project" id={p.id} field="missionId" type="select" value={p.missionId} options={opt(missions)} allowEmpty={false} readOnly={!rw} /></td>
                  <td className="py-0.5"><AutoField model="project" id={p.id} field="recurring" type="bool" value={p.recurring} readOnly={!rw} /></td>
                  <td className="py-0.5">
                    <div className="flex flex-wrap gap-1">
                      {p.editions.map((e) => <Link key={e.id} href={`/edition/${e.id}`} className="rounded-sm bg-muted px-2 py-0.5 text-xs hover:bg-secondary">{e.year}</Link>)}
                      {rw && <AddSimpleForm kind="edition" projectId={p.id} placeholder="Année" compact />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {current === "referentiels" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Financeurs" actions={rw ? <AddSimpleForm kind="funder" placeholder="Nouveau financeur" compact /> : undefined}>
            <ul className="divide-y text-sm">{funders.map((f) => <li key={f.id}><AutoField model="funder" id={f.id} field="name" type="text" value={f.name} readOnly={!rw} /></li>)}</ul>
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
          {(Object.keys(REF_FAMILY_LABELS) as RefFamily[]).map((fam) => (
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
          <Section title="Visibilité du temps saisi" description="Qui voit les temps de qui (EF-K6). Le temps agrégé par projet et par action reste lisible par tous ceux qui pilotent.">
            <AutoField model="settings" id="1" field="timeVisibility" type="select" value={settings.timeVisibility} options={refOpt("time_visibility")} allowEmpty={false} readOnly={!rw} testId="setting-time-visibility" />
          </Section>
          <Section title="Dossier de référence sur le serveur" description="Gabarit du chemin proposé sur chaque édition ; {code} et {annee} sont remplacés.">
            <AutoField model="settings" id="1" field="serverPathTemplate" type="text" value={settings.serverPathTemplate} readOnly={!rw} inputClassName="font-mono text-xs" />
          </Section>
          <Section title="Règles de saisie du temps" description="Affichées à chaque personne dans « Mes temps » (EF-D8).">
            <AutoField model="settings" id="1" field="timeRules" type="textarea" rows={6} value={settings.timeRules} readOnly={!rw} placeholder="Qui saisit, où vont les réunions transverses, quels codes par poste…" />
          </Section>
        </div>
      )}

      {current === "donnees" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Export" description="Réversibilité : toutes les données, à tout moment (ENF-5).">
            <div className="flex flex-wrap gap-2">
              {["personnes", "projets", "editions", "actions", "financements", "livrables", "temps", "depenses", "validations"].map((t) => (
                <Button key={t} asChild size="sm" variant="outline"><a href={`/admin/export?table=${t}${settings.apiToken ? `&jeton=${settings.apiToken}` : ""}`}><Download />{t}.csv</a></Button>
              ))}
              <Button asChild size="sm"><a href={`/admin/export?table=tout&format=json${settings.apiToken ? `&jeton=${settings.apiToken}` : ""}`}><Download />Tout (JSON)</a></Button>
            </div>
          </Section>
          <Section title="Connexions externes" description="Jeton d'API : il protège les exports ouverts depuis Excel ou un autre outil (dans l'outil, aucun jeton n'est nécessaire).">
            <div className="mb-4 grid items-center gap-2 sm:grid-cols-[1fr_320px]">
              <span className="text-sm">Jeton d'API</span>
              <AutoField model="settings" id="1" field="apiToken" type="text" value={settings.apiToken} readOnly={!rw} inputClassName="font-mono text-xs" refreshOnSave testId="setting-api-token" />
            </div>
            <ApiCard apiToken={settings.apiToken} />
          </Section>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[1fr_180px]">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
