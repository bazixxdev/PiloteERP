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

## Ce qui sera fait quand le produit sera lancé (pas avant)

Postgres → auth better-auth (+ Entra ID) → permissions par module en base (matrice) au-dessus des droits contextuels → `Person` → `Personne` élargie (externes, contacts) → modules activables par instance → `config/clients/` → `deploy.sh` paramétré par instance → portage des modules TLST (Adhérents/HelloAsso, Pennylane, Trésorerie, Matériel) → archivage d'`erp-tlst`.
