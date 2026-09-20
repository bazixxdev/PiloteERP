# SEC-25 — PostgreSQL Docker Compose de développement

## Cause racine

`docker-compose.yml` publiait `5432:5432`, ce qui pouvait rendre PostgreSQL accessible sur toutes les interfaces. Le fichier utilisait également `pilote/pilote` en clair, sans indiquer explicitement qu’il s’agissait de valeurs DEV.

## Usage réel

Compose sert uniquement à fournir un PostgreSQL local lorsque Homebrew/Postgres.app ne sont pas disponibles. Les tests production-like utilisent une base locale jetable et peuvent réutiliser ce service ; aucune donnée réelle ne doit y être placée.

## Correction

Le port est maintenant lié explicitement à `127.0.0.1`. L’utilisateur, le mot de passe, la base et le port peuvent être surchargés par variables d’environnement, avec des valeurs par défaut strictement destinées au développement.

Avant : `5432:5432` (toutes interfaces selon Docker).

Après : `127.0.0.1:${POSTGRES_PORT:-5432}:5432`.

Le commentaire du fichier interdit son usage comme configuration de recette/production. Les secrets de production restent hors du dépôt.

## Validation

La configuration doit être vérifiée avec `docker compose config` puis le service démarré localement. La validation de disponibilité réseau depuis une autre machine n’est pas possible dans cet environnement ; le bind explicite garantit toutefois l’absence de publication volontaire sur l’interface publique.

Baseline exécutée après correction : npm ci PASS, Prisma generate PASS, unitaires 35/35 PASS, lint PASS, TypeScript PASS, build PASS. La suite sécurité production-like reste 33/33 au dernier passage.

## Limites

Les valeurs par défaut `pilote/pilote` restent faibles mais sont explicitement limitées au DEV local. Un poste compromis ou une exposition volontaire par une autre configuration Docker resterait hors de ce fichier.

## Verdict

**SEC-25 CORRIGÉ**.
