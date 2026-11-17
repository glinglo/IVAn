# Ajustes tras la revisión de las Fases 1 y 2

Estado: Hecho
17/11/2026 · Plan de Claude (proyecto IVAn)

**Fecha límite: 30/11/2026**, antes de registrar la 00337 de Selfconta. Mejor antes del 24/11, cuando empieza la puesta en marcha en Supabase: así la migración 003 entra ya corregida.

## Por qué

La [revisión de las Fases 1 y 2](2026-11-17-revision-fases-1-2.md) dejó cuatro cosas pendientes. Jose ya ha decidido qué hacer con cada una:

1. **Facturas propias que entran como gasto.** Hoy la única señal para saber si un PDF es una factura de Jose (venta) o un gasto es que Claude lea bien el NIF del emisor. Si lo lee mal, la 00337 entraría como gasto sin avisar. **Decisión:** si el NIF no coincide pero hay otra pista, IVAn pregunta con dos botones. Nunca decide en silencio.
2. **Orden de bloqueo.** `emitir_factura()` bloquea primero `facturas` y luego `ajustes`; `registrar_factura_externa()`, al revés. Dos llamadas a la vez podrían bloquearse mutuamente (deadlock). **Decisión:** el mismo orden en las dos, corregido en la propia migración 003, que no está aplicada en ningún sitio.
3. **`tsconfig.json`.** `next build` lo reescribe (`jsx: react-jsx`) y Claude Code lo revirtió. **Decisión de Claude (abajo, con fuentes):** se deja en el repo la versión que escribe `next build`.
4. **Prueba de integración: 45/47.** Las 2 que fallan esperan 1,5 s fijos a que PostgREST se reconecte tras borrar la base; en el Mac de Jose tarda 15-20 s. **Decisión:** espera activa hasta que PostgREST responda. Las conversaciones tienen que pasar todas en su máquina.

## Lo que se sabe (fuentes)

**1. Detección de facturas propias**
- `lib/bot.ts` (`procesarArchivo`): `if (esPropia(leido.extraido.nif_proveedor, leido.nifPropio))` → `prepararExterna`; si no, `registrarDesdeArchivo` (gasto). No hay otra señal.
- Lo que Claude ya extrae al leer cualquier PDF (`GastoExtraido` en `lib/claude.ts`): `proveedor` (nombre del emisor), `nif_proveedor`, `numero_factura` y `nif_destinatario`. Con eso basta para las tres pistas; **no hace falta cambiar el esquema de Claude** (añadir un campo obligaría a tocar todas las respuestas simuladas de la prueba).
- Lo que ya hay para comparar: `nifSinPais`, `normalizarNumero` y `siguienteNumero` en `lib/externas.ts`; `getAjustes()` (nombre, NIF, serie) y `getClientes()` (NIF de cada cliente) en `lib/db.ts`; `descargarArchivo()` en `lib/db.ts` para recuperar el PDF guardado.
- Botones que ya existen: `g:` (gasto), `f:` (factura de IVAn), `x:` (factura de Selfconta). El prefijo `p:` está libre.

**2. Orden de bloqueo** (`supabase/migrations/003_paralelo.sql`)
- `emitir_factura()`: lee `ajustes` sin bloquear (modo paralelo) → `facturas … for update` → `update ajustes` (bloquea `ajustes`).
- `registrar_factura_externa()`: `ajustes … for update` → `facturas … for update` → `update ajustes`.
- Ninguna otra función ni código bloquea las dos tablas (comprobado con `grep "for update"`).
- Todo en la 003 es `create or replace` / `if not exists`: si por lo que sea ya estuviera aplicada en algún sitio, basta con volver a aplicarla.

**3. `tsconfig.json` con Next 16** (versión instalada: `next@16.4.6`, la `latest` de npm a 17/11/2026)
- El código de Next 16.4.6 (`dist/lib/typescript/writeConfigurationDefaults.js`) pone `jsx: "react-jsx"` como cambio **obligatorio** («next.js uses the React automatic runtime»): lo reescribe en cada `next build` y `next dev`, no es una sugerencia.
- El mismo archivo añade `.next/dev/types/**/*.ts` al `include` (`dist/lib/typescript/type-paths.js`: Next 16 incluye `.next/types` y `.next/dev/types` «para que el tsconfig no cambie al pasar de dev a build»).
- Lo he comprobado ejecutando esa función de Next 16.4.6 sobre el `tsconfig.json` actual del repo: cambia `jsx` a `react-jsx`, añade `.next/dev/types/**/*.ts` y reformatea el JSON. Nada más.
- Documentación de Next: `next dev` y `next build` crean o ajustan el `tsconfig.json` con las opciones recomendadas: https://nextjs.org/docs/app/api-reference/config/typescript
- **Decisión:** dejar en el repo lo que escribe `next build`. Si se deja `preserve`, Next lo vuelve a cambiar en cada build y en cada `npm run dev`, y Jose verá siempre `tsconfig.json` modificado en `git status` (con el riesgo de subirlo a medias en otro commit). Guardarlo como lo quiere Next quita ese ruido para siempre. En Vercel no cambia nada: allí Next lo reescribe igual en cada build.

