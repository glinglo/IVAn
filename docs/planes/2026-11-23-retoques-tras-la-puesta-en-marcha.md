# Retoques tras la puesta en marcha: aviso de fin de mes con gastos, y tres arreglos pequeños

Estado: Hecho (Jose, 23/11/2026)
23/11/2026 · Plan de Claude (proyecto IVAn)
**Antes del 28/11**, que es cuando sale el primer aviso de fin de mes.

## Por qué

IVAn está en marcha desde el 22/11. Jose quiere usar el aviso de fin de mes también para mandar los gastos del mes, y que no se le acumulen al final del trimestre. Además quedaron tres cosas pequeñas de la puesta en marcha:
1. `npm run set-webhook` imprime el secreto del webhook si falla. grammY saca el `payload` del error, que lleva `secret_token`, y así se filtró el 22/11.
2. `llamar()` (lectura de facturas) usa `max_tokens: 1500`. Claude Sonnet 5.5 piensa antes de responder por defecto, y ese pensamiento cuenta dentro de `max_tokens`. Con una factura larga, la respuesta podría cortarse y salir «Claude no devolvió un JSON válido». Además, el tiempo cuenta: la función tiene 60 s.
3. El error que sale si la respuesta se corta no explica el motivo.

## Lo que se sabe

- **Lo que hace hoy el aviso de fin de mes** (`lib/recordatorios.ts` + `lib/cron.ts`):
  - sale una vez al mes desde el día 28;
  - en modo paralelo dice «Hazla en Selfconta y mándame el PDF»;
  - añade «El mes pasado facturaste a X y este mes todavía no» (`clientesSinFacturar`).
- **Gastos de 2026:** casi todos son suscripciones mensuales (Cursor, Anthropic, Figma, Google Cloud, Framer, Zoho, Fly.io, Cloudflare, Replit, Meta…). Si un proveedor aparece en los meses anteriores y no en el mes en curso, lo más probable es que falte su factura.
- **Claude Sonnet 5.5 y el pensamiento:** piensa por defecto (sin campo `thinking`) y se controla con `output_config.effort` (https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide). Claude Code comprueba en la documentación los valores admitidos antes de usarlo.

## Alcance

**Sí**
1. **Aviso de fin de mes con los gastos.** El texto pasa a ser:
   ```
   🧾 Fin de noviembre: dos cosas antes de cerrar el mes.
   1. Factura: hazla en Selfconta y mándame el PDF. (En modo normal: «/factura Zapflow 3060».)
   2. Gastos: mándame todas las facturas de gasto de noviembre (foto o PDF), también las de proveedores nuevos o compras sueltas.
   Suelen llegar cada mes y aún no tengo las de noviembre: Cursor, Figma, Google Cloud…
   Nuevos el mes pasado: Supabase. Si es una suscripción, mándame también la de noviembre.
   ```
   - **Recurrente:** proveedor con al menos un gasto confirmado en **2 de los 3 meses anteriores**.
   - **Falta:** no tiene ningún gasto (confirmado o en borrador) en el mes en curso.
   - **Nuevo el mes pasado** (línea aparte, más suave, porque puede ser una compra suelta): proveedor con gasto en el mes anterior, ninguno en los dos de antes y ninguno todavía en el mes en curso. Si no hay ninguno, la línea no sale.
   - **Proveedores nuevos de este mes:** IVAn no puede saberlos; los cubre la frase general «también las de proveedores nuevos o compras sueltas».
   - Se compara por nombre de proveedor normalizado: sin mayúsculas, sin «S.L.», «Inc.», «Ltd», «B.V.»… y sin espacios de más. Si hay NIF, mejor por NIF.
   - La lista va ordenada por nombre y tiene como mucho 12; si hay más, «y N más».
   - Si no falta ninguno: «De los que suelen llegar cada mes, ya tengo todos los de noviembre. 👍».
   - Se queda la línea de «El mes pasado facturaste a X…».
   - Si hay gastos en borrador sin confirmar, se avisa: «⚠️ Tienes N gasto(s) sin confirmar en el chat.» Es lo mismo que ya hace `resumenTrimestre`.
   - La lógica va en una función pura (`proveedoresQueFaltan(gastos, hoy)`) con sus tests. `lib/cron.ts` solo lee los gastos de los últimos 4 meses y la llama.
2. **`set-webhook` sin secretos en el error:** captura el error y enseña solo `error_code` y `description` («Call to 'setWebhook' failed! (401: Unauthorized)»), sin `payload`.
3. **`llamar()` con margen:**
   - `max_tokens` a 8000;
   - esfuerzo bajo con `output_config.effort` si la API lo admite con structured outputs: leer una factura no necesita pensar mucho y así va más rápido;
   - si `stop_reason` es `max_tokens`, el error dice «La respuesta de Claude se ha cortado (factura demasiado larga)» en vez de «no devolvió un JSON válido».
   - Comprobarlo con una llamada real (texto de prueba, sin datos personales), como en el PR #8.

**No**
- Avisar como «falta» de gastos de un proveedor que no es mensual (anuales, sueltos). Con la regla de 2 de 3 meses quedan fuera; como mucho salen una vez en «Nuevos el mes pasado».
- Cambiar la hora ni la frecuencia del aviso.
- El aviso de domiciliación del 4T (va en el plan del cierre del 4T).

## Cómo sabremos que está bien

- **Tests de `proveedoresQueFaltan`:**
  - con Cursor en agosto, septiembre y octubre y nada en noviembre → falta Cursor;
  - con Cursor solo en agosto → no falta (no es recurrente);
  - «Figma, Inc.» y «FIGMA INC» son el mismo proveedor;
  - un gasto de Cursor de noviembre en borrador → no falta;
  - con Supabase solo en octubre → sale en «Nuevos el mes pasado», no en la lista de los que suelen llegar;
  - con Supabase en octubre y en noviembre → no sale en ninguna lista.
