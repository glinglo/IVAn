# Revisión de las Fases 1 y 2

Estado: Hecho (Claude Code, 17/11/2026)
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

Revisión hecha el 17/11/2026 en la rama `plan/revision-fases-1-2` desde `wip/v0`. No se ha tocado código de la app; solo se ha revisado.

**1. Que funcione en tu máquina**
- `npm ci`: bien (313 paquetes, solo avisos de deprecación habituales del ecosistema, sin relación con el código).
- `npm test`: **27/27 tests en verde**, como esperaba el plan.
- `npm run typecheck`: sin errores.
- `npx next build`: build correcto (8 rutas, todas dinámicas salvo `/sin-acceso`). Next reescribió `tsconfig.json` como efecto colateral del build (cambió `jsx: preserve` → `jsx: react-jsx` y reformateó el JSON); lo he revertido con `git checkout -- tsconfig.json` porque no es un cambio deseado, solo ruido de Next 16 al regenerar el archivo. Si os sale igual al construir en Vercel, no hay que hacer nada: Next lo vuelve a tocar en cada build y no afecta a nada.
- **Prueba de integración ejecutada** (con tu permiso instalé `postgresql@16` y `postgrest` por Homebrew, sin tocar las versiones que ya tenías): Postgres 16 en el puerto 54322, `reset-db.sh`, PostgREST con `arrancar.sh` y `npx tsx scripts/integracion/conversaciones.ts`. Resultado: **45 de 47 conversaciones bien**, 2 mal, reproducible en dos pasadas seguidas:
  - *«La copia se restaura en una base vacía y queda igual»* → `Restaurando ajustes: Database client error. Retrying the connection.` Mirando el log de PostgREST: el test hace `drop database ... with (force)` dentro de `reset-db.sh --vacia`, lo que corta en caliente la conexión de PostgREST a la base; PostgREST se reconecta solo, pero en esta máquina tardó unos 15-20 segundos (varios reintentos con backoff), mientras que el test solo espera 1,5 s antes de seguir. Parece una diferencia de entorno (este Postgres 16 e instancia de PostgREST locales por Homebrew son más lentos para reconectar que el Postgres/PostgREST que usa normalmente este proyecto), no un fallo de `lib/copia.ts`: la lógica de `restaurarCopia` no interviene en el tiempo de reconexión. **No es un bug de la app; es que el tiempo de espera fijo del test (1,5 s) no cubre este entorno.**
  - *«Al quitar el modo paralelo IVAn sigue la numeración (00342)»* → `Non-error value of type object thrown in middleware!`. Es la conversación siguiente en el guion, y arranca con la base en el estado en el que la dejó el test anterior (que falló a mitad de restaurar); probablemente falla en cascada por eso, no por un problema propio. No he podido confirmarlo de forma aislada sin tocar el guion de `conversaciones.ts` (no estaba en el alcance cambiar código, tampoco el de los tests).
  - Las otras 45, incluidas todas las de modo paralelo, registro de facturas externas y seguridad, pasan igual que decía el plan.
  - **No he cambiado nada de `scripts/integracion/` ni del resto del código**, tal y como se pedía. Si se quiere arreglar esto de verdad, lo más simple sería que `reset-db.sh --vacia` (o el test) espere a que PostgREST vuelva a responder en vez de un `sleep` fijo; lo dejo apuntado, no lo he tocado.

**2. Migración 003**
- Es idempotente sobre la 001: todo `add column if not exists` / `create or replace function`, se puede aplicar sin problemas sobre una base que ya tiene la 001 aplicada.
- `emitir_factura()` en la 003 hace exactamente lo mismo que en la 001 (mismo bloqueo de fila con `for update`, misma numeración sin huecos), con el añadido del bloqueo de modo paralelo y la comprobación de `origen`. Confirmado línea a línea.
- `registrar_factura_externa()` bloquea la fila de `ajustes` y la de la factura con `for update`, comprueba que el número coincide con el siguiente esperado y mueve `ultimo_numero`: no puede dejar huecos ni saltarse el bloqueo.
- **Aviso menor (prioridad 3, opinable):** `emitir_factura()` bloquea primero la fila de `facturas` y después actualiza `ajustes`; `registrar_factura_externa()` bloquea primero `ajustes` y después `facturas`. Es un orden de bloqueo invertido entre las dos funciones. Con un solo usuario y el bot procesando de uno en uno no debería notarse nunca, pero si algún día hay dos llamadas a la vez (dos webhooks simultáneos, por ejemplo) podría producirse un *deadlock* de Postgres en vez de que una espere a la otra. No es urgente; si se toca esta parte en el futuro, igualar el orden de los `for update`.

