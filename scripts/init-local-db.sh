#!/bin/sh
# Aplica las migraciones y asigna contraseñas de desarrollo a los roles de servicio.
set -e
for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -U postgres -d pawsible -f "$f"
done
psql -v ON_ERROR_STOP=1 -U postgres -d pawsible <<SQL
ALTER ROLE mascotas_svc PASSWORD 'mascotas_local';
ALTER ROLE adopciones_svc PASSWORD 'adopciones_local';
SQL
