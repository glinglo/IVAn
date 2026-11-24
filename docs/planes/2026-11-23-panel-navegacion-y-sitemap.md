# Panel de IVAn · Navegación, sitemap y mocks (borrador v1)

> **Sustituido** por el lienzo https://claude.ai/artifact/M9CekvBAAgtGMCAjgatDMf y el plan `2026-11-23-rediseno-del-panel.md`. Se guarda como historia de las decisiones.

> Estado: **estructura aprobada por Jose el 23/11/2026** (decisiones en § 11). No es un plan para Claude Code todavía: falta la parte visual con Vela y después el plan de ejecución.
> Números de los mocks: datos reales de 2026 a 23/11 (los marcados con ≈ son aproximados).

---

## 1. Punto de partida

**Hoy el panel tiene 3 pestañas** (`components/Nav.tsx`) y dos páginas escondidas:

| Ruta | Qué enseña | Problema |
|---|---|---|
| `/` Inicio | 3 KPIs, siguientes pasos, P&L en filas, lista de trimestres, botón Excel | Hace de todo: es home, P&L e impuestos a la vez. Nada visual |
| `/ventas` | Chips de trimestre, 2 KPIs, lista de facturas | Lista plana, sin ver evolución ni clientes |
| `/gastos` | Chips, 2 KPIs, lista con tipo de IVA | No se ve en qué se va el dinero |
| `/trimestre/[anio]/[t]` | Casillas 303, 130 y 349 | Solo se llega desde Inicio. Las tablas son largas y no se pueden copiar |
| `/anual/[anio]` | Casillas del 390 | Solo se llega desde el 4T o el bot |

Además, el año (`?anio=`) se pierde al cambiar de pestaña.

## 2. Principios

1. **El bot es para meter datos y el panel para entenderlos.** El panel no crea facturas ni gastos (eso sigue en Telegram). Solo consulta, descarga y lleva al bot.
2. **Cada pantalla responde una pregunta:**
   - Inicio: ¿qué tengo que hacer y cómo voy?
   - Ventas: ¿cuánto facturo y a quién?
   - Gastos: ¿en qué me lo gasto?
   - Resultados: ¿está sano el negocio?
   - Impuestos: ¿qué presento y con qué casillas?
3. **Un gráfico principal por pantalla.** Cada gráfico tiene que decir algo que la lista no dice.
4. **Mobile first, y en escritorio que luzca:** con barra lateral y dos columnas en Inicio y Resultados (para el case study).
5. **Las cifras salen del cálculo actual** (`pyg`, `modelo303`, `modelo130`, `modelo349`, `modelo390`). La UI no recalcula nada fiscal.

## 3. Qué no cambia (reglas de negocio)

- Las facturas emitidas no se tocan. Para corregir una, rectificativa desde el bot.
- **Paralelo noviembre-diciembre:** la 00337 y la 00338 salen de Selfconta y se ven con la etiqueta «Selfconta». La primera emitida por IVAn es la 00339.
- El P&L sigue el criterio de IVAn: la cuota de autónomo y la amortización del Mac cuentan como gasto, y se aplica el 5 % de difícil justificación (máximo 2.000 €).
- Los gastos ISP son neutros en el IVA: se ven, pero no suman «IVA deducible».
- El 130 usa lo pagado de verdad en los trimestres anteriores ([05]).
- **Los 755,53 € no aparecen en el panel** hasta tener el plan del cierre del 4T.
- Presentar es cosa de Jose: el panel prepara y él marca «presentado» en el bot.
- Siguen funcionando los enlaces que manda el bot (`/panel` → `/trimestre/…`, `/anual/…`), con redirección a las rutas nuevas.

---

## 4. Sitemap

> **Cambio del 23/11/2026 (tarde), tras los primeros mocks visuales:** Inicio y Resultados se juntan. Al abrir el panel se ven los resultados, y arriba un **aviso de próximo paso** (tarjeta grande en carrusel, al estilo de Wise o Trade Republic), por orden de urgencia según `siguientesPasos`. En móvil, la barra de abajo queda en **Inicio · Ventas · [Bot] · Gastos · Impuestos**, con el botón del bot en el centro, siempre visible (abre `t.me/Ivanelgestorbot`). En escritorio, «Abrir el bot» va arriba de la barra lateral. «Lo que se lleva el Estado», «Salud», «En qué se van los gastos» y «Cómo se calcula» pasan a un segundo nivel (lista «Más detalle»). Tipografía: solo Inter y 7 estilos; los títulos de card son eyebrow. Mocks visuales: https://claude.ai/artifact/M9CekvBAAgtGMCAjgatDMf. Lo que sigue de §4 a §6 es la versión anterior, pendiente de actualizar.

