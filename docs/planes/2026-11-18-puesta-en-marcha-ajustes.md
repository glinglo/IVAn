# Puesta en marcha: permisos de Supabase, webhook y región

Estado: Hecho (Jose, 18/11/2026)
18/11/2026 · Plan de Claude (proyecto IVAn)

## Por qué

Antes de la Fase 2 he revisado `docs/PUESTA_EN_MARCHA.md` contra el código de `wip/v0` (después del PR #6). Hay un problema que bloquearía la puesta en marcha y tres más pequeños:

1. **Supabase no dará permisos sobre las tablas (bloqueante).**
   - Desde el 30/05/2026, los proyectos nuevos de Supabase no conceden permisos automáticos sobre las tablas del esquema `public` a los roles de la Data API, `service_role` incluido.
   - Nuestras migraciones no tienen ningún `GRANT`. Las pruebas de integración pasan porque `scripts/integracion/grants.sql` da los permisos a mano.
   - En un proyecto nuevo, el bot fallaría en la primera consulta con «permission denied for table …».
2. **`npm run set-webhook` no lee `.env.local`.** `tsx` no carga ese archivo solo, así que el script termina con «Faltan TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET o APP_URL». `scripts/restaurar.ts` ya usa `--env-file=.env.local`; este no.
3. **Las funciones de Vercel corren en Washington y la base está en Frankfurt.** Vercel usa `iad1` (EE. UU.) por defecto, así que cada consulta cruza el Atlántico, y un gasto hace varias. En el plan Hobby se puede elegir una región, y `fra1` (Frankfurt) está al lado de Supabase `eu-central-1`.
4. **La guía tiene datos viejos:**
   - la restauración dice «migraciones 001, 002, 003», pero faltan la 004 (y la 005 de este plan): restaurar una copia con la tabla `gastos` sin `desglose` fallaría;
   - dice «49 conversaciones» y ya son 54;
   - la primera prueba no incluye un ticket de restaurante (los tres botones);
   - no explica las opciones de la Data API al crear el proyecto de Supabase.

## Lo que se sabe (fuentes)

- **Supabase, cambio de permisos por defecto:**
  - anunciado el 28/04/2026;
  - desde el 30/05/2026 es lo normal en todos los proyectos nuevos;
  - desde el 30/10/2026 se aplica a las tablas nuevas de todos los proyectos;
  - al crear el proyecto aparece una casilla («Default privileges for new entities» / «Automatically expose new tables»). Si está desmarcada, cada tabla nueva necesita un `GRANT` explícito para que supabase-js o PostgREST la vean;
  - el cambio es del servidor (permisos de Postgres), así que no depende de la versión de supabase-js.

  https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically · https://supabase.com/docs/guides/database/data-api
- **Vercel, región de las funciones:**
  - por defecto, `iad1` en todos los proyectos nuevos;
  - en Hobby se puede elegir una sola región, desde Settings → Functions o con `"regions"` en `vercel.json`.

  https://vercel.com/docs/functions/configuring-functions/region

## Alcance

**Sí**
1. Migración `005_permisos.sql` con los permisos que necesita IVAn, solo para `service_role`.
2. Pruebas de integración que se comporten como un proyecto nuevo de Supabase: sin permisos a mano sobre las tablas. Así la 005 queda probada.
3. `set-webhook` con `--env-file=.env.local`.
4. `vercel.json` con `"regions": ["fra1"]`.
5. Guía puesta al día.

**No**
- Cambiar el esquema ni la lógica del bot.
- Usar las claves `anon` o `publishable`: IVAn solo habla con Supabase desde el servidor, con la clave secreta.

## Cambios, archivo por archivo

- **`supabase/migrations/005_permisos.sql`** (nuevo):
  ```sql
  -- Proyectos de Supabase creados desde el 30/05/2026: las tablas de public no tienen permisos por
  -- defecto. IVAn solo entra con la clave secreta (service_role); anon y authenticated, nada.
  grant usage on schema public to service_role;
  grant select, insert, update, delete on all tables in schema public to service_role;
  grant usage, select on all sequences in schema public to service_role;
  grant execute on all functions in schema public to service_role;
  revoke all on all tables in schema public from anon, authenticated;
  revoke execute on all functions in schema public from public, anon, authenticated;
  alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
  alter default privileges in schema public grant usage, select on sequences to service_role;
  alter default privileges in schema public grant execute on functions to service_role;
  ```
  Claude Code comprueba que los triggers de facturas emitidas (`bloquear_factura_emitida`, `no_borrar_emitidas`) siguen funcionando después del `revoke execute`. Ya hay pruebas de integración que lo cubren.
- **`scripts/integracion/roles.sql`:** crear también el rol `authenticated` (si no, el `revoke` de la 005 falla).
- **`scripts/integracion/grants.sql`:** dejar solo `grant usage on schema public to anon, authenticated, service_role;`, que es lo que trae un proyecto nuevo. Los permisos sobre tablas, secuencias y funciones salen de la 005.
- **`package.json`:** `"set-webhook": "tsx --env-file=.env.local scripts/set-webhook.ts"`.
- **`vercel.json`:** añadir `"regions": ["fra1"]` junto a `crons`.
- **`docs/PUESTA_EN_MARCHA.md`:**
  - 2.1: al crear el proyecto, dejar la **Data API activada** (esquema `public`) y la casilla de permisos automáticos **desmarcada**. Los permisos los da la 005, y solo a `service_role`.
  - 2.2: añadir `005_permisos.sql` después de la 004.
  - 2.3: añadir una comprobación de permisos (ver abajo).
  - 4: decir que la región `fra1` ya va en `vercel.json` y que se ve en Settings → Functions.
  - 5: antes de `npm run set-webhook`, en `.env.local` `APP_URL` tiene que ser la URL de Vercel, no `localhost`.
  - 6: añadir «manda la foto de un ticket de restaurante → deben salir los tres botones (si es de prueba, pulsa 🏠 Era personal)» y «revisa que el borrador enseñe el IVA por tipo (“IVA 21 % sobre …”)».
  - Restaurar una copia: «migraciones 001 a 005».
  - Pruebas en local: «54 conversaciones».

## Cómo sabremos que está bien

- `npm test` y `npm run typecheck` sin errores; no cambia ninguna cifra.
- Integración en el Mac de Jose, con `grants.sql` reducido: **54/54**. Esto demuestra que la 005 basta en un proyecto nuevo de Supabase. Incluye las de facturas emitidas que no se pueden borrar ni cambiar, y las de copia y restauración.
- En la base de pruebas, tras `reset-db.sh`:
  ```sql
  select has_table_privilege('service_role', 'public.gastos', 'insert');      -- true
  select has_table_privilege('anon', 'public.gastos', 'select');              -- false
  select has_function_privilege('service_role', 'public.emitir_factura(uuid)', 'execute'); -- true
  select has_function_privilege('anon', 'public.emitir_factura(uuid)', 'execute');         -- false
  ```
  Las mismas cuatro consultas van en la guía (paso 2.3) para hacerlas en Supabase.
- `npm run set-webhook` con `.env.local` relleno enseña la URL `…/api/telegram` sin exportar variables a mano.

## Riesgos y dudas

- Si al crear el proyecto la casilla de permisos automáticos queda marcada, no pasa nada grave: la 005 sigue dando los permisos a `service_role` y quita los de `anon` y `authenticated` sobre las tablas que existen.
- `revoke execute … from public` en funciones de trigger: Postgres no comprueba ese permiso al disparar un trigger. **Comprobado por Claude el 18/11** en un Postgres 16 limpio (migraciones 001, 003 y 004 y los datos de 2026, sin permisos, como un proyecto nuevo):
  - sin la 005, `service_role` recibe «permission denied for table gastos»;
  - con la 005, las cuatro consultas de arriba dan true / false / true / false y `service_role` lee 71 gastos y 2.041,44 €;
  - con la 005, borrar o cambiar una factura emitida lo siguen parando los triggers, y `emitir_factura()` se ejecuta.

  Falta confirmarlo con PostgREST y las 54 conversaciones.

## Notas de ejecución

Ejecutado el 18/11/2026, sin desviaciones del plan. `npm test` (62/62) y `npm run typecheck` pasan.

Archivos tocados:
- `supabase/migrations/005_permisos.sql` (nuevo): los `grant`/`revoke` tal cual los da el plan.
- `scripts/integracion/roles.sql`: crea también el rol `authenticated` y lo añade a los que entran
  por `authenticator`, como pide la 005 para que el `revoke ... from anon, authenticated` no falle
  (el rol tiene que existir).
- `scripts/integracion/grants.sql`: reducido a `grant usage on schema public to anon, authenticated,
  service_role;`, que es lo único que trae un proyecto nuevo de Supabase. El resto de permisos salen
  de la 005.
- `package.json`: `"set-webhook": "tsx --env-file=.env.local scripts/set-webhook.ts"`.
- `vercel.json`: añadido `"regions": ["fra1"]`.
- `docs/PUESTA_EN_MARCHA.md`: Data API activada y permisos automáticos desmarcados al crear el
  proyecto; `005_permisos.sql` en la lista de migraciones (y en «Restaurar una copia», 001 a 005);
  las cuatro comprobaciones de permisos como paso 2.4; la región `fra1` en el apartado de Vercel;
  aviso de que `APP_URL` tiene que ser la URL de Vercel antes de `set-webhook`; los dos pasos nuevos
  de la primera prueba (ticket de restaurante con los tres botones, borrador con el IVA por tipo);
  «54 conversaciones» en vez de 49.

Comprobado en Postgres 16 limpio (`~/.ivan-pg-pruebas`), con `scripts/integracion/reset-db.sh` y el
`grants.sql` ya reducido (sin permisos a mano sobre tablas, secuencias o funciones; solo el
`usage` sobre el esquema que trae un proyecto nuevo):
```
select has_table_privilege('service_role', 'public.gastos', 'insert');      -- t
select has_table_privilege('anon', 'public.gastos', 'select');              -- f
select has_function_privilege('service_role', 'public.emitir_factura(uuid)', 'execute'); -- t
select has_function_privilege('anon', 'public.emitir_factura(uuid)', 'execute');         -- f
```
Con PostgREST (puerto 3001) arrancado desde cero (sin ningún proceso colgado de antes), las 54
conversaciones de `scripts/integracion/conversaciones.ts` pasan: 54/54, incluidas las de facturas
emitidas inmutables, copia y restauración. Confirma lo que ya había comprobado Claude en el plan:
la 005 basta para un proyecto nuevo de Supabase, y el `revoke execute ... from public` no afecta a
los triggers (`bloquear_factura_emitida`, `no_borrar_emitidas` siguen funcionando).

No se ha ejecutado `npm run set-webhook`: tocaría un webhook de Telegram real y el entorno de
ejecución lo bloqueó por tratarse de una acción con efectos fuera del repositorio. El cambio es solo
el que pide el plan (`tsx --env-file=.env.local scripts/set-webhook.ts`, igual que ya hace
`scripts/restaurar.ts`); falta que Jose lo pruebe con su `.env.local` real.
