"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "@/app/actions/notifications";
import type { NotificationRow } from "@/components/shell/notifications-bell";

// Liste du centre de notifications : cliquer une ligne l'ouvre et la marque lue ; le point bleu signale le non-lu.
// Une notification ne porte jamais l'action : elle mène à l'écran où l'action se fait (demandes, temps, édition…).
export function NotificationList({ groups }: { groups: { day: string; items: (NotificationRow & { family: string })[] }[] }) {
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-5" data-testid="notification-list">
      {groups.map((g) => (
        <section key={g.day}>
          <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.day}</h2>
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {g.items.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/ma-semaine"}
                data-testid="notification-row"
                data-unread={!n.readAt || undefined}
                onClick={() => { if (!n.readAt) start(async () => { await markNotificationsRead([n.id]); router.refresh(); }); }}
                className={cn("flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/60", n.readAt && "text-muted-foreground")}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block", !n.readAt && "font-medium text-foreground")}>{n.title}</span>
                  {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                </span>
                <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                  <span className="block">{n.createdAt}</span>
                  {n.sender && <span className="block">{n.sender}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" data-testid="mark-all-read" disabled={disabled || pending} className="h-8 rounded-full border bg-card px-3 text-sm hover:bg-muted disabled:opacity-50" onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })}>
      Tout marquer comme lu
    </button>
  );
}
