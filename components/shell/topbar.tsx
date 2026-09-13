import { getCurrentPerson, getPeople, getRefs } from "@/lib/session";
import { refLabel } from "@/lib/refs";
import { PersonSwitcher } from "./person-switcher";
import { QuickSearch } from "./quick-search";
import { prisma } from "@/lib/db";
import { NotificationsBell } from "./notifications-bell";
import { fmtDate } from "@/lib/format";

export async function Topbar() {
  const [current, people, refs] = await Promise.all([getCurrentPerson(), getPeople(), getRefs()]);
  const editions = await prisma.edition.findMany({
    where: { status: { not: "closed" } },
    select: { id: true, year: true, project: { select: { name: true } } },
    orderBy: [{ project: { name: "asc" } }, { year: "desc" }],
  });
  const notifications = await prisma.notification.findMany({ where: { personId: current.id }, include: { sender: true }, orderBy: { createdAt: "desc" }, take: 20 });
  const map = (p: (typeof people)[number]) => ({ id: p.id, name: p.name, role: p.role, roleLabel: refLabel(refs, "role", p.role), poleName: p.pole?.name ?? null });
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background/80 px-6 backdrop-blur print:hidden">
      <QuickSearch editions={editions.map((e) => ({ id: e.id, label: `${e.project.name} · ${e.year}` }))} />
      <div className="flex items-center gap-2">
        <NotificationsBell items={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, createdAt: fmtDate(n.createdAt, "D MMM à HH:mm"), readAt: n.readAt ? n.readAt.toISOString() : null, sender: n.sender?.name ?? null }))} />
        <PersonSwitcher people={people.map(map)} current={map(current)} />
      </div>
    </header>
  );
}