**4. Prueba de integración**
- `scripts/integracion/conversaciones.ts`, caso «La copia se restaura en una base vacía y queda igual»: `execSync(reset-db.sh --vacia)` y luego `setTimeout(1500)`. `reset-db.sh` hace `drop database … with (force)`, que corta la conexión de PostgREST; el `notify pgrst` del final se pierde porque PostgREST está desconectado. PostgREST se reconecta solo (con reintentos cada vez más espaciados) y recarga el esquema al volver.
- Mientras está desconectado, PostgREST responde con error 503 («Database client error. Retrying the connection.»), que es justo el error del fallo. Cuando vuelve a responder 200 a una consulta real, la conexión y el esquema están listos.
- El caso siguiente («Al quitar el modo paralelo IVAn sigue la numeración (00342)») parte de la base que deja el anterior. Claude Code cree que falla en cascada, pero no lo pudo confirmar.
- `scripts/integracion/arrancar.sh` tiene la misma fragilidad: `sleep 1 && curl …` al arrancar PostgREST.

## Alcance

**Sí**
- Las cuatro decisiones de arriba, con sus tests.

**No**
- Cambios en el cálculo fiscal (303 y 390 tienen sus propios planes).
- Cambiar cómo se lee una factura propia cuando el NIF sí coincide (eso ya funciona y se queda igual).
- Una migración 004: la corrección va en la 003.
- Tocar la lógica de `lib/copia.ts` (la revisión confirmó que está bien).

## Cambios, archivo por archivo

Rama `plan/ajustes-revision` desde `wip/v0`.

### 1. Facturas propias: preguntar cuando hay pistas

**`lib/externas.ts`**: nueva función pura, sin acceso a la base:

```ts
export type Pista = { tipo: "nombre" | "numero" | "cliente"; texto: string };
export function pistasDePropia(
  x: { proveedor: string | null; numero_factura: string | null; nif_destinatario: string | null },
  a: Pick<Ajustes, "nombre" | "nif" | "serie" | "digitos_numero" | "ultimo_numero">,
  clientes: Pick<Cliente, "nombre" | "nif">[],
): Pista[]
```

Devuelve una pista por cada una de estas que se cumpla:
- **nombre**: el emisor se llama como Jose. Normalizar los dos nombres (minúsculas, sin tildes, signos → espacio). Palabras de `ajustes.nombre` con 3 letras o más: coincide si al menos **2** aparecen en `proveedor` (o 1, si el nombre solo tiene una). Así «José Bautista» y «BAUTISTA GALLEGO, JOSE» coinciden y «Gallego Hermanos SL» no. Texto: «el emisor se llama como tú».
- **numero**: `normalizarNumero(numero_factura) === siguienteNumero(ajustes)`. Solo el siguiente, no cualquiera de la serie. Texto: «el número 00337 es el siguiente de tu serie».
- **cliente**: `nif_destinatario` (sin prefijo de país) es el NIF de uno de los clientes y **no** es el de Jose. Texto: «el cliente es Zapflow Oy, uno de los tuyos».

**`lib/bot.ts`** (`procesarArchivo`):
- Si `esPropia(…)`: como ahora, sin cambios.
- Si no: calcular `pistasDePropia` con los ajustes y los clientes. Crear el borrador de gasto igual que ahora (`registrarDesdeArchivo`, que guarda el archivo).
  - **Sin pistas**: como ahora (texto del gasto, botones ✅ Guardar / 🗑 Descartar).
  - **Con pistas**: en vez del borrador de gasto, mandar esta pregunta (sin `setMensaje`, para que responder a la pregunta no corrija el gasto):

    ```
    🤔 ¿Esta factura es tuya o es un gasto?
    El emisor que leo es «Persona de Prueba» (NIF ES00000008T), que no es tu NIF, pero:
    · el emisor se llama como tú
    · el número 00342 es el siguiente de tu serie
    · el cliente es Zapflow Oy, uno de los tuyos
    ```
    Si no hay NIF del emisor: «(sin NIF)». Botones: **«📥 Es mía (venta)»** → `p:venta:<idGasto>` y **«🧾 Es un gasto»** → `p:gasto:<idGasto>`.

