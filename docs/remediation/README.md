# PiloteERP — Historique d’audit, remédiation et durcissement

Ce document est l’index maître de la campagne sécurité de PiloteERP. Il décrit le point de départ, les corrections, les preuves, l’état VPS et les dettes restantes. Les documents référencés restent les sources détaillées.

## A. Point de départ

- **Dépôt :** `bazixxdev/CRESS/pilote`.
- **Branche auditée :** `main`.
- **Commit initial audité :** `3a0a614` (`audit-2026-09-19`), commit du 19 septembre 2026 ; les documents d’audit et de remédiation n’étaient pas encore suivis dans ce commit.
- **Commit actuel documenté :** `3a0a6144474edb1aa1c7554ac68ea545251e74c4` ; l’arbre de travail contient les corrections et documents non committés.
- **Période :** audit applicatif initial le 19 septembre 2026, mise en conformité VPS les 20 septembre 2026.
- **Stack initiale :** Next.js 15.5.25, Better Auth 1.7.5, TypeScript, Prisma 6.19.3, PostgreSQL, Nginx, systemd, deux instances CRESS/TLST.
- **Raison du chantier :** fermer les findings d’autorisation, d’intégrité métier, d’exports, de dépendances et de production avant l’usage avec données réelles.
- **État initial :** données réelles non autorisées tant que SEC-01 à SEC-07 et les contrôles d’infrastructure n’étaient pas fermés ; mode démo, identité Unix partagée, bind Next non explicitement loopback, logs tokenisables et garanties backup insuffisantes étaient présents dans la configuration.

## B. Chronologie

| Étape | Date | Référence | Commit identifiable | Résultat |
|---|---|---|---|---|
| Construction initiale de l’application | 12–18/09/2026 | historique Git, lots 1–F | commits historiques | socle métier et multi-instance créé |
| Audit sécurité, données, qualité, production | 19/09/2026 | `docs/audit/01` à `07` | `3a0a614` comme point de référence | 29 findings SEC et backlog consolidé |
| Garde-fous et profil production-like | 19/09/2026 | [`00-guardrails`](00-guardrails.md) | non identifiable dans l’arbre actuel | harness et fixtures préparés |
| Remédiations applicatives SEC-01 à SEC-19 | 19–20/09/2026 | [`01` à `19`](.) | regroupées dans l’arbre de travail | contrôles authz, intégrité, exports et dépendances renforcés |
| Remédiations production SEC-20 à SEC-26 | 19–20/09/2026 | [`20` à `26`](.) | non identifiable séparément | scripts, unités, loopback, config HTTP, backups corrigés côté dépôt |
| Remédiations SEC-27 à SEC-29 | 20/09/2026 | [`27` à `29`](.) | non identifiable séparément | invariants génériques, paiement et concurrence traités avec dettes explicites |
| Audit VPS en lecture seule | 20/09/2026 | [`100-vps-readonly-audit`](100-vps-readonly-audit.md) | — | 8 écarts bloquants constatés |
| VPS-01 environnement production | 20/09/2026 | [`102-vps-prod-env`](102-vps-prod-env.md) | — | backups, `PILOTE_DEMO=0`, HTTPS et redémarrages validés |
| VPS-02 réseau | 20/09/2026 | [`103-vps-network`](103-vps-network.md) | — | Next loopback et UFW actif, ports internes filtrés |
| VPS-03 Unix/systemd | 20/09/2026 | [`104-vps-unix-systemd`](104-vps-unix-systemd.md) | — | comptes dédiés, permissions séparées et hardening effectif |
| VPS-04 Nginx/logs | 20/09/2026 | [`105-vps-nginx-tokens`](105-vps-nginx-tokens.md) | — | redaction active et sentinelles absentes ; rotation porteuse restante |

Les remédiations documentaires ont été produites dans un arbre de travail qui n’a pas de commits de remédiation séparés identifiables via `git log --follow`. Aucun SHA n’est inventé.

## C. Matrice SEC-01 à SEC-29

