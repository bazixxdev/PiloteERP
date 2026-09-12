import { getCurrentPerson, getPeople, getRefs } from "@/lib/session";
import { refLabel } from "@/lib/refs";
import { PersonSwitcher } from "./person-switcher";
import { QuickSearch } from "./quick-search";
import { prisma } from "@/lib/db";

export async function Topbar() {
  const [current, people, refs] = await Promise.all([getCurrentPerson(), getPeople(), getRefs()]);
  const editions = await prisma.edition.findMany({
    where: { status: { not: "closed" } },
    select: { id: true, year: true, project: { select: { name: true } } },
    orderBy: [{ project: { name: "asc" } }, { year: "desc" }],
  });
  const map = (p: (typeof people)[number]) => ({ id: p.id, name: p.name, role: p.role, roleLabel: refLabel(refs, "role", p.role), poleName: p.pole?.name ?? null });
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background/80 px-6 backdrop-blur print:hidden">
      <QuickSearch editions={editions.map((e) => ({ id: e.id, label: `${e.project.name} · ${e.year}` }))} />
      <PersonSwitcher people={people.map(map)} current={map(current)} />
    </header>
  );
}