```
IVAn (panel)
│
├── Inicio                     /
│
├── Ventas                     /ventas            ?anio ?t ?cliente   (fila → PDF)
│
├── Gastos                     /gastos            ?anio ?t ?tipo ?categoria   (fila → archivo original)
│
├── Resultados  (P&L)          /resultados        ?anio ?periodo=año|1T..4T
│
├── Impuestos                  /impuestos         ?anio
│   ├── Trimestre              /impuestos/[anio]/[t]     ← hoy /trimestre/[anio]/[t]
│   └── Resumen anual (390)    /impuestos/[anio]/390     ← hoy /anual/[anio]
│
└── Menú de cuenta (avatar, no es pestaña)
    ├── Mis datos              /ajustes           (solo lectura: NIF, IBAN, cuota, Mac)
    ├── Clientes               /ajustes/clientes  (solo lectura)
    ├── Descargar Excel        /api/exportar?anio
    └── Abrir el bot           t.me/Ivanelgestorbot
```

### Navegación

**Móvil: barra inferior con 5 pestañas**

```
┌────────┬────────┬────────┬────────┬────────┐
│   ⌂    │   ↗    │   ↘    │   ◔    │   ▤    │
│ Inicio │ Ventas │ Gastos │Resultad│Impuest.│
└────────┴────────┴────────┴────────┴────────┘
```

- Impuestos lleva un **punto de aviso** cuando hay un plazo abierto con modelos sin presentar (la misma lógica que `siguientesPasos`).
- El año va en la cabecera de cada pantalla (`2026 ▾`) y **se conserva al cambiar de pestaña**.

**Escritorio (≥ 1024 px): barra lateral**

