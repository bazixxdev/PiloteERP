import { getCurrentPerson, getPeople, getRefs } from "@/lib/session";
import { refLabel } from "@/lib/refs";
import { PersonSwitcher } from "./person-switcher";
import { QuickSearch } from "./quick-search";
import { Suspense } from "react";
import { Breadcrumb } from "./breadcrumb";
import Image from "next/image";
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
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b bg-card px-4 md:px-6 print:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* useSearchParams exige une frontière Suspense dans un layout. */}
        <Suspense fallback={<span className="text-[11px] text-muted-foreground">Pilote</span>}>
          <Breadcrumb editions={editions.map((e) => ({ id: e.id, label: `${e.project.name} / ${e.year}` }))} />
        </Suspense>
        <span className="md:hidden"><Image src="/logo-cress-mark.png" alt="CRESS" width={190} height={177} className="h-auto w-6" /></span>
        <QuickSearch editions={editions.map((e) => ({ id: e.id, label: `${e.project.name} · ${e.year}` }))} />
      </div>
      <div className="flex items-center gap-2">
        <NotificationsBell items={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, createdAt: fmtDate(n.createdAt, "D MMM à HH:mm"), readAt: n.readAt ? n.readAt.toISOString() : null, sender: n.sender?.name ?? null }))} />
        <PersonSwitcher people={people.map(map)} current={map(current)} />
      </div>
    </header>
  );
}
