# Lot I — Multi-instance : un code, un habillage par client (design du 18/09/2026)

Décidé avec Gaël le 18/09/2026, dans la suite de `docs/produit.md` (« le Pilote devient le produit », 15/09) et de `docs/LOTS-TLST.md` (lot I, « attendre la revue »). Ce lot sort ce qui est propre à la CRESS du code métier pour qu'une deuxième instance (TLST, puis d'autres : Gaël ne compte pas s'arrêter à deux clients) tourne sur le même dépôt avec son nom, ses logos, ses couleurs, ses polices et ses mots.

## Ce qu'on livre

1. Un **fichier client** versionné par instance (`config/clients/<client>.ts`) : identité, logos, thème complet, polices, modules par défaut, vocabulaire.
2. Un **vocabulaire** (`lib/vocab.ts`) et le passage systématique des sources : plus aucun « CRESS », « édition », « pôle », « CODIR », « RAF », « direction », « pilote » en dur dans ce qui s'affiche.
3. **Nom, logos, favicon, thème, polices** pris dans le fichier client (layout, composant Logo, route favicon).
4. Un **seed par client** : tronc commun + seed CRESS (inchangé dans son résultat) + seed TLST (squelette + petite démo).
5. **Déploiement par instance** : `deploy.sh <instance>`, fichiers d'instance, unité systemd paramétrée, conf nginx TLST prête.
6. **Tests** : suite actuelle verte sous `cress` ; test d'habillage sous `tlst` ; script de contrôle des mots en dur.

Hors lot : mise en ligne réelle de l'instance TLST (DNS, certificat) et reprise des données depuis mca-vps ; archivage d'`erp-tlst` ; Entra ID ; **écran admin › Apparence** (dans la feuille de route, voir `LOTS-TLST.md`).

## 1. Le fichier client

```
config/clients/
  index.ts     — lit NEXT_PUBLIC_CLIENT (défaut « cress »), exporte `client` ; switch sur imports statiques ; clé inconnue = throw au chargement
  types.ts     — type Client
  cress.ts
  tlst.ts
public/clients/<client>/   — logo.png (couleur), logo-white.png, mark.png, favicon.png
```

```ts
type Client = {
  key: string;                       // "cress" | "tlst" — jamais lu par le code métier
  shortName: string; longName: string; orgGender: "m" | "f";   // « la CRESS », « le TLST »
  logos: { color: Img; white: Img; mark: Img; favicon: string };  // Img = { src, width, height }
  theme: Partial<Theme>;             // tokens CSS ; ce qui manque hérite du thème produit (globals.css)
  fonts: { titles: FontSpec; sans: FontSpec };  // { stack: string } ou { google: "Nom", weights: [...] }
  modules: string;                   // Settings.modules posé au seed
  settings: { serverPathTemplate: string; billingEmail: string; billingNote?: string };  // défauts posés au seed
  vocab: Vocab;                      // § 2
};
```

`Theme` = la liste complète des tokens de `app/globals.css` `:root` : fond, encre, carte, primaire (+ foreground), secondaire, muted, accent, destructive, bordure, input, ring, corail, menthe (mint, mint-soft, mint-pale), sable, warning (+ foreground, soft), danger (+ soft), info-soft, chart-1…5, radius, et le bloc sidebar (fond, texte, primary, primary-foreground, accent, accent-foreground, border, ring). Le fichier CRESS reprend les valeurs actuelles ; TLST part d'une palette proposée par Claude (verts / terre d'un tiers-lieu nourricier), à corriger par Gaël.

Sélection **au build** : `NEXT_PUBLIC_CLIENT` est lu dans `index.ts` ; Next embarque le bon fichier côté serveur et navigateur, sans requête ni provider. Le dev local : `NEXT_PUBLIC_CLIENT=tlst npm run dev`.

Règle inchangée (`produit.md`) : le code métier importe `client.shortName`, `V.edition`… jamais `client.key` ; pas de `if (client === …)`.

Préparation de l'écran Apparence (plus tard) : le fichier client est la **valeur par défaut** ; le jour venu, une surcharge en base (`Settings`) viendra se poser dessus dans un seul point (`lib/branding.ts`, qui expose `branding()` = fichier aujourd'hui, fichier + base demain). Dès ce lot, le layout et le composant Logo passent par `branding()`, pas par `client` directement.

## 2. Le vocabulaire

`lib/vocab.ts` :