```
┌──────────────┬─────────────────────────────────────────────┐
│ IVAn         │  Inicio                         2026 ▾  (J) │
│              │                                             │
│ ⌂ Inicio     │  ┌──────────────────┐ ┌──────────────────┐  │
│ ↗ Ventas     │  │                  │ │                  │  │
│ ↘ Gastos     │  │  col. principal  │ │  col. lateral    │  │
│ ◔ Resultados │  │                  │ │                  │  │
│ ▤ Impuestos •│  └──────────────────┘ └──────────────────┘  │
│              │                                             │
│ ──────────── │                                             │
│ Abrir el bot │                                             │
│ Excel 2026   │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

> **Por qué 5 pestañas y no 4:** preparar los trimestrales es la tarea más importante del año. Hoy está escondida dentro de Inicio. Al darle pestaña propia, Inicio se queda como resumen y Resultados como P&L, sin que ninguna se llene de casillas. Alternativa en las decisiones (§ 10).

---

## 5. Inicio · «¿Qué tengo que hacer y cómo voy?»

Se mantienen las acciones («Siguientes pasos», que te gustan) y se añaden KPIs y un gráfico.

```
┌──────────────────────────────────────────┐
│ Hola, Jose                    2026 ▾  (J)│
│ lunes, 23 de noviembre                   │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ PRÓXIMO PLAZO                  4T 26 │ │
│ │ 303 · 130 · 349 · 390                │ │
│ │                                      │ │
│ │ ███████████████░░░░░░░   70 días     │ │
│ │ Hasta el lunes 1 de febrero          │ │
│ │ Domiciliar antes del ~27 de enero    │ │
│ │                                      │ │
│ │ Previsto hoy:  IVA 0 €  ·  IRPF 0 €  │ │
│ │                     Ver casillas  ›  │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Por hacer                            2   │
│ ┌──────────────────────────────────────┐ │
│ │ ● Registrar la factura de noviembre  │ │
│ │   de Zapflow Oy (Selfconta)       ›  │ │
│ │ ─────────────────────────────────────│ │
│ │ ● 1 gasto sin confirmar           ›  │ │
│ │   Confírmalo en el bot               │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────┐ ┌─────────────────┐  │
│ │ Facturado       │ │ Beneficio       │  │
│ │ 29.460 €        │ │ 20.582 €        │  │
│ │ ▅▅▅▅▅▄▅▄▅▅      │ │ 70 % de margen  │  │
│ └─────────────────┘ └─────────────────┘  │
│ ┌─────────────────┐ ┌─────────────────┐  │
│ │ Media al mes    │ │ A cuenta IRPF   │  │
│ │ 2.946 €         │ │ 4.433 €         │  │
│ │ ene-oct         │ │ 130 · 1T-3T     │  │
│ └─────────────────┘ └─────────────────┘  │
│                                          │
│ Mes a mes              ■ Ingresos ■ Gastos│
│ ┌──────────────────────────────────────┐ │
│ │3k ▇ ▇ ▇ ▇ ▇ ▆ ▇ ▆ ▇ ▇ ┆ ┆            │ │
│ │   ▃ ▂ ▂ ▂ ▂ ▂ ▂ ▂ ▂ ▂ ┆ ┆            │ │
│ │   E F M A M J J A S O N D            │ │
│ └──────────────────────────────────────┘ │
│  Gastos = facturas + cuota de autónomo   │
│                                          │
│ Trimestres 2026                          │
│  ●━━━━━━━━●━━━━━━━━●━━━━━━━━◐            │
│  1T       2T       3T       4T           │
│  ✓        ✓        ✓        en curso     │
│                                          │
│ Último movimiento                        │
│  23 nov · 11 facturas de Cursor (gasto)  │
│  30 oct · 00336 · Zapflow Oy   3.060 €   │
│                         Ver todo  ›      │
├──────────────────────────────────────────┤
│ Inicio  Ventas  Gastos  Resultados  Imp. │
└──────────────────────────────────────────┘
```

**Bloques, en orden**

| # | Bloque | Datos (ya existen) | Notas |
|---|---|---|---|
| 1 | Cabecera | `hoyMadrid()` | Saludo con la fecha. Selector de año y avatar |
| 2 | **Próximo plazo** (hero) | primer `Paso` de plazo + `plazoTrimestral` + `m303.c71`, `m130.aIngresar` | Barra de días que quedan. Color según `nivel`: info (neutro) · pendiente (ámbar) · urgente ≤ 10 días (rojo). Sale de la lista de «Por hacer» para no repetirse |
| 3 | Por hacer | resto de `siguientesPasos` | Igual que hoy, con fila tocable. **Ajuste de texto en el paralelo:** «Facturar a Zapflow» pasa a «Registrar la factura de noviembre (Selfconta)» en nov-dic 2026 |
| 4 | KPIs 2×2 | `pygHasta` + `presentaciones` | Facturado (con minigráfico de 10 meses), Beneficio (= rendimiento neto, con % de margen), Media al mes, Pagos a cuenta del IRPF |
| 5 | Mes a mes | facturas y gastos agrupados por mes + cuota del mes | Barras agrupadas. Meses sin factura todavía: barra de puntos «pendiente». Meses futuros: vacíos. Tocar → Resultados |
| 6 | Trimestres | `resumenTrimestre` × 4 | Línea de pasos con estado. Tocar → Impuestos/trimestre |
| 7 | Último movimiento | 2-3 facturas/gastos más recientes | Opcional; da sensación de «vivo» |

**Estados:** año cerrado (sin plazo; el hero pasa a «2025 cerrado · rendimiento X €») · sin datos (tarjeta vacía «Mándale tu primera factura al bot» con enlace a Telegram) · cargando (esqueletos con la forma de cada bloque).

---

## 6. Resultados (P&L) · «¿Está sano el negocio?»

Es la sección nueva. Usa exactamente el P&L que ya calcula IVAn y lo cuenta de forma visual.

```
┌──────────────────────────────────────────┐
│ Resultados                    2026 ▾  (J)│
│ hasta hoy, 23/11 · provisional           │
│                                          │
│ [ Año ] [ 1T ] [ 2T ] [ 3T ] [ 4T ]      │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ RENDIMIENTO NETO                     │ │
│ │ 20.582 €                             │ │
│ │ 70 % de lo facturado                 │ │
│ │ ≈ 2.058 € al mes                     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ De lo facturado a lo que ganas           │
│ ┌──────────────────────────────────────┐ │
│ │ Ingresos       29.460 ██████████████ │ │
│ │ Gastos fact.   −2.240           ▕█   │ │
│ │ Cuota autón.   −4.982        ▕██▏    │ │
│ │ Amortización     −572       ▕▏       │ │
│ │ 5 % difícil j. −1.083      ▕▌        │ │
│ │ Rendimiento    20.582 ██████████     │ │
│ └──────────────────────────────────────┘ │
│  Cascada: cada barra resta de la anterior│
│                                          │
│ Mes a mes                                │
│ ┌──────────────────────────────────────┐ │
│ │ ▇ ▇ ▇ ▇ ▇ ▆ ▇ ▆ ▇ ▇      ■ ingresos  │ │
│ │ ▃ ▂ ▂ ▂ ▂ ▂ ▂ ▂ ▂ ▂      ■ gastos    │ │
│ │ ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾      ─ beneficio │ │
│ │ E F M A M J J A S O N D    acumulado │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Lo que se lleva el Estado                │
│ ┌──────────────────────────────────────┐ │
│ │ ███████████████░░░░░░░░░░░░░░░░░░░░░ │ │
│ │ 32 de cada 100 € facturados          │ │
│ │                                      │ │
│ │ ■ Cuota de autónomo         4.982 €  │ │
│ │ ■ Pagos a cuenta IRPF (130) 4.433 €  │ │
│ │ El IVA no cuenta: lo cobras al       │ │
│ │ cliente y lo pasas a Hacienda.       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Salud                                    │
│ ┌──────────────────────────────────────┐ │
│ │ Margen               70 %     ● bien │ │
│ │ Gastos sobre ventas   8 %     ● bien │ │
│ │ Dependencia de un    96 %  ● riesgo  │ │
│ │ cliente (Zapflow Oy)                 │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ En qué se van los gastos      Ver todo › │
│  Software e IA          ≈795 € ██████    │
│  Email                  ≈414 € ███       │
│  Publicidad             ≈410 € ███       │
│  Hosting y dominios     ≈305 € ██        │
│  Otros                  ≈118 € █         │
│                                          │
│ ⓘ Cómo se calcula ›                      │
├──────────────────────────────────────────┤
│ Inicio  Ventas  Gastos  Resultados  Imp. │
└──────────────────────────────────────────┘
```

**Bloques**

| # | Bloque | Datos | Notas |
|---|---|---|---|
| 1 | Periodo | `?periodo=` | Año (por defecto) o trimestre. El P&L de trimestre es acumulado hasta el final de ese trimestre, igual que el 130 (hay que decirlo en la pantalla) |
| 2 | Rendimiento neto (hero) | `pyg().rendimientoNeto` | Con % sobre ingresos y media al mes |
| 3 | **Cascada** | `pyg()`: ingresos, gastosFacturas, seguridadSocial, amortizaciones, dificilJustificacion | El gráfico estrella. Son las mismas filas del P&L de hoy, en visual. Tocar una barra → su detalle |
| 4 | Mes a mes | por mes: facturas, gastos, cuota del mes, amortización / 12 | **El 5 % no se reparte por meses:** se calcula sobre el año y solo aparece en el acumulado. La línea es el beneficio acumulado antes del 5 % |
| 5 | Lo que se lleva el Estado | cuotas + `presentaciones` 130 | Solo lo pagado de verdad. El IVA se excluye a propósito y el texto lo explica |
| 6 | Salud | ratios de `pyg` + reparto por cliente | 3 indicadores con semáforo. Umbrales en § 11 |
| 7 | En qué se van los gastos | categorías de gasto | **Necesita categoría en los gastos** (§ 9). Sin ella, se agrupa por proveedor |
| 8 | Cómo se calcula | texto | Hoja que explica el 5 %, la cuota y la amortización, y por qué el resultado acumulado y el del 130 del 4T no coinciden hasta enero (pendiente técnico del bot) |

**Más adelante:** comparar con el año anterior (cuando 2025 esté en IVAn). Hoy, estado vacío: «Carga 2025 para comparar».

---

## 7. Ventas · «¿Cuánto facturo y a quién?»

Igual que ahora (lista de facturas con PDF), con evolución y clientes arriba.

```
┌──────────────────────────────────────────┐
│ Ventas                        2026 ▾  (J)│
│                                          │
│ [ Año ] [ 1T ] [ 2T ] [ 3T ] [ 4T ]      │
│                                          │
│ ┌─────────────────┐ ┌─────────────────┐  │
│ │ Facturado (base)│ │ Facturas        │  │
│ │ 29.460 €        │ │ 11              │  │
│ └─────────────────┘ └─────────────────┘  │
│                                          │
│ Por mes                                  │
│ ┌──────────────────────────────────────┐ │
│ │ ▇ ▇ ▇ ▇ ▇ ▆ ▇ ▆ ▇ ▇ ┆                │ │
│ │                 ▒                    │ │
│ │ E F M A M J J A S O N D              │ │
│ │ ■ Zapflow Oy  ▒ Volta Cultural       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Clientes                                 │
│ ┌──────────────────────────────────────┐ │
│ │ ████████████████████████████████████▒│ │
│ │ Zapflow Oy   28.440 € · 96,5 %  UE   │ │
│ │ Volta Cult.   1.020 € ·  3,5 %  ES   │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Octubre                         3.060 €  │
│ ┌──────────────────────────────────────┐ │
│ │ 00336 · Zapflow Oy          3.060 €  │ │
│ │ 30 oct · UX services…   [UE·sin IVA] │ │
│ └──────────────────────────────────────┘ │
│ Septiembre                      3.020 €  │
│ ┌──────────────────────────────────────┐ │
│ │ 00335 · Zapflow Oy          3.020 €  │ │
│ └──────────────────────────────────────┘ │
│ Agosto                          2.601 €  │
│ ┌──────────────────────────────────────┐ │
│ │ 00334 · Zapflow Oy          1.520 €  │ │
│ │ 00333 · Volta Cultural      1.081 €  │ │
│ │ 5 ago · Disseny…  [21 % · −15 % ret] │ │
│ └──────────────────────────────────────┘ │
│ …                                        │
│                                          │
│ Para facturar, díselo al bot  [Abrir ›]  │
└──────────────────────────────────────────┘
```

- **Lista agrupada por mes** con su subtotal (hoy es plana).
- Etiquetas por tipo: `UE · sin IVA` · `21 % · −15 % ret.` · `Selfconta` (00337 y 00338) · `sin PDF`.
- El importe de la fila es el **total cobrado** (como hoy).
- **Tocar una factura abre su PDF**, como hoy (sin pantalla de detalle). La nota del final recuerda que para corregirla hay que pedir una rectificativa al bot.
- Tocar un cliente → filtra la lista (`?cliente=`).

---

## 8. Gastos · «¿En qué me lo gasto?»

```
┌──────────────────────────────────────────┐
│ Gastos                        2026 ▾  (J)│
│                                          │
│ [ Año ] [ 1T ] [ 2T ] [ 3T ] [ 4T ]      │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ⚠ 1 gasto sin confirmar en el bot  › │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────┐ ┌─────────────────┐  │
│ │ Gastado (base)  │ │ IVA deducible   │  │
│ │ ≈2.240 €        │ │ ≈7 €            │  │
│ └─────────────────┘ └─────────────────┘  │
│                                          │
│ Por categoría                            │
│ ┌──────────────────────────────────────┐ │
│ │ Software e IA       ≈795 € ████████  │ │
│ │ Email               ≈414 € ████      │ │
│ │ Publicidad          ≈410 € ████      │ │
│ │ Hosting y dominios  ≈305 € ███       │ │
│ │ APIs y datos         102 € █         │ │
│ │ Otros                ≈16 €           │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Por tipo de IVA                          │
│ ┌──────────────────────────────────────┐ │
│ │ ██████████████████████████████████▒░ │ │
│ │ ■ ISP UE 49 %   ■ ISP fuera UE 48 %  │ │
│ │ ▒ IVA español 2 %  ░ Sin IVA ded. 1 %│ │
│ │ ⓘ ISP: neutro en el 303 ›            │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ (del 28 a fin de mes)                    │
│ ┌──────────────────────────────────────┐ │
│ │ Faltan este mes                      │ │
│ │ Anthropic · Salesforge · Meta        │ │
│ │ Mándaselos al bot              ›     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Noviembre                         ≈… €   │
│ ┌──────────────────────────────────────┐ │
│ │ Cursor · 0015                 ≈51 €  │ │
│ │ 23 nov · Software e IA [ISP fuera UE]│ │
│ └──────────────────────────────────────┘ │
│ …                                        │
└──────────────────────────────────────────┘
```

- **Por categoría** (barra horizontal; tocar → filtra). Ver § 9.
- **Por tipo de IVA:** barra 100 % con los 4 tipos que ya existen. Explica de un vistazo por qué el IVA deducible es casi 0.
- **Faltan este mes:** misma lógica que el aviso de fin de mes del bot (recurrentes en 2 de los 3 meses anteriores) y misma ventana (desde el día 28). Apify saldrá como falsa alarma un par de meses, como ya pasa en el bot. Mostrar el nombre sin la forma jurídica («Anthropic», no «Anthropic, PBC»), que es el pendiente técnico conocido.
- Etiquetas de fila: tipo de IVA + `%` del desglose + `restaurante: trabajo/cliente` cuando aplique.
- **Tocar un gasto abre el archivo original** (foto o PDF), como hoy.
- La cuota de autónomo y el Mac **no son filas de Gastos** (no son facturas). Una línea al final lo recuerda y enlaza a Resultados.

---

## 9. Impuestos · «¿Qué presento y con qué casillas?»

### 9.1 `/impuestos` (el año)

```
┌──────────────────────────────────────────┐
│ Impuestos                     2026 ▾  (J)│
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ 4T · EN CURSO          70 días       │ │
│ │ Hasta el lunes 1 de febrero de 2027  │ │
│ │ 303  0 €   130  0 €   349  —   390   │ │
│ │                       Preparar  ›    │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ 3T · presentado 15/10            ✓   │ │
│ │ 303  207,46 €  ·  130  1.399,14 €    │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ 2T · presentado 14/07            ✓   │ │
│ │ 303  −0,42 €   ·  130  1.530,54 €    │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ 1T · presentado 14/04            ✓   │ │
│ │ 303  −2,42 €   ·  130  1.503,78 €    │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Resumen anual · 390        enero 2027 ›  │
└──────────────────────────────────────────┘
```

En los trimestres presentados se ve **lo presentado** (de `presentaciones`). En el abierto, lo que calcula IVAn.

### 9.2 `/impuestos/[anio]/[t]` (el trimestre)

```
┌──────────────────────────────────────────┐
│ ‹ Impuestos                              │
│ 1T 2026                    ✓ presentado  │
│                                          │
│ [ 303 IVA ] [ 130 IRPF ] [ 349 UE ]      │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ A INGRESAR · 130                     │ │
│ │ 1.503,78 €  presentado (domiciliado) │ │
│ │ 1.216,02 €  según IVAn               │ │
│ │ Diferencia: IVAn resta la cuota de   │ │
│ │ autónomo; la gestoría no.          ⓘ │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Casillas                  toca para copiar│
│ ┌──────────────────────────────────────┐ │
│ │ 01 Ingresos computables   9.060,00 ⧉ │ │
│ │ 02 Gastos deducibles          …    ⧉ │ │
│ │ 03 Rendimiento neto           …    ⧉ │ │
│ │ 04 20 % del rendimiento       …    ⧉ │ │
│ │ 05 Pagos anteriores        0,00    ⧉ │ │
│ │ 06 Retenciones             0,00    ⧉ │ │
│ │ 07 Resultado                  …    ⧉ │ │
│ │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│ │
│ │ 19 A ingresar          1.216,02    ⧉ │ │
│ └──────────────────────────────────────┘ │
│  Gastos [02] = facturas + cuota +        │
│  amortización + 5 %                      │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Cómo presentarlo                     │ │
│ │ 1 Sede AEAT → Modelo 130 → Cl@ve     │ │
│ │ 2 Copia las casillas de aquí         │ │
│ │ 3 Domicilia antes del ~27/01         │ │
│ │ 4 Dile al bot: «presentado el 130…»  │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

