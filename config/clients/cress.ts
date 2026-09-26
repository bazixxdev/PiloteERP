import type { Client } from "./types";

export const cress: Client = {
  key: "cress",
  shortName: "CRESS",
  longName: "CRESS Centre-Val de Loire",
  orgGender: "f",
  logos: {
    color: { src: "/clients/cress/logo.png", width: 465, height: 187 },
    white: { src: "/clients/cress/logo-white.png", width: 465, height: 187 },
    mark: { src: "/clients/cress/mark.png", width: 190, height: 177 },
    favicon: "/clients/cress/favicon.png",
  },
  // Charte V2 (maquette du 13/09/2026, inspirée du site CRESS Pays de la Loire) — mêmes valeurs que le thème produit.
  theme: {
    background: "#f7f7f3", foreground: "#243d49", card: "#ffffff", "card-foreground": "#243d49",
    popover: "#ffffff", "popover-foreground": "#243d49",
    primary: "#1b6a8a", "primary-foreground": "#ffffff", secondary: "#e6f0f5", "secondary-foreground": "#1b6a8a",
    muted: "#efefea", "muted-foreground": "#5e6c72", accent: "#e5f1eb", "accent-foreground": "#226552",
    destructive: "#a24533", border: "#dce3e5", input: "#b8c1b4", ring: "#1b6a8a",
    coral: "#ea5427", "coral-foreground": "#ffffff", mint: "#226552", "mint-soft": "#e5f1eb", "mint-pale": "#85c8b5", sand: "#f8e9c6",
    warning: "#8c601b", "warning-foreground": "#8c601b", "warning-soft": "#faf0d8", danger: "#a24533", "danger-soft": "#fae9e2", "info-soft": "#e6f0f5",
    "chart-1": "#1b6a8a", "chart-2": "#ea5427", "chart-3": "#85c8b5", "chart-4": "#8c601b", "chart-5": "#5e9bb8",
    sidebar: "#e9f3f8", "sidebar-foreground": "#5e6c72", "sidebar-primary": "#1b6a8a", "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#d7e9f2", "sidebar-accent-foreground": "#1b6a8a", "sidebar-border": "#d3e3ea", "sidebar-ring": "#1b6a8a",
    sky: "#cfe6f2", "sky-strong": "#a9d3e6",
  },
  fonts: {
    titles: { stack: '"Trebuchet MS", "Segoe UI", Arial, sans-serif' },
    sans: { stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
  },
  modules: "veille,adherents,tresorerie,materiel",
  settings: {
    serverPathTemplate: "\\\\cress\\Partage\\Action\\{code}\\{annee}",
    billingEmail: "factures@cress-cvl.example",
  },
  vocab: {
    projet: { one: "projet", many: "projets", gender: "m" },
    edition: { one: "année", many: "années", gender: "f" },
    action: { one: "action", many: "actions", gender: "f" },
    pole: { one: "pôle", many: "pôles", gender: "m" },
    codir: { one: "CODIR", many: "CODIR", gender: "m" },
    raf: { one: "RAF", many: "RAF", gender: "f" },
    direction: { one: "direction", many: "directions", gender: "f" },
    pilote: { one: "pilote", many: "pilotes", gender: "m" },
  },
};