| Finding | Sévérité initiale | Résumé | Remédiation | Tests | État actuel | Dette restante | Rapport |
|---|---|---|---|---|---|---|---|
| SEC-01 | Critique | prise de compte via reset/outbox | cloisonnement reset et outbox | sécurité HTTP | CORRIGÉ | tests d’intégration élargis | [01](01-sec-01-reset-outbox.md) |
| SEC-02 | Élevé | exports accessibles sans session effective | garde d’authentification et permissions | sécurité HTTP | CORRIGÉ | couverture d’exports à maintenir | [02](02-sec-02-exports-anonymes.md) |
| SEC-03 | Élevé | exports globaux et secret porteur exposés | rôles, token dédié, routes contrôlées | SEC-03A/03B | CORRIGÉ AVEC DETTE | rotation réelle apiToken VPS | [03a](03a-sec-03-exports-roles.md), [03b](03b-sec-03-api-token.md) |
| SEC-04 | Élevé | notes privées sérialisées | filtrage avant rendu | sécurité | CORRIGÉ | surveiller nouveaux loaders | [04](04-sec-04-notes-privees.md) |
| SEC-05 | Élevé | niveau de validation falsifiable | niveau calculé côté serveur | unitaires/sécurité | CORRIGÉ AVEC DETTE | intégration PostgreSQL dédiée | [05](05-sec-05-validation-level.md) |
| SEC-06 | Élevé | budget modifiable sans permission | matrice champ-permission et garde serveur | unitaires/sécurité | CORRIGÉ AVEC DETTE | parité complète des couches, BLK-14 | [06](06-sec-06-propositions-budget.md) |
| SEC-07 | Élevé | pièce jointe rattachable à un tiers | cohérence serveur édition/objet | unitaires/sécurité | CORRIGÉ AVEC DETTE | test upload DB/fichier dédié | [07](07-sec-07-pieces-jointes.md) |
| SEC-08 | Moyen | ICS actif après désactivation | vérification `Person.active` | 2/2 sécurité | CORRIGÉ AVEC DETTE | rotation personnelle manuelle | [08](08-sec-08-ics-desactivation.md) |
| SEC-09 | Moyen | sessions conservées après reset | révocation des sessions anciennes | sécurité | CORRIGÉ | — | [09](09-sec-09-reset-sessions.md) |
| SEC-10 | Moyen | suppression de contact et références perdues | archivage/suppression contrôlée | sécurité | CORRIGÉ AVEC DETTE | archivage global, BLK-20 | [10](10-sec-10-suppression-contacts.md) |
| SEC-11 | Moyen | copie de temps dans mois clôturé | garde de période verrouillée | unitaires/sécurité | CORRIGÉ AVEC DETTE | concurrence temporelle | [11](11-sec-11-temps-mois-verrouille.md) |
| SEC-12 | Moyen | tâche conservant droits après réattribution | recalcul du périmètre d’accès | sécurité | CORRIGÉ AVEC DETTE | E2E historique | [12](12-sec-12-tache-apres-reattribution.md) |
| SEC-13 | Moyen | formules dans CSV | neutralisation des débuts de formule | unitaires 35/35 | CORRIGÉ | autres formats à surveiller | [13](13-sec-13-csv-formula.md) |
| SEC-14 | Moyen | tabnabbing dans notes | liens sûrs et `noopener` | unité, navigateur restant | CORRIGÉ AVEC DETTE | test navigateur opener | [14](14-sec-14-tabnabbing.md) |
| SEC-15 | Moyen | open redirect après login | redirect interne/basePath contrôlé | unitaires | CORRIGÉ AVEC DETTE | test navigateur | [15](15-sec-15-open-redirect.md) |
| SEC-16 | Faible | erreur Prisma exposée | erreurs internes normalisées | unitaires | CORRIGÉ AVEC DETTE | test Server Action réel | [16](16-sec-16-erreurs-prisma.md) |
| SEC-17 | Moyen | budget lisible par Server Action anonyme | garde d’authentification et périmètre | unitaires | CORRIGÉ AVEC DETTE | test HTTP Server Action | [17](17-sec-17-budget-action-auth.md) |
| SEC-18 | Élevé | SheetJS vulnérable | remplacement/limitation par ExcelJS | lint/build/sécurité | CORRIGÉ AVEC DETTE | veille advisories | [18](18-sec-18-xlsx.md) |
| SEC-19 | Moyen | PostCSS vulnérable imbriqué | override de version | lint/build | CORRIGÉ AVEC DETTE | dépendances transitives | [19](19-sec-19-postcss.md) |
| SEC-20 | Élevé | mode démo en production | refus prod + `PILOTE_DEMO=0` explicite | tests config, VPS-01 | VALIDATION VPS EFFECTUÉE | seed explicite réservé recette | [20](20-sec-20-mode-demo-production.md), [102](102-vps-prod-env.md) |
| SEC-21 | Élevé | identité Unix partagée | comptes dédiés, ownership et systemd | tests statiques + VPS-03 | VALIDATION VPS EFFECTUÉE | deploy.sh à aligner | [21](21-sec-21-isolation-instances.md), [104](104-vps-unix-systemd.md) |
| SEC-22 | Élevé | bind loopback implicite | `--hostname 127.0.0.1` | unitaires + VPS-02 | VALIDATION VPS EFFECTUÉE | — | [22](22-sec-22-loopback-next.md), [103](103-vps-network.md) |
| SEC-23 | Moyen | tokens journalisables | `pilote_safe`, map ICS, logs sans sentinelles | test runtime VPS-04 | CORRIGÉ AVEC DETTE | rotation apiToken/ICS | [23](23-sec-23-tokens-logs.md), [105](105-vps-nginx-tokens.md) |
| SEC-24 | Moyen | HTTP assimilé au local | profils explicites, HTTPS prod, rate limit | unitaires/build + VPS-01 | VALIDATION VPS EFFECTUÉE | — | [24](24-sec-24-http-local-config.md), [102](102-vps-prod-env.md) |
| SEC-25 | Moyen | PostgreSQL Compose exposé | non traité dans cette campagne | audit dépôt | REPORTÉ | fermer avant usage réseau | [25](25-sec-25-postgres-compose.md) |
| SEC-26 | Moyen | backup/rollback insuffisants | dump validé, archive médias, rollback documenté | unitaires script + VPS-01 | CORRIGÉ AVEC DETTE | restauration réelle hors production | [26](26-sec-26-backup-rollback.md), [102](102-vps-prod-env.md) |
| SEC-27 | Moyen | champs génériques contournant invariants | gardes et invariants spécialisés | unitaires/sécurité | CORRIGÉ AVEC DETTE | retrait progressif saveField | [27](27-sec-27-savefield-invariants.md) |
| SEC-28 | Moyen | paiement supprimé par cascade indirecte | garde applicative de détachement | unitaires/sécurité | CORRIGÉ AVEC DETTE | cascade DB et BLK-03 | [28](28-sec-28-paiement-cascade.md) |
| SEC-29 | Moyen | décisions concurrentes non sérialisées | claim atomique et garde serveur | unitaires | CORRIGÉ AVEC DETTE | test PostgreSQL concurrent réel | [29](29-sec-29-propositions-concurrence.md) |

