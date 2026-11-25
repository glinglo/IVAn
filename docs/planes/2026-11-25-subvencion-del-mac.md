# Subvención del Mac (Kit Digital «Puesto de trabajo seguro»)

**Estado:** Aprobado · **Fecha:** 25/11/2026 · **Prioridad:** antes del cierre del 4T (enero de 2027)

## Por qué

Jose compró el Mac a ECOMPUTER S.L. (factura 45615452, 20/08/2025, 2.399,00 € de base y 503,79 € de IVA) con el bono de **1.000 €** del Kit Digital, categoría «Puesto de trabajo seguro». Es una **subvención de capital** porque financia un bien amortizable.

**Cómo tributa en el IRPF:** la subvención de capital no se imputa de golpe. Se imputa como ingreso de la actividad en la misma proporción en que se amortiza el bien: art. 14.1.b LIRPF, que remite a las reglas del Impuesto sobre Sociedades y a la norma de valoración 18.ª del PGC. Fuentes:
- Consejo General de Gestores Administrativos, «Tributación del Kit Digital en el IRPF»: https://www.consejogestores.org/?p=11962
- Consejo General de Gestores Administrativos, «Autónomos: Tributación del Kit Digital»: https://www.consejogestores.org/?p=10087

El bono de servicios de L3G (2.000 €, 2025) es otra cosa: es una subvención corriente, ya imputada entera en 2025, y no afecta a 2026.

**La fórmula, cada año:** ingreso = amortización del año × subvención / base.

**Los números:**
- **2026:** 623,74 € de amortización (26 % de 2.399,00) × 1.000 / 2.399,00 = **260,00 €** de ingreso.
- **2025** (ya presentado): la gestoría amortizó 227,13 € e imputó **227,12 €** (casilla 0174), como si la subvención cubriera el Mac entero. Lo correcto eran 94,68 €. Hay 132,44 € de ingreso de más, unos 40 € de IRPF. Es poco para pedir la rectificación solo por eso; se comenta a la gestoría. IVAn no toca 2025.

**Hoy IVAn resta la amortización pero no suma la subvención.** Su rendimiento de 2026 sale unos 247 € más bajo de lo que dirá la Renta (260 € de ingreso menos el 5 % de difícil justificación), y «Te queda» sale algo inflado. Además, la base del Mac en IVAn es 2.399,08 €, cuando la factura dice 2.399,00 €.

## Qué cambia

### Datos

- **Migración `009_subvencion_bienes.sql`:**
  ```sql
  alter table bienes_inversion add column if not exists subvencion numeric(12,2) not null default 0;
  comment on column bienes_inversion.subvencion is 'Subvención de capital que financió el bien. Se imputa como ingreso en proporción a la amortización.';
  ```
- **SQL para Jose** (lo ejecuta él en Supabase, no va en el repo con datos):
  ```sql
  update bienes_inversion set base = 2399.00, subvencion = 1000, descripcion = 'MacBook (ECOMPUTER 45615452, Kit Digital puesto de trabajo seguro)'
  where descripcion ilike 'MacBook%';
  select descripcion, fecha_compra, base, pct_anual, subvencion from bienes_inversion;
  ```
  El `select` tiene que devolver una fila con base 2399.00 y subvención 1000.00.
- **`lib/libro.ts`:** el `select` de `bienes_inversion` pide también `subvencion`. Si falta la columna, porque no se ha aplicado la migración, vale 0 y no rompe nada, con el mismo patrón que `casillas` en la fase D.

### Cálculo (`lib/calculo.ts`, con tests)

- `BienCalc` gana `subvencion?: number` (0 si no viene).
- Función nueva `subvencionesDelAnio(bienes, hasta)`: para cada bien, la amortización del año hasta `hasta` × `subvencion / base`, redondeada a céntimos. Sigue el mismo reparto por meses que `amortizacionDelAnio`, así que se acaba de imputar justo cuando el bien termina de amortizarse.
- **`PyG`** gana `subvenciones`:
  - `ingresos` sigue siendo solo lo facturado, porque lo usan Ventas y otras pantallas;
  - `diferencia` = ingresos + subvenciones − gastos − seguridad social − amortizaciones;
  - `rendimientoNeto` incluye la subvención.
