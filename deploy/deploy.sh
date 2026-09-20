#!/bin/bash
# Déploiement de Pilote sur le VPS Bazixx (bazixx-vps, srv771239), convention outilcli — une instance par client (lot I).
#
#   ./deploy/deploy.sh cress            # met en ligne la copie de travail locale sur l'instance CRESS
#   ./deploy/deploy.sh tlst --seed      # idem sur l'instance TLST, puis remet la base de démo à zéro
#
# Ce qui distingue une instance (dossier, base, port, sous-chemin, service, client) vit dans deploy/instances/<instance>.env ;
# ce script n'a plus rien de propre à un client.
# Principes (hérités de MCA) : on construit AVANT d'arrêter ; sauvegarde de la base (pg_dump) avant migration ;
# migrations avant démarrage ; healthcheck ; retour à l'ancienne version si l'app ne répond pas.
# Base : PostgreSQL local du VPS (rôle et base créés une fois par ce script, mot de passe généré et gardé dans le .env serveur).
# Comptes (lot F) : BETTER_AUTH_SECRET généré une fois dans le .env serveur ; mot de passe de démo commun « pilote-demo-2026 ».
# Brevo (18/09) : le connecteur s'active en ajoutant BREVO_API_KEY="…" au .env serveur (à la main, jamais par ce script ni par un
# agent), puis `systemctl restart pilote@<instance>`. Sans clé, l'admin affiche « non configuré ». Idem HelloAsso (module Adhérents) :
# HELLOASSO_CLIENT_ID, HELLOASSO_CLIENT_SECRET, HELLOASSO_ORG_SLUG.
# Service : unité paramétrée deploy/systemd/pilote@.service (installée par ce script si absente) ; l'ancienne unité d'une instance
# (LEGACY_SERVICE, ex. cress-pilote) est désactivée au premier démarrage réussi sous le nouveau nom.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
INSTANCE="${1:-}"
if [ -z "$INSTANCE" ] || [ ! -f "$HERE/instances/$INSTANCE.env" ]; then
  echo "usage : $0 <instance> [--seed]   (instances : $(ls "$HERE/instances" | sed 's/\.env$//' | tr '\n' ' '))" >&2
  exit 2
fi
# shellcheck disable=SC1090
source "$HERE/instances/$INSTANCE.env"
RUNTIME_USER="pilote-$INSTANCE"
SEED="${2:-none}" # « none » plutôt que vide : ssh perd un argument vide
HEALTH="http://127.0.0.1:$PORT$BASE_PATH/connexion" # page publique (le reste renvoie à la connexion, lot F)
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL="$(cd "$HERE/.." && pwd)"

echo "═══ Pilote [$INSTANCE] → $HOST ($STAMP) ═══"

# 1. Copie du code (sans dépendances, caches, base, pièces).
rsync -az --delete \
  --exclude node_modules --exclude ".next*" --exclude uploads --exclude "uploads-test" --exclude ".claude/worktrees" \
  --exclude .env --exclude test-results --exclude playwright-report --exclude .git \
  "$LOCAL/" "$HOST:$DIR.next/"