```ts
type Word = { one: string; many: string; gender: "m" | "f" };
type Vocab = { projet: Word; edition: Word; action: Word; pole: Word; codir: Word; raf: Word; direction: Word; pilote: Word };
export const V: Vocab & { org: Word; orgLong: string }   // org = shortName avec orgGender
// helpers : cap(w) « Édition » ; le(w) « le pôle » / « l'équipe » ; un(w) ; du(w) « du pôle » / « de l'équipe » ;
//           de(w) « d'édition » / « de projet » ; ce(w) ; tout(w) « toute la CRESS » / « tout le TLST » ; adj(w, "nouveau", "nouvelle")
```

Table TLST de départ (à corriger par Gaël après avoir vu l'instance) :

| Clé | CRESS | TLST |
|---|---|---|
| org / orgLong | CRESS (f) / CRESS Centre-Val de Loire | TLST (m) / Tiers-Lieu Nourricier du Sud Touraine |
| projet | projet (m) | projet (m) |
| edition | édition (f) | action (f) |
| action (jalon) | action (f) | étape (f) |
| pole | pôle (m) | équipe (f) |
| codir | CODIR (m) | bureau (m) |
| raf | RAF (f) | trésorier·e (épicène : articles au féminin, « la trésorière ») |
| direction | direction (f) | coordination (f) |
| pilote | pilote | responsable |

Règles de passage des sources (≈ 104 fichiers pour « édition », 59 pour « pôle », 34 pour « CRESS ») :
- **Libellés** (menu, titres, colonnes, boutons, onglets, options, `aria-label`, placeholders, sujets de mail, noms de feuille Excel / titres Word, iCal `PRODID` et nom de calendrier, lexique) → `V` et helpers.
- **Phrases** (aides, descriptions, hints des permissions, notifications) → reformulées sans le mot quand c'est naturel, sinon interpolées.
- **Commentaires de code** → inchangés (explications, pas affichage).
- **Clés techniques** (`perimetre=cress`, `data-testid`, routes `/edition/[id]`, tables, `Person.role === "director"`, `modules` keys) → inchangées.
- `lib/lexique.ts` : `LEXIQUE` devient `lexique()` qui compose ses termes et définitions avec `V`.
- `lib/permissions.ts` (catalogue) et `lib/modules.ts` (`VISIBILITIES`, `INSTANCE_MODULES`) : libellés et hints composés avec `V` (fonctions ou getters, pas des constantes figées à l'import — mais comme `V` est statique au build, une constante calculée à l'import convient).

## 3. Nom, logos, favicon, thème, polices

- `app/layout.tsx` : `<title>` = `Pilote · {longName}` ; `<style>` inline dans `<head>` posant les tokens `:root` du thème client ; polices via `next/font/google` (spec `google`) ou pile locale (spec `stack`) exposées en `--font-titles` / `--font-sans`. `globals.css` garde ses valeurs actuelles comme thème produit de repli.
- `components/shell/logo.tsx` : `<Logo variant="color" | "white" | "mark" className />`, `alt` = `longName`. Remplace les `<img>` de `sidebar.tsx`, `topbar.tsx`, `auth-shell.tsx`. Fiches imprimées (bon pour accord, fiche de prêt) et projection CODIR : variante selon le fond.
- `app/icon.tsx` sert `logos.favicon` du client (PNG) ; `app/favicon.ico` supprimé. `public/logo-cress*.png` déplacés dans `public/clients/cress/`.
- `prisma/schema.prisma` : `Settings.serverPathTemplate` et `billingEmail` passent à `@default("")` ; le seed de chaque client pose ses valeurs (`client.settings`). Migration Prisma correspondante (défaut seulement, pas de données touchées).
- Les 34 fichiers citant « CRESS » : « Toute la CRESS » → `cap(tout(V.org))` ; « CRESS Centre-Val de Loire » → `V.orgLong` ; signatures « CRESS » → `V.org.one`.

## 4. Un seed par client

```
prisma/seed.ts           — aiguillage : NEXT_PUBLIC_CLIENT → seeds/<client>.ts
prisma/seeds/common.ts   — rôles et permissions, référentiels de base, natures de pièces, compte admin (DEMO_PASSWORD), Settings (client.modules, client.settings)
prisma/seeds/cress.ts    — le seed actuel déplacé, appelant common ; résultat identique (les tests en dépendent)
prisma/seeds/tlst.ts     — squelette + petite démo
```

Seed TLST : un pôle « Équipe » ; 5 personnes (coordination, trésorier·e, deux responsables, un·e assistant·e) ; 3 projets avec leur action 2026 (« Jardin partagé », « Cantine solidaire », « Ateliers réparation ») avec budget, équipe, quelques étapes ; 2 financeurs (Région Centre-Val de Loire, une fondation) avec lignes de financement et versements (un reçu, un attendu) ; 1 appel à projets en veille ; 10 adhérents (6 structures, 4 personnes) sur 2 collèges, cotisations mêlées réglées / à régler ; 4 règles de trésorerie (loyer, salaires, assurance, subvention annuelle) et un solde de départ ; 5 matériels et 1 prêt en cours ; 6 contacts et 1 liste. Vidable avant la reprise des vraies données (`prisma migrate reset` puis seed squelette : option `--skeleton` du seed TLST, sans la démo).

`npm run seed` inchangé ; `NEXT_PUBLIC_CLIENT=tlst npm run seed` ; `NEXT_PUBLIC_CLIENT=tlst npm run seed -- --skeleton`.

## 5. Déploiement par instance

- `deploy/instances/cress.env`, `deploy/instances/tlst.env` : `CLIENT`, `HOST`, `DIR`, `MEDIAS`, `DATA` (cress seulement, sauvegardes SQLite historiques), `DBNAME`, `DBUSER`, `PORT`, `BASE_PATH`, `PUBLIC_URL`, `SERVICE`, `BACKUP_DIR`.
- `deploy/deploy.sh <instance> [--seed]` : charge `deploy/instances/<instance>.env`, refuse sans argument ou instance inconnue ; plus aucun « cress » dans le script. Le `.env` serveur créé à la première mise en ligne reçoit `NEXT_PUBLIC_CLIENT`, `NEXT_PUBLIC_BASE_PATH`, `BETTER_AUTH_URL` depuis l'instance ; healthcheck sur `PUBLIC_URL/connexion` ; rideau `ACTIF-<instance>`.
- `deploy/systemd/pilote@.service` (unité paramétrée : `WorkingDirectory=/var/www/%i-pilote`, `EnvironmentFile`) ; `cress-pilote.service` conservé jusqu'au premier déploiement réussi sous `pilote@cress`, puis retiré (étape notée dans `deploy/README.md`).
- `deploy/nginx/tlst.bazixx.fr.conf` prêt (port 3003, `/outilcli/tlst/pilote`) ; DNS et certificat = étape « instance TLST », hors lot.
- Valeurs TLST : `DIR=/var/www/tlst-pilote`, `MEDIAS=/var/www/tlst-pilote-medias`, `DBNAME=tlst_pilote`, `PORT=3003`, `BASE_PATH=/outilcli/tlst/pilote`, `PUBLIC_URL=https://tlst.bazixx.fr/outilcli/tlst/pilote`.

## 6. Tests et vérification

- Suite Playwright existante sous `cress` : verte sans changer les attentes.
- `tests/habillage.spec.ts`, projet Playwright `tlst` : serveur de production sur `PW_PORT+1`, base `TEST_DATABASE_URL_TLST` (défaut `pilote_test_tlst`), `NEXT_PUBLIC_CLIENT=tlst`, seed TLST. Vérifie : `<title>`, `alt` du logo, favicon, « Tout le TLST » dans la bascule de périmètre, « Action » / « Étape » dans le menu, la fiche et le lexique, et **aucun** « CRESS » / « édition » / « pôle » / « CODIR » / « RAF » dans le HTML rendu de : portefeuille, fiche action, matrice, demandes, admin, annuaire, trésorerie, adhérents, matériel, notes.
- `scripts/check-vocab.mjs` : grep des sources (`app`, `components`, `lib`, hors commentaires `//` et `/* */`, hors `config/clients/`, `lib/vocab.ts`, `lib/lexique.ts` et `data-testid`) pour les mots en dur ; sortie = liste des fichiers/lignes ; code de retour ≠ 0 si trouvaille. Lancé par `npm run check:vocab` et dans le test d'habillage.
- Vérification visuelle en local sous `tlst` avant commit ; captures dans `docs/screens/tlst/`.
- Déploiement CRESS (`deploy.sh cress`) après le lot : l'instance en ligne ne doit rien changer d'apparent.

## Ordre de réalisation

1. Fichier client + `lib/vocab.ts` + `lib/branding.ts` + `config/clients/cress.ts` (valeurs actuelles) et `tlst.ts`.
2. Layout, Logo, favicon, thème, polices ; déplacement des logos ; migration des défauts `Settings`.
3. `scripts/check-vocab.mjs` (rouge au départ), puis passage des sources jusqu'au vert, en gardant la suite `cress` verte.
4. Seeds : découpage common / cress (résultat identique) ; seed TLST.
5. Test d'habillage `tlst`.
6. deploy.sh par instance, systemd, nginx, README.
7. Docs : `LOTS-TLST.md` (lot I fait ; Apparence en feuille de route), `produit.md` (« déjà en place »), `RETOURS-A-CHAUD.md`.
