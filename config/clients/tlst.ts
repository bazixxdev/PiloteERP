import type { Client } from "./types";

// Tiers-Lieu Nourricier du Sud Touraine (Loches). Palette de départ : verts / terre d'un tiers-lieu nourricier (le vert forêt
// d'erp-tlst), à corriger par Gaël ; logos = placeholders générés par scripts/make-brand-images.py, à remplacer par le vrai logo.
export const tlst: Client = {
  key: "tlst",
  shortName: "TLST",
  longName: "Tiers-Lieu Nourricier du Sud Touraine",
  orgGender: "m",
  logos: {
    color: { src: "/clients/tlst/logo.png", width: 465, height: 187 },
    white: { src: "/clients/tlst/logo-white.png", width: 465, height: 187 },
    mark: { src: "/clients/tlst/mark.png", width: 190, height: 177 },
    favicon: "/clients/tlst/favicon.png",
  },
  theme: {
    background: "#f6f5ef", foreground: "#26332a", card: "#ffffff", "card-foreground": "#26332a",
    popover: "#ffffff", "popover-foreground": "#26332a",
    primary: "#3f6b4a", "primary-foreground": "#ffffff", secondary: "#e7efe6", "secondary-foreground": "#3f6b4a",
    muted: "#eeede4", "muted-foreground": "#5f6b62", accent: "#f2ead6", "accent-foreground": "#7a5a1e",
    destructive: "#9c4a2e", border: "#dcdfd3", input: "#b9c0b0", ring: "#3f6b4a",
    coral: "#c8742f", "coral-foreground": "#ffffff", mint: "#3f6b4a", "mint-soft": "#e7efe6", "mint-pale": "#9fc4a5", sand: "#f2ead6",
    warning: "#7a5a1e", "warning-foreground": "#7a5a1e", "warning-soft": "#f7f0dc", danger: "#9c4a2e", "danger-soft": "#f6e7df", "info-soft": "#e7efe6",
    "chart-1": "#3f6b4a", "chart-2": "#c8742f", "chart-3": "#9fc4a5", "chart-4": "#7a5a1e", "chart-5": "#6f8f7a",
    sidebar: "#eaf0e6", "sidebar-foreground": "#5f6b62", "sidebar-primary": "#3f6b4a", "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#d9e5d6", "sidebar-accent-foreground": "#3f6b4a", "sidebar-border": "#d3dccd", "sidebar-ring": "#3f6b4a",
    sky: "#d9e5d6", "sky-strong": "#b7cdb3",
  },
  fonts: {
    titles: { google: "Nunito", weights: ["600", "700"], fallback: '"Segoe UI", Arial, sans-serif' },
    sans: { stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
  },
  modules: "veille,adherents,tresorerie,materiel",
  settings: {
    serverPathTemplate: "\\\\nas\\Partage\\Actions\\{code}\\{annee}",
    billingEmail: "compta@tlst.example",
  },
  vocab: {
    projet: { one: "projet", many: "projets", gender: "m" },
    edition: { one: "action", many: "actions", gender: "f" },
    action: { one: "étape", many: "étapes", gender: "f" },
    pole: { one: "équipe", many: "équipes", gender: "f" },
    codir: { one: "bureau", many: "bureaux", gender: "m" },
    raf: { one: "trésorier·e", many: "trésorier·es", gender: "f" },
    direction: { one: "coordination", many: "coordinations", gender: "f" },
    pilote: { one: "responsable", many: "responsables", gender: "m" },
  },
};
