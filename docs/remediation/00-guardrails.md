# Garde-fous de remédiation sécurité

Date : 20 septembre 2026  
Snapshot de départ : `3a0a6144474edb1aa1c7554ac68ea545251e74c4`  
Références : `docs/audit/01-securite.md`, `docs/audit/05-tests-robustesse.md`, `docs/audit/07-backlog-consolide.md`

## Objectif et périmètre

Cette étape prépare un profil de test production-like et les fixtures nécessaires aux prochains tickets `SEC-01` à `SEC-07` et `SEC-20`. Elle ne corrige aucune vulnérabilité applicative et ne remplace pas la suite E2E existante.

Le profil est conçu pour :

- `PILOTE_DEMO=0` et des sessions Better Auth séparées ;
- une base PostgreSQL dédiée indiquée par `SECURITY_DATABASE_URL` ;
- des comptes fictifs issus du seed CRESS ;
- un secret Better Auth de recette uniquement ;
- aucun appel externe implicite : les futurs tests devront fournir leurs doubles locaux ;
- un répertoire d’uploads séparé (`SECURITY_UPLOAD_DIR`).

La base et le répertoire sont jetables. Il est interdit de pointer `SECURITY_DATABASE_URL` ou `SECURITY_UPLOAD_DIR` vers une instance de développement ou de production.

## Fichiers créés

- `playwright.security.config.ts` : configuration Playwright isolée, distincte de `playwright.config.ts`, avec `PILOTE_DEMO=0`, rate limit actif, base URL et base PostgreSQL obligatoires.
- `tests/security/global-setup.ts` : migration et seed de la base dédiée, création de storage states séparés pour les acteurs.
- `tests/security/fixtures.ts` : acteurs, connexion indépendante, cookie invalide, helper HTTP et helper Server Actions.
- `docs/remediation/00-guardrails.md` : ce document.

Aucun fichier applicatif sous `app/`, `lib/`, `components/` ou `prisma/` n’a été modifié. Aucun scénario SEC rouge n’est ajouté à ce stade.

## Fonctionnement du profil production-like

Le profil n’utilise pas le `storageState` partagé, le sélecteur « Je suis… », le mode démo ou les mocks de la suite historique. `global-setup.ts` exécute migration, seed, puis une connexion HTTP distincte pour chaque acteur. Les états sont écrits sous `tests/.security-auth/<acteur>.json`.

Exemple de préparation :

```bash
createdb pilote_security_local
export SECURITY_DATABASE_URL='postgresql://pilote_security@localhost:5432/pilote_security_local'
export SECURITY_BASE_URL='http://localhost:3200'
export SECURITY_TEST_PASSWORD='security-test-password-2026'
export SECURITY_UPLOAD_DIR="$PWD/.security-uploads"
export DATABASE_URL="$SECURITY_DATABASE_URL"
export BETTER_AUTH_URL="$SECURITY_BASE_URL/api/auth"
export BETTER_AUTH_SECRET='security-test-only-secret-change-per-run-000000000000'
export PILOTE_DEMO=0
export AUTH_RATE_LIMIT=5
export NEXT_PUBLIC_CLIENT=cress
export UPLOAD_DIR="$SECURITY_UPLOAD_DIR"

NEXT_DIST_DIR=.next-security npm run build
NEXT_DIST_DIR=.next-security npm run start -- -p 3200
```

Dans un autre terminal, avec les mêmes variables :

```bash
npx playwright test --config=playwright.security.config.ts
```

Le répertoire `tests/security/` ne contient volontairement pas encore de fichiers `*.spec.ts`. Le profil et le setup sont un harnais à remplir ticket par ticket, sans introduire une suite rouge impossible à merger.

## Acteurs et helpers disponibles

Les identités proviennent du seed CRESS et sont fictives :

| Clé | Personne | Rôle métier | Usage |
|---|---|---|---|
| `contributor` | Lucas Perrin | contributor | droits minimaux, accès objet étranger |
| `pilot` | Thomas Guérin | pilot | décisions et projets |
| `raf` | Nadia Ferrand | raf | finances et administration déléguée |
| `director` | Claire Vasseur | director | direction/admin |
| `disabled` | Manon Girard | contributor | compte à désactiver dans un scénario |

Les mots de passe sont injectés par `SECURITY_TEST_PASSWORD` et ne sont pas des secrets de production. Chaque acteur obtient son propre cookie de session dans un fichier de contexte différent.

`tests/security/fixtures.ts` fournit les acteurs, l’anonyme, le cookie invalide, la connexion, les contextes/pages et `postServerAction`.

La fixture `disabled` est préparée comme identité ; sa désactivation effective doit être faite dans le scénario qui la teste, puis restaurée ou effectuée sur une base recréée.

## Structure prévue pour les prochains tickets

Chaque ticket ajoutera un fichier ciblé sous `tests/security/`, par exemple `sec-01-reset-access.spec.ts` jusqu’à `sec-20-tenant-or-instance-isolation.spec.ts`.

Le cycle attendu est : test reproduisant le problème, correction minimale dans un ticket séparé, même test vert, baseline et suite sécurité, revue du diff et vérification qu’aucune donnée réelle n’est utilisée.

## Commandes de baseline

État vérifié sur la copie de travail au 20 septembre 2026 :

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run build
```

Résultats :

- `npm run lint` : succès, aucune erreur signalée ;
- `npx tsc --noEmit` : succès, aucune erreur signalée ;
- `npm run test:unit` : succès, 7 tests passés ;
- `npm run build` : succès avec Next 15.5.25 ; warnings de build déjà observés (cache webpack volumineux et avertissements runtime Node/localStorage).

Le build ne constitue pas une preuve de déploiement réel, de restauration PostgreSQL ou de disponibilité des services externes.

## Commandes de contrôle du diff

```bash
git status --short
git diff -- playwright.security.config.ts tests/security docs/remediation/00-guardrails.md
git diff -- app lib components prisma deploy
```

Le second diff doit rester vide pour cette étape. Les fichiers de session générés sous `tests/.security-auth/` et les uploads de recette ne doivent pas être commités.

## Limites restantes

- La création du rôle PostgreSQL, de la base et l’isolation réseau restent à la charge de la recette.
- Aucun serveur Next n’est automatiquement lancé par ce profil.
- Aucun mock Brevo, HelloAsso ou Pennylane n’est branché automatiquement.
- Les identifiants de Server Actions sont générés par le build et doivent être récupérés au moment du test.
- Les scénarios SEC-01 à SEC-07 et SEC-20 restent à écrire dans les tickets suivants.
- Les tests de migration, concurrence et restauration restent à ajouter dans les lots dédiés.

