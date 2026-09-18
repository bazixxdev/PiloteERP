// Point d'entrée unique de l'habillage (lot I) : aujourd'hui le fichier client, demain le fichier surchargé par ce que la base
// contiendra (écran admin › Apparence, feuille de route). Le layout, le logo et le favicon ne lisent que ceci.
import { client } from "@/config/clients";
import type { FontSpec, Img, Theme } from "@/config/clients/types";

export type Branding = {
  shortName: string;
  longName: string;
  logos: { color: Img; white: Img; mark: Img; favicon: string };
  themeCss: string; // « --primary: #…; --sidebar: #…; » à poser dans :root
  fonts: { titles: FontSpec; sans: FontSpec };
};

export function themeToCss(theme: Theme): string {
  return Object.entries(theme)
    .map(([k, v]) => `--${k}: ${v};`)
    .join(" ");
}

export function branding(): Branding {
  return {
    shortName: client.shortName,
    longName: client.longName,
    logos: client.logos,
    themeCss: themeToCss(client.theme),
    fonts: client.fonts,
  };
}

// Pile CSS d'une police : la pile locale telle quelle, ou la police Google suivie de son repli.
export function fontStack(spec: FontSpec): string {
  return "stack" in spec ? spec.stack : `"${spec.google}", ${spec.fallback}`;
}
