# Audit de clôture de la campagne sécurité

## 1. Résumé exécutif

Les corrections applicatives SEC-01 à SEC-19, SEC-24 et SEC-27 à SEC-29 sont présentes dans le dépôt et la baseline locale est verte. Les sujets d’infrastructure (SEC-20 à SEC-23, SEC-26) ne sont pas validés sur le VPS. SEC-25 n’a reçu aucune remédiation dédiée. Plusieurs preuves restent des tests unitaires/statics plutôt que des scénarios navigateur ou PostgreSQL intégration.

## 2. Matrice SEC-01 à SEC-29

| SEC | Sévérité | Constat | Statut actuel | Correctif / preuve | Dette restante | Action requise |
|---|---|---|---|---|---|---|
| 01 | Critique | MailOutbox/reset exposé | CORRIGÉ | `01-sec-01`; sécurité 33/33 | — | — |
| 02 | Élevé | exports sans auth effective | CORRIGÉ | `02-sec-02`; sécurité | — | — |
| 03 | Élevé | exports globaux/token | CORRIGÉ CÔTÉ DÉPÔT — VALIDATION VPS REQUISE | `03a/03b`; rotation testée | rotation token production | rotation VPS |
| 04 | Élevé | note privée sérialisée | CORRIGÉ | `04-sec-04`; sécurité | autres loaders à surveiller | — |
| 05 | Élevé | requiredLevel falsifiable | CORRIGÉ AVEC DETTE RÉSIDUELLE | `05`; unitaires | intégration PostgreSQL dédiée manquante | test intégration |
| 06 | Élevé | proposition budget bypass | CORRIGÉ AVEC DETTE RÉSIDUELLE | `06`; unitaires | scénario production-like dédié | test intégration |
| 07 | Élevé | rattachement pièce incohérent | CORRIGÉ AVEC DETTE RÉSIDUELLE | `07`; cohérence serveur | test upload DB/fichier dédié | test intégration |
| 08 | Moyen | ICS après désactivation | CORRIGÉ CÔTÉ DÉPÔT — VALIDATION VPS REQUISE | `08`; sécurité | rotation/flux équipe VPS | validation VPS |
| 09 | Moyen | sessions post-reset | CORRIGÉ | `09`; sécurité 33/33 | — | — |
| 10 | Moyen | suppression contact historique | CORRIGÉ AVEC DETTE RÉSIDUELLE | `10`; actions contacts | archivage global | BLK-20 |
| 11 | Moyen | copie mois verrouillé | CORRIGÉ AVEC DETTE RÉSIDUELLE | `11`; tests historiques limités | concurrence temps | BLK-11 |
| 12 | Moyen | tâche après réattribution | CORRIGÉ AVEC DETTE RÉSIDUELLE | `12`; correction action | test E2E historique à rejouer | tests |
| 13 | Moyen | CSV formule | CORRIGÉ | `13`; unitaires 35/35 | autres formats hors ticket | — |
| 14 | Moyen | tabnabbing notes | CORRIGÉ AVEC DETTE RÉSIDUELLE | `14`; config Tiptap | test navigateur opener manquant | test navigateur |
| 15 | Moyen | open redirect login | CORRIGÉ AVEC DETTE RÉSIDUELLE | `15`; unitaires | parcours navigateur/basePath | test navigateur |
| 16 | Faible | erreur Prisma client | CORRIGÉ AVEC DETTE RÉSIDUELLE | `16`; helper ciblé | QLT-09 global | harmonisation |
| 17 | Moyen | Server Action budget | CORRIGÉ AVEC DETTE RÉSIDUELLE | `17`; garde périmètre | POST Server Action réel | test intégration |
| 18 | Élevé | xlsx vulnérable | CORRIGÉ AVEC DETTE RÉSIDUELLE | `18`; ExcelJS | advisories ExcelJS/uuid | suivi dépendances |
| 19 | Moyen | PostCSS imbriqué | CORRIGÉ AVEC DETTE RÉSIDUELLE | `19`; override 8.5.28 | npm audit transitif/Next | surveillance |
| 20 | Élevé | mode démo production | CORRIGÉ CÔTÉ DÉPÔT — VALIDATION VPS REQUISE | `20`; tests config | env réel | contrôle VPS |
| 21 | Élevé | identité Unix partagée | CORRIGÉ CÔTÉ DÉPÔT — VALIDATION VPS REQUISE | `21`; systemd/deploy | non déployé sur VPS | migration VPS |
| 22 | Élevé | bind loopback implicite | CORRIGÉ CÔTÉ DÉPÔT — VALIDATION VPS REQUISE | `22`; commande explicite | `ss` réel | contrôle VPS |
| 23 | Moyen | tokens dans logs | CORRIGÉ CÔTÉ DÉPÔT — VALIDATION VPS REQUISE | `23`; format Nginx | nginx -t/logs réels | installation VPS |
| 24 | Moyen | HTTP assimilé local | CORRIGÉ | `24`; unitaires | env public réel | vérifier VPS |
| 25 | Moyen | PostgreSQL Compose exposé | NON TRAITÉ | aucune remédiation | port/identifiants dev | fermer avant usage réseau |
| 26 | Moyen | backup/rollback insuffisant | CORRIGÉ CÔTÉ DÉPÔT — VALIDATION VPS REQUISE | `26`; tests locaux | restauration copie VPS/uploads | validation opératoire |
| 27 | Moyen | saveField invariants | CORRIGÉ AVEC DETTE RÉSIDUELLE | `27`; matériel couvert | autres champs sensibles | BLK-14 |
| 28 | Moyen | cascade paiement | CORRIGÉ AVEC DETTE RÉSIDUELLE | `28`; garde applicatif | FK Cascade conservée | BLK-03 |
| 29 | Moyen | décisions concurrentes | CORRIGÉ AVEC DETTE RÉSIDUELLE | `29`; claim atomique | test PostgreSQL concurrent réel | BLK-11 |