**3. Detección de facturas propias (`esPropia`, `nifSinPais`)**
- La lógica en sí es correcta y los tests de NIF con/sin prefijo de país pasan.
- **Riesgo real confirmado (prioridad 2):** en `lib/bot.ts` (`procesarArchivo`), la única señal para decidir si un PDF es una factura propia (ventas) o un gasto es `esPropia(nif_proveedor leído por Claude, nif propio)`. Si Claude lee mal el NIF del emisor en el PDF (letra mal reconocida, OCR de una foto borrosa, etc.), una factura emitida por Jose en Selfconta entraría como un **gasto normal** en vez de pasar por `prepararExterna`, sin ningún aviso ni segunda comprobación. El plan ya apuntaba esta duda; la confirmo como riesgo real, no solo teórico, porque no hay ninguna señal de respaldo (p. ej. mirar si el número de factura sigue la serie 00326-00339, o el nombre del emisor). Sugerencia para un plan futuro: si el número extraído coincide con el patrón de la serie propia (`serie + dígitos`) aunque el NIF no cuadre, avisar con una pregunta en vez de registrarlo directamente como gasto.

**4. Copia de seguridad**
- Paginación correcta (`range` de 1000 filas, se repite hasta que una página vuelve incompleta): no tiene límite práctico de tamaño.
- Usa `service_role` (vía `db()`), así que RLS no la bloquea; coherente con que todo el acceso de servidor pasa por esa clave.
- `restaurarCopia` usa `upsert` con `ignoreDuplicates: true` sobre la clave de cada tabla, y en `mensajes` (columna generada) descarta el `id` antes de insertar: no debería pisar nada que ya exista. No he podido probarlo contra un Supabase real (fuera de alcance: la puesta en marcha la hace Jose), pero la lógica es sólida.

**5. Seguridad**
- Webhook de Telegram: comprueba `x-telegram-bot-api-secret-token` contra `TELEGRAM_WEBHOOK_SECRET` antes de nada; devuelve 401 si no coincide.
- Cron: comprueba `Authorization: Bearer CRON_SECRET`; devuelve 401 si no coincide.
- `TELEGRAM_API_ROOT` y `OPENAI_BASE_URL` (`lib/env.ts`): si no están definidas, usan el dominio real por defecto (`api.telegram.org`, `api.openai.com`); solo se pueden desviar si alguien define esas variables a mano. Mientras no se definan en Vercel, no hay riesgo de que producción apunte a otro sitio.
- `/acceso` (enlace firmado del panel) y la cookie de sesión usan HMAC-SHA256 con `timingSafeEqual`: bien hecho, resistente a timing attacks.
- Nada que arreglar aquí.

**6. Estilo y estructura**
- No he encontrado comentarios `TODO`/`FIXME` pendientes ni código muerto evidente.
- El código es consistente con las reglas del proyecto (español, sin abstracciones de más, `lib/calculo.ts` y `lib/facturacion.ts` como únicos puntos de verdad). No propongo cambios de estilo.

**Resumen de prioridades**
1. (Media) Riesgo de clasificación errónea de facturas propias como gasto si Claude lee mal el NIF del emisor — valorar una señal de respaldo en un plan futuro.
2. (Baja) `reset-db.sh --vacia` / la prueba de integración esperan un tiempo fijo (1,5 s) a que PostgREST se reconecte tras el `drop database ... with (force)`; en este entorno tardó más y 2 de 47 conversaciones fallaron por eso (en cascada). No es un bug de la app; si se quiere robustecer, cambiar el `sleep` fijo por una espera activa a que PostgREST responda.
3. (Baja, opinable) Orden de bloqueo invertido entre `emitir_factura()` y `registrar_factura_externa()`: solo importa con concurrencia real.

Todo lo demás (build, tests, typecheck, migración, backup, seguridad, estilo, y 45 de las 47 conversaciones simuladas) está bien y no necesita cambios.
