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

(Claude Code)
