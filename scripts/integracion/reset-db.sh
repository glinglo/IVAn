#!/usr/bin/env bash
# Borra y recrea la base de pruebas con el esquema y los datos de 2026.
# Con --vacia: solo el esquema (para probar la restauración de una copia).
set -euo pipefail
R="$(cd "$(dirname "$0")/../.." && pwd)"
P="psql -v ON_ERROR_STOP=1 -q -h localhost -p ${PGPORT:-54322} -U postgres"
$P -d postgres -c "drop database if exists ivan with (force)" -c "create database ivan"
$P -d ivan -f "$R/scripts/integracion/roles.sql"
for m in "$R"/supabase/migrations/*.sql; do
  # 002 crea el bucket de Supabase Storage, que aquí se simula en memoria
  [[ "$m" == *002_storage.sql ]] || $P -d ivan -f "$m"
done
if [[ "${1:-}" != "--vacia" ]]; then
  $P -d ivan -f "$R/scripts/integracion/ajustes.prueba.sql"
  $P -d ivan -f "$R/supabase/seed/datos_2026.sql"
fi
$P -d ivan -f "$R/scripts/integracion/grants.sql"
$P -d ivan -c "notify pgrst, 'reload schema'"
echo "Base 'ivan' lista"
