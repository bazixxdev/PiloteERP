import { getCurrentPerson, getPeople, getRefs, getSessionUser } from "@/lib/session";
import { DEMO_MODE } from "@/lib/auth";
import { refLabel } from "@/lib/refs";
import { PersonSwitcher } from "./person-switcher";
import { QuickSearch } from "./quick-search";
import { Suspense } from "react";
import { Breadcrumb } from "./breadcrumb";
import { prisma } from "@/lib/db";
import { NotificationsBell } from "./notifications-bell";
import { byRelevance } from "@/lib/scope";
import { canAdmin } from "@/lib/rights";
import { withBase } from "@/lib/base-path";
import { fmtDate, dayjs } from "@/lib/format";
import { hasModule } from "@/lib/modules";
import { noteColor, NOTE_CONTEXTS } from "@/lib/notes";
import { QuickMenu, type QuickItem } from "./quick-menus";
import type { NavSection } from "@/lib/navigation";

export async function Topbar({ tree }: { tree: NavSection[] }) {
  const [current, people, refs, sessionUser] = await Promise.all([getCurrentPerson(), getPeople(), getRefs(), getSessionUser()]);
  const rawEditions = await prisma.edition.findMany({
    where: { status: { not: "closed" } },
    select: { id: true, year: true, project: { select: { name: true, poleId: true, pilotId: true, guarantorId: true, secondaryPoles: { select: { poleId: true } } } }, team: { select: { personId: true } } },
    orderBy: [{ project: { name: "asc" } }, { year: "desc" }],
  });
  const editions = byRelevance(current, rawEditions, (e) => ({ project: e.project, teamIds: e.team.map((t) => t.personId) }));
  const notifications = await prisma.notification.findMany({ where: { personId: current.id }, include: { sender: true }, orderBy: { createdAt: "desc" }, take: 20 });
  // Menus rapides Notes / Tâches : les cinq dernières de la personne (notes par date, tâches à faire par échéance).
  const [recentNotes, recentTasks] = await Promise.all([
    hasModule(current, "notes") ? prisma.note.findMany({ where: { authorId: current.id, archivedAt: null }, orderBy: [{ updatedAt: "desc" }], take: 5, include: { edition: { include: { project: true } } } }) : Promise.resolve(null),
    hasModule(current, "tasks") ? prisma.task.findMany({ where: { personId: current.id, done: false }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 5, include: { edition: { include: { project: true } } } }) : Promise.resolve(null),
  ]);
  const noteItems: QuickItem[] | null = recentNotes && recentNotes.map((n) => ({ id: n.id, title: n.title || "Sans titre", sub: `${fmtDate(n.date, "D MMM")} · ${n.edition ? `${n.edition.project.name} · ${n.edition.year}` : NOTE_CONTEXTS.find((c) => c.value === n.context)?.label ?? ""}`, href: `/notes?note=${n.id}`, color: noteColor(n.color)?.hex ?? null }));
  const taskItems: QuickItem[] | null = recentTasks && recentTasks.map((t) => ({ id: t.id, title: t.label, sub: [t.dueDate ? (dayjs(t.dueDate).isBefore(dayjs(), "day") ? `en retard · ${fmtDate(t.dueDate, "D MMM")}` : `pour le ${fmtDate(t.dueDate, "D MMM")}`) : "sans échéance", t.edition ? `${t.edition.project.name} · ${t.edition.year}` : null].filter(Boolean).join(" · "), href: "/taches" }));
  const map = (p: (typeof people)[number]) => ({ id: p.id, name: p.name, role: p.role, roleLabel: refLabel(refs, "role", p.role), poleName: p.pole?.name ?? null });
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b bg-card px-4 md:px-6 print:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* useSearchParams exige une frontière Suspense dans un layout. */}
        <Suspense fallback={<span className="text-[11px] text-muted-foreground">Pilote</span>}>
          <Breadcrumb tree={tree} editions={editions.map((e) => ({ id: e.id, label: `${e.project.name} / ${e.year}` }))} />
        </Suspense>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className="md:hidden"><img src={withBase("/logo-cress-mark.png")} alt="CRESS" width={190} height={177} className="h-auto w-6" /></span>
        <QuickSearch editions={editions.map((e) => ({ id: e.id, label: `${e.project.name} · ${e.year}` }))} />
      </div>
      <div className="flex items-center gap-2">
        {noteItems && <QuickMenu kind="notes" label="Notes" items={noteItems} allHref="/notes" addHref="/notes?note=nouvelle" addLabel="Nouvelle note" emptyText="Aucune note encore." />}
        {taskItems && <QuickMenu kind="tasks" label="Tâches" items={taskItems} allHref="/taches" addHref="/taches?ajouter=1" addLabel="Nouvelle tâche" emptyText="Rien à faire pour l'instant." />}
        <NotificationsBell items={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, createdAt: fmtDate(n.createdAt, "D MMM à HH:mm"), readAt: n.readAt ? n.readAt.toISOString() : null, sender: n.sender?.name ?? null }))} />
        <PersonSwitcher people={people.map(map)} current={map(current)} canAdmin={canAdmin(current.role)} demo={DEMO_MODE} account={sessionUser?.name ?? null} />
      </div>
    </header>
  );
}