# 2. Côté serveur : build dans la nouvelle copie, puis bascule.
ssh "$HOST" bash -s -- "$DIR" "$DATA" "$MEDIAS" "$HEALTH" "$STAMP" "$SEED" "$DBNAME" "$DBUSER" "$CLIENT" "$BASE_PATH" "$PUBLIC_URL" "$SERVICE" "$MAINTENANCE_FLAG" "$BACKUP_DIR" "$PORT" "${LEGACY_SERVICE:-none}" "$RUNTIME_USER" <<'REMOTE'
set -euo pipefail
DIR="$1"; DATA="$2"; MEDIAS="$3"; HEALTH="$4"; STAMP="$5"; SEED="$6"; DBNAME="$7"; DBUSER="$8"
CLIENT="$9"; BASE_PATH="${10}"; PUBLIC_URL="${11}"; SERVICE="${12}"; MAINTENANCE_FLAG="${13}"; BACKUP_DIR="${14}"; PORT="${15}"; LEGACY_SERVICE="${16}"; RUNTIME_USER="${17}"
id "$RUNTIME_USER" >/dev/null 2>&1 || { echo "✖ utilisateur système absent : $RUNTIME_USER (création préalable requise)" >&2; exit 1; }
NEW="$DIR.next"; OLD="$DIR.prev"
mkdir -p "$DATA" "$MEDIAS" "$BACKUP_DIR" /var/www/maintenance
# Rôle et base Postgres : créés une fois (mot de passe généré, gardé dans le .env). Idempotent.
if ! su postgres -c "psql -Atc \"select 1 from pg_roles where rolname='$DBUSER'\"" | grep -q 1; then
  DBPASS=$(openssl rand -hex 24)
  su postgres -c "psql -c \"create role $DBUSER login password '$DBPASS'\""
  echo "DATABASE_URL=\"postgresql://$DBUSER:$DBPASS@127.0.0.1:5432/$DBNAME\"" > "$DIR.dburl"; chmod 600 "$DIR.dburl"
fi
if ! su postgres -c "psql -Atc \"select 1 from pg_database where datname='$DBNAME'\"" | grep -q 1; then
  su postgres -c "createdb -O $DBUSER $DBNAME"
fi
# .env de production (créé une fois, jamais écrasé par le rsync). Passage SQLite → Postgres : la ligne DATABASE_URL est remplacée.
# Première mise en ligne d'une instance : le dossier n'existe pas encore (il ne contiendra que le .env jusqu'à la bascule).
mkdir -p "$DIR"
if [ ! -f "$DIR/.env" ]; then
  cat > "$DIR/.env" <<ENV
$(cat "$DIR.dburl")
UPLOAD_DIR="$MEDIAS"
NEXT_PUBLIC_BASE_PATH="$BASE_PATH"
NEXT_PUBLIC_CLIENT="$CLIENT"
ENV
elif grep -q '^DATABASE_URL="file:' "$DIR/.env"; then
  [ -f "$DIR.dburl" ] || { echo "✖ .env encore en SQLite et mot de passe Postgres inconnu ($DIR.dburl absent) : corrigez DATABASE_URL à la main" >&2; exit 1; }
  sed -i "s|^DATABASE_URL=.*|$(cat "$DIR.dburl")|" "$DIR/.env"
fi
# Comptes et sessions (lot F) : secret de signature généré une fois, adresse publique de l'API d'auth, mode démo.
grep -q '^BETTER_AUTH_SECRET=' "$DIR/.env" || echo "BETTER_AUTH_SECRET=\"$(openssl rand -hex 32)\"" >> "$DIR/.env"
grep -q '^BETTER_AUTH_URL=' "$DIR/.env" || echo "BETTER_AUTH_URL=\"$PUBLIC_URL/api/auth\"" >> "$DIR/.env"
# Toute instance déployée est une instance de production : conserver les
# garde-fous explicites même lors d'une première mise en ligne.
if grep -q '^NODE_ENV=' "$DIR/.env" && ! grep -q '^NODE_ENV=production$' "$DIR/.env"; then
  echo "✖ NODE_ENV doit être production ($INSTANCE)" >&2
  exit 1
fi
grep -q '^NODE_ENV=' "$DIR/.env" || echo 'NODE_ENV=production' >> "$DIR/.env"
if ! grep -Eq '^BETTER_AUTH_URL=\"https://' "$DIR/.env"; then
  echo "✖ BETTER_AUTH_URL doit être HTTPS ($INSTANCE)" >&2
  exit 1
