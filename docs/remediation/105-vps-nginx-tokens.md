# VPS-04 — Nginx réel, redaction des logs et secrets porteurs

Date : 2026-09-20  
Hôte : `srv771239`

## Sauvegarde et configuration active

La configuration active Nginx, `nginx.conf`, les vhosts CRESS/TLST et le format précédemment installé ont été sauvegardés avant modification sous :

`/var/backups/pilote-vps04-nginx-20260920-195429/`

Avant correction, CRESS et TLST utilisaient `access_log` sans format explicite, donc le format Nginx par défaut pouvait journaliser la requête complète. Les anciennes rotations contiennent des lignes avec des motifs `jeton=` ou `/api/agenda/` : 6 lignes CRESS et 3 lignes TLST. Cela confirme une exposition historique potentielle de tokens ; aucun token n’a été affiché.

## Configuration après

Le format a été installé dans `/etc/nginx/conf.d/pilote-log-format.conf`, inclus dans le contexte HTTP. Il journalise l’IP, méthode, URI normalisée, protocole, statut, taille, user-agent et request ID.

Une normalisation supplémentaire masque explicitement les chemins `/api/agenda/...` avant écriture, car `$uri` seul conserve le token ICS du chemin. Les query strings, arguments et referers ne sont pas journalisés.

Les deux vhosts utilisent maintenant réellement :

```text
access_log /var/log/nginx/cress.access.log pilote_safe;
access_log /var/log/nginx/tlst.access.log pilote_safe;
```

`nginx -t` : PASS. Le reload contrôlé a réussi et Nginx est actif.

## Tests runtime sentinelles

Des requêtes fictives ont été envoyées avec des sentinelles export et ICS. Résultats après la correction v2 :

| Sentinelle | Journaux CRESS/TLST, erreurs et applicatifs |
|---|---|
| export | NOT FOUND |
| ICS | NOT FOUND |

Le premier test a détecté que la version initiale du format laissait apparaître le faux token ICS dans `$uri`. Cette configuration a été corrigée avant validation finale. Les anciennes occurrences de la première sentinelle sont artificielles et ne constituent pas un secret réel.

## Rotation des secrets porteurs

L’exposition historique potentielle impose de considérer comme compromis :

- le token d’export global ;
- les tokens ICS personnels et équipe susceptibles d’avoir figuré dans les anciennes URLs.

La rotation réelle n’a pas été effectuée dans ce lot :

- l’interface active CRESS/TLST ne présente pas le panneau/bouton de régénération SEC-03B attendu ; elle expose seulement le champ existant ;
- aucune API opérateur dédiée et authentifiée de rotation n’a été rendue disponible sur l’instance active ;
- aucune écriture DB manuelle ni injection de token n’a été improvisée ;
- le mécanisme de rotation ICS existe côté code du dépôt mais n’est pas exposé de manière vérifiable dans l’interface active.

Conséquence : la rotation apiToken et ICS est un **blocage restant** nécessitant le déploiement/activation du mécanisme applicatif SEC-03B et d’un parcours sûr ICS, puis la mise à jour des consommateurs Excel/Power Query et abonnements ICS. Les tokens réels ne figurent pas dans ce rapport.

## Permissions et rotation des logs

- logs Nginx actifs : `0640`, `www-data:adm` ;
- logs applicatifs : `0640`, `root:adm` ;
- `pilote-cress` et `pilote-tlst` ne peuvent lire ni les logs applicatifs ni les logs Nginx de l’autre instance ;
- logrotate Nginx : quotidien, rétention 14 rotations, compression, `create 0640 www-data adm`.

Les permissions applicatives ont été resserrées après constat initial de fichiers `0644`.

## Smoke tests finaux

- HTTPS CRESS : PASS (`302` racine) ;
- HTTPS TLST : PASS (`302` racine) ;
- Nginx actif après reload : PASS ;
- proxy CRESS/TLST vers les loopbacks : PASS ;
- aucune erreur nouvelle significative Nginx/Next/DB/Better Auth détectée.

## Rollback

Disponible via la sauvegarde Nginx préalable. Aucun rollback n’a été utilisé, la configuration finale étant valide et les smoke tests passant.

## Verdict

**VPS-04 PARTIEL — redaction Nginx effective et validée, mais rotation apiToken/ICS bloquée par l’absence de mécanisme opérable sur l’instance active.**
