import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/shell/logo";
import { branding } from "@/lib/branding";
import { getLogos, getLoginPalette } from "@/lib/branding-db";
import { brandStyle } from "@/lib/brand-palette";
import { V, pl } from "@/lib/vocab";
import "./brand-aura.css";

// Pages hors session (spec connexion du 27/09) : à gauche, un panneau lumineux aux couleurs du logo (palette calculée à
// l'envoi du logo, posée ici côté serveur, filtrée par brandStyle) ; à droite, le logo et le formulaire. Composants et polices
// du projet inchangés : seules les couleurs --primary et --ring viennent du logo, sur cette page seulement.
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const b = branding();
  const [logos, palette] = await Promise.all([getLogos(), getLoginPalette()]);
  return (
    <div className="auth-page" style={brandStyle(palette) as CSSProperties} data-testid="auth-page">
      <aside className="brand-aura" data-testid="brand-aura">
        <span className="brand-aura__blob brand-aura__blob--1" aria-hidden="true" />
        <span className="brand-aura__blob brand-aura__blob--2" aria-hidden="true" />
        <span className="brand-aura__blob brand-aura__blob--3" aria-hidden="true" />
        <span className="brand-aura__blob brand-aura__blob--4" aria-hidden="true" />
        <div className="pitch">
          <span className="pitch__eyebrow">{b.longName}</span>
          <p className="pitch__title">{`Piloter vos ${pl(V.projet)} d'économie sociale et solidaire, de l'idée au bilan.`}</p>
        </div>
      </aside>
      <section className="auth-side">
        <main className="auth-side__main">
          <Logo img={logos.color} className="auth-logo" />
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.5px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </main>
        <footer className="auth-side__foot"><span>© {new Date().getFullYear()} {b.longName}</span><span>Pilote</span></footer>
      </section>
    </div>
  );
}
