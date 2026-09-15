"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { iconFor } from "./section-icons";
import { cn } from "@/lib/utils";

export type QuickItem = { id: string; title: string; sub: string; href: string; color?: string | null; done?: boolean };

// Menus rapides de la barre haute (retour du 15/09) : Notes et Tâches à portée de main partout — les dernières,
// la liste complète, et un « + » à côté du bouton qui ouvre directement l'ajout (pas de doublon dans le déroulant). N'apparaissent que si le module est activé.
export function QuickMenu({ kind, label, items, allHref, addHref, addLabel, emptyText }: { kind: "notes" | "tasks"; label: string; items: QuickItem[]; allHref: string; addHref: string; addLabel: string; emptyText: string }) {
  const router = useRouter();
  const active = usePathname().startsWith(allHref);
  const Icon = iconFor(allHref)!;
  return (
    <div className="hidden items-center md:flex" data-testid={`quick-${kind}`}>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn("inline-flex h-8 items-center gap-1.5 rounded-l-md border border-r-0 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground", active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground")} aria-label={`${label} : les dernières`} aria-current={active ? "page" : undefined} data-testid={`quick-${kind}-open`}>
          <Icon className="size-4" /><span className="hidden lg:inline">{label}</span><ChevronDown className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">{items.length ? `Les dernières · ${label.toLowerCase()}` : label}</DropdownMenuLabel>
          {items.length === 0 && <div className="px-2 pb-2 text-xs text-muted-foreground">{emptyText}</div>}
          {items.map((it) => (
            <DropdownMenuItem key={it.id} onSelect={() => router.push(it.href)} className="grid cursor-pointer gap-0.5 py-1.5" data-testid={`quick-${kind}-item`}>
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                {it.color && <span className="size-2 shrink-0 rounded-full" style={{ background: it.color }} aria-hidden />}
                <span className={cn("truncate", it.done && "text-muted-foreground line-through")}>{it.title}</span>
              </span>
              <span className="truncate text-[10px] text-muted-foreground">{it.sub}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push(allHref)} className="cursor-pointer text-xs" data-testid={`quick-${kind}-all`}>{kind === "notes" ? "Toutes mes notes" : "Toutes mes tâches"} →</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Link href={addHref} title={addLabel} aria-label={addLabel} className="inline-flex h-8 items-center rounded-r-md border px-1.5 text-primary hover:bg-info-soft" data-testid={`quick-${kind}-add`}><Plus className="size-4" /></Link>
    </div>
  );
}
