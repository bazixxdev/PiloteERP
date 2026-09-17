import { getCurrentPerson } from "@/lib/session";
import { PersonSwitcher } from "./person-switcher";
import { QuickSearch } from "./quick-search";
import { Suspense } from "react";
import { Breadcrumb } from "./breadcrumb";
import { prisma } from "@/lib/db";
import { NotificationsBell } from "./notifications-bell";
import { withBase } from "@/lib/base-path";
import { getAccountProps } from "./account-data";
import { getNavEditions } from "./nav-editions";
import { fmtDate, dayjs } from "@/lib/format";
import { hasModule } from "@/lib/modules";
import { noteColor, NOTE_CONTEXTS } from "@/lib/notes";
import { QuickMenu, type QuickItem } from "./quick-menus";
import type { NavSection } from "@/lib/navigation";

// Barre haute (maquette du 17/09) : la recherche à gauche, Notes / Tâches / notifications à droite. Le compte est en bas de la
// barre latérale ; sur mobile (pas de barre latérale) un avatar compact le remplace ici. Le fil d'Ariane est au-dessus du
// titre de la page (PageBreadcrumb, dans le layout).
export async function Topbar() {
  const [current, editions, account] = await Promise.all([getCurrentPerson(), getNavEditions(), getAccountProps()]);
  const notifications = await prisma.notification.findMany({ where: { personId: current.id }, include: { sender: true }, orderBy: { createdAt: "desc" }, take: 20 });
  // Menus rapides Notes / Tâches : les cinq dernières de la personne (notes par date, tâches à faire par échéance).
  const [recentNotes, recentTasks] = await Promise.all([
    hasModule(current, "notes") ? prisma.note.findMany({ where: { authorId: current.id, archivedAt: null }, orderBy: [{ updatedAt: "desc" }], take: 5, include: { edition: { include: { project: true } } } }) : Promise.resolve(null),
    hasModule(current, "tasks") ? prisma.task.findMany({ where: { personId: current.id, done: false }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 5, include: { edition: { include: { project: true } } } }) : Promise.resolve(null),
  ]);
  const noteItems: QuickItem[] | null = recentNotes && recentNotes.map((n) => ({ id: n.id, title: n.title || "Sans titre", sub: `${fmtDate(n.date, "D MMM")} · ${n.edition ? `${n.edition.project.name} · ${n.edition.year}` : NOTE_CONTEXTS.find((c) => c.value === n.context)?.label ?? ""}`, href: `/notes?note=${n.id}`, color: noteColor(n.color)?.hex ?? null }));
  const taskItems: QuickItem[] | null = recentTasks && recentTasks.map((t) => ({ id: t.id, title: t.label, sub: [t.dueDate ? (dayjs(t.dueDate).isBefore(dayjs(), "day") ? `en retard · ${fmtDate(t.dueDate, "D MMM")}` : `pour le ${fmtDate(t.dueDate, "D MMM")}`) : "sans échéance", t.edition ? `${t.edition.project.name} · ${t.edition.year}` : null].filter(Boolean).join(" · "), href: "/taches" }));
  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between gap-3 border-b bg-card px-4 md:px-6 print:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className="md:hidden"><img src={withBase("/logo-cress-mark.png")} alt="CRESS" width={190} height={177} className="h-auto w-6" /></span>
        <QuickSearch editions={editions.map((e) => ({ id: e.id, label: `${e.project.name} · ${e.year}` }))} />
      </div>
      <div className="flex items-center gap-2">
        {noteItems && <QuickMenu kind="notes" label="Notes" items={noteItems} allHref="/notes" addHref="/notes?note=nouvelle" addLabel="Nouvelle note" emptyText="Aucune note encore." />}
        {taskItems && <QuickMenu kind="tasks" label="Tâches" items={taskItems} allHref="/taches" addHref="/taches?ajouter=1" addLabel="Nouvelle tâche" emptyText="Rien à faire pour l'instant." />}
        <NotificationsBell items={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, createdAt: fmtDate(n.createdAt, "D MMM à HH:mm"), readAt: n.readAt ? n.readAt.toISOString() : null, sender: n.sender?.name ?? null }))} />
        <span className="md:hidden"><PersonSwitcher {...account} variant="topbar" testId="person-switcher-mobile" /></span>
      </div>
    </header>
  );
}

// Fil d'Ariane au-dessus du titre de chaque page (maquette du 17/09) ; rien en projection plein écran.
export async function PageBreadcrumb({ tree }: { tree: NavSection[] }) {
  const editions = await getNavEditions();
  return (
    <div className="px-4 pt-4 md:px-6 md:pt-5 print:hidden" data-testid="breadcrumb-strip">
      {/* useSearchParams exige une frontière Suspense dans un layout. */}
      <Suspense fallback={<span className="text-[11px] text-muted-foreground">Pilote</span>}>
        <Breadcrumb tree={tree} editions={editions.map((e) => ({ id: e.id, label: `${e.project.name} / ${e.year}` }))} />
      </Suspense>
    </div>
  );
}