## D. Principales corrections par domaine

### Authentification / comptes

SEC-01 a séparé la boîte d’envoi et les liens de reset ; SEC-08 refuse désormais le flux ICS d’une personne inactive ; SEC-09 révoque les sessions concurrentes après reset. Le principe retenu est de contrôler identité, état du compte et durée de session côté serveur avant toute donnée sensible.

### Autorisations

SEC-02, SEC-03, SEC-04 et SEC-17 ont renforcé les gardes de session, rôle, permission et ressource, y compris avant sérialisation. SEC-16 normalise les erreurs Prisma. SEC-03 conserve néanmoins un token externe qui doit encore être tourné en production.

### Finance

SEC-05 calcule le niveau de validation côté serveur ; SEC-06 protège budget/spent par permission ; SEC-28 ferme le chemin de suppression de paiement ; SEC-29 rend la décision atomique côté application. Les tests PostgreSQL de concurrence et certains scénarios d’intégration restent à ajouter.

### Intégrité métier

SEC-07 vérifie la cohérence des pièces et rattachements ; SEC-10 protège l’historique des contacts ; SEC-11 bloque les mois clôturés ; SEC-12 recalcule les droits après réattribution ; SEC-27 limite les mutations génériques. La stratégie globale d’archivage et la sortie de `saveField` restent planifiées.

### Exports / contenu

SEC-13 neutralise les formules CSV ; SEC-14 sécurise les liens riches ; SEC-15 borne les redirections ; SEC-16 cache les détails internes. Les tests navigateur SEC-14/15 et certains tests HTTP restent une dette de preuve.

### Dépendances

SEC-18 remplace le chemin SheetJS vulnérable et SEC-19 fixe le PostCSS ciblé. La baseline npm signale encore 5 vulnérabilités (2 modérées, 3 élevées) ; il faut maintenir la veille et requalifier les transitives.

### Production

SEC-20 à SEC-26 ont établi le fail-fast de configuration, l’isolation Unix, le loopback, la redaction, les profils HTTPS et les sauvegardes DB/médias. SEC-25 est reporté. La restauration réelle DB+médias et la rotation des secrets porteurs restent ouvertes.

## E. Évolution des tests

Le dépôt contient un profil security production-like (`playwright.security.config.ts`), des fixtures dédiées, les tests unitaires sous `tests/unit`, une suite `npm run test:security`, et des validations de configuration/deploy. Les tests de seed et migrations utilisent le chemin PostgreSQL prévu (`prisma migrate deploy`) dans le harness lorsque la variable de base de sécurité est fournie.

