import { withBase } from "@/lib/base-path";
import { branding } from "@/lib/branding";
import type { Img } from "@/config/clients/types";
import { cn } from "@/lib/utils";

// Le logo de l'organisation : couleur et marque sont choisies par le serveur (téléversées par un admin, sinon celles du
// fichier client — lib/branding-db.ts, getLogos) et transmises ici via `img` ; `white` (fond sombre : projection, bandeaux)
// reste toujours celle du fichier client, jamais téléversable (spec connexion § 3).
export function Logo({ img, variant, className, decorative = false }: { img?: Img; variant?: "white"; className?: string; decorative?: boolean }) {
  const b = branding();
  const src = variant === "white" ? b.logos.white : (img ?? b.logos.white);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={withBase(src.src)} alt={decorative ? "" : b.longName} width={src.width} height={src.height} className={cn("h-auto", className)} />;
}
