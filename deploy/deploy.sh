#!/bin/bash
# Déploiement de Pilote sur le VPS Bazixx (bazixx-vps, srv771239), convention outilcli.
#
#   ./deploy/deploy.sh            # met en ligne la copie de travail locale (dépôt sans remote)
#   ./deploy/deploy.sh --seed     # idem, puis remet la base de démo à zéro
#
# Principes (hérités de MCA) : on construit AVANT d'arrêter ; sauvegarde de la base (pg_dump) avant migration ;
# migrations avant démarrage ; healthcheck ; retour à l'ancienne version si l'app ne répond pas.
# Base : PostgreSQL local du VPS (rôle et base créés une fois par ce script, mot de passe généré et gardé dans le .env serveur).
# Comptes (lot F) : BETTER_AUTH_SECRET généré une fois dans le .env serveur ; mot de passe de démo commun « pilote-demo-2026 ».
set -euo pipefail

HOST=bazixx-vps
DIR=/var/www/cress-pilote
DATA=/var/www/cress-pilote-data   # ancien emplacement SQLite ; garde les sauvegardes .db historiques
MEDIAS=/var/www/cress-pilote-medias
DBNAME=cress_pilote
DBUSER=cress_pilote
HEALTH="http://127.0.0.1:3002/outilcli/cress/pilote/connexion" # page publique (le reste renvoie à la connexion, lot F)
SEED="${1:-none}" # « none » plutôt que vide : ssh perd un argument vide et $6 devenait « unbound »
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══ Pilote → $HOST ($STAMP) ═══"

# 1. Copie du code (sans dépendances, caches, base, pièces).
rsync -az --delete \
  --exclude node_modules --exclude ".next*" --exclude uploads --exclude "uploads-test" --exclude ".claude/worktrees" \
  --exclude .env --exclude test-results --exclude playwright-report --exclude .git \
  "$LOCAL/" "$HOST:$DIR.next/"

# 2. Côté serveur : build dans la nouvelle copie, puis bascule.
ssh "$HOST" bash -s -- "$DIR" "$DATA" "$MEDIAS" "$HEALTH" "$STAMP" "$SEED" "$DBNAME" "$DBUSER" <<'REMOTE'
set -euo pipefail
DIR="$1"; DATA="$2"; MEDIAS="$3"; HEALTH="$4"; STAMP="$5"; SEED="$6"; DBNAME="$7"; DBUSER="$8"
NEW="$DIR.next"; OLD="$DIR.prev"
mkdir -p "$DATA" "$MEDIAS" /var/backups/cress
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
if [ ! -f "$DIR/.env" ]; then
  cat > "$DIR/.env" <<ENV
$(cat "$DIR.dburl")
UPLOAD_DIR="$MEDIAS"
NEXT_PUBLIC_BASE_PATH="/outilcli/cress/pilote"
ENV
elif grep -q '^DATABASE_URL="file:' "$DIR/.env"; then
  [ -f "$DIR.dburl" ] || { echo "✖ .env encore en SQLite et mot de passe Postgres inconnu ($DIR.dburl absent) : corrigez DATABASE_URL à la main" >&2; exit 1; }
  sed -i "s|^DATABASE_URL=.*|$(cat "$DIR.dburl")|" "$DIR/.env"
fi
# Comptes et sessions (lot F) : secret de signature généré une fois, adresse publique de l'API d'auth, mode démo.
grep -q '^BETTER_AUTH_SECRET=' "$DIR/.env" || echo "BETTER_AUTH_SECRET=\"$(openssl rand -hex 32)\"" >> "$DIR/.env"
grep -q '^BETTER_AUTH_URL=' "$DIR/.env" || echo 'BETTER_AUTH_URL="https://cress.bazixx.fr/outilcli/cress/pilote/api/auth"' >> "$DIR/.env"
grep -q '^PILOTE_DEMO=' "$DIR/.env" || echo 'PILOTE_DEMO=1' >> "$DIR/.env"
cp "$DIR/.env" "$NEW/.env"
cd "$NEW"
echo "→ dépendances"; npm ci --no-audit --no-fund >/dev/null
echo "→ sauvegarde de la base"; su postgres -c "pg_dump -Fc $DBNAME" > "/var/backups/cress/$DBNAME-$STAMP.dump" 2>/dev/null || true
echo "→ migrations"; npx prisma migrate deploy
# Base vide (première mise en ligne) ou --seed : données de démo AVANT le démarrage, sinon l'app répond 500.
PERSONNES=$(su postgres -c "psql -Atc 'select count(*) from \"Person\"' $DBNAME" 2>/dev/null || echo 0)
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