- **Pestañas por modelo** en vez de tres tablas seguidas.
- **Tocar una casilla copia el importe** en el formato de la Sede (`1216,02`). Es lo que más ahorra al rellenar.
- Se ven **todas las casillas de hoy**; las que están a 0 van en gris, como ya se hace en el 390.
- **Presentado vs IVAn:** cuando hay justificante, se ven los dos importes y por qué difieren. Es la base visual del aviso B2 del plan del cierre.
- El 349 se queda como lista: clave, nombre, VAT, base.
- El 390 conserva su contenido (incluido el cambio compensar/devolver) con el mismo patrón visual.

---

## 10. Cambios de datos que piden estos mocks

| Qué | Para qué | Impacto en reglas |
|---|---|---|
| **Series por mes** (facturas, gastos, cuota, amortización/12) | Gráficos de Inicio, Resultados y Ventas | Ninguno: es agrupar lo que ya hay. Función nueva en `lib/libro.ts`, sin tocar `calculo.ts` |
| **Categoría de gasto** (columna `categoria`, opcional) · **aprobado** | «En qué se van los gastos» | Ninguno en el fiscal. La pone Claude al leer la factura (Jose la corrige respondiendo al borrador). Los 71 gastos antiguos se rellenan una vez a partir de su concepto |
| Reparto por cliente | Ventas y Salud | Ninguno |
| Copiar casilla en formato Sede | Impuestos | Ninguno |

