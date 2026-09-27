"use client";

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { withBase } from "@/lib/base-path";
import { brandStyle, type BrandPalette } from "@/lib/brand-palette";
import { deleteBrandLogo, uploadBrandLogo } from "@/app/actions/brand";
import { Button } from "@/components/ui/button";
import type { BrandKind } from "@/lib/brand-images";
import "@/components/auth/brand-aura.css";

type Big = { url: string; palette: BrandPalette } | null;
type Small = { url: string } | null;

// Téléversement des logos (Admin › Paramètres, spec connexion § 3) : la page ne rend ce composant que si canAdmin(me)
// (app/admin/page.tsx). L'aperçu du panneau réutilise le vrai panneau de connexion (composants/auth/brand-aura.css, tâche
// 5) : mêmes taches animées, réduites à ~240×120, aux couleurs du grand logo.
export function BrandLogos({ logo, logoSmall }: { logo: Big; logoSmall: Small }) {
  return (
    <div className="grid gap-6">
      <LogoField kind="logo" title="Grand logo" hint="Page de connexion, barre latérale dépliée." current={logo?.url ?? null}>
        {logo && (
          <div className="mt-3 grid gap-2">
            <div className="flex flex-wrap gap-1.5">
              {logo.palette.source.map((hex) => (
                <span key={hex} data-testid="brand-swatch" className="size-5 rounded-full border" style={{ background: hex }} title={hex} />
              ))}
            </div>
            <div
              className="brand-aura"
              style={{ position: "relative", top: "auto", height: 120, width: 240, margin: 0, ...brandStyle(logo.palette) } as CSSProperties}
              data-testid="brand-preview"
            >
              <span className="brand-aura__blob brand-aura__blob--1" aria-hidden="true" />
              <span className="brand-aura__blob brand-aura__blob--2" aria-hidden="true" />
              <span className="brand-aura__blob brand-aura__blob--3" aria-hidden="true" />
              <span className="brand-aura__blob brand-aura__blob--4" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground">Aperçu du panneau de connexion</p>
            <p className="text-xs text-muted-foreground">Un logo prévu pour fond sombre (texte blanc) disparaît sur le fond blanc de la page de connexion : préférez la version pour fond clair.</p>
          </div>
        )}
      </LogoField>
      <LogoField kind="logo_small" title="Petit logo" hint="Barre repliée, bandeau mobile, onglet du navigateur." current={logoSmall?.url ?? null} />
    </div>
  );
}

function LogoField({ kind, title, hint, current, children }: { kind: BrandKind; title: string; hint: string; current: string | null; children?: ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const suffix = kind === "logo_small" ? "-small" : "";

  const onChange = (file: File | null) => {
    if (!file) return;
    setError(null);
    start(async () => {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const result = await uploadBrandLogo(form);
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  };

  const onDelete = () => {
    setError(null);
    start(async () => {
      const result = await deleteBrandLogo(kind);
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  };

  return (
    <div className="grid gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={withBase(current)} alt={title} className="h-16 w-auto max-w-[200px] rounded-lg border bg-white object-contain p-1" />
      ) : (
        <p className="text-xs text-muted-foreground">Logo du fichier client.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={pending}
          data-testid={`brand-upload-logo${suffix}`}
          onChange={(e) => { onChange(e.target.files?.[0] ?? null); e.target.value = ""; }}
          className="text-xs"
        />
        {current && (
          <Button type="button" size="sm" variant="outline" disabled={pending} data-testid={`brand-delete-logo${suffix}`} onClick={onDelete}>
            Retirer
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {children}
    </div>
  );
}