- Nuevo `b.callbackQuery(/^p:(venta|gasto):(.+)$/)`:
  - Si el gasto no existe o ya no es `borrador`: «Ya estaba resuelta».
  - **gasto**: editar el mensaje de la pregunta con `textoGasto(g, duplicado)` y `tecladoGasto(g.id)`, y `setMensaje("gastos", g.id, <id de ese mensaje>)`. Desde ahí sigue el flujo normal de gastos.
  - **venta**: `descargarArchivo(g.archivo_path)`, deducir el tipo por la extensión (`pdf` → `application/pdf`, `jpg` → `image/jpeg`, `png`, `webp`) y llamar a `prepararExterna(…)`. Después, el gasto pasa a `descartado` (Jose ha dicho que no es un gasto), salga bien o no. Si `prepararExterna` devuelve una duda, editar el mensaje con `🤔 {duda}`. Si va bien, editar el mensaje con `textoExterna(…)` y `tecladoExterna(…)` y hacer `setMensaje("facturas", …)`: desde ahí sigue el flujo normal (✅ Registrar / 🗑 Descartar). Si `prepararExterna` lanza un error (red, Claude), el gasto **no** se descarta y se avisa para que Jose vuelva a pulsar.
- `answerCallbackQuery` en todos los casos.

### 2. Orden de bloqueo en la 003

**`supabase/migrations/003_paralelo.sql`**, `emitir_factura()`: bloquear **primero `ajustes`, después `facturas`**, como `registrar_factura_externa()`:
- La primera consulta pasa a ser `select emitir_desde into v_desde from ajustes where id = 1 for update;` (bloquea y lee el modo paralelo a la vez).
- Después, el `select … from facturas … for update`, las comprobaciones y los dos `update`, sin más cambios.
- Comentario de una línea encima: el orden (ajustes → facturas) tiene que ser el mismo en todas las funciones que tocan las dos tablas, para que dos llamadas a la vez esperen en vez de bloquearse.
- `registrar_factura_externa()` no cambia.
- Los mensajes de error y el resultado de la función siguen exactamente iguales.

### 3. `tsconfig.json`

- Ejecutar `npx next build` y **guardar el `tsconfig.json` tal cual lo deja Next**, sin retocarlo a mano (debería quedar `jsx: "react-jsx"`, `.next/dev/types/**/*.ts` en `include` y el JSON con un elemento por línea).
- Si Next cambia algo más que eso, parar y apuntarlo en las notas.

### 4. Prueba de integración: espera activa

**`scripts/integracion/conversaciones.ts`**:
- Nueva ayuda `esperarPostgrest(maxMs = 60_000)`: repite `db().from("ajustes").select("id").limit(1)` cada 500 ms hasta que no devuelva error. Si pasan 60 s, lanza un error claro: «PostgREST no ha vuelto en 60 s: mira $TMPDIR/postgrest.log». Que imprima cuánto ha esperado (para ver en el Mac de Jose si son esos 15-20 s).
- En «La copia se restaura…», cambiar el `setTimeout(1500)` por `await esperarPostgrest()`.

**`scripts/integracion/arrancar.sh`**: cambiar `sleep 1 && curl …` por un bucle de hasta 30 s que pruebe `curl -sf http://localhost:3001/` cada 0,5 s. Si no responde, mostrar el aviso y salir con error.

**`docs/PUESTA_EN_MARCHA.md`** («Pruebas en local»): una línea que diga que la restauración puede tardar unos 20 s porque espera a que PostgREST se reconecte.

### Tests nuevos

**`tests/externas.test.ts`**: un `it("detecta pistas de factura propia")` con estos casos:
- «José Bautista» y «BAUTISTA GALLEGO, JOSE» con nombre «Jose Bautista Gallego» → pista `nombre`; «Gallego Hermanos SL» → nada.
- `numero_factura` «337» y «00337» con `ultimo_numero` 336 → `numero`; «00338» y «97A706DA-1920528» → nada.
- `nif_destinatario` «FI 26899624» con Zapflow de cliente → `cliente`; `nif_destinatario` = el NIF de Jose → nada.
- Un gasto normal (Framer B.V., NIF NL…, destinatario Jose, número raro) → `[]`.
- Los tres a la vez → tres pistas.

