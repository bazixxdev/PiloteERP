# Menu rangé par usage — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** passer de 12 sections / 35 entrées à 6 sections (Mon travail, Projets, Financements, Réseau, Ressources, Admin), où une vue d'une même liste devient un onglet de la page, un document un bouton et un moment de l'année une entrée saisonnière.

**Architecture:** tout l'arbre reste calculé côté serveur dans `lib/navigation.ts` (`navTreeFor`, `locate`) ; la barre latérale, le rail et le fil d'Ariane ne font qu'afficher. Un composant d'onglets commun (`components/shell/page-tabs.tsx`) remplace les barres d'onglets écrites à la main. Une seule règle de saison (`lib/season.ts`) sert au menu, aux raccourcis, à `/seminaire` et au bouton de Vue annuelle. Aucune adresse, aucun droit, aucune donnée ne change.

**Tech Stack:** Next.js 15 App Router (server components, `searchParams`), TypeScript strict, Tailwind, lucide-react, `node:test` via tsx (unitaires), Playwright (recette).

**Spec:** `docs/superpowers/specs/2026-09-27-menu-par-usage-design.md` (points tranchés par Gaël le 27/09, § 6).

## Global Constraints

- Les adresses ne changent pas (`/codir`, `/seminaire`, `/cafe`, `/echeances`, `/adherents?vue=cotisations`, `/mes-actions`…) ; pas de redirection nouvelle ; pas de changement de droits ni de données ; pas de nouveau module (spec § 8).
- Aucun mot du vocabulaire client en dur, ni dans l'interface ni dans les tests : `V`, `cap`, `pl`, `de`… de `lib/vocab.ts` ; « Tous les {projets} » = `` `Tous les ${pl(V.projet)}` ``, « Mes {projets} » = `` `Mes ${pl(V.projet)}` `` ; `npm run check:vocab` vert.
- Libellés exacts des sections : « Mon travail », « Projets », « Financements », « Réseau », « Ressources », « Admin ». Identifiants : `travail`, `projets`, `financements`, `reseau`, `ressources`, `admin`.
- Préparer : de septembre à décembre, l'année suivante ; en janvier, l'année qui commence ; affiché dans le menu de septembre à janvier, pour le {CODIR} seulement (spec § 6.5).
- Qui ne suit pas son temps : seule l'entrée « Mon temps » disparaît ; « Temps de l'équipe » et l'onglet Clôture suivent seulement les droits (spec § 6.6).
- `npm run check` vert avant chaque commit ; commits en français, message court qui dit le pourquoi, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Recette Playwright : préfixer `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<texte donné par Gaël pour ce plan>"` ; recette puis sécurité l'une après l'autre, jamais en parallèle ; `PW_PORT=3140` si le port 3100 est pris.
- Les `data-testid` utilisés par la recette sont gardés quand l'objet existe encore (`requests-view-*`, `rail-${id}`, `rail-panel-${id}`) ; un `data-testid` de section qui disparaît (`rail-demandes`…) est remplacé dans les specs dans la même tâche.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `.agents/rules/interface-navigation.md` (nouveau) | la règle d'interface (spec § 2) |
| `lib/season.ts` (nouveau) | `preparedYear`, `prepareInSeason` — une seule règle de saison |
| `lib/navigation.ts` | nouvel arbre, `NavLeaf.alsoPaths`, `NavContext.canCloseMonths` |
| `app/layout.tsx` | contexte de navigation (droits de clôture) |
| `components/shell/sidebar.tsx` | icônes des six sections |
| `components/shell/page-tabs.tsx` (nouveau) | onglets de page pilotés par l'adresse |
| `app/demandes/page.tsx`, `app/conventions/page.tsx`, `app/adherents/page.tsx`, `app/materiel/page.tsx`, `app/materiel/prets/page.tsx`, `app/temps/page.tsx`, `app/cloture/page.tsx`, `app/projets/page.tsx`, `app/portefeuille/page.tsx` | onglets |
| `app/echeances/page.tsx`, `app/annuel/page.tsx`, `app/codir/page.tsx`, `app/portefeuille/page.tsx`, `app/seminaire/page.tsx` | boutons, titre « À décider », année préparée |
| `components/shell/breadcrumb.tsx`, `components/shell/shortcuts.tsx` | fil d'Ariane et raccourcis alignés |
| `lib/lexique.ts`, `lib/permissions.ts`, `app/aide/page.tsx`, `docs/produit.md` | guide et textes d'aide |
| `tests/unit/navigation.test.ts`, `tests/unit/season.test.ts` (nouveaux), `tests/rail.spec.ts`, `tests/revue-ux.spec.ts`, `tests/menu.spec.ts` (nouveau) | tests |

---

### Task 1: Règle d'interface et règle de saison

**Files:**
- Create: `.agents/rules/interface-navigation.md`, `lib/season.ts`, `tests/unit/season.test.ts`
- Modify: `AGENTS.md` (section `## Rules`), `app/seminaire/page.tsx:21`, `components/shell/shortcuts.tsx:15`

**Interfaces:**
- Produces: `preparedYear(today: Date): number`, `prepareInSeason(today: Date): boolean` (`lib/season.ts`), lus par les tâches 2 et 5.

- [ ] **Step 1: Écrire la règle** `.agents/rules/interface-navigation.md` :

