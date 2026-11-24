#!/usr/bin/env bash
# Arranca Postgres (puerto 54322) y PostgREST (3001) para las pruebas de integración.
# Requiere: Postgres 16 inicializado en $PGDATA y el binario de PostgREST en $POSTGREST_BIN.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
"${POSTGREST_BIN:-postgrest}" "$D/postgrest.conf" > "${TMPDIR:-/tmp}/postgrest.log" 2>&1 &
echo $! > "${TMPDIR:-/tmp}/postgrest.pid"

for i in $(seq 1 60); do
  curl -sf http://localhost:3001/ > /dev/null && echo "PostgREST listo" && exit 0
  sleep 0.5
done
echo "PostgREST no ha respondido en 30 s: mira ${TMPDIR:-/tmp}/postgrest.log" >&2
exit 1