- **Con los datos reales de 2026 a fecha 28/11/2026:** Claude Code apunta en las notas la lista que saldría, para que Jose vea si tiene sentido.
- **Integración:** el aviso del día 28 en modo paralelo lleva las dos partes, la lista y el aviso de borradores.
- **`set-webhook` con un token falso:** el error no contiene el secreto (test o comprobación manual apuntada en las notas).
- **`llamar()`:** un test con una respuesta simulada con `stop_reason: "max_tokens"` da el error nuevo; y una llamada real de prueba funciona con el esfuerzo bajo.
- `npm test`, `typecheck` e integración en el Mac de Jose sin fallos. Las cifras de 2026 no cambian.

## Riesgos y dudas

- **Nombres de proveedor que Claude lee distinto cada mes** («Google Cloud EMEA Ltd» y «Google Ireland»): la lista podría dar un falso «falta». Es un aviso, no bloquea nada. Si molesta, se afina.
- Si `output_config.effort` no se puede usar con structured outputs, basta con subir `max_tokens` y el error claro.

## Notas de ejecución

Ejecutado el 23/11/2026, sin desviaciones. `npm test` (78/78) y `npm run typecheck` pasan.

**Comprobación con la API real de los cambios de `llamar()` (punto obligatorio del plan):** con
`max_tokens: 8000` y `output_config.effort: "low"` junto a `output_config.format` de tipo
`json_schema`, una llamada de prueba a `claude-sonnet-5-5` (texto «Responde ok=true», sin datos
personales) devolvió `stop_reason: "end_turn"` y `thinking_tokens: 0`: el esfuerzo bajo sí se
puede combinar con structured outputs y, como se esperaba, evita el pensamiento por defecto. El
error nuevo (`stop_reason === "max_tokens"` → «La respuesta de Claude se ha cortado (factura
demasiado larga)») se probó con un servidor HTTP de pruebas local que simula la API
(`tests/claude-max-tokens.test.ts`), no con la API real (no hay forma de pedirle a Claude que corte
la respuesta a propósito sin gastar una respuesta enorme).

**Lista de proveedores que saldría el 28/11/2026 con los datos reales** (consulta de solo lectura a
la Supabase real, `gastos` desde el 1/8/2026 hasta hoy, sin estado "descartado"; solo nombres de
proveedor, nada de importes ni NIF de clientes): de los **7 gastos** que hay cargados en IVAn hasta
ahora (puesta en marcha el 22/11, así que casi todo lo de agosto-octubre de Selfconta aún no está
aquí),
- **Faltan** (recurrentes, sin nada en noviembre): **Anthropic, PBC** · **Apify Technologies
  s.r.o.**
- **Nuevos el mes pasado:** ninguno.

Con tan pocos gastos cargados, esta lista es poco representativa todavía: según
`docs/CONTEXTO.md`, Cursor, Figma, Google Cloud, Framer, Zoho, Fly.io, Cloudflare, Replit y Meta
también deberían salir como recurrentes en cuanto Jose cargue los gastos de agosto a octubre que
llevaba Selfconta (ahora mismo no están en IVAn). Jose decide si merece la pena cargarlos antes del
28/11 para que el aviso sea útil ya este mes, o esperar a que se complete solo con los próximos
meses.

Archivos tocados:
- `lib/fiscal.ts`: `nombreMes()` (nombre del mes en español) y `mesAnterior()` ("2026-11" →
  "2026-10"), funciones puras de fecha junto a las demás.
- `lib/recordatorios.ts`: `proveedoresQueFaltan(gastos, hoy)`, pura, con `normalizarProveedor()` y
  `claveProveedor()` (por NIF si lo hay, si no por nombre normalizado) como ayudantes internos.
- `lib/cron.ts`: `textoFinDeMes()` construye el aviso nuevo (factura según el modo + gastos
  recurrentes que faltan + nuevos del mes pasado); `avisoBorradores()` (antes esa cuenta solo salía
  dentro de `resumenTrimestre`, ahora también en el aviso de fin de mes, una sola vez por mensaje
  aunque coincidan los dos avisos el mismo día); `lista()` corta en 12 con «y N más».
- `scripts/set-webhook.ts`: todo el cuerpo envuelto en un `try`; `sinSecretos()` relanza solo
  `.message` del error (que en un `GrammyError` ya viene sin el `payload`: «Call to 'setWebhook'
  failed! (401: Unauthorized)»), nunca el objeto entero. Comprobado a mano con un token falso contra
  la API real de Telegram: el error sale igual que en el plan y el secreto no aparece por ningún
  lado (ni en el mensaje ni en el stack).
- `lib/claude.ts`: `llamar()` con `max_tokens: 8000`, `output_config.effort: "low"`, y el error
  nuevo si `stop_reason === "max_tokens"`.
- `tests/recordatorios.test.ts` (nuevo): toda la tabla de casos del plan, más NIF y gasto
  descartado.
- `tests/claude-max-tokens.test.ts` (nuevo): servidor de pruebas local con `stop_reason`
  simulado.
- `scripts/integracion/conversaciones.ts`: el caso del aviso de fin de mes en modo paralelo ahora
  comprueba las dos partes (factura + gastos) y el aviso de borradores (se inserta un borrador
  suelto para que la cuenta no dependa de lo que haya quedado de otros casos).

**Integración con Postgres real** (`~/.ivan-pg-pruebas`, Postgres 16 + PostgREST): **56/56**. `npm
test` 78/78 y `npm run typecheck` limpio. No cambia ninguna cifra de 2026.