## 3. Actions VPS

**Critique avant données réelles** : créer les utilisateurs Unix et appliquer l’isolation CRESS/TLST ; vérifier `PILOTE_DEMO=0`, HTTPS et `BETTER_AUTH_URL`; installer systemd/Nginx, `--hostname 127.0.0.1`, puis `ss`/health checks ; exécuter `nginx -t` et vérifier les logs sans sentinelles ; effectuer rotation apiToken/ICS si les anciens logs sont accessibles ; tester backup/restauration hors production.

**Important** : vérifier permissions des secrets/uploads/logs, firewall, rétention des logs, sauvegarde médias et rollback code+DB.

**Post-production** : smoke tests publics, rotation périodique et contrôle des consommateurs ICS/exports.

## 4. Dettes de tests

**Bloquant prod** : aucun nouveau test local ne remplace la validation VPS ci-dessus.

**Important** : scénarios PostgreSQL production-like SEC-05/06/07, concurrence SEC-29, navigateur `window.opener` SEC-14, post-login SEC-15, réponse Server Action Prisma SEC-16/17.

**Amélioration** : tests historiques auth/kanban et couverture des autres champs `saveField`.

## 5. Dettes structurelles

BLK-03 (cascades financières), BLK-04 (relations polymorphes), BLK-11 (transactions/concurrence), BLK-14 (retrait de `saveField`), BLK-18 (pyramide de tests), BLK-20 (archivage/rétention) et QLT-09 (contrat d’erreur global) restent ouverts.

## 6. Gate avant données réelles

**Bloquants avant données réelles** : SEC-25 ; validation VPS de SEC-20/21/22/23/26 ; rotation des secrets potentiellement présents dans les anciens logs ; restauration réelle vérifiée ; isolation Unix et HTTPS public vérifiés.

**À faire rapidement mais non bloquant** : tests d’intégration SEC-05/06/07/14/15/16/17/29 et couverture des champs sensibles restants.

**Dette technique** : BLK-03/04/11/14/18/20 et QLT-09.

## 7. Baseline finale

- `npm ci` : PASS
- `prisma generate` : PASS
- tests unitaires : **35/35 PASS**
- `npm run test:security` : **33/33 PASS**
- lint : PASS
- TypeScript : PASS
- build production : PASS
- `npm audit` : **5 avis** (2 modérés, 3 élevés), notamment ExcelJS/UUID, Prisma et transitifs Next/PostCSS.

## VERDICT DE CLÔTURE

**PRÊT POUR VALIDATION VPS**. Le dépôt est testable et les correctifs applicatifs principaux sont présents, mais la mise en production avec données réelles reste conditionnée aux validations infrastructure et à la fermeture de SEC-25.
