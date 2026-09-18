# Mise en ligne des instances (bazixx-vps)

Une instance par client (lot I) : même code, son dossier, sa base, son port, son sous-chemin, son service. Ce qui la distingue est
dans `deploy/instances/<instance>.env` (aucun secret : ils vivent dans le `.env` serveur, posé et complété par `deploy.sh`).

| Instance | URL | Service | Port |
|---|---|---|---|
| `cress` | https://cress.bazixx.fr/outilcli/cress/pilote (rideau `auth_basic`, hors moteurs de recherche) | `pilote@cress` (ex-`cress-pilote`) | 3002 |
| `tlst` | https://tlst.bazixx.fr/outilcli/tlst/pilote (rideau `auth_basic`, fiche `CRESS/tlst-acces-demo.txt` hors git) — déployée le 18/09 (démo TLST), nginx et rideau en place ; **reste le DNS `tlst` → 195.35.25.148 et `certbot --nginx -d tlst.bazixx.fr`** | `pilote@tlst` | 3003 |

## À chaque mise à jour (depuis le poste de travail)
`./deploy/deploy.sh <instance>` — et `./deploy/deploy.sh <instance> --seed` pour remettre la base de démo à zéro.

Le script copie le code, construit dans un dossier à côté, sauvegarde la base (`pg_dump` dans `BACKUP_DIR`), applique les migrations,
bascule avec la page de maintenance, vérifie que l'application répond, sinon revient à la version précédente. Le `.env` serveur
reçoit `NEXT_PUBLIC_CLIENT` et `PORT` de l'instance ; le build embarque donc l'habillage du client (`config/clients/`).

## Installation initiale d'une instance (une fois, en root sur `bazixx-vps`)
1. Créer le DNS et la conf nginx : `cp deploy/nginx/<domaine>.conf /etc/nginx/sites-available/ && ln -s ../sites-available/<domaine>.conf /etc/nginx/sites-enabled/`
2. `htpasswd -c /etc/nginx/.htpasswd-<instance> <utilisateur>` (mot de passe transmis à part), `nginx -t && systemctl reload nginx`
3. `certbot --nginx -d <domaine>`
4. `cp deploy/maintenance.html /var/www/maintenance/__maintenance.html` (une fois pour le serveur)
5. `./deploy/deploy.sh <instance> --seed` depuis le poste : le script crée le rôle et la base Postgres, le `.env`, installe l'unité
   `pilote@.service` si elle manque, seed, build, démarre.

## Passage de `cress-pilote` à `pilote@cress` (fait par `deploy.sh cress`)
Au premier déploiement sous le nouveau nom, l'ancienne unité est arrêtée puis désactivée quand la nouvelle répond ; en cas
d'échec, le script revient sur l'ancienne. **Fait le 18/09** : `pilote@cress` en service, `cress-pilote.service` retiré du serveur.

Base : PostgreSQL local (`DBNAME` de l'instance, une par client) ; pièces jointes : `MEDIAS` de l'instance.