Categorías propuestas (cortas, para un autónomo digital): Software e IA · Email · Publicidad · Hosting y dominios · APIs y datos · Formación · Material y equipos · Comidas · Otros.

---

## 11. Decisiones (cerradas el 23/11/2026)

1. **5 pestañas:** Inicio · Ventas · Gastos · Resultados · Impuestos.
2. **Nombre: «Resultados»** (no «P&L»).
3. **Categoría en los gastos: sí.** Campo nuevo `categoria`; la pone Claude al leer la factura y se corrige respondiendo al borrador. Los 71 gastos antiguos se rellenan una vez a partir del concepto. Sin efecto fiscal.
4. **Umbrales de «Salud»:** margen bien si ≥ 50 %; gastos sobre ventas bien si ≤ 20 %; dependencia de un cliente en riesgo si ≥ 70 %.
5. **Sin proyección de cierre de año** en la v1.
6. **Sin pantallas de detalle:** tocar una factura o un gasto abre el PDF o el archivo original, como hoy.

## 12. Vela: qué hay y qué falta

Revisado `glinglo/vela-ds` (último commit: 12/05/2026). React + Tailwind v4 + `cva`, iconos `lucide-react` y gráficos con `recharts`. Tokens en 3 capas (primitivos → semánticos → utilidades) y modo oscuro con la clase `.dark`.

