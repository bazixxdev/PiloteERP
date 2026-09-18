import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { NotificationList, MarkAllRead } from "@/components/notifications/notification-list";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { familyOf, FAMILY_LABEL, type NotificationFamily } from "@/lib/notifications";
import { dayjs, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { V, le } from "@/lib/vocab";

type Filter = "toutes" | "non-lues" | NotificationFamily;

// Centre de notifications : tout ce qui a été adressé à la personne (relances, remarques, demandes, échéances…), lu ou non,
// groupé par jour. La cloche n'en montre que les quatre dernières ; ici, on retrouve l'historique et on filtre par famille.
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams;
  const me = await getCurrentPerson();
  const all = await prisma.notification.findMany({ where: { personId: me.id }, include: { sender: true }, orderBy: { createdAt: "desc" }, take: 300 });
  const rows = all.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, createdAt: fmtDate(n.createdAt, "HH:mm"), day: dayjs(n.createdAt), readAt: n.readAt ? n.readAt.toISOString() : null, sender: n.sender?.name ?? null, family: familyOf(n) }));
  const unread = rows.filter((r) => !r.readAt).length;
  const counts = rows.reduce<Record<string, number>>((acc, r) => ((acc[r.family] = (acc[r.family] ?? 0) + 1), acc), {});
  const current: Filter = (["toutes", "non-lues", ...Object.keys(FAMILY_LABEL)] as Filter[]).includes(filtre as Filter) ? (filtre as Filter) : "toutes";
  const kept = rows.filter((r) => (current === "toutes" ? true : current === "non-lues" ? !r.readAt : r.family === current));
  // Groupes par jour ; on retire l'objet dayjs avant de passer au composant client (sérialisation).
  const groups: { day: string; items: Omit<(typeof kept)[number], "day">[] }[] = [];
  for (const { day, ...r } of kept) {
    const label = day.isSame(dayjs(), "day") ? "Aujourd'hui" : day.isSame(dayjs().subtract(1, "day"), "day") ? "Hier" : fmtDate(day, "dddd D MMMM");
    const last = groups[groups.length - 1];
    if (last && last.day === label) last.items.push(r); else groups.push({ day: label, items: [r] });
  }
  const chip = (f: Filter, label: string, count?: number) => (
    <Link key={f} href={f === "toutes" ? "/notifications" : `/notifications?filtre=${f}`} aria-current={current === f ? "page" : undefined} data-testid={`filtre-${f}`} className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm transition-colors", current === f ? "border-primary bg-primary text-white" : "bg-card hover:bg-muted")}>
      {label}{count !== undefined && count > 0 && <span className="ml-1 opacity-70">{count}</span>}
    </Link>
  );
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Notifications" subtitle={`Ce qui vous a été adressé : relances, remarques, demandes, échéances de vos projets. Chaque ligne mène à l'écran où ${le(V.action)} se fait.`} actions={<MarkAllRead disabled={unread === 0} />} />
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {chip("toutes", "Toutes")}
        {chip("non-lues", "Non lues", unread)}
        {(Object.keys(FAMILY_LABEL) as NotificationFamily[]).filter((f) => counts[f]).map((f) => chip(f, FAMILY_LABEL[f], counts[f]))}
      </div>
      {kept.length === 0 ? (
        <EmptyState title={current === "non-lues" ? "Tout est lu" : "Aucune notification"} hint="Les relances, remarques et échéances arrivent ici — par mail en V1." icon={<Bell className="size-5" />} />
      ) : (
        <NotificationList groups={groups} />
      )}
    </div>
  );
}
