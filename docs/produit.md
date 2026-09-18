# Le Pilote comme produit — architecture cible (mise de côté le 15/09/2026)

Décision de Gaël le 15/09/2026 : **le Pilote devient le produit** « gestion d'association », dont la CRESS est le premier client et le Tiers-Lieu Sud Touraine (dépôt `erp-tlst`, juillet 2026) le deuxième. Analyse détaillée : `CRESS/point-fusion-erp-tlst-pilote.md`.

**Statut : mis de côté.** Tant que la CRESS est en prototype puis en recette (28/09, décembre), on ne construit pas le multi-client. On garde seulement les règles de structure ci-dessous pour ne pas se fermer la porte. Pas de SaaS : un produit installé, une instance par client.

## Le modèle : un code, une instance par client, la configuration hors du code

```
dépôt « pilote » (le produit)   — une branche main, des versions taguées (v1.0, v1.1…), jamais de branche par client
   ├─ instance CRESS   /var/www/cress-pilote   base « cress »   port 3002   CLIENT=cress
   ├─ instance TLST    /var/www/tlst-pilote    base « tlst »    port 3003   CLIENT=tlst
   └─ instance démo    (recette produit avant livraison)
```

Chaque instance : même build, sa base, son `.env`, son service systemd, son dossier de pièces, ses sauvegardes (convention outilcli sur bazixx-vps ; transposable chez le client). Pas de multi-tenant (colonne « client » dans les tables) : inutile à deux clients, risqué, et un client peut vouloir héberger ses données chez lui.

## Où vit ce qui est propre à un client — trois tiroirs, jamais le code métier

| Tiroir | Contient | Exemples |
|---|---|---|
| `.env` de l'instance | technique et secret | base, port, `basePath`, secret de session, clés Entra ID / HelloAsso, `CLIENT=` |
| `config/clients/<client>.ts` (versionné) | l'habillage | nom, logo, palette, vocabulaire (« édition » / « fiche », point médian), modules activés par défaut |
| `Settings` + référentiels en base | ce que le client règle lui-même | seuils, rythmes, chemin serveur, financeurs, natures de pièces, adresse de facturation |

## Mises à jour

- Une version = un tag git avec ses migrations. Livrer = `deploy.sh <instance> <version>` (build, sauvegarde, migrations, redémarrage, healthcheck, rollback).
- Chaque client a son rythme ; deux instances sur deux versions différentes, c'est normal.
- Démo d'abord, clients ensuite.

## Quand un client demande ce que l'autre ne veut pas

1. C'est un réglage → `Settings` / référentiel.
2. C'est un bloc → un **module** allumé ou éteint par instance (Temps, Adhérents, Trésorerie, Matériel…).
3. C'est utile à tous → dans le produit, pour tous.
Rien d'autre : jamais de patch d'instance.

## Règles de structure à respecter dès maintenant dans le Pilote (le seul engagement pris)

- Pas de « CRESS » en dur dans le code métier : logo, palette, libellés de vocabulaire, adresse de facturation, gabarit de chemin passent par `Settings`, la charte (`app/globals.css` tokens) ou, plus tard, `config/clients/`.
- Une seule fonction pour la personne courante (`getCurrentPerson`), une seule pour les droits (`lib/rights.ts` + `lib/scope.ts`) : c'est là que se brancheront l'auth et un étage de permissions par module.
- Les listes de valeurs en base (`RefValue`), pas en enum.
- Ce qui vient d'`erp-tlst` se réécrit sur le modèle Pilote et sur Radix ; on reprend les règles et les idées, pas les fichiers (kit UI Base UI incompatible, vocabulaire différent : l'`Action` TLST ≈ l'`Edition` Pilote).

## Déjà en place (15/09)

- **Habillage par client** (18/09, lot I) : `config/clients/<client>.ts` — nom court / long avec genre, quatre images (`public/clients/<client>/`), thème complet (tous les tokens de `globals.css`), polices (pile locale ou Google via `next/font`), modules et réglages posés au seed, **vocabulaire** (projet, édition, action, pôle, CODIR, RAF, direction, pilote). Sélection au build par `NEXT_PUBLIC_CLIENT` (`config/clients/index.ts`, imports statiques). `lib/vocab.ts` fournit `V` et les helpers d'article / d'accord (`le`, `un`, `du`, `de`, `au`, `ce`, `mon`, `son`, `tout`, `aucun`, `seul`, `adj`, `ppe`, `nb`…) ; `npm run check:vocab` (AST TypeScript, chaînes et texte JSX seulement) interdit tout mot en dur. `lib/branding.ts` est le seul point d'entrée du layout, du `<Logo>` et du favicon (`app/icon.tsx`) : l'écran admin › Apparence (feuille de route) viendra s'y brancher en surchargeant le fichier par la base. Seeds : `prisma/seeds/common.ts` (tronc), `cress.ts`, `tlst.ts` (`--skeleton`). Déploiement : `./deploy/deploy.sh <instance>` avec `deploy/instances/<instance>.env`, unité `pilote@.service`. Recette : projet Playwright `tlst`.

- **PostgreSQL** (17/09) : un moteur pour toutes les instances ; une base par instance (`cress_pilote`, demain `tlst_pilote`), sauvegarde `pg_dump` par déploiement, base de test séparée.
- **Organisations** (18/09, lot E2) : un annuaire par instance, genres cumulables (financeur, fournisseur, partenaire, réseau, collectivité) — le module Adhérents de TLST viendra s'y greffer (une organisation ou une personne adhérente).
- **Rôles et droits** (17/09, lot F2) : catalogue de permissions en code, rôles en base par instance (chaque structure règle ses droits, crée ses rôles), contexte en code.
- **Comptes et sessions** (17/09, lot F) : better-auth, `User` distinct de `Person` ; par instance, le fournisseur (mot de passe, demain Entra ID pour la CRESS, autre chose pour TLST) est un réglage, pas du code.
- `Settings.modules` + admin › Paramètres › Modules de l'installation (lot 0) : premier module activable, la veille des appels à projets. Le mécanisme est générique (`INSTANCE_MODULES`, `instanceHas`) ; chaque nouveau module ajoute une entrée et garde sa page derrière `instanceHas`.

## Ce qui sera fait quand le produit sera lancé (pas avant)

Entra ID (second fournisseur better-auth) → instance TLST en ligne et reprise des données d'erp-tlst → archivage d'`erp-tlst` → écran admin › Apparence (surcharge en base de `config/clients/`, Gaël vise plus de deux clients). Fait : auth, permissions, `Person` / contacts, modules par instance, `config/clients/`, `deploy.sh` par instance, portage des modules TLST.
