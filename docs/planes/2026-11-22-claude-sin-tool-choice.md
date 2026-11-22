# Lectura de facturas con Claude Sonnet 5.5 (sin tool_choice forzado) y errores visibles

Estado: Hecho (Jose, 22/11/2026)
22/11/2026 · Plan de Claude (proyecto IVAn)

## Por qué

En la primera prueba real con Telegram (22/11/2026), fallan las dos cosas que usan `llamar()` en `lib/claude.ts`:
- **Un gasto por foto** se queda en «Leyendo la factura…» y no contesta nada.
- **«Factura a Zapflow 3.060 de noviembre»:** la herramienta de facturas da error dos veces y no se crea el borrador.

El registro de Vercel dice:

```
400 invalid_request_error: tool_choice: type "tool" and "any" are not supported for this model.
```

`llamar()` obliga a Claude a responder con una herramienta (`tool_choice: { type: "tool", name }`). Claude Sonnet 5.5 (`claude-sonnet-5-5`, el modelo por defecto de IVAn) no lo admite. Las pruebas de integración no lo vieron porque simulan a Claude y aceptan cualquier `tool_choice`. El agente de conversación funciona porque no fuerza herramientas.

Al revisar el registro han salido dos problemas más:
1. **El error no le llega a Jose.** En un gasto, la excepción se escapa del manejador y el mensaje «Leyendo la factura…» se queda así para siempre.
2. **El registro de Vercel incluye el token del bot.** `app/api/telegram/route.ts` hace `console.error("update", id, e)`, y el `BotError` de grammY lleva dentro `ctx.api.token`. Cualquiera con acceso a los registros controla el bot.

## Lo que se sabe (fuentes)

