import Link from "next/link";
import { Inbox, CheckCircle2, ListTodo } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { TaskList } from "@/components/tasks/task-list";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { loadEditionOpts, loadMyLists, loadMyTasks, loadSharedLists } from "@/lib/tasks";
import { hasModule, VISIBILITIES } from "@/lib/modules";
import { noteColor } from "@/lib/notes";
import { ListHeader, NewListDialog } from "./list-card";
import { visibilityIcon } from "@/components/common/visibility-icon";
import { cn } from "@/lib/utils";
import { ListDropLink } from "@/components/tasks/list-drop-link";

// Espace Tâches (revue UX du 15/09, même structure que les notes) : à gauche les vues (À faire, À trier, Terminées), mes listes
// et celles qu'on partage avec moi ; à droite une seule liste de tâches, une seule zone d'ajout, les lignes groupées par échéance.
export default async function TachesPage({ searchParams }: { searchParams: Promise<{ ajouter?: string; vue?: string; liste?: string; partagee?: string }> }) {
  const { ajouter, vue, liste, partagee } = await searchParams;
  const [me, settings] = await Promise.all([getCurrentPerson(), getSettings()]);
  if (!hasModule(me, "tasks")) {
    return (
      <div className="p-4 md:p-6">
        <PageHeader title="Tâches" />
        <EmptyState title="Module désactivé" hint="Activez « Tâches » dans Mon compte pour retrouver vos listes." />
        <p className="mt-3 text-xs"><Link href="/compte" className="text-primary hover:underline">Ouvrir Mon compte →</Link></p>
      </div>
    );
  }
  const [tasks, lists, shared, editions] = await Promise.all([loadMyTasks(me.id), loadMyLists(me.id), loadSharedLists(me), loadEditionOpts(me, settings)]);
  const listOpts = lists.map((l) => ({ id: l.id, name: l.name, color: l.color }));
  const open = tasks.filter((t) => !t.done);
  const unlisted = tasks.filter((t) => !t.listId);
  const doneTasks = tasks.filter((t) => t.done);
  const currentList = liste ? lists.find((l) => l.id === liste) : null;
  const currentShared = partagee ? shared.find((s) => s.list.id === partagee) : null;
  const view = currentList ? "liste" : currentShared ? "partagee" : vue === "trier" ? "trier" : vue === "terminees" ? "terminees" : "afaire";
  const late = open.filter((t) => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)).length;

  const navClass = (active: boolean) => cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-xs hover:bg-muted", active && "bg-info-soft font-semibold text-primary");
  const NavLink = ({ href, active, children, testId, name }: { href: string; active: boolean; children: React.ReactNode; testId?: string; name?: string }) => (
    <Link href={href} className={navClass(active)} aria-current={active ? "page" : undefined} data-testid={testId} data-name={name}>{children}</Link>
  );
  const Count = ({ n, danger }: { n: number; danger?: boolean }) => n > 0 ? <span className={cn("ml-auto rounded-sm px-1.5 text-[10px]", danger ? "bg-danger-soft font-semibold text-danger" : "bg-muted text-muted-foreground")}>{n}</span> : null;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Mes tâches" subtitle={<>{open.length ? `${open.length} en cours` : "Rien en cours"}{late ? ` · ${late} en retard` : ""} · une liste peut suivre un projet ou rester une catégorie à vous ; vous choisissez qui la lit.</>} actions={<NewListDialog editions={editions} />} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <nav className="rounded-md border bg-card p-1.5" aria-label="Vues" data-testid="tasks-views">
            <NavLink href="/taches" active={view === "afaire"} testId="tasks-view-afaire"><ListTodo className="size-3.5 text-muted-foreground" />À faire<Count n={open.length} /></NavLink>
            <ListDropLink href="/taches?vue=trier" listId={null} listName="À trier" active={view === "trier"} className={navClass(view === "trier")} testId="tasks-view-trier"><Inbox className="size-3.5 text-muted-foreground" />À trier<Count n={unlisted.filter((t) => !t.done).length} /></ListDropLink>
            <NavLink href="/taches?vue=terminees" active={view === "terminees"} testId="tasks-view-terminees"><CheckCircle2 className="size-3.5 text-muted-foreground" />Terminées<Count n={doneTasks.length} /></NavLink>
          </nav>
          <nav className="rounded-md border bg-card p-1.5" aria-label="Mes listes" data-testid="tasks-lists">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">Mes listes · {lists.length}</div>
            {lists.map((l) => {
              const n = tasks.filter((t) => t.listId === l.id && !t.done).length;
              const c = noteColor(l.color);
              return <ListDropLink key={l.id} href={`/taches?liste=${l.id}`} listId={l.id} listName={l.name} active={currentList?.id === l.id} className={navClass(currentList?.id === l.id)} testId={`tasks-list-${l.id}`} name={l.name}><span className="size-2.5 shrink-0 rounded-full" style={{ background: c?.hex ?? "var(--border)" }} aria-hidden /><span className="truncate">{l.name}</span><Count n={n} /></ListDropLink>;
            })}
            {lists.length === 0 && <p className="px-3 pb-1 text-[11px] text-muted-foreground">Aucune liste : tout est « À trier ».</p>}
            <NewListDialog editions={editions} compact />
          </nav>
          {shared.length > 0 && (
            <nav className="rounded-md border bg-card p-1.5" aria-label="Partagées avec moi" data-testid="shared-lists">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">Partagées avec moi · {shared.length}</div>
              {shared.map(({ list, tasks: ts }) => {
                const c = noteColor(list.color);
                return <NavLink key={list.id} href={`/taches?partagee=${list.id}`} active={currentShared?.list.id === list.id} testId={`tasks-shared-${list.id}`} name={list.name}><span className="size-2.5 shrink-0 rounded-full" style={{ background: c?.hex ?? "var(--border)" }} aria-hidden /><span className="min-w-0"><span className="block truncate">{list.name}</span><span className="block truncate text-[10px] font-normal text-muted-foreground">{list.owner.name}</span></span><Count n={ts.filter((t) => !t.done).length} /></NavLink>;
              })}
            </nav>
          )}
        </div>

        <div className="min-w-0 overflow-hidden rounded-md border bg-card" data-testid="tasks-main" data-view={view} data-name={currentList?.name ?? currentShared?.list.name}>
          {view === "afaire" && (
            <>
              <div className="px-4 py-3"><h2 className="text-[15px] font-bold">À faire</h2><p className="text-[11px] text-muted-foreground">Toutes vos tâches en cours, ce qui presse d'abord. Une nouvelle tâche va dans « À trier » ; rangez-la en cliquant sa pastille de liste, ou en la glissant sur une liste à gauche.</p></div>
              <TaskList tasks={open} editions={editions} lists={listOpts} autoFocus={ajouter === "1"} grouped showList emptyText="Rien en cours. Ajoutez une tâche ci-dessus : c'est à vous, ce n'est ni une action du projet, ni un jalon." />
            </>
          )}
          {view === "trier" && (
            <>
              <div className="px-4 py-3"><h2 className="text-[15px] font-bold">À trier</h2><p className="text-[11px] text-muted-foreground">Les tâches sans liste, privées. Rangez-les en cliquant « À trier » sur la ligne, ou en les glissant sur une liste à gauche — ou laissez-les là : ça marche aussi.</p></div>
              <TaskList tasks={unlisted} editions={editions} lists={listOpts} autoFocus={ajouter === "1"} grouped emptyText="Rien à trier." />
            </>
          )}
          {view === "terminees" && (
            <>
              <div className="px-4 py-3"><h2 className="text-[15px] font-bold">Terminées</h2><p className="text-[11px] text-muted-foreground">Les 14 derniers jours. Décochez pour rouvrir.</p></div>
              <TaskList tasks={doneTasks} editions={editions} lists={listOpts} showList hideAdd emptyText="Rien de terminé ces 14 derniers jours." />
            </>
          )}
          {view === "liste" && currentList && (
            <>
              <ListHeader list={currentList} editions={editions} count={tasks.filter((t) => t.listId === currentList.id && !t.done).length} />
              <TaskList tasks={tasks.filter((t) => t.listId === currentList.id)} editions={editions} lists={listOpts} listId={currentList.id} editionId={currentList.edition?.id} autoFocus={ajouter === "1"} grouped emptyText="Aucune tâche dans cette liste." />
            </>
          )}
          {view === "partagee" && currentShared && (() => {
            const Icon = visibilityIcon(currentShared.list.visibility);
            const vis = VISIBILITIES.find((v) => v.value === currentShared.list.visibility);
            return (
              <>
                <div className="px-4 py-3">
                  <h2 className="text-[15px] font-bold">{currentShared.list.name}</h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span>Liste de {currentShared.list.owner.name}</span>
                    {currentShared.list.edition && <span>· <Link href={`/edition/${currentShared.list.edition.id}`} className="text-primary hover:underline">{currentShared.list.edition.name} · {currentShared.list.edition.year}</Link></span>}
                    <span className="inline-flex items-center gap-1" title={vis?.hint}>· <Icon className="size-3" aria-hidden />{vis?.label}</span>
                    <span>· en lecture : chacun écrit dans ses propres listes</span>
                  </p>
                </div>
                <TaskList tasks={currentShared.tasks} readOnly emptyText="Rien en cours dans cette liste." />
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
