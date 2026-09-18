import { withBase } from "@/lib/base-path";
import { branding } from "@/lib/branding";
import { cn } from "@/lib/utils";

// Le logo du client (lot I) : couleur (barre latérale, connexion), blanc (fond sombre : projection, bandeaux), marque seule
// (mobile, barre repliée). PNG statique servi tel quel : l'optimiseur d'images ne gère pas le basePath.
export function Logo({ variant, className, decorative = false }: { variant: "color" | "white" | "mark"; className?: string; decorative?: boolean }) {
  const b = branding();
  const img = b.logos[variant];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={withBase(img.src)} alt={decorative ? "" : b.longName} width={img.width} height={img.height} className={cn("h-auto", className)} />;
}
