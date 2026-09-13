#!/bin/bash
# Déploiement de Pilote sur le VPS Bazixx (bazixx-vps, srv771239), convention outilcli.
#
#   ./deploy/deploy.sh            # met en ligne la copie de travail locale (dépôt sans remote)
#   ./deploy/deploy.sh --seed     # idem, puis remet la base de démo à zéro
#
# Principes (hérités de MCA) : on construit AVANT d'arrêter ; sauvegarde de la base avant migration ;
# migrations avant démarrage ; healthcheck ; retour à l'ancienne version si l'app ne répond pas.
set -euo pipefail

HOST=bazixx-vps
DIR=/var/www/cress-pilote
DATA=/var/www/cress-pilote-data
MEDIAS=/var/www/cress-pilote-medias
HEALTH="http://127.0.0.1:3002/outilcli/cress/pilote/portefeuille"
SEED="${1:-}"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══ Pilote → $HOST ($STAMP) ═══"

# 1. Copie du code (sans dépendances, caches, base, pièces).
rsync -az --delete \
  --exclude node_modules --exclude ".next*" --exclude uploads --exclude "prisma/prototype.db*" \
  --exclude .env --exclude test-results --exclude playwright-report --exclude .git \
  "$LOCAL/" "$HOST:$DIR.next/"

# 2. Côté serveur : build dans la nouvelle copie, puis bascule.
ssh "$HOST" bash -s -- "$DIR" "$DATA" "$MEDIAS" "$HEALTH" "$STAMP" "$SEED" <<'REMOTE'
set -euo pipefail
DIR="$1"; DATA="$2"; MEDIAS="$3"; HEALTH="$4"; STAMP="$5"; SEED="$6"
NEW="$DIR.next"; OLD="$DIR.prev"
mkdir -p "$DATA" "$MEDIAS" /var/backups/cress
# .env de production (créé une fois, jamais écrasé par le rsync).
if [ ! -f "$DIR/.env" ]; then
  cat > "$DIR/.env" <<ENV
DATABASE_URL="file:$DATA/prototype.db"
UPLOAD_DIR="$MEDIAS"
NEXT_PUBLIC_BASE_PATH="/outilcli/cress/pilote"
ENV
fi
cp "$DIR/.env" "$NEW/.env"
cd "$NEW"
echo "→ dépendances"; npm ci --no-audit --no-fund >/dev/null
echo "→ sauvegarde de la base"; [ -f "$DATA/prototype.db" ] && cp "$DATA/prototype.db" "/var/backups/cress/prototype-$STAMP.db" || true
echo "→ migrations"; npx prisma migrate deploy
# Base vide (première mise en ligne) ou --seed : données de démo AVANT le démarrage, sinon l'app répond 500.
PERSONNES=$(sqlite3 "$DATA/prototype.db" "select count(*) from Person" 2>/dev/null || echo 0)
if [ "$SEED" = "--seed" ] || [ "$PERSONNES" = "0" ]; then
  echo "→ seed"; rm -f "$MEDIAS"/*.pdf; env UPLOAD_DIR="$MEDIAS" npx prisma db seed >/dev/null
fi
echo "→ build"; npm run build >/dev/null
# Bascule : maintenance, arrêt, échange des dossiers, démarrage.
touch /var/www/maintenance/ACTIF-cress
systemctl stop cress-pilote 2>/dev/null || true
rm -rf "$OLD"; [ -d "$DIR" ] && mv "$DIR" "$OLD"; mv "$NEW" "$DIR"
chown -R www-data:www-data "$DIR" "$DATA" "$MEDIAS"
systemctl start cress-pilote
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "$HEALTH"; then
    rm -f /var/www/maintenance/ACTIF-cress
    echo "✔ en ligne : https://cress.bazixx.fr/outilcli/cress/pilote"; exit 0
  fi
  sleep 2
done
echo "✖ l'application ne répond pas : retour à la version précédente" >&2
systemctl stop cress-pilote || true
mv "$DIR" "$NEW.failed-$STAMP"; [ -d "$OLD" ] && mv "$OLD" "$DIR"
systemctl start cress-pilote || true
rm -f /var/www/maintenance/ACTIF-cress
exit 1
REMOTE
