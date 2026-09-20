# SEC-23 — Tokens sensibles dans les URLs et journaux

## Constats

Les exports globaux acceptent encore `apiToken` via `?jeton=...`. Les flux ICS personnels et équipe portent leur bearer token dans le chemin `/api/agenda/{token}.ics`. Ces transports sont nécessaires aux consommateurs actuels (Power Query/exports externes et abonnements Outlook). Les anciennes configurations Nginx utilisaient le format d’accès par défaut, qui journalise la requête complète et pouvait donc conserver query string et chemin contenant un token.

Les logs applicatifs inspectés ne journalisent pas les valeurs `apiToken`, `icsToken`, liens de reset ou d’invitation. Les réponses HTML/RSC ne sont pas modifiées par ce ticket.

## Correction

Ajout de `deploy/nginx/pilote-log-format.conf`, à inclure dans le bloc `http {}` de la configuration Nginx :

- méthode, URI normalisée (`$uri`), protocole, statut, taille, user-agent et identifiant de requête ;
- aucune query string (`$args`, `$query_string`, `$request_uri`) ;
- aucun referer ;
- le chemin réel contenant un token ICS n’est donc pas écrit.

Les vhosts CRESS et TLST utilisent désormais explicitement `pilote_safe`. Le proxy continue à transmettre les requêtes et les routes ne changent pas.

## Tests

Le test unitaire `tests/unit/nginx-token-logs.test.ts` vérifie statiquement les deux vhosts et le format. Une validation runtime Nginx doit être effectuée sur le VPS avec les sentinelles `API_TOKEN_SENTINEL_SEC23` et `ICS_TOKEN_SENTINEL_SEC23`; aucun secret de production n’a été utilisé ici.

## Rotation et limites

Les anciens logs peuvent contenir des tokens : après déploiement, rotation du token d’export et régénération des tokens ICS recommandées (obligatoires si les logs historiques sont accessibles à un tiers). Les abonnements ICS devront alors être mis à jour. Le fichier de format doit être installé dans le contexte `http {}` puis `nginx -t` et un rechargement contrôlé doivent être réalisés sur le VPS. Les logs déjà existants ne sont pas nettoyés par ce ticket.

## Fichiers

- `deploy/nginx/pilote-log-format.conf`
- `deploy/nginx/cress.bazixx.fr.conf`
- `deploy/nginx/tlst.bazixx.fr.conf`
- `tests/unit/nginx-token-logs.test.ts`

## Verdict

**SEC-23 CORRIGÉ CÔTÉ CONFIGURATION**. La redaction est préparée dans le dépôt et les vhosts l’utilisent; l’installation et le test de logs réels restent à exécuter sur le VPS.