**`scripts/integracion/conversaciones.ts`**: dos conversaciones nuevas, después de «Cliente desconocido: pide darlo de alta» (ahí `ultimo_numero` es 341). No deben registrar nada, para no mover la numeración que esperan los casos siguientes:
- **«NIF mal leído: pregunta y, con "Es mía", la prepara como venta»**: PDF leído con `nif_proveedor: "ES00000008T"`, `proveedor: "Persona de Prueba"`, `numero_factura: "00342"` y `nif_destinatario: "FI26899624"` → mensaje «¿Esta factura es tuya o es un gasto?» con las tres pistas y los botones `p:venta:` y `p:gasto:`; ningún gasto confirmado ni factura creada. Pulsar `p:venta` (con la respuesta simulada de `registrar_factura_emitida`, número 00342) → «📥 Factura tuya hecha fuera de IVAn · 00342» con `x:ok`, y el gasto en `descartado`. Pulsar `x:no` para dejarlo como estaba. `ultimo_numero` sigue en 341.
- **«NIF mal leído: con "Es un gasto" sigue como gasto»**: el mismo PDF → pulsar `p:gasto` → el mensaje pasa a borrador de gasto con `g:ok`, y responder a ese mensaje lo corrige (flujo normal). Pulsar `g:no` para descartarlo.
- Comprobar que ninguno de los gastos que ya se prueban dispara la pregunta: si alguno lo hace, parar y apuntarlo (sería una pista demasiado amplia).

## Cómo sabremos que está bien

En el Mac de Jose:
- `npm test`: todos en verde, con **un test más** que ahora (27 → 28, o los que haya +1 si antes se ha ejecutado otro plan).
- `npm run typecheck`: sin errores con el `tsconfig.json` nuevo.
- `npx next build`: correcto, y **después `git status` no muestra `tsconfig.json` modificado**. Repetir con `npm run dev` (arrancar y parar): tampoco lo cambia.
- Prueba de integración (`reset-db.sh` → `arrancar.sh` → `conversaciones.ts`): **49 de 49** (las 47 de antes y las 2 nuevas), en dos pasadas seguidas. Apuntar cuánto esperó `esperarPostgrest`.
- «Dos ✅ a la vez emiten una sola factura» y todas las de numeración (00337 a 00342) siguen pasando con el nuevo orden de bloqueo.
- La 003 se aplica sobre una base con la 001 (como hace `reset-db.sh`) sin errores.

## Riesgos y dudas

- **La pista del número puede saltar con un gasto de verdad** si un proveedor numera igual que Jose (p. ej. su factura 00337). No pasa nada: IVAn pregunta y Jose pulsa «🧾 Es un gasto». Es lo decidido: mejor una pregunta de más que una venta en gastos.
- **Si no hay ninguna pista** (NIF mal leído, nombre ilegible, número raro y sin NIF de cliente), la factura sigue entrando como borrador de gasto. Pero no en silencio: Jose ve el borrador y tiene que pulsar ✅ Guardar. Lo cubre también la comparación con Selfconta en noviembre y diciembre.
- **«Es mía» llama dos veces a Claude** (lectura como gasto y lectura como factura emitida). Son céntimos y solo pasa cuando hay duda.
- **El archivo del gasto descartado se queda en Storage** (`gastos/…`). Ocupa poco y sirve de rastro; `prepararExterna` guarda su propia copia en `facturas/…/externas/`.
- **Si la conversación «00342» sigue fallando** con la espera activa, no es un fallo en cascada: parar y apuntarlo en las notas, sin tocar la app.
- **Si Jose aplica la 003 en Supabase antes de que se ejecute este plan**: volver a aplicarla después (todo es `create or replace`). Mejor ejecutar el plan antes del 24/11.

## Notas de ejecución

Ejecutado por Claude Code el 17/11/2026, en rama `plan/ajustes-revision` desde `wip/v0`. Los cuatro bloques, en el orden pedido:

**2. Orden de bloqueo en la 003.** `emitir_factura()` ahora bloquea `ajustes` primero (`select ... for update` en vez de `select` sin bloqueo), igual que `registrar_factura_externa()`, con un comentario explicando el orden. Sin más cambios: mensajes de error y resultado iguales. La 003 se aplicó sin errores sobre una base con la 001 (`reset-db.sh`).

