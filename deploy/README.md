# Mise en ligne de la démo (bazixx-vps)

URL : https://cress.bazixx.fr/outilcli/cress/pilote (rideau `auth_basic`, hors moteurs de recherche).

## Installation initiale (une fois, en root sur `bazixx-vps`)
1. `mkdir -p /var/www/cress-pilote /var/www/cress-pilote-data /var/www/cress-pilote-medias /var/www/maintenance`
2. `cp deploy/maintenance.html /var/www/maintenance/__maintenance.html`
3. `cp deploy/systemd/cress-pilote.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable cress-pilote`
4. `cp deploy/nginx/cress.bazixx.fr.conf /etc/nginx/sites-available/ && ln -s ../sites-available/cress.bazixx.fr.conf /etc/nginx/sites-enabled/`
5. `htpasswd -c /etc/nginx/.htpasswd-cress cress` (mot de passe transmis à part), `nginx -t && systemctl reload nginx`
6. `certbot --nginx -d cress.bazixx.fr`

## À chaque mise à jour (depuis le poste de travail)
`./deploy/deploy.sh` — et `./deploy/deploy.sh --seed` pour remettre la base de démo à zéro.

Le script copie le code, construit dans un dossier à côté, sauvegarde la base SQLite dans `/var/backups/cress`, applique les migrations, bascule avec la page de maintenance, vérifie que l'application répond, sinon revient à la version précédente.

Base : SQLite sur disque (`/var/www/cress-pilote-data/prototype.db`) ; pièces jointes : `/var/www/cress-pilote-medias`. Postgres et stockage objet au passage V1.