fi
if grep -q '^AUTH_RATE_LIMIT=' "$DIR/.env"; then
  RATE_LIMIT=$(sed -n 's/^AUTH_RATE_LIMIT=//p' "$DIR/.env" | head -1)
  [ "$RATE_LIMIT" != "0" ] || { echo "✖ AUTH_RATE_LIMIT=0 est interdit en production ($INSTANCE)" >&2; exit 1; }
else
  echo 'AUTH_RATE_LIMIT=10' >> "$DIR/.env"
fi
if grep -Eq '^PILOTE_ENV_PROFILE=(local|test|security-test)$|^PILOTE_ENV=(local|test|security-test)$|^PILOTE_PROFILE=(local|test|security-test)$' "$DIR/.env"; then
  echo "✖ profil local/test interdit en production ($INSTANCE)" >&2
  exit 1
fi
# Lot I : le client et le port de l'instance dans le .env (le build embarque l'habillage ; l'unité systemd lit PORT).
grep -q '^NEXT_PUBLIC_CLIENT=' "$DIR/.env" || echo "NEXT_PUBLIC_CLIENT=\"$CLIENT\"" >> "$DIR/.env"
grep -q '^PORT=' "$DIR/.env" || echo "PORT=$PORT" >> "$DIR/.env"
# Une instance déployée est toujours production : le mode démonstration doit
# être explicitement refusé, jamais activé par défaut.
if grep -q '^PILOTE_DEMO=1' "$DIR/.env"; then
  echo "✖ PILOTE_DEMO=1 est interdit pour une instance de production ($INSTANCE)" >&2
  exit 1