Protections permanentes principales : refus prod+démo, URL HTTPS et rate limit non nul, guards avant sérialisation, contrôle serveur des niveaux et permissions, neutralisation CSV, ownership séparé, `--hostname 127.0.0.1`, `pilote_safe`, backups non vides et vérification de rollback.

Dette de preuve : intégration SEC-05/06/07, navigateur SEC-14/15, test Server Action SEC-16, test HTTP SEC-17, concurrence PostgreSQL SEC-29, tests historiques supplémentaires et couverture des champs sensibles restants.

## F. Durcissement du VPS

| Contrôle | Avant | Après | Preuve | Document |
|---|---|---|---|---|
| `NODE_ENV` | injecté par unité, `.env` incomplet | `production` confirmé CRESS/TLST | VPS-01 | [102](102-vps-prod-env.md) |
| `PILOTE_DEMO` | `1` | `0` | VPS-01 | [102](102-vps-prod-env.md) |
| Next bind | `*:3002`, `*:3003` | `127.0.0.1:3002`, `127.0.0.1:3003` | `ss`, smoke HTTPS | [103](103-vps-network.md) |
| Firewall | UFW inactif, INPUT ACCEPT | UFW actif, deny incoming, 22/80/443 autorisés | nouvelle connexion SSH + tests externes | [103](103-vps-network.md) |
| PostgreSQL | loopback | loopback, 5432 filtré | `ss` + test externe | [103](103-vps-network.md) |
| Utilisateurs Unix | `www-data` partagé | `pilote-cress` / `pilote-tlst`, nologin | `systemctl show`, `runuser` | [104](104-vps-unix-systemd.md) |
| Code | partagé et runtime writable | `root:root`, non inscriptible | tests de sentinelle | [104](104-vps-unix-systemd.md) |
| Secrets | `.env` `0644`, partagé | owner instance, `0600` | `stat`, tests croisés | [104](104-vps-unix-systemd.md) |
| Uploads | `www-data`, `0755` | owner instance, `0750`, isolation croisée | sentinelles | [104](104-vps-unix-systemd.md) |
| systemd | protections absentes, umask 0022 | protections strictes, umask 0077, RW limité | `systemctl show` | [104](104-vps-unix-systemd.md) |
| HTTPS | vhosts existants | HTTPS et redirections validés | smoke tests | [102](102-vps-prod-env.md), [103](103-vps-network.md) |
| Nginx | format par défaut | `pilote_safe` actif sur CRESS/TLST | `nginx -t`, `nginx -T` | [105](105-vps-nginx-tokens.md) |
| Log redaction | URLs tokenisables | query strings et chemins ICS normalisés | sentinelles NOT FOUND | [105](105-vps-nginx-tokens.md) |
| Backups DB | présents mais permissions larges | dumps frais non vides, `0600` | point de retour VPS-01 | [102](102-vps-prod-env.md) |
| Backups médias | non démontrés | archives séparées non vides, `0600` | point de retour VPS-01 | [102](102-vps-prod-env.md) |
| Rollback | non prouvé | configuration et procédures conservées | répertoires de backup VPS | [102](102-vps-prod-env.md), [104](104-vps-unix-systemd.md), [105](105-vps-nginx-tokens.md) |

## G. État VPS actuel

- **VPS-01 : CONFORME** pour environnement production, backups préalables, mode démo désactivé et redémarrages.
- **VPS-02 : CONFORME** pour loopback Next et firewall OS. Hostinger n’a pas pu être vérifié via les outils disponibles.
- **VPS-03 : CONFORME** pour comptes Unix, permissions, isolation croisée et hardening systemd. `deploy.sh` conserve une dette de `chown -R` du code à traiter ultérieurement.
- **VPS-04 : PARTIEL.** `pilote_safe` est actif, les sentinelles finales sont absentes des logs et les permissions sont resserrées ; l’exposition historique est confirmée, la rotation apiToken n’est pas effectuée et la rotation ICS n’est pas opérable sur l’instance active.

## H. Procédures opérationnelles

- Déploiement : [`deploy/README.md`](../../deploy/README.md), [`deploy/deploy.sh`](../../deploy/deploy.sh), [SEC-20](20-sec-20-mode-demo-production.md), [SEC-26](26-sec-26-backup-rollback.md).
- Backup, restauration et rollback : [SEC-26](26-sec-26-backup-rollback.md), [VPS-01](102-vps-prod-env.md).
- Isolation des instances : [SEC-21](21-sec-21-isolation-instances.md), [VPS-03](104-vps-unix-systemd.md).
- Validation réseau : [SEC-22](22-sec-22-loopback-next.md), [VPS-02](103-vps-network.md).
- Rotation apiToken : [SEC-03B](03b-sec-03-api-token.md), avec blocage opérationnel constaté dans [VPS-04](105-vps-nginx-tokens.md).
- ICS et désactivation : [SEC-08](08-sec-08-ics-desactivation.md), [VPS-04](105-vps-nginx-tokens.md).
- Audit VPS : [audit lecture seule](100-vps-readonly-audit.md), puis [VPS-01](102-vps-prod-env.md) à [VPS-04](105-vps-nginx-tokens.md).

