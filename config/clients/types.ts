// Ce qui est propre à un client (docs/produit.md, lot I) : l'habillage livré avec le code. Le code métier n'importe jamais
// `key` ; il passe par lib/vocab.ts (les mots) et lib/branding.ts (nom, logos, thème, polices).
export type Word = { one: string; many: string; gender: "m" | "f" };

export type Vocab = {
  projet: Word; // ce qui se répète d'une année sur l'autre
  edition: Word; // le projet une année donnée — l'objet piloté
  action: Word; // un jalon daté dans l'édition
  pole: Word; // l'équipe d'une personne
  codir: Word; // l'instance qui décide
  raf: Word; // la personne qui suit les factures
  direction: Word; // la personne qui tranche
  pilote: Word; // la personne responsable d'un projet
};

export type Img = { src: string; width: number; height: number };

// Un token par variable de app/globals.css :root ; ce qui manque garde la valeur produit.
export type Theme = Partial<
  Record<
    | "background" | "foreground" | "card" | "card-foreground" | "popover" | "popover-foreground"
    | "primary" | "primary-foreground" | "secondary" | "secondary-foreground" | "muted" | "muted-foreground"
    | "accent" | "accent-foreground" | "destructive" | "border" | "input" | "ring"
    | "coral" | "coral-foreground" | "mint" | "mint-soft" | "mint-pale" | "sand"
    | "warning" | "warning-foreground" | "warning-soft" | "danger" | "danger-soft" | "info-soft"
    | "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "radius"
    | "sidebar" | "sidebar-foreground" | "sidebar-primary" | "sidebar-primary-foreground"
    | "sidebar-accent" | "sidebar-accent-foreground" | "sidebar-border" | "sidebar-ring" | "sky" | "sky-strong",
    string
  >
>;

// Une pile de polices installées, ou une police Google chargée par next/font (nom exact de Google Fonts).
export type FontSpec = { stack: string } | { google: string; weights: ("400" | "600" | "700")[]; fallback: string };

export type Client = {
  key: string;
  shortName: string;
  longName: string;
  orgGender: "m" | "f";
  logos: { color: Img; white: Img; mark: Img; favicon: string };
  theme: Theme;
  fonts: { titles: FontSpec; sans: FontSpec };
  modules: string; // Settings.modules posé au seed
  settings: { serverPathTemplate: string; billingEmail: string; billingNote?: string };
  vocab: Vocab;
};
