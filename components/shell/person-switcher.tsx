"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRound, ChevronDown } from "lucide-react";
import { switchPerson } from "@/app/actions/session";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type P = { id: string; name: string; role: string; roleLabel: string; poleName: string | null };

export function PersonSwitcher({ people, current }: { people: P[]; current: P }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full" data-testid="person-switcher" disabled={pending}>
          <UserRound className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">Je suis…</span>
          <span className="font-semibold">{current.name}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">{current.roleLabel}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Changer de personne (et de droits)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {people.map((p) => (
          <DropdownMenuItem
            key={p.id}
            data-testid={`person-${p.id}`}
            onSelect={() => start(async () => { await switchPerson(p.id); router.refresh(); })}
            className="flex items-center justify-between gap-2"
          >
            <span className={p.id === current.id ? "font-semibold" : ""}>{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.roleLabel}{p.poleName ? ` · ${p.poleName}` : ""}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
