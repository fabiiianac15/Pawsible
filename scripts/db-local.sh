#!/bin/sh
# Inicia Postgres con las migraciones del proyecto, para equipos sin el plugin docker compose.
# Uso: scripts/db-local.sh [--reset]
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
[ "$1" = "--reset" ] && docker rm -f pawsible-db >/dev/null 2>&1 || true
docker start pawsible-db >/dev/null 2>&1 || docker run -d --name pawsible-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pawsible -p 54329:5432 \
  -v "$RAIZ/supabase/migrations:/docker-entrypoint-initdb.d/migrations:ro" \
  -v "$RAIZ/scripts/init-local-db.sh:/docker-entrypoint-initdb.d/00-init.sh:ro" \
  postgres:16-alpine >/dev/null
# El rol de servicio solo existe cuando terminó la inicialización.
until docker exec -e PGPASSWORD=mascotas_local pawsible-db \
  psql -U mascotas_svc -d pawsible -h 127.0.0.1 -c 'select 1' >/dev/null 2>&1; do
  sleep 1
done
echo "Postgres listo en localhost:54329"