- **Modelo 130:** `c01` = ingresos + subvenciones (la casilla 01 son todos los ingresos computables de la actividad).
- **Tests nuevos:**
  - el Mac de 2026 (base 2.399,00, 26 %, subvención 1.000, compra 20/08/2025): `subvencionesDelAnio` a 31/12/2026 = 260,00 € y a 31/03/2026 = 65,00 €;
  - un bien sin subvención da 0;
  - `pyg` y `modelo130` del 4T con la subvención dentro de `c01` y del rendimiento.
- **Los tests de `tests/calculo.test.ts` no cambian:** el bien de prueba no lleva subvención, así que siguen reproduciendo la hoja y el P&L de la gestoría al céntimo. Si alguno cambia, parar y apuntarlo.

### Dónde se ve

- **Cascada de Inicio** (`lib/inicio.ts`): fila nueva en positivo, después de los ingresos: «Subvención del Mac (Kit Digital)», solo si es mayor que 0. Etiqueta corta: «Subvención».
- **Pantalla del 130** (`/impuestos/[anio]/[t]?m=130`): la [01] ya sale de `c01`. Debajo de la rejilla, una línea gris: «Incluye X € de la subvención del Mac (Kit Digital), que se imputa a medida que se amortiza».
- **Bot:** en el resumen del 130 que da el agente, el mismo dato si es mayor que 0.
- **Exportación a Excel (`/exportar`)**, hoja del P&L: fila «Subvenciones de capital».
- **Ajustes** (`/ajustes`): en la lista de bienes, debajo de la amortización del año, «Subvención 1.000 € · se imputan X € este año». La consulta de `bienes_inversion` de esa página pide también `subvencion` y no debe romperse si falta la columna.
- **«Cómo se calcula»** (fase E.2 del rediseño): si ya existe, se le añade la fila de la subvención.

## Comprueba

- `npm test` (con los tests nuevos), `npm run typecheck`, `next build`, y la integración de las 56 conversaciones en el Mac de Jose.
- Con los datos reales, después de la migración y el `update`:
  - en Inicio, con «Año 2026», la cascada enseña «Subvención del Mac» con 21,67 € por mes transcurrido (en noviembre, 11 × 21,67 ≈ 238 €);
  - el rendimiento neto sube en la subvención × 0,95;
  - `/impuestos/2026/4?m=130` lleva la subvención del año entero (260,00 €) en la [01] y la nota debajo.
- El 130 del 4T sigue saliendo a 0: lo ya pagado (4.433,46 € + 153 € de retenciones) cubre de sobra el 20 %.

## Fuera de este plan

- Rectificar la Renta 2025 por los 132,44 € de más: no compensa. Se menciona en el correo a la gestoría.
- La pequeña diferencia de amortización de 2025 (la gestoría, por días: 227,13 €; IVAn, por meses: 259,90 €) solo afecta al último año (2029). Se revisa entonces.

## Notas de ejecución

(Claude Code, 25/11/2026, rama `plan/subvencion-mac-codigo`)

