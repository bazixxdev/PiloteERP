import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { TaskList } from "@/components/tasks/task-list";
import { getCurrentPerson, getSettings } from "@/lib/session";
import { loadEditionOpts, loadMyLists, loadMyTasks, loadSharedLists } from "@/lib/tasks";
import { hasModule, VISIBILITIES } from "@/lib/modules";
import { ListHeader, NewListDialog } from "./list-card";
import { visibilityIcon } from "@/components/common/visibility-icon";

// Espace Tâches (retour du 14/09) : mes listes, avec ou sans projet, visibilité au choix ; les listes que d'autres partagent avec moi, en lecture.
export default async function TachesPage() {
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
  const listOpts = lists.map((l) => ({ id: l.id, name: l.name }));
  const unlisted = tasks.filter((t) => !t.listId);
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Mes tâches"
        subtitle={<>{openCount ? `${openCount} en cours` : "Rien en cours"} · {lists.length} liste{lists.length > 1 ? "s" : ""} · une liste peut suivre un projet ou rester une catégorie à vous ; vous choisissez qui la lit.</>}
        actions={<NewListDialog editions={editions} />}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-md border bg-card" data-testid="list-unlisted">
          <div className="flex items-center justify-between border-b px-4 py-3"><h4 className="text-[13px] font-bold">Sans liste</h4><span className="text-[11px] text-muted-foreground">{unlisted.filter((t) => !t.done).length ? `${unlisted.filter((t) => !t.done).length} en cours` : "rien en cours"} · privées</span></div>
          <TaskList tasks={unlisted} editions={editions} lists={listOpts} emptyText="Aucune tâche hors liste. Ajoutez-en une ici, ou créez une liste." />
        </div>
        {lists.map((l) => {
          const mine = tasks.filter((t) => t.listId === l.id);
          return (
            <div key={l.id} className="overflow-hidden rounded-md border bg-card" data-testid={`list-${l.id}`} data-name={l.name}>
              <ListHeader list={l} editions={editions} count={mine.filter((t) => !t.done).length} />
              <TaskList tasks={mine} editions={editions} listId={l.id} lists={listOpts} editionId={l.edition?.id} emptyText="Aucune tâche dans cette liste." />
            </div>
          );
        })}
      </div>

      <section className="mt-6" data-testid="shared-lists">
        <h2 className="text-[15px] font-bold">Partagées avec moi</h2>
        <p className="mb-3 text-xs text-muted-foreground">Les listes que des collègues ont rendues visibles pour vous. En lecture : chacun écrit dans ses propres listes.</p>
        {shared.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-[11px] text-muted-foreground">Personne ne partage de liste avec vous pour l'instant.</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {shared.map(({ list, tasks: ts }) => {
              const Icon = visibilityIcon(list.visibility);
              const vis = VISIBILITIES.find((v) => v.value === list.visibility);
              return (
                <div key={list.id} className="overflow-hidden rounded-md border bg-card" data-testid={`shared-list-${list.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                    <div><h4 className="text-[13px] font-bold">{list.name}</h4><p className="text-[11px] text-muted-foreground">{list.owner.name}{list.edition ? <> · <Link href={`/edition/${list.edition.id}`} className="text-primary hover:underline">{list.edition.name} · {list.edition.year}</Link></> : ""}</p></div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={vis?.hint}><Icon className="size-3" aria-hidden />{vis?.label}</span>
                  </div>
                  <TaskList tasks={ts} readOnly emptyText="Rien en cours dans cette liste." />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
