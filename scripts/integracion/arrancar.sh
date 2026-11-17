#!/usr/bin/env bash
# Arranca Postgres (puerto 54322) y PostgREST (3001) para las pruebas de integración.
# Requiere: Postgres 16 inicializado en $PGDATA y el binario de PostgREST en $POSTGREST_BIN.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
"${POSTGREST_BIN:-postgrest}" "$D/postgrest.conf" > "${TMPDIR:-/tmp}/postgrest.log" 2>&1 &
echo $! > "${TMPDIR:-/tmp}/postgrest.pid"
sleep 1 && curl -sf http://localhost:3001/ > /dev/null && echo "PostgREST listo"