**Identidad:** índigo de marca `brand-500 #4641D7`, cian secundario `brand-secondary-500 #06B6D4` y grises slate. Tipografías: Inter (texto), DM Serif Display (serif, para titulares) y Roboto Mono (cifras). Radios de 6-8 px, sombras muy suaves.

**Componentes que ya sirven**

| Bloque de los mocks | Componente de Vela |
|---|---|
| Barra lateral (escritorio) | `SidebarNav` + `SidebarNavGroup` + `SidebarNavItem` + `SidebarNavUser` (avatar con menú) |
| KPIs | `CardMetrics` (título, valor grande, badge y subtexto) |
| Por hacer, Último movimiento, casillas «Cómo se calcula» | `CardSummary` (título, enlace y filas con valor o badge) |
| Contenedores y gráficos | `Card` (con variante `interactive` para lo tocable) |
| Estados vacíos | `CardEmpty` |
| Etiquetas: presentado, pendiente, UE · sin IVA, Selfconta… | `Badge`: `success` · `onhold` · `secondary` · `tertiary` · `destructive` |
| Gastos sin confirmar, avisos de plazo | `Alert` (`help` naranja, `warning` rojo, `info` índigo) |
| Selector de año | `Dropdown` |
| «Abrir el bot», «Descargar Excel» | `Button` (`primary`, `secondary`, `ghost`) |
| Gráficos de barras y áreas | Patrón de `mockups/Dashboard.tsx`: `recharts` con colores leídos de los tokens (`useChartColors`) |

