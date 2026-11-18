# IVA de los gastos: el tipo que pone la factura y si se puede deducir

Estado: Aprobado (Jose, 18/11/2026)
18/11/2026 · Plan de Claude (proyecto IVAn)
Depende de: [Modelo 390](2026-11-17-modelo-390.md) (PR #5, fusionado). Sustituye su `tipoSoportado()`.

## Por qué

Jose quiere que, cuando mande un gasto, IVAn entienda bien el tipo de IVA. Hoy no lo hace:

1. **Un gasto guarda un solo `base` y un solo `iva`.** Lo que no cabe ahí:
   - un ticket con varios tipos (un restaurante: comida al 10 % y bebida al 21 %);
   - el tipo que pone la factura: el 390 lo adivina con `iva / base` y se bloquea si no da justo 4, 10 o 21. Con importes de céntimos el redondeo engaña: 0,41 € + 0,09 € da un 22 %.
2. **El IVA extranjero se deduce.** `clasificarGasto()` marca como «IVA soportado» todo gasto con `iva > 0`. El prompt de lectura dice «si cobra VAT de otro país, ponlo en iva». Así, una factura de Paddle con IVA cobrado acabaría en la casilla 29 del 303. La gestoría la trató como gasto sin IVA deducible, y el esquema SQL también lo prevé así, pero el código nunca asigna «Sin IVA deducible».
3. **El IVA de un ticket sin el NIF de Jose se deduce.** El borrador avisa («No veo tu NIF»), pero el IVA va igual a la casilla 29.

## Lo que se sabe (fuentes)

- **Tipos de IVA en 2026:** 21 % general, 10 % y 4 % reducidos (art. 90 y 91 de la Ley 37/1992). Hay además un 0 % para casos concretos.
- **El tipo cambia por fecha, no solo por producto.** El RDL 7/2026 bajó del 21 % al 10 % la luz (menos de 10 kW), el gas natural, los pellets y la leña del 22/03 al 30/06/2026. El RDL 18/2026 lo alargó al 30/09. El RDL 25/2026 lo repite en noviembre y diciembre de 2026, pero solo si el IPC de esos productos sube más del 15 %. **Por eso IVAn tiene que leer el tipo de la factura y no deducirlo del producto.**
- **Para deducir el IVA hace falta factura** (art. 97 LIVA). Una factura simplificada (ticket) solo vale si lleva el NIF y el domicilio de Jose y la cuota de IVA aparte (art. 7.2 del RD 1619/2012).
- **IVA extranjero:** el IVA de otro país, o el que cobra una plataforma por la ventanilla única (OSS, números `EU…`), no se recupera en el 303. Va como más gasto, igual que hizo la gestoría con Paddle.
- **Restaurantes en el IVA:** las atenciones a clientes no dan derecho a deducir el IVA (art. 96.Uno.5º LIVA). La hostelería y los viajes solo se deducen si el gasto es deducible en el IRPF (art. 96.Uno.6º).
- **Comer trabajando fuera (manutención propia), en el IRPF** (art. 30.2.5ª.c LIRPF y art. 9 RIRPF):
  - tiene que ser en un restaurante o bar, en el desarrollo de la actividad, y pagado con tarjeta, Bizum o transferencia (en efectivo no vale);
  - límites diarios: 26,67 € en España y 48,08 € en el extranjero; con pernocta, 53,34 € y 91,35 €;
  - la AEAT pide además que sea en un municipio distinto al de residencia y trabajo habitual. Jose vive y trabaja en El Masnou.
- **Invitar a un cliente, en el IRPF:** es una atención a clientes. Es deducible si guarda relación con los ingresos y está justificada, con un límite del 1 % de la cifra de negocios del año (DGT V2525-25, de 17/12/2025; art. 15.e LIS).

Fuentes:
- Tipos (AEAT, vía administracion.gob.es): https://administracion.gob.es/pag_Home/Tu-espacio-europeo/derechos-obligaciones/empresas/impuestos/IVA/tipos-exenciones.html
- RDL 7/2026, 18/2026 y 25/2026 (nota de Cuatrecasas): https://www.cuatrecasas.com/resources/rdl-25-2026-text-6abe416dc1903647981407.pdf
- Ley 37/1992, art. 96 y 97: https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740
- RD 1619/2012, art. 7: https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696
- Manutención del autónomo: https://www.conversoriaecnae.es/gastos-deducibles/dietas-y-manutencion
- Comidas con clientes, DGT V2525-25: https://www.supercontable.com/informacion/impuesto_renta_IRPF/Consulta_vinculante_V2525-25_DGT.Justificacion_y_.html

**Antes de ejecutar:** comprobar en el BOE si el 10 % de la luz y el gas se aplica en noviembre y diciembre de 2026. Solo afecta a los tests de ejemplo, porque IVAn copia el tipo de la factura.

## Alcance

**Sí**
1. **Desglose por tipo en cada gasto.** Se guarda una lista de líneas `{ pct, base, cuota }` en euros. `base` e `iva` siguen siendo los totales, así que el 303, el 130, el P&L y el Excel no cambian.
2. **Lectura:** Claude copia el cuadro de impuestos de la factura, una línea por tipo, **con el % impreso**, y dice si el IVA es español.
3. **Comprobación en código** (no en Claude):
   - los tipos españoles válidos son 0, 4, 10 y 21 %;
   - `base × pct ≈ cuota`, con 2 céntimos de margen por línea;
   - las líneas suman la base y el IVA;
   - base + IVA ≈ total.

   Si algo no cuadra, el borrador lo dice con ⚠️ y Jose corrige respondiendo. IVAn nunca guarda en silencio un tipo que no cuadra.
4. **Si el IVA es deducible** (IVAn lo propone en el borrador y Jose lo puede cambiar respondiendo):
   - IVA no español → «Sin IVA deducible»: la cuota se suma a la base e `iva = 0`, como el Paddle del fixture.
   - IVA español sin el NIF de Jose en el documento → «Sin IVA deducible», con el aviso «pide la factura con tu NIF y reenvíamela: sustituyo este gasto». (Decidido por Jose el 18/11: siempre pedirá factura con su NIF; si solo hay ticket, se apunta sin deducir el IVA.)
5. **Restaurantes: IVAn pregunta con tres botones** (decidido por Jose el 18/11). Nunca lo decide solo.
   - **🧑‍💻 Comí trabajando fuera** (`uso = 'manutencion'`):
     - cuenta en el IRPF hasta 26,67 €/día, sumando todas las comidas de ese día;
     - si es en el extranjero o con pernocta, se corrige respondiendo («dormí fuera», «fue en Lisboa») y el límite pasa a 48,08 €, 53,34 € o 91,35 €;
     - si el total con IVA pasa del límite, cuenta hasta el límite y el IVA se deduce en la misma proporción. El resto no cuenta en el IRPF y su IVA no se deduce;
     - el borrador recuerda que tiene que estar pagado con tarjeta y ser fuera de El Masnou.
   - **🤝 Invité a un cliente** (`uso = 'atencion_cliente'`):
     - el IVA no se deduce (va como más gasto) y el gasto cuenta en el IRPF;
     - el límite es el 1 % de la base facturada en el año hasta esa fecha. Lo que pase de ahí no cuenta en el 130;
     - el borrador dice cuánto queda del 1 %.
   - **🏠 Era personal:** se descarta.

   Claude marca en la lectura si el gasto es de restaurante u hostelería (`categoria: "restauracion"`). Si se equivoca, se corrige respondiendo.
6. **Borrador de Telegram:** una línea por tipo («IVA 10 % sobre 40,00 € = 4,00 €») y la conclusión («deducible» o «no deducible: motivo»).
7. **390:** suma el desglose por tipo (190/191, 603/604, 605/606). Los gastos antiguos sin desglose usan el cálculo de ahora.
8. **303, casilla 28:** suma solo las bases de las líneas con IVA (las del 0 % no entran). Con los datos de 2026 no cambia nada.
9. **130 y P&L:** aplican los límites de manutención y del 1 % de atenciones a clientes. Con los datos de 2026 no cambia nada (no hay restaurantes).

**No**
- Prorrata, vehículos al 50 %, recargo de equivalencia, régimen especial de viajeros.
- Que IVAn decida solo para qué fue una comida.
- Comprobar con el banco que se pagó con tarjeta: lo confirma Jose.
- Recalcular los gastos de 1T-3T de 2026: los presentó la gestoría.

## Cambios, archivo por archivo

- `supabase/migrations/004_desglose_iva.sql`: columnas en `gastos`:
  - `desglose jsonb not null default '[]'`;
  - `uso text check (uso in ('manutencion', 'atencion_cliente'))`, null para el resto;
  - `manutencion_limite numeric(6,2)`: 26,67, 48,08, 53,34 o 91,35. Relleno de los gastos «IVA soportado» que ya existen: una línea con `pct = round(iva / base × 100)` si da 4, 10 o 21; si no, se deja vacía y se lista en la salida de la migración.
- `lib/fiscal.ts`:
  - `TIPOS_IVA_ES = [0, 4, 10, 21]`, con la fuente en un comentario.
  - `validarDesglose(lineas, base, iva, total)`: devuelve la lista de avisos.
  - `clasificarGasto(pais, iva, { ivaEspanol, aMiNombre })`: con las reglas del punto 4.
- `lib/claude.ts`: esquema y prompt de `extraerGasto` y `corregirGasto`.
  - `desglose_iva: [{ tipo_pct, base, cuota }]`: «copia el cuadro de impuestos del documento; el % tal cual está impreso, no lo deduzcas del producto; si solo pone total con IVA incluido y el %, deja base y cuota en null».
  - `iva_espanol: boolean`: «true si el IVA es español: el emisor factura con NIF español o ES…; false si es VAT de otro país o un número OSS EU…».
- `lib/gastos.ts`, `aFila()`:
  - pasa el desglose a euros línea a línea y ajusta el céntimo de redondeo en la línea mayor para que sume el total;
  - aplica `validarDesglose` y `clasificarGasto`;
  - si es «Sin IVA deducible», suma la cuota a la base y deja `iva = 0`.
- `lib/db.ts`, `lib/libro.ts` y `GastoCalc` en `lib/calculo.ts`: añadir `desglose`.
- `lib/calculo.ts`:
  - el 390 reparte por el desglose; `tipoSoportado()` queda solo para gastos sin desglose;
  - la casilla 28 del 303 suma las bases de las líneas con `pct > 0`;
  - `limitesRestauracion(datos, hasta)`, una función pura:
    - manutención: suma por día, recorta al límite y reparte el IVA deducible en proporción;
    - atenciones a clientes: suma lo acumulado del año contra el 1 % de la base facturada hasta esa fecha.

    El 303 (IVA deducible), el 130 y el P&L usan su resultado.
- `lib/claude.ts`: `categoria: "restauracion" | "otro"` en la lectura. La corrección por respuesta entiende «dormí fuera», «fue en el extranjero» y «era con un cliente».
- `lib/bot.ts`:
  - `textoGasto()`: las líneas por tipo, la conclusión sobre la deducción y los avisos;
  - teclado de restaurante (`g:uso:manutencion|cliente|personal:<id>`). «Personal» descarta el gasto; ✅ Guardar no aparece hasta elegir.
- `app/(panel)/gastos/page.tsx`: el % al lado del IVA (o «10 % + 21 %»).

## Cómo sabremos que está bien

**Nada cambia con los datos de 2026:**
- `tests/calculo.test.ts` sigue igual;
- 303 [71]: −2,42 / −0,42 / 207,46 / 0 €;
- 130: 1.216,02 / 1.272,90 / 1.141,50 / 277,03 €;
- 390: 86 = 207,46 € y 108 = 29.460 €.

**Tests nuevos (`tests/iva-gastos.test.ts`):**

| Caso | Entrada (lo que lee Claude) | Resultado |
|---|---|---|
| Restaurante mixto, «🤝 cliente» | 40,00 € al 10 % (4,00 €) + 10,00 € al 21 % (2,10 €), con NIF de Jose | base 56,10 € (el IVA pasa a gasto) · iva 0 € · nada en el 303 ni en el 390 · cuenta en el 130 (cabe en el 1 %) |
| Restaurante mixto, «🧑‍💻 trabajando fuera» | el mismo ticket, 56,10 € con IVA, límite 26,67 € | cuenta el 47,54 % (26,67 / 56,10): IVA deducible 2,90 € · gasto en el 130 23,77 € · 390: 603/604 = 19,02 / 1,90 € y 605/606 = 4,75 / 1,00 € |
| Dos comidas el mismo día | 20,00 € + 15,00 € con IVA, «trabajando fuera» | entre las dos, 26,67 € como máximo |
| 1 % de atenciones | ventas del año 29.460 € (1 % = 294,60 €) y comidas con clientes por 300 € | cuentan 294,60 €; el borrador avisa de que se ha pasado el límite |
| Personal | «🏠 Era personal» | el gasto queda descartado |
| Céntimos | 0,41 € al 21 % (0,09 €) | se acepta el 21 % (0,41 × 0,21 = 0,086) · el 390 no se bloquea |
| ionos | 1,00 € al 21 % (0,21 €) | igual que ahora |
| Cuota que no cuadra | 100,00 € al 21 % con cuota de 10,00 € | ⚠️ en el borrador; no se guarda sin que Jose lo confirme o corrija |
| Tipo que no existe | una línea al 5 % | ⚠️ «el 5 % no es un tipo de IVA español» |
| Luz en noviembre | 60,00 € al 10 % (6,00 €), factura española con NIF de Jose | se acepta el 10 % que pone la factura · 603/604 |
| Paddle con IVA | 12,18 € + 2,56 € (21 %), número OSS `EU372017215`, país GB | «Sin IVA deducible» · base 14,74 € · iva 0 € · no entra en el 303 |
| Ticket sin NIF | 20,00 € al 21 % (4,20 €), sin NIF de destinatario | «Sin IVA deducible» · base 24,20 € · aviso de pedir factura |
| Gasto en USD con IVA español | dos líneas en USD | cada línea se pasa a euros al cambio del BCE y suman el total exacto |

**Integración** (`scripts/integracion/conversaciones.ts`):
- foto del ticket del restaurante → el borrador enseña las dos líneas y los tres botones, sin ✅ Guardar;
- se pulsa «🤝 Invité a un cliente» → aparece ✅ Guardar y el borrador dice cuánto queda del 1 %;
- se responde «la bebida también es al 10 %» → el desglose se corrige y se vuelve a validar;
- un PDF de Paddle con IVA → el borrador dice «no deducible: IVA de otro país».

Todos los casos que ya existían siguen pasando (50/50).

## Riesgos y dudas

- **Manutención por encima del límite:** repartir el IVA deducible en proporción es el criterio más prudente que encaja con el art. 96.Uno.6º («salvo que el importe tuviera la consideración de gasto deducible»). No hay una casilla que lo diga, así que hay que revisarlo si la Sede o una consulta dicen otra cosa.
- **El 1 % de atenciones a clientes** es anual. Durante el año IVAn lo mide con lo facturado hasta la fecha, así que un gasto que en marzo no cabe puede caber en diciembre. Al cerrar el año se recalcula para la Renta; en el 130 manda lo que había en cada trimestre.
- **Municipio distinto:** IVAn no sabe dónde comió Jose. El botón lo recuerda y Jose decide.
- Los tickets de supermercado con muchos productos pueden descuadrar más de 2 céntimos por el redondeo producto a producto. En ese caso IVAn avisa y no bloquea; si molesta, se sube el margen.
- La lectura de Claude se prueba con respuestas simuladas. Con fotos reales hay que mirarlo en la Fase 2.

## Notas de ejecución

(Las rellena Claude Code.)
