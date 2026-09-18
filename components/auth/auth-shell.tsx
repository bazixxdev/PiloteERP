import type { ReactNode } from "react";
import { Logo } from "@/components/shell/logo";

// Cadre des pages hors session (connexion, mot de passe) : le logo, une carte, rien d'autre.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo variant="color" className="mx-auto mb-6 w-[170px]" />
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.5px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">Pilote · outil de pilotage des projets · prototype</p>
      </div>
    </div>
  );
}
