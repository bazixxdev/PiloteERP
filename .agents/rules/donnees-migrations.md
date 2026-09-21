# Données, schéma et migrations

Intégrité en PostgreSQL, deux instances (CRESS, TLST) sur le même code, données réelles possibles.

## Quand lire ce fichier

- Modification de `prisma/schema.prisma`, création d'une migration, suppression ou cascade, opération multi-étapes, archivage.

## Règles

- **CRITICAL** — expand / contract : une migration ajoute (colonne nullable, table, index) et le code s'y adapte ; la suppression ou le `NOT NULL` vient dans une release **suivante**, quand plus rien ne lit l'ancien. Un renommage = ajout + copie des données dans la même migration (comme `Call.note → description`), l'ancienne colonne reste jusqu'à la release suivante.
- **NEVER** une migration qui perd des données sans l'écrire dans le commit et dans `docs/decisions.md`, et sans l'avoir rejouée sur un dump de production restauré (`docs/remediation/111-…` montre comment ; `deploy.sh` fait le dump avant).
- **NEVER** `onDelete: Cascade` vers une table d'historique ou financière (`Payment`, `TimeEntry`, `ValidationRequest`, `ChangeLog`, `Attachment`) sans revue explicite ; préférer `Restrict` + archivage (`archivedAt`) ou une garde applicative qui détache (SEC-10, SEC-28).
- **ALWAYS** une transaction (`prisma.$transaction`) pour toute mutation multi-étapes dont un échec partiel laisserait un état incohérent (création + rattachement, suppression + remplacement, reconduction). Nommer la frontière dans un commentaire.
- **ALWAYS** une contrainte en base quand elle suffit et est stable (unique, FK, check) plutôt qu'un contrôle applicatif seul.
- **ALWAYS** régénérer le client après un changement de schéma : `npx prisma generate` — le client généré est commun à toutes les branches ; un `tsc` qui échoue sur des propriétés Prisma « inconnues » vient de là.
- Rattachements polymorphes (une pièce, une tâche, une note rattachée à plusieurs types de parents) : vérifier la cohérence côté serveur (`attachmentParentsAreConsistent`) et n'accepter que des parents de la **même édition / même dossier**.
- Historique : une suppression métier est un archivage (`archivedAt`, `active=false`) ; la suppression physique est réservée aux objets sans référence (contrôlée : `bulkDeleteContacts` refuse un contact encore cité). Politique uniforme à finir (BLK-20).
- Seeds : 100 % fictifs, relatifs à `today` pour les dates récentes, mais **stables** pour ce que les tests visent (voir tests-recette.md).
- Locale et vocabulaire : jamais un mot du vocabulaire client en dur dans ce qui s'affiche — `V`, `cap`, `le`, `de`, `ce`, `un` de `lib/vocab.ts` (`npm run check:vocab`).

## Checklist migration

1. `npx prisma migrate dev --name <snake_case>` → relire le SQL généré, l'annoter (pourquoi, ce qui est copié).
2. `npx prisma generate`, `npm run check`.
3. Si la migration touche des données existantes : la rejouer sur un dump restauré (`pg_restore` dans une base jetable, `prisma migrate deploy`, requête de contrôle).
4. Déployer par `deploy.sh` uniquement (dump + archive médias avant, migration, bascule, healthcheck).
