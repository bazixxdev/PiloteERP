import type { Client } from "./types";

// Tiers-Lieu Nourricier du Sud Touraine (Loches). Logo réel (export du site, 2024 : blanc + jaune #ffb42b + vert #004214) dans
// public/clients/tlst/logo-white.png ; les autres images en sont dérivées par scripts/make-brand-images.py. Palette tirée du
// logo (vert profond, jaune en accent) — polices du site non connues (charte erp-tlst « à confirmer »), Nunito en attendant.
export const tlst: Client = {
  key: "tlst",
  shortName: "TLST",
  longName: "Tiers-Lieu Nourricier du Sud Touraine",
  orgGender: "m",
  logos: {
    color: { src: "/clients/tlst/logo.png", width: 465, height: 354 },
    white: { src: "/clients/tlst/logo-white.png", width: 465, height: 354 },
    mark: { src: "/clients/tlst/mark.png", width: 190, height: 123 },
    favicon: "/clients/tlst/favicon.png",
  },
  theme: {
    background: "#f7f6f0", foreground: "#1c2a20", card: "#ffffff", "card-foreground": "#1c2a20",
    popover: "#ffffff", "popover-foreground": "#1c2a20",
    primary: "#1f5a2d", "primary-foreground": "#ffffff", secondary: "#e6efe4", "secondary-foreground": "#004214",
    muted: "#eeeee6", "muted-foreground": "#5d6a60", accent: "#fff1d2", "accent-foreground": "#7a5200",
    destructive: "#9c4a2e", border: "#dcdfd3", input: "#b9c0b0", ring: "#1f5a2d",
    coral: "#ffb42b", "coral-foreground": "#004214", mint: "#1f5a2d", "mint-soft": "#e6efe4", "mint-pale": "#9fc4a5", sand: "#fff1d2",
    warning: "#8a5a00", "warning-foreground": "#8a5a00", "warning-soft": "#fff1d2", danger: "#9c4a2e", "danger-soft": "#f6e7df", "info-soft": "#e6efe4",
    "chart-1": "#1f5a2d", "chart-2": "#ffb42b", "chart-3": "#9fc4a5", "chart-4": "#8a5a00", "chart-5": "#6f8f7a",
    sidebar: "#eaf0e6", "sidebar-foreground": "#5d6a60", "sidebar-primary": "#004214", "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#d9e5d6", "sidebar-accent-foreground": "#004214", "sidebar-border": "#d3dccd", "sidebar-ring": "#1f5a2d",
    sky: "#fff1d2", "sky-strong": "#ffd98a",
  },
  fonts: {
    titles: { google: "Nunito", weights: ["600", "700"], fallback: '"Segoe UI", Arial, sans-serif' },
    sans: { stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
  },
  modules: "veille,adherents,tresorerie,materiel,budget",
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
    raf: { one: "trésorier", many: "trésoriers", gender: "m" }, // « trésorier·e » + article ne se lit pas : masculin générique, à revoir avec TLST
    direction: { one: "coordination", many: "coordinations", gender: "f" },
    pilote: { one: "responsable", many: "responsables", gender: "m" },
  },
};
