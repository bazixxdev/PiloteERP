"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/common/searchable-select";
import { createRole, deleteRole, resetRole, setRolePermission, updateRole } from "@/app/actions/roles";
import { PERMISSION_MODULES, PERMISSIONS, type PermissionModule } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { V, son, pl } from "@/lib/vocab";

type R = { ok: true; data?: unknown } | { ok: false; error: string };
export type RoleView = { code: string; label: string; description: string; system: boolean; validationLevel: number; permissions: string[]; count: number };

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: (r: R) => void) => start(async () => { const r = await fn(); if (!r.ok) { toast.error(r.error); return; } after?.(r); router.refresh(); });
  return { pending, run };
}

const LEVELS = [
  { value: "0", label: "0 · n'approuve rien" },
  { value: "1", label: `1 · ses ${pl(V.edition)}` },
  { value: "2", label: `2 · ${son(V.pole)}` },
  { value: "3", label: "3 · partout" },
];

// Matrice rôles × droits, groupée par module (lot F2). Une case = un droit d'un rôle ; la sauvegarde est immédiate.
export function RolesMatrix({ roles, readOnly }: { roles: RoleView[]; readOnly: boolean }) {
  const { pending, run } = useRun();
  // État local pour une case réactive ; un rôle qui vient d'arriver (créé, rafraîchi) se lit dans les props tant qu'on n'y a pas touché.
  const [local, setLocal] = useState<Record<string, string[]>>({});
  const current = (code: string) => local[code] ?? roles.find((r) => r.code === code)?.permissions ?? [];
  const on = (code: string, key: string) => current(code).includes(key);
  const toggle = (code: string, key: string, next: boolean) => {
    const before = current(code);
    setLocal((s) => ({ ...s, [code]: next ? [...before, key] : before.filter((k) => k !== key) }));
    run(() => setRolePermission(code, key, next).then((r) => { if (!r.ok) setLocal((s) => ({ ...s, [code]: before })); return r; }));
  };
  const modules = Object.keys(PERMISSION_MODULES) as PermissionModule[];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="roles-matrix">
        <thead className="sticky top-0 z-10 bg-card text-left text-[10px] font-semibold text-muted-foreground">
          <tr>
            <th className="py-1.5 pr-2">Droit</th>
            {roles.map((r) => <th key={r.code} className="px-1 py-1.5 text-center align-bottom"><span className="inline-block max-w-[7rem] leading-tight">{r.label}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            [
              <tr key={`m-${m}`} className="bg-muted/40"><td colSpan={roles.length + 1} className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{PERMISSION_MODULES[m]}</td></tr>,
              ...PERMISSIONS.filter((p) => p.module === m).map((p) => (
                <tr key={p.key} className="border-t border-border/60 align-top" data-testid={`perm-row-${p.key}`}>
                  <td className="py-1.5 pr-2"><div className="font-medium">{p.label}</div><div className="max-w-[26rem] text-[11px] text-muted-foreground">{p.help}</div></td>
                  {roles.map((r) => (
                    <td key={r.code} className="px-1 py-1.5 text-center">
                      <input type="checkbox" checked={on(r.code, p.key)} disabled={pending || readOnly} onChange={(e) => toggle(r.code, p.key, e.target.checked)} className="size-4 rounded border-border accent-primary" aria-label={`${p.label} — ${r.label}`} data-testid={`perm-${r.code}-${p.key}`} />
                    </td>
                  ))}
                </tr>
              )),
            ]
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Carte d'un rôle : libellé, description, niveau de validation, personnes qui le portent, copier / remettre / supprimer.
export function RoleCard({ role, readOnly }: { role: RoleView; readOnly: boolean }) {
  const { pending, run } = useRun();
  const [label, setLabel] = useState(role.label);
  const [description, setDescription] = useState(role.description);
  return (
    <div className={cn("grid gap-1.5 rounded-md border px-3 py-2.5", role.system ? "bg-card" : "bg-muted/30")} data-testid={`role-card-${role.code}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={label} disabled={readOnly || pending} onChange={(e) => setLabel(e.target.value)} onBlur={() => { if (label.trim() !== role.label) run(() => updateRole(role.code, { label })); }} className="h-8 max-w-[16rem] font-semibold" aria-label="Libellé du rôle" data-testid={`role-label-${role.code}`} />
        <span className="text-[10px] text-muted-foreground">{role.system ? "rôle système" : `code ${role.code}`} · {role.count} personne{role.count > 1 ? "s" : ""}</span>
        <div className="ml-auto flex items-center gap-1">
          {!readOnly && <CreateRoleButton copyOf={role.code} label={`Copier « ${role.label} »`} icon={<Copy />} />}
          {!readOnly && role.system && <Button size="xs" variant="ghost" disabled={pending} title="Remettre les droits d'origine" onClick={() => run(() => resetRole(role.code), () => toast.success("Droits d'origine remis"))} data-testid={`role-reset-${role.code}`}><RotateCcw />Origine</Button>}
          {!readOnly && !role.system && <Button size="xs" variant="ghost" disabled={pending || role.count > 0} title={role.count ? "Encore porté par quelqu'un" : "Supprimer ce rôle"} onClick={() => run(() => deleteRole(role.code), () => toast.success("Rôle supprimé"))} data-testid={`role-delete-${role.code}`}><Trash2 />Supprimer</Button>}
        </div>
      </div>
      <Input value={description} disabled={readOnly || pending} placeholder="En une phrase : à quoi sert ce rôle" onChange={(e) => setDescription(e.target.value)} onBlur={() => { if (description.trim() !== role.description) run(() => updateRole(role.code, { description })); }} className="h-8 text-xs" aria-label="Description du rôle" />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">Valide au niveau
        <Select value={String(role.validationLevel)} disabled={readOnly || pending} onChange={(e) => run(() => updateRole(role.code, { validationLevel: Number(e.target.value) }))} className="h-7 text-xs" aria-label={`Niveau de validation — ${role.label}`} data-testid={`role-level-${role.code}`}>
          {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </Select>
      </label>
    </div>
  );
}

// Créer un rôle (copié d'un autre ou vide) : un bouton, un petit panneau avec le nom — même patron que les autres ajouts.
export function CreateRoleButton({ copyOf, label, icon }: { copyOf?: string | null; label?: string; icon?: React.ReactNode }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button size="xs" variant={copyOf ? "ghost" : "outline"} data-testid={copyOf ? `role-copy-${copyOf}` : "role-add-open"}>{icon}{label ?? "Nouveau rôle"}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => createRole(name, copyOf), () => { toast.success("Rôle créé"); setName(""); setOpen(false); }); }}>
          <div className="text-xs text-muted-foreground">{copyOf ? "Mêmes droits et même niveau que le rôle copié ; vous les ajustez ensuite." : "Sans aucun droit : vous les cochez ensuite dans la matrice."}</div>
          <Input autoFocus value={name} placeholder="Nom du rôle" onChange={(e) => setName(e.target.value)} className="h-8" data-testid="role-add-input" />
          <Button type="submit" size="sm" disabled={pending || !name.trim()} data-testid="role-add-submit">Créer</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