**4. Espera activa en la integración.** Añadida `esperarPostgrest(db, maxMs = 60_000)` en `scripts/integracion/conversaciones.ts` (consulta `ajustes` cada 500 ms, imprime cuánto tardó, lanza error claro a los 60 s), usada en «La copia se restaura en una base vacía». `arrancar.sh` cambia `sleep 1 && curl` por un bucle de hasta 30 s. Añadida la línea en `docs/PUESTA_EN_MARCHA.md`. En esta máquina (Postgres de pruebas efímero, no el de Jose) PostgREST tardó **~1.0-1.05 s** en volver (1028 ms y 1045 ms en las dos pasadas), muy por debajo de los 15-20 s que ve Jose; la espera activa cubre ambos casos igual.

**3. `tsconfig.json`.** Ejecutado `npx next build`: cambió exactamente lo previsto (`jsx: "react-jsx"`, añade `.next/dev/types/**/*.ts` a `include`, reformatea a un elemento por línea) y nada más. Comprobado con el hash del archivo que ni un segundo `next build` ni un `npm run dev` (arrancado y parado) lo vuelven a tocar. Guardado tal cual lo deja Next.

**1. Pregunta con dos botones.** `lib/externas.ts`: nueva `pistasDePropia(x, ajustes, clientes)` (pura, sin acceso a la base), con las tres pistas del plan (nombre con comparación normalizada ≥2 palabras de 3+ letras, o 1 si el nombre solo tiene una; número = siguiente de la serie; cliente por NIF del destinatario, descartando el propio). `lib/bot.ts`: en `procesarArchivo`, cuando `esPropia` es falso se calculan las pistas; sin pistas sigue el flujo de gasto de siempre, con pistas se manda la pregunta (`textoPregunta`/`tecladoPregunta`, sin `setMensaje`) con los botones `p:venta:<id>` y `p:gasto:<id>`. Nuevo `b.callbackQuery(/^p:(venta|gasto):(.+)$/)`: `gasto` edita a borrador de gasto normal (con `setMensaje` ahí sí, para que responder lo corrija); `venta` descarga el archivo guardado, deduce el tipo por la extensión y llama a `prepararExterna`; el gasto pasa a `descartado` solo si `prepararExterna` responde (ok o duda), nunca si lanza una excepción (ahí se avisa de reintentar y el gasto queda como estaba).

**Tests.** `tests/externas.test.ts`: `it("detecta pistas de factura propia")` con los casos del plan (28 tests en total, 27 → 28). `scripts/integracion/conversaciones.ts`: las dos conversaciones nuevas después de «Cliente desconocido: pide darlo de alta» («NIF mal leído: pregunta y, con "Es mía", la prepara como venta» y «...con "Es un gasto" sigue como gasto»), con el PDF de NIF `ES00000008T`, número `00342` y cliente `FI26899624`. Ningún otro gasto de la prueba disparó la pregunta.

**Cómo quedaron los tests (en esta máquina, con un Postgres de pruebas efímero levantado para la ocasión y parado al terminar):**
- `npm test`: 28/28.
- `npm run typecheck`: sin errores.
- `npx next build`: correcto; `git status` no mostró `tsconfig.json` modificado más allá del cambio ya hecho, ni tras un segundo build ni tras `npm run dev` (arrancado y parado).
- Integración (`reset-db.sh` → `arrancar.sh` → `conversaciones.ts`): **49/49 en dos pasadas seguidas**. La conversación «00342» (Al quitar el modo paralelo IVAn sigue la numeración) pasó las dos veces, sin fallo en cascada.
- «Dos ✅ a la vez emiten una sola factura» y toda la numeración 00337-00342 siguen pasando con el nuevo orden de bloqueo.

**Fuera del plan, aprobado por Jose:** `next build`/`next dev` creaban un `AGENTS.md` en la raíz (guía de Next 16 para agentes) que no estaba antes y rompía el «`git status` limpio» de este mismo plan. Añadido `agentRules: false` en `next.config.ts` (opción de Next 16 que evita que se cree, y quita su bloque si ya existiera). Comprobado: tras `npx next build` y tras arrancar y parar `npm run dev`, ya no aparece `AGENTS.md` y `git status` queda limpio sin tocar nada a mano; `npm run typecheck` y `npx next build` siguen bien. Va en un commit separado de los cuatro bloques del plan.

Nada de lo anterior no encajó con el código ni hubo que parar: las cuatro decisiones del plan se aplicaron tal cual estaban escritas.

Revisión de Claude: answerCallbackQuery al principio de p:venta.
