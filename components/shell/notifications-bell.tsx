"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markNotificationsRead } from "@/app/actions/notifications";

export type NotificationRow = { id: string; title: string; body: string | null; link: string | null; createdAt: string; readAt: string | null; sender: string | null };

// Cloche : notifications de la personne courante (relances de temps…). Marquer comme lu retire le badge, ne résout rien.
export function NotificationsBell({ items }: { items: NotificationRow[] }) {
  const unread = items.filter((n) => !n.readAt).length;
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} non lues)`} data-testid="bell">
          <Bell className="size-4" />
          {unread > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-coral px-1.5 text-[10px] font-semibold text-white" data-testid="bell-count">{unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unread > 0 && <button type="button" className="text-xs font-normal text-primary hover:underline" disabled={pending} onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })}>Tout marquer comme lu</button>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && <div className="px-2 py-3 text-sm text-muted-foreground">Aucune notification. Dans le prototype, les relances et rappels arrivent ici, pas par mail.</div>}
        {items.slice(0, 8).map((n) => (
          <DropdownMenuItem key={n.id} asChild className={n.readAt ? "opacity-60" : ""}>
            <Link href={n.link ?? "/ma-semaine"} onClick={() => { if (!n.readAt) start(async () => { await markNotificationsRead([n.id]); }); }} className="flex flex-col items-start gap-0.5" data-testid="notification-item">
              <span className="font-medium">{n.title}</span>
              {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
              <span className="text-[11px] text-muted-foreground">{n.createdAt}{n.sender ? ` · ${n.sender}` : ""}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