```markdown
# Interface et navigation

Le menu a été rangé par usage le 27/09/2026 (spec `docs/superpowers/specs/2026-09-27-menu-par-usage-design.md`) : 12 sections et 35 entrées devenues 6 sections. Il redevient illisible dès qu'un module ajoute « son » entrée ou « sa » section.

## Quand lire ce fichier
- Avant d'ajouter ou de renommer une entrée dans `lib/navigation.ts`, une page, un onglet, un bouton d'export.
- Avant de créer un module d'instance qui a des écrans.

## Règles
- **ALWAYS** — la première section rassemble le quotidien (« Mon travail ») ; les suivantes sont rangées par objet : Projets, Financements, Réseau, Ressources, Admin.
- **ALWAYS** — une entrée de menu = un endroit où l'on va. Une vue d'une même liste = un onglet dans la page (`components/shell/page-tabs.tsx`). Un document produit = un bouton. Un moment de l'année = un bouton, ou une entrée affichée seulement en saison (`lib/season.ts`).
- **NEVER** — une section définie par un groupe de personnes (« Direction ») : les droits masquent des entrées, ils ne créent pas de section.
- **NEVER** — une nouvelle section pour un module : ses écrans vont dans la section de leur objet.
- **ALWAYS** — une adresse rattachée à une entrée sans en être une (sous-page, page d'onglet) est déclarée dans `alsoPaths` de la feuille ou `also` de la section, pour que l'entrée reste active.
- **ALWAYS** — un libellé de menu qui contient un mot métier passe par `lib/vocab.ts`.
```

- [ ] **Step 2: Indexer la règle** dans `AGENTS.md`, section `## Rules`, après la ligne « Production et déploiement » :

```markdown
- **Interface et navigation** - [.agents/rules/interface-navigation.md](.agents/rules/interface-navigation.md) - menu rangé par usage : une entrée = un endroit, une vue = un onglet, un document = un bouton, un moment = une entrée de saison ; pas de section par groupe de personnes.
```

- [ ] **Step 3: Écrire le test qui échoue** `tests/unit/season.test.ts` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { preparedYear, prepareInSeason } from "../../lib/season";

const d = (iso: string) => new Date(`${iso}T12:00:00`);

test("l'année préparée : l'année suivante de septembre à décembre, l'année qui commence en janvier", () => {
  assert.equal(preparedYear(d("2026-09-01")), 2027);
  assert.equal(preparedYear(d("2026-12-31")), 2027);
  assert.equal(preparedYear(d("2027-01-01")), 2027);
  assert.equal(preparedYear(d("2027-01-31")), 2027);
  assert.equal(preparedYear(d("2027-02-01")), 2028);
  assert.equal(preparedYear(d("2027-06-15")), 2028);
});

test("la saison de Préparer : de septembre à janvier", () => {
  assert.equal(prepareInSeason(d("2026-08-31")), false);
  assert.equal(prepareInSeason(d("2026-09-01")), true);
  assert.equal(prepareInSeason(d("2026-12-15")), true);
  assert.equal(prepareInSeason(d("2027-01-31")), true);
  assert.equal(prepareInSeason(d("2027-02-01")), false);
});
```

- [ ] **Step 4: Lancer** `npx tsx --test tests/unit/season.test.ts` — attendu : échec, module `lib/season` introuvable.

- [ ] **Step 5: Implémenter** `lib/season.ts` :

```ts
// Le moment de l'année où l'on prépare l'année suivante (spec menu § 6.5, 27/09) : de septembre à décembre, on prépare N+1 ;
// en janvier on finit de préparer l'année qui commence. Une seule règle, lue par le menu, les raccourcis, /seminaire et Vue annuelle.
export function preparedYear(today: Date): number {
  return today.getMonth() === 0 ? today.getFullYear() : today.getFullYear() + 1;
}

