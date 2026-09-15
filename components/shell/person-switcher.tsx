"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserCircle, Users, Search } from "lucide-react";
import { switchPerson } from "@/app/actions/session";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type P = { id: string; name: string; role: string; roleLabel: string; poleName: string | null };

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");

// Avatar à initiales (V2) ; les rôles CODIR reçoivent la teinte « mousse ».
export function Avatar({ name, role, className }: { name: string; role?: string; className?: string }) {
  const moss = role === "director" || role === "raf" || role === "pole_lead";
  return <span className={cn("inline-flex size-[27px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold", moss ? "bg-[#dcecf2] text-mint" : "bg-[#e6ddcf] text-[#574f3f]", className)} aria-hidden>{initials(name)}</span>;
}

// Menu utilisateur : mon compte, admin (selon les droits), changement d'utilisateur (prototype) et déconnexion.
// Sans authentification réelle, la déconnexion ramène au choix de la personne ; en V1, ce sera le compte Microsoft.
export function PersonSwitcher({ people, current, canAdmin }: { people: P[]; current: P; canAdmin: boolean }) {
  const [chooser, setChooser] = useState<"switch" | "logout" | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted" data-testid="person-switcher" title="Menu utilisateur">
            <span className="hidden sm:inline"><b className="font-semibold text-foreground">{current.name}</b> · {current.roleLabel}</span>
            <Avatar name={current.name} role={current.role} />
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
            <Avatar name={current.name} role={current.role} className="size-8 text-[11px]" />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{current.name}</span><span className="block truncate text-xs text-muted-foreground">{current.roleLabel}{current.poleName ? ` · ${current.poleName}` : ""}</span></span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/compte" data-testid="menu-account"><UserCircle />Mon compte</Link></DropdownMenuItem>
          {canAdmin && <DropdownMenuItem asChild><Link href="/admin" data-testid="menu-admin"><Settings />Admin</Link></DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setChooser("switch")} data-testid="menu-switch"><Users />Changer d'utilisateur<span className="ml-auto rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">proto</span></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setChooser("logout")} data-testid="menu-logout"><LogOut />Se déconnecter</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PersonChooser open={chooser !== null} mode={chooser ?? "switch"} onOpenChange={(o) => { if (!o) setChooser(null); }} people={people} current={current} />
    </>
  );
}

// Modale « Je suis… » : recherche par nom, rôle ou pôle ; un clic change la personne et ses droits.
function PersonChooser({ open, mode, onOpenChange, people, current }: { open: boolean; mode: "switch" | "logout"; onOpenChange: (o: boolean) => void; people: P[]; current: P }) {
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const list = useMemo(() => { const n = norm(q.trim()); return n ? people.filter((p) => norm(`${p.name} ${p.roleLabel} ${p.poleName ?? ""}`).includes(n)) : people; }, [q, people]);
  const pick = (id: string) => start(async () => { await switchPerson(id); onOpenChange(false); setQ(""); router.refresh(); });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(""); }}>
      <DialogContent className="sm:max-w-md" data-testid="person-chooser">
        <DialogHeader>
          <DialogTitle>{mode === "logout" ? "Se déconnecter" : "Changer d'utilisateur"}</DialogTitle>
          <DialogDescription>
            {mode === "logout"
              ? "Le prototype n'a pas de compte : en V1, la déconnexion ramène à la page de connexion Microsoft. Ici, choisissez simplement qui vous êtes."
              : "Mode prototype : choisissez la personne dont vous prenez la place, avec ses droits."}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, rôle ou pôle…" className="pl-8" aria-label="Rechercher une personne" data-testid="person-search" />
        </div>
        <ul className="-mx-1 max-h-[50vh] overflow-y-auto" role="listbox" aria-label="Personnes">
          {list.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">Personne ne correspond.</li>}
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button" role="option" aria-selected={p.id === current.id} disabled={pending} data-testid={`person-${p.id}`}
                onClick={() => pick(p.id)}
                className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-60", p.id === current.id && "bg-info-soft")}
              >
                <Avatar name={p.name} role={p.role} className="size-7 text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate", p.id === current.id && "font-semibold")}>{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.roleLabel}{p.poleName ? ` · ${p.poleName}` : ""}</span>
                </span>
                {p.id === current.id && <span className="text-[10px] font-semibold text-primary">actuel</span>}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