## I. Principes désormais non négociables

- authentification != autorisation ;
- contrôle avant sérialisation ;
- mutation indirecte = mêmes invariants que mutation directe ;
- niveau de validation calculé serveur ;
- `saveField` progressivement réservé aux champs triviaux ;
- une commande métier canonique par invariant ;
- aucune donnée financière historique supprimée indirectement ;
- transaction pour les opérations multi-étapes critiques ;
- production fail-fast sur configuration dangereuse ;
- secrets jamais dans les logs ;
- runtime sans écriture sur le code.

## J. Dette technique encore planifiée

- **BLK-03 :** cascades financières et protection structurelle des paiements ; SEC-28 ferme le chemin testé mais pas toute la cascade.
- **BLK-04 :** modèle/rattachements polymorphes et cohérence globale.
- **BLK-11 :** transactions et concurrence des commandes multi-étapes.
- **BLK-14 :** retrait progressif de `saveField` comme second moteur métier.
- **BLK-18 :** pyramide unitaires/intégration/API et scénarios navigateur.
- **BLK-20 :** archivage, rétention et historisation uniformes.
- **QLT-09 :** contrat global d’erreurs internes.
- **BLK-07/22 :** restauration opérationnelle réelle et politique de dépendances/configuration.

Ces dettes ne signifient pas que les scénarios SEC correspondants restent ouverts : elles décrivent les limites de conception, de preuve ou de généralisation explicitement conservées par les rapports.

## K. Actions restantes avant clôture définitive

1. Effectuer la rotation réelle de l’apiToken par le mécanisme SEC-03B déployé, vérifier ancien refus/nouveau succès et mettre à jour Excel/Power Query.
2. Implémenter ou activer un parcours sûr de rotation ICS, régénérer les tokens concernés et mettre à jour les abonnements.
3. Exécuter VPS-05 : restauration DB et médias hors production, avec preuve de cohérence.
4. Corriger ultérieurement la compatibilité de `deploy.sh` avec le code root-owned et qualifier son prochain déploiement.
5. Rejouer la baseline sécurité avec `SECURITY_DATABASE_URL` dédiée et fermer les dettes de tests restantes.
6. Produire la validation finale de clôture après ces preuves.

## L. Git et traçabilité

- commit initial audité : `3a0a6144474edb1aa1c7554ac68ea545251e74c4` (`audit-2026-09-19`) ;
- commit actuel documenté : même commit HEAD, arbre de travail enrichi de corrections/documentation non committées ;
- commits fonctionnels historiques identifiables : lots applicatifs et multi-instance dans `git log`, notamment `220f269` (comptes/connexion), `22b0cf8` (déploiement par instance), `e50fad5` (première mise en ligne TLST), `49352c3` (bascule vers `pilote@cress`) ;
- aucun commit séparé identifiable pour les fichiers `docs/remediation/*` actuels ; ils sont donc référencés par chemin et date d’exécution, sans SHA inventé.

## M. Baseline locale du 20/09/2026

Exécutée sans modification du code applicatif :

| Commande | Résultat observé |
|---|---|
| `npm ci` | PASS ; 5 avis npm signalés (2 modérés, 3 élevés) |
| `npx prisma generate` | PASS ; Prisma Client 6.19.3 généré |
| `npm run test:unit` | PASS, 35 tests |
| `npm run test:security` | NON EXÉCUTABLE : `SECURITY_DATABASE_URL` obligatoire absente |
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

La baseline est donc partiellement verte : la suite security doit être rejouée avec une base de sécurité dédiée, sans utiliser une base de production.

## N. Documents de référence

- Audit : [`docs/audit/01-securite.md`](../audit/01-securite.md) à [`07-backlog-consolide.md`](../audit/07-backlog-consolide.md).
- Clôture initiale : [`99-audit-cloture.md`](99-audit-cloture.md).
- Lots VPS : [`100`](100-vps-readonly-audit.md), [`102`](102-vps-prod-env.md), [`103`](103-vps-network.md), [`104`](104-vps-unix-systemd.md), [`105`](105-vps-nginx-tokens.md).
