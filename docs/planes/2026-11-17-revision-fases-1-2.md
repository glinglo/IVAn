# Revisión de las Fases 1 y 2

Estado: Aprobado (Jose, 17/11/2026)
17/11/2026 · Plan de Claude (proyecto IVAn)

## Por qué

Los commits `cd92e42` (Fase 1) y `8c73c76` (Fase 2) de `wip/v0` los escribió Claude desde claude.ai, sin plan aprobado y sin pasar por Claude Code. Jose decidió dejarlos como base. Este plan pide a Claude Code que los **revise** antes de seguir construyendo encima.

## Qué hay en esos commits

**Fase 1 (`cd92e42`)**
- `scripts/integracion/`: prueba de integración con Postgres + PostgREST reales, y Telegram, Claude, la transcripción y el tipo de cambio simulados (`fakes.ts`). Incluye `conversaciones.ts` (conversaciones de punta a punta), `reset-db.sh`, `arrancar.sh` y `servidor.ts` (para probar el panel con `next dev`).
- `lib/bot.ts`: si la factura se emite y falla el envío del PDF, el bot ya no dice «No la he emitido».
- `lib/calculo.ts` + panel: el 349 separa país y número (`nifComunitario`).
- `lib/facturacion.ts`: en facturas UE, el NIF del emisor sale con prefijo ES.
- `lib/recordatorios.ts`: el aviso de facturar sale desde el día 28 (antes, solo el 28).
- `lib/env.ts`, `lib/voz.ts`, `lib/bot.ts`: `TELEGRAM_API_ROOT` y `OPENAI_BASE_URL` opcionales, solo para las pruebas.
- `docs/PUESTA_EN_MARCHA.md`, `supabase/seed/ajustes.ejemplo.sql`, `scripts/set-webhook.ts` (comandos /panel, /exportar).

**Fase 2 (`8c73c76`)**
- `supabase/migrations/003_paralelo.sql`: `ajustes.emitir_desde` (modo paralelo con Selfconta hasta el 1/1/2027), `facturas.origen` y `numero_externo`, la función `registrar_factura_externa()`, y `emitir_factura()` reescrita para bloquear la emisión en modo paralelo.
- `lib/externas.ts` + `lib/claude.ts` (`extraerFacturaEmitida`) + `lib/bot.ts`: si llega el PDF de una factura emitida por Jose, se registra en ventas con su número (botón ✅ Registrar).
- `lib/gastos.ts`: `registrarDesdeArchivo` se divide en `leerArchivo` + `registrarDesdeArchivo`.
- `lib/copia.ts`, `scripts/restaurar.ts`, cron y `/copia`: copia de seguridad cada 7 días por Telegram.
- `/ajustes emitir_desde: …`.

## Qué revisar

1. **Que funcione en tu máquina.** `npm ci`, `npm test`, `npm run typecheck`, `npx next build`. La prueba de integración necesita Postgres 16 y el binario de PostgREST: ver `docs/PUESTA_EN_MARCHA.md` («Pruebas en local»). Resultado esperado: 27 tests y 47 conversaciones.
2. **Migración 003.** Que se pueda aplicar sobre una base que ya tiene la 001 (es la que tendrá Jose en Supabase), y que `emitir_factura()` reescrita siga haciendo exactamente lo mismo que la de la 001, más el bloqueo. Que `registrar_factura_externa()` no deje huecos en la numeración ni se pueda saltar el bloqueo de filas.
3. **Detección de facturas propias** (`lib/externas.ts`, `esPropia`, `nifSinPais`): casos de NIF que puedan confundirse. Ojo: si Claude no rellena bien `nif_proveedor`, una factura de Jose entraría como gasto. Valorar si hace falta otra señal (p. ej. que el número siga la serie).
4. **Copia de seguridad** (`lib/copia.ts`): tamaño de la copia con años de datos, paginación, que restaurar sobre una base vacía funcione en Supabase de verdad (con RLS activado y la `service_role`).
5. **Seguridad.** El webhook y el cron rechazan peticiones sin secreto; las variables `*_API_ROOT` y `*_BASE_URL` no deben poder apuntar a otro sitio en producción si no están definidas.
6. **Estilo y estructura.** Si algo no encaja con cómo quieres el código, apúntalo. No reescribas por gusto: propón el cambio en las notas y lo plantea Jose.

## Fuera de alcance

- Cambios en el cálculo fiscal (van en sus propios planes).
- La puesta en marcha en Supabase y Vercel (la hace Jose con la guía).

## Cómo sabremos que está bien

- Los cuatro comandos del punto 1 en verde en la máquina de Jose.
- Una lista en «Notas de ejecución»: qué está bien, qué hay que arreglar (con prioridad) y qué es opinable.

## Notas de ejecución

_(las rellena Claude Code)_
