# Lectura de facturas con Claude Sonnet 5.5 (sin tool_choice forzado) y errores visibles

Estado: Aprobado (Jose, 22/11/2026)
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

(Las rellena Claude Code.)