fi
grep -q '^PILOTE_DEMO=' "$DIR/.env" || echo 'PILOTE_DEMO=0' >> "$DIR/.env"
cp "$DIR/.env" "$NEW/.env"
cd "$NEW"
echo "→ dépendances"; npm ci --no-audit --no-fund >/dev/null
echo "→ build"; npm run build >/dev/null
echo "→ sauvegarde de la base";
DUMP="$BACKUP_DIR/$DBNAME-$STAMP.dump"
TMP_DUMP="$DUMP.tmp"
rm -f "$TMP_DUMP"
su postgres -c "pg_dump -Fc $DBNAME" > "$TMP_DUMP"
[ -s "$TMP_DUMP" ] || { echo "✖ sauvegarde PostgreSQL absente ou vide" >&2; exit 1; }
su postgres -c "pg_restore --list '$TMP_DUMP'" >/dev/null
chmod 600 "$TMP_DUMP"
mv "$TMP_DUMP" "$DUMP"
MEDIA_BACKUP="$BACKUP_DIR/$INSTANCE-medias-$STAMP.tar.gz"
tar -czf "$MEDIA_BACKUP" -C "$(dirname "$MEDIAS")" "$(basename "$MEDIAS")"
[ -s "$MEDIA_BACKUP" ] || { echo "✖ sauvegarde médias absente ou vide" >&2; exit 1; }
chmod 600 "$MEDIA_BACKUP"
echo "→ migrations"; npx prisma migrate deploy
# Base vide (première mise en ligne) ou --seed : données de démo AVANT le démarrage, sinon l'app répond 500.
PERSONNES=$(su postgres -c "psql -Atc 'select count(*) from \"Person\"' $DBNAME" 2>/dev/null || echo 0)
if [ "$SEED" = "--seed" ] || [ "$PERSONNES" = "0" ]; then
  if [ "$PERSONNES" = "0" ] && [ "$SEED" != "--seed" ]; then
    echo "✖ base vide : un seed explicite (--seed) est requis ; aucun seed de démonstration implicite en production" >&2
    exit 1
  fi
  echo "→ seed"; rm -f "$MEDIAS"/*.pdf; env UPLOAD_DIR="$MEDIAS" npx prisma db seed >/dev/null
fi
# Unité systemd paramétrée (lot I) : installée depuis le dépôt si elle manque ; l'ancienne unité de l'instance est arrêtée.
if ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
  cp "$NEW/deploy/systemd/pilote@.service" /etc/systemd/system/pilote@.service
  systemctl daemon-reload
fi
UNIT=/etc/systemd/system/pilote@.service
grep -q '^User=pilote-%i$' "$UNIT" || { echo "✖ unité systemd non isolée : User attendu" >&2; exit 1; }
grep -q '^Group=pilote-%i$' "$UNIT" || { echo "✖ unité systemd non isolée : Group attendu" >&2; exit 1; }
grep -q '^NoNewPrivileges=true$' "$UNIT" || { echo "✖ unité systemd sans NoNewPrivileges" >&2; exit 1; }
grep -q '^PrivateTmp=true$' "$UNIT" || { echo "✖ unité systemd sans PrivateTmp" >&2; exit 1; }
grep -q '^ProtectSystem=strict$' "$UNIT" || { echo "✖ unité systemd sans ProtectSystem=strict" >&2; exit 1; }
grep -q '^ProtectHome=true$' "$UNIT" || { echo "✖ unité systemd sans ProtectHome" >&2; exit 1; }
grep -q '^UMask=0077$' "$UNIT" || { echo "✖ unité systemd sans UMask=0077" >&2; exit 1; }
grep -q '^ReadWritePaths=/var/www/%i-pilote-data /var/www/%i-pilote-medias$' "$UNIT" || { echo "✖ chemins d'écriture systemd inattendus" >&2; exit 1; }
systemctl is-enabled "$SERVICE" >/dev/null 2>&1 || systemctl enable "$SERVICE" >/dev/null 2>&1 || true # au boot, chaque instance
# Bascule : maintenance, arrêt, échange des dossiers, démarrage.
touch "$MAINTENANCE_FLAG"
[ "$LEGACY_SERVICE" != "none" ] && systemctl stop "$LEGACY_SERVICE" 2>/dev/null || true
systemctl stop "$SERVICE" 2>/dev/null || true
if [ -d "$OLD" ]; then mv "$OLD" "$OLD.$STAMP.previous"; fi
[ -d "$DIR" ] && mv "$DIR" "$OLD"
mv "$NEW" "$DIR"
chown -R root:root "$DIR"
find "$DIR" -type d -exec chmod u+rwx,go+rx,go-w {} +
find "$DIR" -type f -exec chmod go-w {} +
chown "$RUNTIME_USER:$RUNTIME_USER" "$DIR/.env"
chmod 600 "$DIR/.env"
chown -R "$RUNTIME_USER:$RUNTIME_USER" "$DATA" "$MEDIAS"
find "$DATA" "$MEDIAS" -type d -exec chmod 750 {} +
find "$DATA" "$MEDIAS" -type f -exec chmod 640 {} +
systemctl start "$SERVICE"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "$HEALTH"; then
    rm -f "$MAINTENANCE_FLAG"
    # Premier démarrage réussi sous le nouveau nom : l'ancienne unité ne doit plus redémarrer au boot.
    [ "$LEGACY_SERVICE" != "none" ] && systemctl disable "$LEGACY_SERVICE" >/dev/null 2>&1 || true
    echo "✔ en ligne : $PUBLIC_URL"; exit 0
  fi
  sleep 2
done
echo "✖ l'application ne répond pas : retour à la version précédente" >&2
systemctl stop "$SERVICE" || true
mv "$DIR" "$NEW.failed-$STAMP"; [ -d "$OLD" ] && mv "$OLD" "$DIR"
# Retour : l'ancienne unité si elle existe encore (première migration), sinon la nouvelle sur l'ancien dossier.
if [ "$LEGACY_SERVICE" != "none" ] && systemctl cat "$LEGACY_SERVICE" >/dev/null 2>&1 && systemctl is-enabled "$LEGACY_SERVICE" >/dev/null 2>&1; then systemctl start "$LEGACY_SERVICE" || true; else systemctl start "$SERVICE" || true; fi
rm -f "$MAINTENANCE_FLAG"
exit 1
REMOTE