**Qué le falta a Vela para IVAn.** Vela está pensado para escritorio. IVAn es mobile first, así que faltan piezas. Las propongo como componentes nuevos de Vela, no como estilos sueltos dentro de IVAn (para el case study, el design system crece con el producto):

| Falta | Para qué |
|---|---|
| `TabBar` (barra inferior móvil con punto de aviso) | Navegación en móvil |
| `SegmentedControl` / `Chips` | Año · 1T-4T; 303 · 130 · 349 |
| `ProgressBar` | Días que quedan del plazo |
| `Stepper` | Trimestres 1T-4T |
| `ListItem` (título, detalle, importe, badge y chevron) | Facturas, gastos y casillas |
| `CopyValue` (casilla con importe que se copia) | Impuestos |
| `StackedBar` (barra al 100 % con leyenda) | Clientes, tipos de IVA, «Lo que se lleva el Estado» |
| `Waterfall` (cascada con `recharts`) | Resultados |
| `Skeleton` y `Tooltip` | Estados de carga y explicaciones con ⓘ |
| Paleta de gráficos semántica (ingresos, gastos, beneficio, impuestos) | Mismos colores en todas las pantallas |

**Cómo llega Vela a IVAn: como paquete (decidido el 23/11/2026),** para mantener una sola copia. IVAn pasa a Tailwind v4.

Antes, Vela necesita estos ajustes (es trabajo en el repo de Vela, no en IVAn):
1. **Publicarlo con versión.** `dist/` no está en git, así que instalarlo directamente desde el repo obligaría a Vercel a compilar Vela entero en cada despliegue. Mejor publicarlo en **GitHub Packages** como `@glinglo/vela-ds`, con una GitHub Action que compile (`build:lib`) y publique al crear una etiqueta (`v0.2.0`…).
2. **En IVAn,** un `.npmrc` que apunte `@glinglo` a GitHub Packages y una variable `NPM_TOKEN` (token de solo lectura de paquetes) en Vercel y en el Mac. El token nunca se pega en el chat.
3. **Exportar los tokens como tema de Tailwind** (`@glinglo/vela-ds/theme.css`, con los `@theme` sin compilar), para que las pantallas de IVAn usen las mismas utilidades (`bg-card`, `text-tertiary`…). Hoy solo se exporta el CSS ya compilado.
4. **Sacar la carga de Google Fonts del CSS del paquete:** IVAn las cargará con `next/font` (más rápido, sin peticiones externas).
5. **Componentes nuevos** de la tabla de arriba, en Vela, con su story en Storybook.

