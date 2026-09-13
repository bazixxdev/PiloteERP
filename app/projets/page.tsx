import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { AutoField } from "@/components/inline/auto-field";
import { DossiersNav } from "@/components/common/dossiers-nav";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { AddSimpleForm, CreateProjectForm, ProjectPolesPicker } from "@/app/admin/forms";

// Projets et éditions : objets permanents et leurs éditions annuelles. Modifiable par la direction et la RAF, lisible par tous.
export default async function ProjetsPage() {
  const me = await getCurrentPerson();
  const rw = canAdmin(me.role);
  const [people, poles, projects, missions] = await Promise.all([
    prisma.person.findMany({ orderBy: [{ active: "desc" }, { order: "asc" }] }),
    prisma.pole.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ include: { pole: true, pilot: true, mission: true, secondaryPoles: true, editions: { orderBy: { year: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.mission.findMany({ orderBy: { order: "asc" } }),
  ]);
  const opt = (arr: { id: string; name: string }[]) => arr.map((x) => ({ value: x.id, label: x.name }));
  return (
    <div className="p-4 md:p-6">
      <DossiersNav current="projets" />
      <PageHeader title="Projets et éditions" subtitle={`${projects.length} projets · ${projects.reduce((s, p) => s + p.editions.length, 0)} éditions.${rw ? "" : " Lecture seule : la direction et la RAF créent les projets et les éditions."}`} />
      <div className="overflow-x-auto">
        <Section title="Projets" description="Objets permanents ; chaque année une édition. Le pôle principal est celui du pilote ; un projet commun a des pôles associés, dont les membres le voient dans leur périmètre." actions={rw ? <CreateProjectForm poles={opt(poles)} people={opt(people.filter((p) => p.active))} missions={opt(missions)} /> : undefined}>
          <table className="w-full text-sm" data-testid="projects-table">
            <thead className="text-left text-[10px] font-semibold text-muted-foreground">
              <tr><th className="py-1.5">Projet</th><th className="py-1.5">Code</th><th className="py-1.5" title="Pôle principal, puis pôles associés pour un projet commun">Pôles</th><th className="py-1.5">Pilote</th><th className="py-1.5">Garant</th><th className="py-1.5">Mission</th><th className="py-1.5">Récurrent</th><th className="py-1.5">Éditions</th></tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="min-w-[200px] py-0.5"><AutoField model="project" id={p.id} field="name" type="text" value={p.name} readOnly={!rw} inputClassName="font-medium" /></td>
                  <td className="w-24 py-0.5"><AutoField model="project" id={p.id} field="analyticCode" type="text" value={p.analyticCode} readOnly={!rw} inputClassName="tabular" /></td>
                  <td className="min-w-[220px] py-0.5">
                    <AutoField model="project" id={p.id} field="poleId" type="select" value={p.poleId} options={opt(poles)} allowEmpty={false} readOnly={!rw} refreshOnSave />
                    <div className="mt-0.5 pl-2"><ProjectPolesPicker projectId={p.id} mainPoleId={p.poleId} poles={opt(poles)} selected={p.secondaryPoles.map((x) => x.poleId)} readOnly={!rw} /></div>
                  </td>
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
      </div>
    </div>
  );
}
