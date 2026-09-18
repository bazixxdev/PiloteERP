"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, LogOut, Settings, UserCircle, Users, Search } from "lucide-react";
import { switchPerson } from "@/app/actions/session";
import { authClient } from "@/lib/auth-client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { V } from "@/lib/vocab";

type P = { id: string; name: string; role: string; roleLabel: string; poleName: string | null; codir: boolean };

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");

// Avatar à initiales (V2) ; bleu ciel pour qui siège au CODIR, sable pour les autres (maquette du 17/09).
export function Avatar({ name, codir, className }: { name: string; codir?: boolean; className?: string }) {
  return <span className={cn("inline-flex size-[27px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold", codir ? "bg-sky-strong text-primary" : "bg-[#e6ddcf] text-[#574f3f]", className)} aria-hidden>{initials(name)}</span>;
}

// Menu utilisateur : mon compte, admin (selon les droits), « Changer d'utilisateur » en mode démo seulement, et la déconnexion
// (lot F : session better-auth ; on revient à la page de connexion).
// Deux habillages (maquette du 17/09) : `sidebar` = bloc bleu ciel en bas de la barre latérale, menu qui s'ouvre vers le haut
// (`rail` : l'avatar seul) ; `topbar` = avatar compact dans la barre haute (mobile, où la barre latérale n'existe pas).
export function PersonSwitcher({ people, current, canAdmin, demo, account, variant = "sidebar", rail = false, testId = "person-switcher" }: { people: P[]; current: P; canAdmin: boolean; demo: boolean; account: string | null; variant?: "sidebar" | "topbar"; rail?: boolean; testId?: string }) {
  const [chooser, setChooser] = useState<"switch" | null>(null);
  const router = useRouter();
  const [pendingOut, startOut] = useTransition();
  const logout = () => startOut(async () => { await authClient.signOut(); router.push("/connexion"); router.refresh(); });
  const sidebar = variant === "sidebar";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {sidebar ? (
            <button
              type="button" data-testid={testId} title="Menu utilisateur"
              className={cn(
                "flex items-center gap-2.5 rounded-lg bg-sky text-left transition-colors hover:bg-sky-strong/70 data-[state=open]:bg-sky-strong/70",
                rail ? "size-11 justify-center p-0" : "size-11 justify-center p-0 lg:h-auto lg:w-full lg:justify-start lg:px-2.5 lg:py-2",
              )}
            >
              <Avatar name={current.name} codir className="size-9 text-[12px]" />
              <span className={cn("min-w-0 flex-1", rail ? "hidden" : "hidden lg:block")}>
                <span className="block truncate text-[13px] font-semibold text-foreground">{current.name}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">{current.roleLabel}</span>
              </span>
              <ChevronUp className={cn("size-4 shrink-0 text-muted-foreground", rail ? "hidden" : "hidden lg:block")} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="flex items-center gap-1 rounded-md p-1 hover:bg-muted" data-testid={testId} title="Menu utilisateur">
              <Avatar name={current.name} codir={current.codir} />
              <ChevronDown className="size-3 opacity-60" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side={sidebar ? "top" : "bottom"} align={sidebar ? "start" : "end"} sideOffset={8} className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
            <Avatar name={current.name} codir={current.codir} className="size-8 text-[11px]" />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{current.name}</span><span className="block truncate text-xs text-muted-foreground">{current.roleLabel}{current.poleName ? ` · ${current.poleName}` : ""}</span>{account && account !== current.name && <span className="block truncate text-[10px] text-muted-foreground">connecté·e : {account}</span>}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/compte" data-testid="menu-account"><UserCircle />Mon compte</Link></DropdownMenuItem>
          {canAdmin && <DropdownMenuItem asChild><Link href="/admin" data-testid="menu-admin"><Settings />Admin</Link></DropdownMenuItem>}
          <DropdownMenuSeparator />
          {demo && <DropdownMenuItem onSelect={() => setChooser("switch")} data-testid="menu-switch"><Users />Changer d'utilisateur<span className="ml-auto rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">démo</span></DropdownMenuItem>}
          <DropdownMenuItem onSelect={logout} disabled={pendingOut} data-testid="menu-logout"><LogOut />Se déconnecter</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {demo && <PersonChooser open={chooser !== null} onOpenChange={(o) => { if (!o) setChooser(null); }} people={people} current={current} />}
    </>
  );
}

// Modale « Je suis… » : recherche par nom, rôle ou pôle ; un clic change la personne et ses droits.
function PersonChooser({ open, onOpenChange, people, current }: { open: boolean; onOpenChange: (o: boolean) => void; people: P[]; current: P }) {
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
          <DialogTitle>Changer d&apos;utilisateur</DialogTitle>
          <DialogDescription>Mode démo : choisissez la personne dont vous prenez la place, avec ses droits. Hors démo, chacun se connecte avec son compte.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Nom, rôle ou ${V.pole.one}…`} className="pl-8" aria-label="Rechercher une personne" data-testid="person-search" />
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
                <Avatar name={p.name} codir={p.codir} className="size-7 text-[10px]" />
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