### Marca de IVAn: lila (decidido el 23/11/2026)

Se probó un naranja claro (`#FE9E58`): demasiado fuerte, transmitía nervios. Se compararon tres pasteles (melocotón, lila y salvia) sobre la pantalla de Inicio y se eligió **lila**: calma y seguridad con un punto cálido (tono rosado, no azul), no choca con ningún color de estado (verde, amarillo y rojo) y es pariente del índigo de Vela. Escala en OKLCH (tono 295-305), 500 = `#C1A9EE`:

```css
@import "tailwindcss";
@import "@glinglo/vela-ds/theme.css";
@source "../node_modules/@glinglo/vela-ds/dist";

@theme {
  --color-brand-50:  #FBF9FF;
  --color-brand-100: #F5EFFF;
  --color-brand-200: #ECE0FF;
  --color-brand-300: #E0CDFF;
  --color-brand-400: #D2B8FF;
  --color-brand-500: #C1A9EE;
  --color-brand-600: #9B84C8;
  --color-brand-700: #7865A2;
  --color-brand-800: #5D4E7F;
  --color-brand-900: #453B60;
  --color-brand-950: #28223A;
}

/* Marca clara: el texto sobre o en color de marca usa tonos oscuros */
:root {
  --color-text-btn-primary:          var(--color-gray-950);  /* 9,78:1 sobre 500 */
  --color-text-nav-item-active:      var(--color-brand-800); /* 6,53:1 sobre 100 */
  --color-text-link-secondary:       var(--color-brand-700); /* 5,02:1 sobre blanco */
  --color-text-link-secondary-hover: var(--color-brand-800);
  --color-text-brand:                var(--color-brand-700);
  --color-focus-ring:                var(--color-brand-700);
}
```

- El tono fuerte (500) solo va en el botón del bot y en la serie principal de los gráficos; la tarjeta de aviso de marca usa el 200 (pastel) con texto 900 (8,14:1); la franja de «Por hacer», el 100.
- **Gráficos:** el 500 da 2,06:1 sobre blanco, por debajo del 3:1 para barras: en modo claro la serie de marca usa el **600** (3,22:1).
- Modo oscuro: pendiente de revisar con la escala lila cuando se diseñe.

**«Pendiente» en amarillo (decidido el 23/11/2026).** El naranja de Vela para `onhold`/`help` tenía casi el mismo fondo que `brand-100` (`#FFEDD5` frente a `#FFEFDE`), así que «pendiente» se confundía con la marca. Vela añade una escala primitiva `yellow-50…950` (la de Tailwind, como el resto de primitivos de Vela), sin cambiar su naranja por defecto, e IVAn remapea:

```css
:root {
  --color-bg-badge-onhold:       var(--color-yellow-100);
  --color-text-badge-onhold:     var(--color-yellow-800); /* 6,38:1 */
  --color-bg-alert-help:         var(--color-yellow-100);
  --color-text-alert-help:       var(--color-yellow-800); /* 6,38:1 (el 700 daría 4,58, justo) */
  --color-text-link-help:        var(--color-yellow-700); /* 4,92:1 sobre blanco */
  --color-text-link-help-hover:  var(--color-yellow-800);
}
.dark {
  --color-text-link-help:        var(--color-yellow-400); /* 9,55:1 sobre gray-800 */
  --color-text-link-help-hover:  var(--color-yellow-300);
}
```

Colores de estado en IVAn: **verde** = presentado/bien · **amarillo** = pendiente/atención · **rojo** = urgente/riesgo · **lila** = solo marca (acciones, navegación, serie principal de los gráficos).

## 13. Siguiente paso

1. Mocks visuales de Inicio y Resultados (móvil y escritorio) con los tokens y componentes de Vela, diseñando también los componentes que faltan.
2. Plan para Claude Code en dos repos: **Vela** (publicar el paquete, `theme.css` y componentes nuevos) y **IVAn**, por fases: A) navegación + tokens Vela + redirecciones · B) Inicio · C) Resultados · D) Ventas y Gastos (con la categoría) · E) Impuestos.