- **Claude Sonnet 5.5 no admite forzar una herramienta.** `tool_choice` con `{"type": "any"}` o `{"type": "tool", "name": "..."}` devuelve un 400 `invalid_request_error`. Se admiten `auto` (el valor por defecto) y `none`. Para que la entrada cumpla el esquema hay dos caminos: dejar `auto` y marcar la herramienta con `strict: true`, o pasar el esquema a structured outputs (https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5).
- **Structured outputs** (`output_config.format` con `type: "json_schema"`): sirve para recibir la respuesta de Claude en un JSON concreto, por ejemplo para extraer datos de imágenes o textos. El JSON llega en el bloque de texto de la respuesta. El esquema tiene algunas limitaciones (https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

## Alcance

**Sí**
1. `llamar()` deja de usar herramientas y `tool_choice`. Pide la respuesta con **structured outputs** (`output_config.format`, `type: "json_schema"`), con el mismo esquema de cada caso. Luego lee el JSON del bloque de texto y lo valida con el zod de siempre.
   - Aplica a todos los que usan `llamar()`: `extraerGasto`, `corregirGasto`, `interpretarFactura`, la lectura de facturas de Selfconta y cualquier otro.
   - Si la versión de `@anthropic-ai/sdk` no admite `output_config`, se actualiza el SDK. Si no hay más remedio, se usa la otra opción de la documentación: herramienta con `strict: true` y `tool_choice: auto`, diciendo en el prompt que siempre debe usarla, y un error claro si no la usa.
   - Los esquemas se ajustan a las limitaciones de structured outputs (por ejemplo, `additionalProperties: false` y todo en `required`) sin cambiar los datos que devuelven.
2. **Errores visibles para Jose:**
   - en gastos y facturas de Selfconta, si algo falla después de «Leyendo la factura…», ese mensaje se edita con «⚠️ No he podido leer la factura: <motivo breve>»;
   - un `bot.catch` general que conteste «⚠️ Algo ha fallado: <motivo breve>» en vez de quedarse callado.
3. **Ningún secreto en los registros:**
   - en `app/api/telegram/route.ts` y en el cron, registrar solo `update_id`, el nombre y el mensaje del error, y como mucho `error.error` (el error de la API), nunca el objeto `ctx` ni el `BotError` entero;
   - test que lo compruebe: el texto registrado no contiene el token.
4. **Pruebas que se parezcan a la API real.** El Claude simulado de `scripts/integracion/` responde 400 con el mismo mensaje si recibe `tool_choice` de tipo `tool` o `any`. Así este error no puede volver sin que fallen las pruebas. Los casos que usan `llamar()` pasan a devolver la respuesta en formato structured outputs.

**No**
- Cambiar de modelo. `claude-sonnet-5-5` sigue siendo el de por defecto.
- Cambiar el agente de conversación (`lib/agente.ts`), que ya usa `tool_choice` automático.

## Cómo sabremos que está bien

- `grep -rn "tool_choice" lib/` solo aparece en el agente, con `auto` o sin poner.
- `npm test` y `npm run typecheck` sin errores, y la integración en el Mac de Jose: todas las conversaciones, incluida una nueva para cada caso de los puntos 2 y 3:
  - si Claude falla al leer un gasto, «Leyendo la factura…» pasa a «⚠️ No he podido leer la factura…»;
  - el registro de un error no contiene el token del bot.
- El Claude simulado rechaza `tool_choice: tool` (probado con un test).
- **Prueba real en Telegram (Jose):**
  - la foto de un gasto da el borrador con el IVA por tipo;
  - «Factura a Zapflow 3.060 de noviembre» da el borrador con «⛔ Modo paralelo…» y se cancela.

## Riesgos y dudas

- Que structured outputs no acepte algún detalle de nuestros esquemas (tipos `["string", "null"]`, `enum`, arrays de objetos). Claude Code lo comprueba con una llamada real a la API desde el Mac de Jose antes de dar el plan por hecho, sin datos personales (con un texto de prueba).
- El texto que antes iba en la descripción de la herramienta tiene que seguir llegando a Claude: se pasa al `system` o a las descripciones del esquema.

## Notas de ejecución

Ejecutado el 22/11/2026, sin desviaciones de alcance (una desviación de implementación respecto al
punto 2, explicada abajo). `npm test` (68/68) y `npm run typecheck` pasan.

**Comprobación previa con la API real (punto obligatorio del plan, antes de dar nada por hecho):**
con un texto de prueba (sin datos personales) llamé a `claude-sonnet-5-5` con `output_config.format`
de tipo `json_schema` usando el esquema real de `guardar_gasto` (enums, `type: ["string","null"]`,
un array de objetos anidado con su propio `required`/`additionalProperties`, y `description` en la
raíz del esquema). La API lo aceptó y devolvió el JSON esperado en un bloque de texto; en otra
llamada, la respuesta llegó con un bloque `thinking` antes del texto (`llamar()` ya lo tenía en
cuenta: busca el primer bloque `type: "text"`, no asume que sea el primero). Al final, ya con el
código terminado, repetí la comprobación llamando a `extraerGasto()` de verdad (con un PNG en
blanco, sin datos reales) para confirmar que el esquema completo, tal cual quedó en el repo
(con `additionalProperties: false` en todos los objetos), funciona de principio a fin.

Archivos tocados:
- `lib/claude.ts`: `llamar()` ya no manda `tools`/`tool_choice`; pide `output_config.format` de tipo
  `json_schema` con el mismo esquema de cada caso (ahora bajo `esquema: { descripcion, schema }` en
  vez de `tool: { name, description, schema }`: el `name` no se usaba para nada sin herramienta que
  invocar). Lee el primer bloque `text` de la respuesta, lo parsea como JSON y lo valida con el zod
  de siempre. Los tres esquemas (`guardar_gasto`, `registrar_factura_emitida`, `preparar_factura`)
  llevan `additionalProperties: false` en el objeto raíz y en los objetos anidados (`desglose_iva`).
- `package.json` / `package-lock.json`: `@anthropic-ai/sdk` de 1.9.0 a 1.12.0 (la 1.9.0 no tenía
  `output_config` en los tipos). De paso, el lockfile tenía `"name": "gestor"` suelto de un cambio de
  nombre anterior; `npm install` lo ha dejado en `"ivan"`, como en `package.json`.
- `lib/bot.ts`:
  - `procesarArchivo()` (gastos y facturas de Selfconta por foto/PDF) envuelve todo en un `try`; si
    falla, edita el mensaje «Leyendo la factura…» con «⚠️ No he podido leer la factura: `<motivo>`».
  - `erroSeguro()` (nueva, exportada): de un error solo sacan el nombre, el mensaje y, como mucho,
    su `.error` (el cuerpo de la API, como en `AnthropicError`/`GrammyError`), nunca el `ctx` ni el
    objeto entero.
  - `b.catch()` ahora registra con `erroSeguro(err.error)` en vez de pasar `err.error` entero.
  - **Desviación respecto al plan:** al escribir el test de integración de «el registro de un error
    no contiene el token del bot» salió un problema que el plan no había visto: `bot.handleUpdate()`
    (lo que usa el webhook) **nunca llama a `bot.catch`** — grammY solo invoca el `errorHandler` desde
    `bot.start()` (long polling), que IVAn no usa. Así que el `b.catch` general que pedía el punto 2
    era, tal cual, código muerto en producción: un fallo sin capturar dentro de una herramienta del
    agente (p. ej. `preparar_factura`, el caso real del aviso de Jose) se habría quedado sin
    respuesta igual que antes. Añadida `manejarActualizacion(bot, update)` (nueva, exportada): llama
    a `handleUpdate` y, si revienta con un `BotError`, invoca `bot.errorHandler` a mano. La usan
    `app/api/telegram/route.ts` y los ayudantes `mensaje`/`pulsar` de
    `scripts/integracion/conversaciones.ts` en vez de `bot.handleUpdate` directamente.
- `app/api/telegram/route.ts`: usa `manejarActualizacion` y registra con `erroSeguro(e)`.
- `app/api/cron/recordatorios/route.ts`: el `catch` de la copia de seguridad registra con
  `erroSeguro(e)` en vez de pasar el error entero.
- `scripts/integracion/fakes.ts`: `claudeApi` responde 400 con el mismo mensaje que la API real
  (`tool_choice: type "tool" and "any" are not supported for this model.`) si recibe `tool_choice`
  de tipo `tool` o `any`.
- `scripts/integracion/conversaciones.ts`: `forzada()` ya no construye un bloque `tool_use`: ahora
  comprueba `output_config.format.type === "json_schema"` y que no hay `tool_choice`, y devuelve el
  JSON como texto (que es lo que hace `llamar()` de verdad). El único sitio con un guion «a mano»
  para `preparar_factura` (la corrección de una factura por texto) se ajustó igual. Dos casos nuevos:
  uno simula que Claude falla al leer un gasto (sin guion: el Claude simulado responde 500 «Guion de
  Claude agotado») y comprueba que el mensaje se edita con el aviso; el otro hace que el guion del
  agente falle en sus tres intentos (el SDK reintenta los 500 dos veces por defecto) y comprueba que
  `manejarActualizacion` contesta «⛔ Algo ha fallado» y que nada de lo registrado por `console.error`
  contiene el token de Telegram de las pruebas.
- `tests/claude-sin-tool-choice.test.ts` (nuevo): el Claude simulado rechaza `tool_choice: "tool"` y
  `"any"` con el 400 de verdad, y no rechaza una llamada sin `tool_choice`.
- `tests/erro-seguro.test.ts` (nuevo): `erroSeguro()` nunca deja pasar el `ctx` de un `BotError` (se
  construye uno de verdad con un token falso y se comprueba que no aparece en el resultado), conserva
  el `.error` de un error con forma de API, y no revienta con cualquier otra cosa.

**Integración con Postgres real** (`~/.ivan-pg-pruebas`, Postgres 16 + PostgREST), ejecutada en mi
Mac: **56/56** (las 54 de antes + las 2 nuevas de este plan). `npm test` 68/68 y `npm run typecheck`
limpio. No cambia ninguna cifra de 2026.