- **Migración `009_subvencion_bienes.sql`** (`bienes_inversion.subvencion`, por defecto 0). El SQL de relleno (`update bienes_inversion set base = 2399.00, subvencion = 1000, descripcion = …`) no va en el repo, tal como pide el plan: queda tal cual en este documento para que Jose lo ejecute en el SQL Editor de Supabase.
- **`lib/calculo.ts`:** `BienCalc` gana `subvencion?` (0 si no viene). `subvencionesDelAnio(bienes, hasta)` nueva, con el mismo reparto por meses que `amortizacionDelAnio` (misma función de amortización acumulada por debajo, escalada por `subvencion / base`). `PyG` gana `subvenciones`; `ingresos` sigue siendo solo lo facturado; `diferencia` y `rendimientoNeto` suman la subvención. `modelo130.c01` = `ingresos + subvenciones`. **Tests nuevos** con el Mac real (base 2.399,00, 26 %, subvención 1.000, compra 20/08/2025): `subvencionesDelAnio` da 260,00 € a 31/12/2026 y 65,00 € a 31/03/2026 (exactos a los del plan); un bien sin subvención da 0; `pyg`/`modelo130` del 4T con la subvención dentro de `c01` y del rendimiento. **Los tests existentes de `tests/calculo.test.ts` no han cambiado** (el bien de la hoja de pruebas no lleva subvención): sigue reproduciendo la hoja y el P&L de la gestoría al céntimo, tal como exigía el plan.
- **`lib/libro.ts`:** el `select` de `bienes_inversion` en `cargarLibro` (la consulta compartida de todas las páginas) pide también `subvencion`; si falla porque la migración 009 no está aplicada, repite la consulta sin esa columna en vez de lanzar, con el mismo patrón que `casillas` en la fase D del rediseño — para que no tumbe `/`, `/ventas`, `/gastos` ni `/impuestos` por una columna que de momento solo usa un bien.
- **Dónde se ve:**
  - **Inicio:** la `Cascada` (`Waterfall` de Vela) **no tiene una variante «suma» entre pasos** (solo `total`/`minus`/`result`: `total` reinicia el acumulado desde 0, no hay forma de insertar una fila que sume sin romper visualmente la cascada). Así que, en vez de una fila dentro de la cascada como pedía el plan, la subvención sale como una línea de texto justo debajo: «Incluye X € de la subvención del Mac (Kit Digital), ya en el rendimiento neto», solo si es mayor que 0. El número en sí (y el rendimiento neto que ya la incluye) es correcto; lo que cambia es solo cómo se ve. Apuntado aquí por si hace falta pedir a Vela un `WaterfallKind` nuevo para esto.
  - **`/impuestos/[anio]/[t]?m=130`:** línea gris bajo la rejilla de casillas con el texto del plan, si `m130.pyg.subvenciones > 0`.
  - **Bot:** `resumen` del agente (`lib/agente.ts`) añade `subvencion_mac` al objeto `m130` solo si es mayor que 0 (la propia `pyg_acumulado` que ya mandaba también lleva `subvenciones` ahora, de regalo).
  - **`/exportar`:** fila «Subvenciones de capital» en la hoja P&L, justo después de «Ingresos».
  - **`/ajustes`:** el `select` de `bienes_inversion` pide `subvencion` con el mismo patrón de reintento que `cargarLibro`; bajo la amortización del año, una segunda línea «Subvención X € · se imputan Y € este año» si la hay.
  - **«Cómo se calcula»:** no existe todavía (es la fase E.2 del rediseño, no hecha); no hay nada que tocar ahí.
- **Comprobado sin la migración 009 aplicada** (`next start` + `curl` a `/`, `/ventas`, `/gastos`, `/impuestos`, `/ajustes` e `/impuestos/2026/4?m=130`): las seis dan `200`, sin ninguna de las líneas de subvención (se degradan a 0, como debía ser).
- **`npm test`** (155, con los 3 tests nuevos de `subvencionesDelAnio`/`pyg`/`modelo130`), **`npm run typecheck`** y **`npm run build`** sin errores. **Prueba de integración de las 56 conversaciones**: todas pasan (en la base local, con la migración 009 ya aplicada por `reset-db.sh`).
- **No comprobado con los datos reales ya migrados**: esta sesión no puede aplicar la migración 009 en el Supabase de producción ni ejecutar el `update` del Mac (ese paso es de Jose). Los números están verificados con los tests unitarios, que reproducen exactamente los de la «Comprueba» del plan (260,00 € / 65,00 €); falta que Jose aplique la migración y el `update`, y confirme en el panel real que «Incluye 260 € de la subvención del Mac…» sale en Inicio y en el 130 del 4T, y que el 130 del 4T sigue a 0.