export function prepareInSeason(today: Date): boolean {
  const m = today.getMonth();
  return m >= 8 || m === 0;
}
```

- [ ] **Step 6: Brancher** `app/seminaire/page.tsx:21` : `const target = Number(sp.annee) || preparedYear(new Date());` (import de `preparedYear`, retirer `dayjs` s'il n'est plus utilisé) ; `components/shell/shortcuts.tsx:15` : `` label: `Préparer ${preparedYear(new Date())}` `` (import de `@/lib/season`). Dans `components/shell/shortcuts.tsx`, remplacer aussi les libellés `"Arbitrages"` par `"À décider"`, `"Validations"` (key `v`, `/validations`) par `"À traiter"` avec `href: "/demandes"`, et `"Écran café"` par `"Café du lundi"`.

- [ ] **Step 7: Vérifier** `npx tsx --test tests/unit/season.test.ts` (vert) puis `npm run check`.

- [ ] **Step 8: Commit** — « Menu : la règle d'interface, et une seule règle pour l'année qu'on prépare ».

---

### Task 2: Le nouvel arbre de navigation

**Files:**
- Modify: `lib/navigation.ts` (types, `navTreeFor`, `leafMatches`), `app/layout.tsx:55-78`, `components/shell/sidebar.tsx:6,20-33`
- Test: `tests/unit/navigation.test.ts` (nouveau)

**Interfaces:**
- Consumes: `preparedYear`, `prepareInSeason` (tâche 1).
- Produces: `NavSection["id"]` = `"travail" | "projets" | "financements" | "reseau" | "ressources" | "admin"` ; `NavLeaf.alsoPaths?: string[]` ; `NavContext` gagne `canCloseMonths: boolean` et `today: Date` et garde les autres champs ; `navTreeFor(ctx)` et `locate(tree, pathname, params)` gardent leur signature.

- [ ] **Step 1: Écrire le test qui échoue** `tests/unit/navigation.test.ts` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { navTreeFor, locate, type NavContext } from "../../lib/navigation";

const DIRECTOR = ["codir.access", "admin.manage", "time.lock", "treasury.view"];
const base = (over: Partial<NavContext> = {}): NavContext => ({
  role: "pilot", permissions: [], validationLevel: 0,
  modules: ["tasks", "notes"], veille: true, adherents: true, tresorerie: true, materiel: true,
  tracksTime: true, showTeam: false, canCloseMonths: false, wide: null,
  badges: { requests: 3, reminders: 2 }, today: new Date("2026-10-05T12:00:00"),
  ...over,
});
const ids = (ctx: NavContext) => navTreeFor(ctx).map((s) => s.id);
const labels = (ctx: NavContext, id: string) => navTreeFor(ctx).find((s) => s.id === id)?.items.map((l) => l.label) ?? [];
const at = (ctx: NavContext, url: string) => { const u = new URL(url, "http://x"); return locate(navTreeFor(ctx), u.pathname, u.searchParams); };

test("six sections au plus, dans l'ordre du quotidien puis par objet", () => {
  assert.deepEqual(ids(base({ role: "director", permissions: DIRECTOR, showTeam: true, canCloseMonths: true })), ["travail", "projets", "financements", "reseau", "ressources", "admin"]);
  assert.deepEqual(ids(base()), ["travail", "projets", "financements", "reseau", "ressources"]);
});

test("Mon travail : À traiter porte le badge des demandes ; Mon temps disparaît pour qui ne suit pas son temps", () => {
  const travail = navTreeFor(base()).find((s) => s.id === "travail")!;
  assert.equal(travail.items.find((l) => l.href === "/demandes")?.badge, 3);
  assert.ok(labels(base(), "travail").includes("Mon temps"));
  assert.ok(!labels(base({ tracksTime: false }), "travail").includes("Mon temps"));
});

test("Temps de l'équipe suit les droits, même pour qui ne suit pas son temps", () => {
  assert.ok(labels(base({ tracksTime: false, showTeam: true }), "ressources").includes("Temps de l'équipe"));
  assert.ok(labels(base({ tracksTime: false, canCloseMonths: true }), "ressources").includes("Temps de l'équipe"));
  assert.ok(!labels(base(), "ressources").includes("Temps de l'équipe"));
  const cloture = navTreeFor(base({ canCloseMonths: true })).find((s) => s.id === "ressources")!.items.find((l) => l.label === "Temps de l'équipe");
  assert.equal(cloture?.href, "/cloture"); // sans temps d'autrui visible, l'entrée ouvre la clôture
});

test("Projets : À décider et Préparer pour le CODIR seulement ; Préparer en saison seulement", () => {
  const codir = base({ permissions: ["codir.access"] });
  assert.ok(labels(codir, "projets").includes("À décider"));
  assert.ok(labels(codir, "projets").includes("Préparer 2027"));
  assert.ok(!labels(base(), "projets").includes("À décider"));
  assert.ok(!labels({ ...codir, today: new Date("2026-05-10T12:00:00") }, "projets").some((l) => l.startsWith("Préparer")));
  assert.ok(labels({ ...codir, today: new Date("2027-01-10T12:00:00") }, "projets").includes("Préparer 2027"));
});

test("les modules d'instance masquent leurs entrées ; une section vide disparaît", () => {
  const sans = base({ veille: false, adherents: false, tresorerie: false, materiel: false });
  assert.ok(!labels(sans, "financements").includes("Appels à projets"));
  assert.ok(!labels(sans, "reseau").includes("Adhérents"));
  assert.ok(!ids(sans).includes("ressources"));
});

test("l'entrée active suit l'adresse, onglets et pages rattachées comprises", () => {
  const dir = base({ role: "director", permissions: DIRECTOR, showTeam: true, canCloseMonths: true });
  assert.deepEqual(at(dir, "/demandes?vue=mes"), { section: "travail", leaf: "/demandes" });
  assert.deepEqual(at(dir, "/validations"), { section: "travail", leaf: "/demandes" });
  assert.deepEqual(at(dir, "/notifications"), { section: "travail", leaf: "/ma-semaine" });
  assert.deepEqual(at(dir, "/temps"), { section: "travail", leaf: "/temps" });
  assert.deepEqual(at(dir, "/temps?equipe=1"), { section: "ressources", leaf: "/temps?equipe=1" });
  assert.deepEqual(at(dir, "/cloture"), { section: "ressources", leaf: "/temps?equipe=1" });
  assert.deepEqual(at(dir, "/portefeuille"), { section: "projets", leaf: "/projets" });
  assert.deepEqual(at(dir, "/cafe"), { section: "projets", leaf: "/echeances" });
  assert.deepEqual(at(dir, "/conventions?vue=obtenus"), { section: "financements", leaf: "/conventions" });
  assert.deepEqual(at(dir, "/adherents?vue=cotisations"), { section: "reseau", leaf: "/adherents" });
  assert.deepEqual(at(dir, "/materiel/prets?vue=termines"), { section: "ressources", leaf: "/materiel/prets" });
  assert.deepEqual(at(dir, "/materiel"), { section: "ressources", leaf: "/materiel/prets" });
  assert.deepEqual(at(dir, "/admin?section=parametres"), { section: "admin", leaf: "/admin" });
  assert.deepEqual(at(dir, "/seminaire?annee=2027"), { section: "projets", leaf: "/seminaire" });
  assert.deepEqual(at({ ...dir, today: new Date("2026-05-10T12:00:00") }, "/seminaire"), { section: "projets", leaf: "/projets" });
});
```

