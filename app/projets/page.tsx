import Link from "next/link";
import { FileDown, Lightbulb } from "lucide-react";
import { DossiersHeader } from "@/components/common/dossiers-nav";
import { StatusBadge } from "@/components/common/status-badge";
import { prisma } from "@/lib/db";
import { getCurrentPerson, getRefs } from "@/lib/session";
import { canAdmin } from "@/lib/rights";
import { refLabel } from "@/lib/refs";
import { CreateProjectDialog } from "@/app/admin/forms";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/base-path";
import { PROJECT_STATES, projectState } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { ProjectsToolbar } from "./controls";
import { V, cap, pl } from "@/lib/vocab";

// Projets (lot 1 du 19/09, retour de Gaël) : une liste sobre — le nom, l'état, la raison d'être, le pôle, le pilote, les
// éditions — triable et filtrable ; le paramétrage (pôle, pilote, raison d'être, code) vit dans la fiche du projet.
export default async function ProjetsPage({ searchParams }: { searchParams: Promise<{ q?: string; etat?: string; tri?: string }> }) {
  const sp = await searchParams;
  const [me, refs] = await Promise.all([getCurrentPerson(), getRefs()]);
  const rw = canAdmin(me);
  const [people, poles, projects, missions] = await Promise.all([
    prisma.person.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.pole.findMany({ orderBy: { name: "asc" } }),
    prisma.project.findMany({ include: { pole: true, pilot: true, mission: true, editions: { select: { id: true, year: true, status: true }, orderBy: { year: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.mission.findMany({ orderBy: { order: "asc" } }),
  ]);
  const opt = (arr: { id: string; name: string }[]) => arr.map((x) => ({ value: x.id, label: x.name }));
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = sp.q ? norm(sp.q) : "";
  const year = new Date().getFullYear();
  const withState = projects.map((p) => ({ ...p, state: projectState(p, year) }));
  const etat = sp.etat && PROJECT_STATES[sp.etat] ? sp.etat : "";
  let rows = withState.filter((p) => (etat ? p.state === etat : p.state !== "archived") && (!q || norm(`${p.name} ${p.analyticCode} ${p.pole.name} ${p.pilot.name} ${p.mission.name}`).includes(q)));
  const tri = sp.tri ?? "name";
  const order: Record<string, number> = { active: 0, study: 1, none: 2, done: 3, archived: 4 };
  rows = [...rows].sort((a, b) => tri === "etat" ? order[a.state] - order[b.state] || a.name.localeCompare(b.name, "fr") : tri === "pole" ? a.pole.name.localeCompare(b.pole.name, "fr") || a.name.localeCompare(b.name, "fr") : tri === "pilote" ? a.pilot.name.localeCompare(b.pilot.name, "fr") || a.name.localeCompare(b.name, "fr") : a.name.localeCompare(b.name, "fr"));
  const counts = Object.fromEntries(Object.keys(PROJECT_STATES).map((k) => [k, withState.filter((p) => p.state === k).length]));
  const href = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ q: sp.q, etat, tri: sp.tri, ...patch })) if (v) p.set(k, v); return `/projets${p.toString() ? `?${p.toString()}` : ""}`; };
  const Th = ({ k, label, className }: { k: string; label: string; className?: string }) => <th className={cn("py-1.5", className)}><Link href={href({ tri: k })} className={cn("hover:text-foreground", tri === k && "text-primary")} data-testid={`projects-sort-${k}`}>{label}{tri === k ? " ↓" : ""}</Link></th>;
  return (
    <div className="p-4 md:p-6">
      <DossiersHeader
        current="projets"
        summary={`${rows.length} projet${rows.length > 1 ? "s" : ""}${etat ? ` · ${PROJECT_STATES[etat].label.toLowerCase()}` : ` · ${counts.active} en cours`}${counts.archived ? ` · ${counts.archived} archivé${counts.archived > 1 ? "s" : ""}` : ""}`}
        tools={<ProjectsToolbar q={sp.q ?? ""} etat={etat} counts={counts} />}
        actions={
          <>
            <Button asChild variant="outline" size="sm" title={`Toutes les fiches de l'année en un seul Word, par ${V.pole.one} puis mission — à la place du copier-coller`}><a href={withBase(`/plan-operationnel/export?annee=${year}`)} data-testid="export-plan"><FileDown />Plan opérationnel {year} (Word)</a></Button>
            <Button asChild variant="outline" size="sm"><Link href="/projets/proposer" data-testid="propose-project"><Lightbulb />Proposer un projet</Link></Button>
            {rw && <CreateProjectDialog poles={opt(poles)} people={opt(people)} missions={opt(missions)} />}
          </>
        }
      />
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-[13px]" data-testid="projects-table">
          <thead className="text-left text-[10px] font-semibold text-muted-foreground">
            <tr><Th k="name" label="Projet" className="px-4" /><Th k="etat" label="État" className="px-2" /><th className="px-2 py-1.5">Raison d&apos;être</th><Th k="pole" label={cap(V.pole)} className="px-2" /><Th k="pilote" label={cap(V.pilote)} className="px-2" /><th className="px-2 py-1.5">{cap(pl(V.edition))}</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-sm text-muted-foreground">Aucun projet {etat ? PROJECT_STATES[etat].label.toLowerCase() : ""}{q ? " pour cette recherche" : ""}.</td></tr>}
            {rows.map((p) => {
              const st = PROJECT_STATES[p.state];
              return (
                <tr key={p.id} className={cn(p.state === "archived" && "opacity-60")} data-testid={`project-row-${p.analyticCode}`} data-state={p.state}>
                  <td className="min-w-[220px] px-4 py-2"><Link href={`/projets/${p.id}`} className="font-medium text-primary underline-offset-2 hover:underline" data-testid={`project-open-${p.analyticCode}`}>{p.name}</Link><span className="ml-2 font-mono text-[10px] text-muted-foreground">{p.analyticCode}</span></td>
                  <td className="px-2 py-2"><StatusBadge label={st.label} color={st.color} /></td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{p.mission.name}</td>
                  <td className="px-2 py-2 text-xs">{p.pole.name}</td>
                  <td className="px-2 py-2 text-xs">{p.pilot.name}</td>
                  <td className="px-2 py-2"><div className="flex flex-wrap gap-1">{p.editions.map((e) => <Link key={e.id} href={`/edition/${e.id}`} title={refLabel(refs, "edition_status", e.status)} className={cn("rounded-sm px-1.5 py-0.5 text-[11px] hover:bg-secondary", e.status === "in_progress" || e.status === "validated" ? "bg-info-soft text-primary" : e.status === "closed" ? "bg-muted text-muted-foreground" : "bg-warning-soft text-warning")}>{e.year}</Link>)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
