"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { switchPerson } from "@/app/actions/session";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type P = { id: string; name: string; role: string; roleLabel: string; poleName: string | null };

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");

// Avatar à initiales (V2) ; les rôles CODIR reçoivent la teinte « mousse ».
export function Avatar({ name, role, className }: { name: string; role?: string; className?: string }) {
  const moss = role === "director" || role === "raf" || role === "pole_lead";
  return <span className={`inline-flex size-[27px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${moss ? "bg-[#dcecf2] text-mint" : "bg-[#e6ddcf] text-[#574f3f]"} ${className ?? ""}`} aria-hidden>{initials(name)}</span>;
}

export function PersonSwitcher({ people, current }: { people: P[]; current: P }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-60" data-testid="person-switcher" disabled={pending} title="Changer de personne (et de droits)">
          <span className="hidden sm:inline"><b className="font-semibold text-foreground">{current.name}</b> · {current.roleLabel}</span>
          <Avatar name={current.name} role={current.role} />
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Je suis… (change la personne et ses droits)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {people.map((p) => (
          <DropdownMenuItem
            key={p.id}
            data-testid={`person-${p.id}`}
            onSelect={() => start(async () => { await switchPerson(p.id); router.refresh(); })}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2"><Avatar name={p.name} role={p.role} className="size-6 text-[9px]" /><span className={p.id === current.id ? "font-semibold" : ""}>{p.name}</span></span>
            <span className="text-xs text-muted-foreground">{p.roleLabel}{p.poleName ? ` · ${p.poleName}` : ""}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