- [ ] **Step 2: Lancer** `npx tsx --test tests/unit/navigation.test.ts` — attendu : échec (champs `canCloseMonths`/`today` inconnus, sections anciennes).

- [ ] **Step 3: Réécrire** `lib/navigation.ts` (types et `navTreeFor` ; `underPath` et `locate` gardés, `leafMatches` étendu) :

```ts
// Arbre de navigation à deux niveaux, rangé par usage (spec menu du 27/09) : « Mon travail » (le quotidien), puis par objet —
// Projets, Financements, Réseau, Ressources, Admin. Une vue d'une même liste est un onglet de la page, pas une entrée ; un moment
// de l'année est une entrée de saison. Tout est calculé ici, côté serveur, à partir des droits et des modules. Module pur.
import { canAdmin, canViewTreasury, isCodir, type Actor } from "./rights";
import { preparedYear, prepareInSeason } from "./season";
import { V, pl } from "@/lib/vocab";

export type NavLeaf = {
  label: string;
  href: string;
  badge?: number;
  // Reconnaissance de l'entrée active : préfixe(s) d'adresse, puis conditions sur la chaîne de requête.
  path: string | string[];
  exact?: boolean;
  param?: { key: string; oneOf: (string | null)[] };
  present?: string[];
  absent?: string[];
  // Adresses qui activent aussi cette entrée, sans condition de paramètres (pages d'onglet, pages rattachées : /cloture, /cafe).
  alsoPaths?: string[];
};

export type NavSection = {
  id: "travail" | "projets" | "financements" | "reseau" | "ressources" | "admin";
  label: string;
  badge?: number;
  items: NavLeaf[];
  also?: string[];
};

export type NavContext = Actor & {
  modules: string[];
  veille: boolean;
  adherents: boolean;
  tresorerie: boolean;
  materiel: boolean;
  tracksTime: boolean; // suit son temps : sinon seule « Mon temps » disparaît (spec menu § 6.6)
  showTeam: boolean; // au moins une autre personne dont le temps est visible
  canCloseMonths: boolean; // droit de clôturer les mois (onglet Clôture de Temps de l'équipe)
  wide: string | null;
  badges: { requests: number; reminders: number };
  today: Date; // la saison de « Préparer » (lib/season.ts)
};

export function navTreeFor(ctx: NavContext): NavSection[] {
  const codir = isCodir(ctx);
  const inSeason = prepareInSeason(ctx.today);
  const sections: NavSection[] = [
    {
      id: "travail",
      label: "Mon travail",
      badge: ctx.badges.requests,
      also: ["/notifications"],
      items: [
        { label: "Ma semaine", href: "/ma-semaine", path: "/ma-semaine" },
        { label: "À traiter", href: "/demandes", badge: ctx.badges.requests, path: ["/demandes", "/validations"] },
        ...(ctx.modules.includes("tasks") ? [{ label: "Tâches", href: "/taches", path: "/taches" }] : []),
        ...(ctx.modules.includes("notes") ? [{ label: "Notes", href: "/notes", path: "/notes" }] : []),
        ...(ctx.tracksTime ? [{ label: "Mon temps", href: "/temps", path: "/temps", absent: ["equipe", "personne"] }] : []),
        { label: `Mes ${pl(V.action)}`, href: "/mes-actions", path: "/mes-actions" },
      ],
    },
    {
      id: "projets",
      label: "Projets",
      also: ["/edition", "/action", "/seminaire"],
      items: [
        { label: `Tous les ${pl(V.projet)}`, href: "/projets", path: ["/projets", "/portefeuille"] },
        { label: "Vue annuelle", href: "/annuel", path: "/annuel" },
        { label: "Plan de charge", href: "/plan-de-charge", path: "/plan-de-charge" },
        { label: "Échéances", href: "/echeances", badge: ctx.badges.reminders, path: ["/echeances", "/rappels"], alsoPaths: ["/cafe"] },
        ...(codir ? [{ label: "À décider", href: "/codir", path: "/codir" }] : []),
        ...(codir && inSeason ? [{ label: `Préparer ${preparedYear(ctx.today)}`, href: "/seminaire", path: "/seminaire" }] : []),
      ],
    },
    {
      id: "financements",
      label: "Financements",
      items: [
        { label: "Dossiers", href: "/conventions", path: "/conventions" },
        { label: "Qui finance quoi", href: "/matrice", path: "/matrice" },
        ...(ctx.veille ? [{ label: "Appels à projets", href: "/appels", path: "/appels" }] : []),
      ],
    },
    {
      id: "reseau",
      label: "Réseau",
      also: ["/financeurs"],
      items: [
        { label: "Organisations", href: "/organisations", path: "/organisations" },
        ...(ctx.adherents ? [{ label: "Adhérents", href: "/adherents", path: "/adherents" }] : []),
        { label: "Contacts", href: "/contacts", path: "/contacts" },
      ],
    },
    {
      id: "ressources",
      label: "Ressources",
      items: [
        ...(ctx.tresorerie && canViewTreasury(ctx) ? [{ label: "Trésorerie", href: "/tresorerie", path: "/tresorerie" }] : []),
        ...(ctx.materiel ? [{ label: "Matériel et prêts", href: "/materiel/prets", path: "/materiel" }] : []),
        ...(ctx.showTeam || ctx.canCloseMonths
          ? [{ label: "Temps de l'équipe", href: ctx.showTeam ? "/temps?equipe=1" : "/cloture", path: "/temps", present: ["equipe", "personne"], alsoPaths: ["/cloture"] }]
          : []),
      ],
    },
  ];
  if (canAdmin(ctx)) sections.push({ id: "admin", label: "Admin", items: [{ label: "Admin", href: "/admin", path: "/admin" }] });
  return sections.filter((s) => s.items.length > 0);
}

function underPath(pathname: string, p: string): boolean {
  return pathname === p || pathname.startsWith(p + "/");
}

export function leafMatches(leaf: NavLeaf, pathname: string, params: URLSearchParams): boolean {
  if (leaf.alsoPaths?.some((p) => underPath(pathname, p))) return true;
  const paths = Array.isArray(leaf.path) ? leaf.path : [leaf.path];
  if (!paths.some((p) => (leaf.exact ? pathname === p : underPath(pathname, p)))) return false;
  if (leaf.param && !leaf.param.oneOf.includes(params.get(leaf.param.key))) return false;
  if (leaf.present && !leaf.present.some((k) => params.has(k))) return false;
  if (leaf.absent && leaf.absent.some((k) => params.has(k))) return false;
  return true;
}
```

`locate` ne change pas (la première feuille qui reconnaît l'adresse gagne ; sinon `also` de section et première feuille). Remarque : l'ordre « Mon temps » (absent equipe/personne) dans `travail`, puis « Temps de l'équipe » (present) dans `ressources` suffit à distinguer `/temps` de `/temps?equipe=1`.

- [ ] **Step 4: Adapter** `app/layout.tsx` : dans l'appel à `navTreeFor`, ajouter `canCloseMonths: canLockMonths(me),` et `today: new Date(),` (import de `canLockMonths` depuis `@/lib/rights`). Dans `components/shell/sidebar.tsx`, remplacer `SECTION_ICONS` :

```ts
const SECTION_ICONS: Record<NavSection["id"], LucideIcon> = {
  travail: CalendarDays,
  projets: FileSignature,
  financements: HandCoins,
  reseau: BookUser,
  ressources: Package,
  admin: Settings,
};
```

et retirer de l'import lucide les icônes devenues inutiles (`Clock`, `Inbox`, `Users`, `Wallet`, `CalendarClock`, `Landmark`) — `npm run lint` le signale sinon. Une section à une seule feuille (Admin) : vérifier dans `sidebar.tsx` que l'icône mène directement à la feuille (ligne 62 : lien direct quand `s.items.length === 1` ; sinon l'ajouter sur ce modèle).

- [ ] **Step 5: Vérifier** `npx tsx --test tests/unit/navigation.test.ts` (vert), `npm run check`.

- [ ] **Step 6: Commit** — « Menu : six sections rangées par usage, Préparer en saison, le temps de l'équipe selon les droits ».

---

### Task 3: Onglets communs — À traiter, Dossiers, Adhérents

**Files:**
- Create: `components/shell/page-tabs.tsx`
- Modify: `app/demandes/page.tsx:91-97`, `app/conventions/page.tsx` (en-têtes des deux vues, l.45-56 et 94-97), `app/adherents/page.tsx:49`

**Interfaces:**
- Produces: `PageTabs({ tabs, testId? }: { tabs: { href: string; label: string; active: boolean; count?: number; testId?: string }[]; testId?: string })` — rendu `role="tablist"` / `role="tab"` / `aria-selected`, style de `app/edition/[id]/tabs-nav.tsx` (bordure `border-coral`, `font-bold text-primary` pour l'actif). Réutilisé par la tâche 4.

- [ ] **Step 1: Créer** `components/shell/page-tabs.tsx` :

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

export type PageTab = { href: string; label: string; active: boolean; count?: number; testId?: string };

// Onglets d'une page (spec menu § 2 : une vue d'une même liste = un onglet, pas une entrée de menu). Pilotés par l'adresse :
// chaque onglet est un lien, l'actif est calculé par la page serveur. Même dessin que les onglets d'une année (tabs-nav.tsx).
export function PageTabs({ tabs, testId }: { tabs: PageTab[]; testId?: string }) {
  return (
    <nav role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b" data-testid={testId}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          role="tab"
          aria-selected={t.active}
          data-testid={t.testId}
          className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", t.active ? "border-coral font-bold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          {t.label}{t.count !== undefined && <span className="ml-1 text-xs text-muted-foreground">({t.count})</span>}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: À traiter** — dans `app/demandes/page.tsx`, titre `PageHeader` « À traiter » (au lieu de « Mes demandes ») ; remplacer les pastilles l.95-97 par :

```tsx
<PageTabs tabs={[
  { href: "/demandes", label: "Qu'on me fait", count: forMe.length, active: view === "moi", testId: "requests-view-moi" },
  { href: "/demandes?vue=mes", label: "Que j'ai faites", count: mine.length, active: view === "mes", testId: "requests-view-mes" },
  ...(wide ? [{ href: "/demandes?vue=toutes", label: wide, count: all.length, active: view === "toutes", testId: "requests-view-toutes" }] : []),
]} />
```

(les noms `forMe`, `mine`, `all` sont ceux des listes déjà comptées l.95-97 : reprendre exactement les expressions de comptage existantes). Les `testId` restent ceux de la recette.

- [ ] **Step 3: Dossiers** — dans `app/conventions/page.tsx`, sous l'en-tête de chacune des deux vues, ajouter :

```tsx
<PageTabs tabs={[
  { href: "/conventions", label: "En cours", active: !obtenus },
  { href: "/conventions?vue=obtenus", label: "Obtenus", active: obtenus },
]} />
```

Les titres restent « Dossiers de financement » et « Financements obtenus ».

- [ ] **Step 4: Adhérents** — dans `app/adherents/page.tsx`, sous l'en-tête :

```tsx
<PageTabs tabs={[
  { href: "/adherents", label: "Adhérents", active: !money },
  { href: "/adherents?vue=cotisations", label: "Cotisations", active: money },
]} />
```

- [ ] **Step 5: Vérifier** `npm run check`, puis les specs qui visitent ces pages : `grep -ln "demandes\|conventions\|adherents" tests/*.spec.ts` et les lancer (préfixe de consentement) ; corriger une attente de titre « Mes demandes » → « À traiter » s'il y en a.

- [ ] **Step 6: Commit** — « Menu : À traiter, Dossiers et Adhérents ont leurs vues en onglets ».

---

### Task 4: Onglets — Matériel et prêts, Temps de l'équipe, Projets

**Files:**
- Modify: `app/materiel/prets/page.tsx:34`, `app/materiel/page.tsx:42-44`, `app/temps/page.tsx` (en-tête en mode équipe), `app/cloture/page.tsx:19-23,75-77`, `app/projets/page.tsx:50`, `app/portefeuille/page.tsx:69-90`

**Interfaces:**
- Consumes: `PageTabs` (tâche 3) ; `canSeeTimeOf`, `canLockMonths`, `isCodir` (`lib/rights.ts`).

- [ ] **Step 1: Matériel et prêts** — même barre sur `/materiel/prets` et `/materiel` :

```tsx
<PageTabs tabs={[
  { href: "/materiel/prets", label: "Prêts en cours", active: current === "encours" },
  { href: "/materiel/prets?vue=termines", label: "Prêts terminés", active: current === "termines" },
  { href: "/materiel", label: "Inventaire", active: current === "inventaire" },
]} />
```

avec `current` = `done ? "termines" : "encours"` dans `app/materiel/prets/page.tsx`, `"inventaire"` dans `app/materiel/page.tsx`. Pour ne pas écrire la liste deux fois, la déclarer dans `app/materiel/tabs.ts` : `export function materielTabs(current: "encours" | "termines" | "inventaire"): PageTab[]`.

- [ ] **Step 2: Temps de l'équipe + Clôture** — créer `app/temps/team-tabs.ts` :

```ts
import type { PageTab } from "@/components/shell/page-tabs";

// Onglets de « Temps de l'équipe » (spec menu § 6.3 et § 6.6) : chacun selon son droit, jamais selon le fait de saisir soi-même.
export function teamTabs(current: "equipe" | "cloture", can: { team: boolean; close: boolean }): PageTab[] {
  return [
    ...(can.team ? [{ href: "/temps?equipe=1", label: "Temps de l'équipe", active: current === "equipe" }] : []),
    ...(can.close ? [{ href: "/cloture", label: "Clôture", active: current === "cloture" }] : []),
  ];
}
```

Dans `app/temps/page.tsx`, en mode équipe (`teamMode`) seulement, afficher `<PageTabs tabs={teamTabs("equipe", { team: true, close: canLockMonths(me) })} />` sous l'en-tête. Dans `app/cloture/page.tsx`, après la garde `canLockMonths` (l.19-23, inchangée), afficher `<PageTabs tabs={teamTabs("cloture", { team: showTeam, close: true })} />`, où `showTeam` reprend exactement la règle du layout (`people.some((p) => p.id !== me.id && p.tracksTime && canSeeTimeOf(me, p, settings.timeVisibility))`) — la sortir dans `lib/time-visibility.ts` : `export function seesSomeoneElse(me, people, visibility): boolean`, et l'utiliser aussi dans `app/layout.tsx` (une seule règle). Un onglet seul n'affiche pas de barre : dans `PageTabs`, `if (tabs.length < 2) return null;`.

- [ ] **Step 3: Projets** — créer `app/projets/tabs.ts` :

```ts
import type { PageTab } from "@/components/shell/page-tabs";
import { V, pl } from "@/lib/vocab";

// « Tous les {projets} » et, à côté, la vue par personne : « Portefeuille » pour le {CODIR}, « Mes {projets} » pour les autres
// (même page /portefeuille, spec menu § 6.4).
export function projectTabs(current: "tous" | "portefeuille", codir: boolean): PageTab[] {
  return [
    { href: "/projets", label: `Tous les ${pl(V.projet)}`, active: current === "tous" },
    { href: "/portefeuille", label: codir ? "Portefeuille" : `Mes ${pl(V.projet)}`, active: current === "portefeuille" },
  ];
}
```

L'afficher sous l'en-tête de `app/projets/page.tsx` (`projectTabs("tous", isCodir(me))`) et de `app/portefeuille/page.tsx` hors mode `?mode=codir` (`projectTabs("portefeuille", isCodir(me))`).

- [ ] **Step 4: Vérifier** `npm run check` ; specs touchées : `tests/perimetre.spec.ts`, et `grep -ln "materiel\|cloture\|temps\|portefeuille\|projets" tests/*.spec.ts` — les lancer ; corriger ce qui dépendait des anciennes entrées de menu.

- [ ] **Step 5: Commit** — « Menu : Matériel et prêts, Temps de l'équipe (avec la clôture) et Projets en onglets ».

---

### Task 5: Boutons et noms — café, Préparer hors saison, « À décider »

**Files:**
- Modify: `app/echeances/page.tsx:46`, `app/annuel/page.tsx:52`, `app/codir/page.tsx:20,30,101`, `app/portefeuille/page.tsx` (titre et boutons du mode `codir`)

**Interfaces:**
- Consumes: `preparedYear`, `prepareInSeason` (tâche 1), `isCodir`.

- [ ] **Step 1: Café** — dans l'en-tête de `app/echeances/page.tsx`, ajouter en `actions` : `<Button asChild variant="outline" size="sm"><Link href="/cafe"><Coffee />Projeter le café du lundi</Link></Button>` (icône `Coffee` de lucide-react), `data-testid="echeances-cafe"`.

- [ ] **Step 2: Préparer hors saison** — dans `app/annuel/page.tsx`, ajouter aux `actions` de l'en-tête, pour le {CODIR} seulement et hors saison :

```tsx
{isCodir(me) && !prepareInSeason(new Date()) && (
  <Button asChild variant="outline" size="sm" data-testid="annuel-preparer"><Link href="/seminaire">{`Préparer ${preparedYear(new Date())}`}</Link></Button>
)}
```

(lire `me` comme le reste de la page ; en saison, l'entrée du menu suffit).

- [ ] **Step 3: « À décider »** — remplacer le libellé « Arbitrages » partout où il s'affiche : titre de `app/codir/page.tsx:30` → « À décider » ; commentaire l.20 mis à jour ; bouton l.101 « Quitter le mode Arbitrages » → « Quitter À décider » ; dans `app/portefeuille/page.tsx`, titre `codir ? "À décider" : …` et boutons « Mode Arbitrages » → « À décider », « Quitter le mode Arbitrages » → « Quitter À décider ». Vérifier par `grep -rn "Arbitrages" app components lib` qu'il ne reste que des commentaires (le guide est traité en tâche 7).

- [ ] **Step 4: Vérifier** `npm run check` ; `tests/revue-ux.spec.ts:66` attend un lien « Arbitrages » absent pour un non-{CODIR} : remplacer le nom par « À décider » ; lancer `tests/revue-ux.spec.ts`, `tests/codir.spec.ts` et les specs qui cherchent « Arbitrages » (`grep -rln "Arbitrages" tests`).

- [ ] **Step 5: Commit** — « Menu : le café en bouton d'Échéances, Préparer en bouton hors saison, l'écran de décision s'appelle À décider ».

---

### Task 6: Fil d'Ariane et rail alignés

**Files:**
- Modify: `components/shell/breadcrumb.tsx:9-45`, `tests/rail.spec.ts`, `tests/rail-infobulle.spec.ts`
- Test: `tests/menu.spec.ts` (nouveau)

- [ ] **Step 1: Fil d'Ariane** — dans `components/shell/breadcrumb.tsx`, la liste `OUTSIDE` : retirer `/validations` (la page redirige vers `/demandes`, reconnue par l'arbre) ; `/cafe` → le fil devient « Projets › Échéances › Café du lundi » (l'arbre donne section et feuille grâce à `alsoPaths`, ajouter le dernier maillon « Café du lundi » pour `/cafe`) ; `/cloture` → « Ressources › Temps de l'équipe › Clôture » ; `/portefeuille?mode=codir` → « Projets › À décider ». Garder les autres cas particuliers tels quels (`EDITION_TABS`, `/seminaire?annee=`, `/materiel/pret/*`, `/projets/[id]`, `/conventions/*`, `/financeurs/*`).

- [ ] **Step 2: Rail** — `tests/rail.spec.ts` utilise `rail-demandes`, `rail-projets`, `rail-financements` : remplacer `rail-demandes` par `rail-travail` (À traiter est dans Mon travail) et adapter les feuilles cliquées aux nouveaux libellés ; `tests/rail-infobulle.spec.ts` : vérifier que `Tâches` est toujours dans `rail-panel-travail`.

- [ ] **Step 3: Recette du menu** `tests/menu.spec.ts` :

```ts
import { test, expect } from "@playwright/test";
import { iAm } from "./helpers";

// Menu rangé par usage (spec du 27/09) : six sections au plus, les vues en onglets, l'entrée active suit l'onglet.
// Session par défaut de la recette : Claire Vasseur (direction) ; iAm change de personne sans se reconnecter.
test.use({ viewport: { width: 900, height: 800 } }); // sous lg, la barre est un rail d'icônes (rail-<id>)

test("la direction voit six sections ; l'entrée reste active sur un onglet", async ({ page }) => {
  await page.goto("/ma-semaine");
  for (const id of ["travail", "projets", "financements", "reseau", "ressources", "admin"]) await expect(page.getByTestId(`rail-${id}`)).toBeVisible();
  await expect(page.getByTestId("rail-demandes")).toHaveCount(0);
  await page.goto("/conventions?vue=obtenus");
  await expect(page.getByRole("tab", { name: "Obtenus" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("rail-financements")).toHaveAttribute("aria-current", "page");
  await page.goto("/cloture");
  await expect(page.getByRole("tab", { name: "Clôture" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("rail-ressources")).toHaveAttribute("aria-current", "page");
});

test("sans droit {CODIR} ni admin : pas d'Admin, pas de « À décider »", async ({ page }) => {
  await page.goto("/ma-semaine");
  await iAm(page, "Lucas Perrin");
  await expect(page.getByTestId("rail-admin")).toHaveCount(0);
  await page.getByTestId("rail-projets").click();
  await expect(page.getByTestId("rail-panel-projets").getByRole("link", { name: "À décider" })).toHaveCount(0);
});
```

(le libellé `{CODIR}` du titre de test est à écrire avec `V.codir` via `tests/vocab.ts`, comme les autres specs ; vérifier dans `tests/rail.spec.ts` la taille d'écran qui affiche le rail.)

- [ ] **Step 4: Vérifier** `npm run check`, puis `tests/menu.spec.ts`, `tests/rail.spec.ts`, `tests/rail-infobulle.spec.ts`.

- [ ] **Step 5: Commit** — « Menu : fil d'Ariane et rail suivent les six sections ; recette du menu ».

---

### Task 7: Guide, aide des droits, documentation

**Files:**
- Modify: `lib/lexique.ts` (champs `where` et entrées nommant les écrans), `lib/permissions.ts:63` (aide de `codir.access`), `app/aide/page.tsx` (schéma), `docs/produit.md`

- [ ] **Step 1: Chemins du guide** — dans `lib/lexique.ts`, réécrire tous les champs `where` qui citent un ancien chemin : « Annuaire › Contacts » → « Réseau › Contacts » (×4) ; « Temps › Ma répartition » → « Mon travail › Mon temps » ; « Temps › Clôture mensuelle » → « Ressources › Temps de l'équipe › Clôture » ; « Prêts » → « Ressources › Matériel et prêts » ; « Échéances » → « Projets › Échéances » ; « Projets › Portefeuille » → « Projets › Tous les {projets} › Portefeuille » ; `` `${cap(V.direction)} › Arbitrages` `` → « Projets › À décider » ; `` `${cap(V.direction)} › Préparer (l'année suivante)` `` → « Projets › Préparer (de septembre à janvier ; sinon bouton de Vue annuelle) » ; l'entrée « Arbitrages, écran café » devient « À décider, café du lundi » (À décider : alertes et validations en attente, décisions ; Café : bouton d'Échéances). Vérifier qu'il ne reste aucun `where` avec « Direction », « Annuaire », « Temps › », « Demandes » : `grep -n "where:" lib/lexique.ts`.

- [ ] **Step 2: Aide du droit** `codir.access` (`lib/permissions.ts:63`) : « Page Arbitrages, … écran café » → « À décider, Préparer l'année suivante, montants dans la matrice et le portefeuille, café du lundi, décisions. »

- [ ] **Step 3: `app/aide/page.tsx`** et `docs/produit.md` : décrire les six sections et la règle « une entrée = un endroit, une vue = un onglet ».

- [ ] **Step 4: Vérifier** `npm run check` (le test d'habillage refuse « dition » : pas de « conditionné ») et `tests/habillage.spec.ts`.

- [ ] **Step 5: Commit** — « Guide : les chemins suivent le menu rangé par usage ».

---

### Task 8: Recette complète

**Files:** specs Playwright encore cassées par les tâches 2 à 7.

- [ ] **Step 1:** `grep -rln "Ma répartition\|Temps de l'équipe\|Clôture mensuelle\|Portefeuille\|Écran café\|Financements obtenus\|Dossiers de financement\|Mes demandes\|Arbitrages\|rail-demandes\|rail-temps\|rail-annuaire\|rail-echeances\|rail-direction\|rail-adherents\|rail-materiel\|rail-tresorerie" tests` et corriger chaque attente sur un ancien libellé ou une ancienne section, sans affaiblir le test (même vérification, nouveau nom).
- [ ] **Step 2:** recette complète (consentement de Gaël pour ce plan), puis `npm run test:security`, l'une après l'autre. Attendu : tout vert.
- [ ] **Step 3:** captures du menu déplié et du rail, CRESS et TLST (preview 3001 et 3011), à montrer à Gaël.
- [ ] **Step 4: Commit** — « Recette : le menu rangé par usage ».

---

## Self-review (faite à l'écriture)

- Spec § 2 → tâche 1 ; § 3 et § 4 (entrée par entrée) → tâches 2 à 5 ; § 6.1 → tâches 2 (Notifications hors menu, `also`) et 5 (café) ; § 6.2 → tâche 2 (Ressources) ; § 6.3 → tâche 4 ; § 6.4 → tâches 2 et 4 ; § 6.5 → tâches 1, 2, 5 ; § 6.6 → tâches 2 et 4 ; § 6.7 → contrainte globale et tâche 7 ; § 7.5 → tâche 6 ; § 7.6 → tâche 7 ; § 7.7 → tâches 2, 6, 8.
- Noms constants : `preparedYear`, `prepareInSeason`, `PageTabs`/`PageTab`, `teamTabs`, `projectTabs`, `materielTabs`, `seesSomeoneElse`, `canCloseMonths`, `alsoPaths`.
- Points à vérifier en exécutant : les noms exacts des listes comptées dans `app/demandes/page.tsx` (tâche 3) ; la taille d'écran du rail et la personne par défaut de la recette dans `tests/menu.spec.ts` (tâche 6) ; le lien direct d'une section à une feuille dans le rail (tâche 2).
