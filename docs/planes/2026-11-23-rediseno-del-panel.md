# Rediseño del panel con Vela: navegación, Inicio con resultados, Ventas, Gastos e Impuestos

Estado: **Aprobado** (Jose, 23/11/2026)
23/11/2026 · Plan de Claude (proyecto IVAn)

**Depende de:** Vela 0.3.0 publicada (`@glinglo/vela-ds@0.3.0`, plan `docs/planes/2026-11-23-vela-0-3-0.md` del repo `glinglo/vela-ds`).
**Se ejecuta por fases:** una fase por sesión de Claude Code y un PR por fase, contra `wip/v0`, en ramas `plan/rediseno-a`, `plan/rediseno-b`… Jose revisa cada fase en Vercel antes de la siguiente.

## Por qué

El panel funciona, pero es una lista de cifras sin jerarquía. Además, IVAn es el case study de Jose como diseñador que construye un producto de cero a producción. Se ha rediseñado con el design system de Jose (Vela), con una marca lila propia.

**Fuente de verdad visual:** https://claude.ai/artifact/M9CekvBAAgtGMCAjgatDMf
- Móvil: Inicio, drawer, aviso urgente, Ventas, Gastos, Impuestos, 4T, «Impuestos y cuota», «Salud» y «Cómo se calcula».
- Escritorio: Inicio.
- Referencias: la ficha de marca y las variantes del aviso.

Si una pantalla del lienzo y este plan no coinciden, manda el plan. Apúntalo en las notas.

## Lo que NO cambia

- `lib/calculo.ts` no se toca. Todas las cifras salen de `pyg`, `modelo303`, `modelo130`, `modelo349` y `modelo390`. `tests/calculo.test.ts` tiene que seguir pasando igual.
- El panel no crea ni edita facturas ni gastos: eso sigue en el bot. Tocar una factura o un gasto abre su PDF o archivo, como hoy (`/api/archivo`).
- Modo paralelo: las facturas de Selfconta se ven con la etiqueta «Selfconta».
- **Los 755,53 € no aparecen** hasta el plan del cierre del 4T.
- Sesión: `exigirSesion()` en el layout y los enlaces firmados de `/acceso`.

## Decisiones (Jose, 23/11/2026)

- **Navegación:**
  - Móvil: **Inicio · Ventas · [Bot] · Gastos · Impuestos**. El bot, en el centro, abre `https://t.me/Ivanelgestorbot`.
  - Escritorio: barra lateral con «Abrir el bot» arriba.
  - Resultados deja de ser una pestaña: **Inicio = resultados**.
- **Aviso de próximo paso según urgencia:**
  - Normalmente, una franja de una línea («N cosas por hacer · la próxima: …») que abre un drawer con la lista.
  - Tarjeta grande solo si hay algo urgente (plazo abierto con ≤ 10 días) o, desde el día 28, la factura y los gastos del mes.
- **Marca lila** sobre Vela (escala y contrastes en la ficha de marca del lienzo). «Pendiente» en amarillo. Solo Inter.
- **Categoría en los gastos:** campo nuevo, sin efecto fiscal.
- **Sin pantallas de detalle** de factura o gasto.
- Umbrales de «Salud»:
  - margen: bien si es ≥ 50 %;
  - gastos sobre ventas: bien si es ≤ 20 %;
  - dependencia de un cliente: riesgo si es ≥ 70 %.
- Sin proyección de cierre de año.
- **Modo oscuro:** esta versión sale **solo en claro**, aunque el panel actual lo tiene. El oscuro con lila se diseña después.


---

## Fase A · Base: Vela, tema lila, navegación y rutas

1. **Vela:**
   - `npm install @glinglo/vela-ds@0.3.0`.
   - `.npmrc` en el repo (sin token; la variable ya está en Vercel y en el `.envrc` de Jose):
     ```ini
     @glinglo:registry=https://npm.pkg.github.com
     //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
     ```
2. **Tailwind v4:** `tailwindcss` y `@tailwindcss/postcss` en `devDependencies`, y `postcss.config.mjs`.
3. **`app/globals.css`** se rehace:
   ```css
   @import "tailwindcss";
   @import "@glinglo/vela-ds/theme.css";
   @source "../node_modules/@glinglo/vela-ds/dist";

   @theme {
     --font-sans: var(--font-inter), system-ui, sans-serif;
     --color-brand-50:  #FBF9FF; --color-brand-100: #F5EFFF; --color-brand-200: #ECE0FF;
     --color-brand-300: #E0CDFF; --color-brand-400: #D2B8FF; --color-brand-500: #C1A9EE;
     --color-brand-600: #9B84C8; --color-brand-700: #7865A2; --color-brand-800: #5D4E7F;
     --color-brand-900: #453B60; --color-brand-950: #28223A;
   }
   :root {
     --color-text-btn-primary:          var(--color-gray-950);  /* 9,78:1 sobre 500 */
     --color-text-nav-item-active:      var(--color-brand-800); /* 6,53:1 sobre 100 */
     --color-text-link-secondary:       var(--color-brand-700); /* 5,02:1 */
     --color-text-link-secondary-hover: var(--color-brand-800);
     --color-text-brand:                var(--color-brand-700);
     --color-focus-ring:                var(--color-brand-700);
     --color-bg-badge-onhold:   var(--color-yellow-100);
     --color-text-badge-onhold: var(--color-yellow-800);  /* 6,38:1 */
     --color-bg-alert-help:     var(--color-yellow-100);
     --color-text-alert-help:   var(--color-yellow-800);
     --color-text-link-help:       var(--color-yellow-700);
     --color-text-link-help-hover: var(--color-yellow-800);
   }
   ```
   El CSS propio de ahora (`.card`, `.fila`, `.kpi`…) se borra cuando ninguna página lo use (al final de la fase E). Mientras, convive.
4. **Fuente:** `next/font/google` con Inter (400, 500 y 600) en `app/layout.tsx`, con `variable: "--font-inter"`. Sin `<link>` a Google.
5. **Layout del panel (`app/(panel)/layout.tsx`):**
   - en móvil (< 1024 px), `TabBar` abajo con `centerAction` del bot;
   - en escritorio, `SidebarNav` con el logo «IVAn», el botón «Abrir el bot» (`Button` primario), las 4 secciones, «Excel {año}» (`/api/exportar?anio=`) y el usuario;
   - punto amarillo (`dot`) en Impuestos si hay un plazo abierto con modelos sin presentar (la misma condición que el primer paso de `siguientesPasos`).
6. **El año se conserva al navegar:** las pestañas y la barra lateral llevan el `?anio=` de la página actual si no es el año en curso. El selector de año es un `Dropdown` en la cabecera.
7. **Rutas nuevas y redirecciones** (en `next.config.ts`, `redirects()`, no permanentes):
   - `/trimestre/:anio/:t` → `/impuestos/:anio/:t`;
   - `/anual/:anio` → `/impuestos/:anio/390`.

   Actualizar también:
   - el `href` de `siguientesPasos` en `lib/libro.ts` (hoy `/trimestre/…`);
   - `enlacePanel(\`/anual/${anio}\`)` en `lib/agente.ts`.

   `rutaSegura` en `lib/sesion.ts` ya acepta las rutas nuevas.
8. **Páginas en esta fase:** las 4 secciones existen con su `PageHeader`. Las que aún no se han rediseñado muestran su contenido de ahora debajo de la cabecera nueva.

**Comprueba:**
- `npm test` y `npm run typecheck`.
- `next build` en local con `GITHUB_PACKAGES_TOKEN` cargado.
- En Vercel (preview): las 4 pestañas, el bot central, la barra lateral a 1440 px, las redirecciones antiguas y un enlace `/panel` del bot que lleve a `/impuestos/2026/4`.

## Fase A.1 · Retoques tras la revisión de la fase A (23/11/2026)

En la misma rama `plan/rediseno-a`, **antes de fusionar el PR #10**. **Depende de Vela 0.3.1** (plan `docs/planes/2026-11-23-vela-0-3-1.md` de `glinglo/vela-ds`): `SidebarNavItem` y `Button` con `href`, y `badge`.

1. **Barra lateral con enlaces de verdad:**
   - `npm install @glinglo/vela-ds@0.3.1`;
   - en `components/PanelNav.tsx`, cada `SidebarNavItem` lleva `href` (con el `?anio=` que ya se calcula) en vez de `onClick={() => window.location.href = …}`;
   - fuera `window.location` del archivo.
2. **«Abrir el bot» en otra pestaña:**
   - escritorio: `Button` con `href={BOT_URL}` y `target="_blank"`;
   - móvil: `centerAction` de `TabBar` con `target="_blank"`.
3. **Aviso de Impuestos sin depender del texto:**
   - `Paso` gana `clave: "plazo" | "gastos" | "facturar" | "iban" | "direccion" | "mac" | "cuota" | "verifactu"`, que se rellena en `siguientesPasos` sin cambiar su lógica ni su orden (adelantado desde la fase B);
   - el aviso de Impuestos pasa a ser `pasos.some((p) => p.clave === "plazo" && p.nivel !== "info")`;
   - en la barra lateral, `badge={<Badge type="onhold">{t}T</Badge>}` con el trimestre del plazo, en vez del «•»;
   - test de `siguientesPasos` que compruebe la `clave` de cada paso.
4. **La barra lateral ocupa todo el alto:** el `SidebarNav` va en un contenedor `sticky top-0 h-dvh` (con `overflow-y-auto`). Ahora se corta después de «Impuestos».
5. **El pie de la barra lateral que pedía la fase A:**
   - «Excel {año}» (`/api/exportar?anio=`), como enlace;
   - el usuario: «Jose», con la inicial en un círculo `brand-100`.

   Van en la prop `footer` de `SidebarNav`.
6. **`themeColor`** en `app/layout.tsx`: el color de fondo nuevo (`#F8FAFC`, `gray-50` de Vela), en vez de `#f6f5f2`.

**Comprueba:**
- `npm test` y `npm run typecheck`.
- En la vista previa de Vercel, a 1440 px:
  - la barra lateral llega hasta abajo y se queda fija al hacer scroll;
  - clic central en «Ventas» la abre en otra pestaña;
  - «Abrir el bot» abre Telegram en otra pestaña;
  - Impuestos muestra el badge solo si hay plazo abierto (hoy, 23/11, no lo hay: el 4T abre el 1 de enero).

## Fase B · Inicio = resultados y avisos

**Datos** (funciones nuevas puras en `lib/libro.ts`, con tests en `tests/`; sin tocar `calculo.ts`):
- `seriesMensuales(libro, hasta)`: por mes, ingresos (base de facturas), gastos con factura (base) y cuota de autónomo del mes (`datos.cuotaMes`). Los meses sin factura después del último emitido salen como `pendiente` si son el mes en curso, o vacíos si son futuros.
- `cascada(pyg)`: Ingresos → − gastos con factura → − cuota → − amortización → − 5 % → rendimiento neto.
- `salud(libro, pyg)`:
  - margen = rendimiento / ingresos;
  - gastos sobre ventas = gastos con factura / ingresos;
  - dependencia = el cliente con más base / ingresos.

  Cada uno con su estado según los umbrales de arriba.
- `estadoYCuota(libro, hasta)`: cuotas pagadas en el periodo, y 130 pagado (de `presentaciones`, importe real; si falta, el calculado, marcado como tal).
- `clasificarAvisos(pasos, hoy)` devuelve `{ destacado: Paso | null, resto: Paso[] }`:
  - `destacado` es el primer paso `urgente`, o, si `hoy` es día ≥ 28, el de facturar el mes;
  - todo lo demás va a `resto`.

  Para distinguir el paso de facturar se usa `Paso.clave`, que ya existe desde la fase A.1.
- **Texto del paso de facturar en modo paralelo:** si `modoParalelo(ajustes, hoy)` (`lib/externas.ts`), el texto es «Registrar la factura de {mes} de {cliente}», con el detalle «La emite Selfconta: mándale el PDF al bot».

**Pantalla `/`** (móvil, de arriba abajo):
1. `PageHeader`: «Hola, Jose», con el subtítulo «Tus resultados de {año}, hasta hoy». El año va en el `Dropdown`.
2. Si hay `destacado`: `NoticeCard` (variante `urgent` si es urgente; `pending` si es fin de mes; `brand` en otro caso), con el botón de su acción. Ocultar = guardar en `localStorage` `aviso-oculto:{clave}:{fecha}`; vuelve a salir al día siguiente.
3. Si hay pasos: `NoticeStrip` («{n} cosas por hacer» · «La próxima: {texto}») que abre un `Sheet` con todos los pasos: título, detalle, `Badge` (pendiente / urgente / «en N días») y la acción (`href` del paso, o «Abrir el bot» si no tiene). Si no hay ninguno: «Todo al día» en la franja, sin drawer.
4. `SegmentedControl` (filtro): Año · 1T · 2T · 3T · 4T.
   - Año = `pyg` hasta hoy (o hasta el 31/12 si el año está cerrado).
   - Un trimestre = `pyg` hasta el final de ese trimestre (acumulado, como el 130). El subtítulo lo dice: «Acumulado hasta el 30/09».
5. Tarjeta «Rendimiento neto»: `text-display`, con el `Badge` del margen y «≈ X € al mes».
6. Tarjeta «De lo facturado al rendimiento»: `Waterfall`.
7. Tarjeta «Ingresos y gastos por mes»: `BarChart` (ingresos en `chart-primary`, gastos = facturas + cuota en `chart-muted`). Nota: «El 5 % se calcula sobre el año».
8. «Más detalle»: `ListGroup` con 4 `ListItem`:
   - «Impuestos y cuota» → `/detalle/impuestos-y-cuota`;
   - «Salud del negocio» → `/detalle/salud` (con el `Badge` «N avisos» si alguno está en riesgo);
   - «En qué se van los gastos» → `/gastos`;
   - «Cómo se calcula» → `/detalle/como-se-calcula`.

En escritorio, lo mismo en filas `flex-wrap`:
- aviso a todo el ancho;
- rendimiento (1/3) y cascada (2/3);
- barras (2/3) y «Más detalle» (1/3).

**Comprueba:**
- Los tests nuevos:
  - `seriesMensuales` cuadra con los totales de `pyg`;
  - `clasificarAvisos` funciona con fechas fijas: 23/11, 28/11 y 29/01.
- Con los datos reales a 23/11: rendimiento ≈ 20.582 € y margen 70 %. Se ve la franja y no hay tarjeta grande.

## Fase C · Ventas y Gastos

**Ventas (`/ventas`):**
- Cabecera.
- `SegmentedControl` del periodo.
- Tarjeta con la base facturada (`text-display`) y «N facturas · base imponible».
- Tarjeta «Clientes»: `StackedBar` más un `ListItem` por cliente (base, % y tipo: «UE · sin IVA», «21 % · −15 %»).
- Facturas en `ListGroup` por mes, con el subtotal de base. Cada `ListItem`:
  - título «número · cliente»;
  - detalle «fecha · concepto»;
  - importe total cobrado;
  - `Badge` del tipo, «Selfconta» si es externa y «sin PDF» si no tiene.

  Al tocarlo, abre el PDF.
- En modo paralelo, si el mes en curso no tiene factura y el mes pasado sí: una fila «Factura de {mes} · {cliente}» con `Badge` «pendiente».
- Se muestran los 3 meses más recientes y el enlace «Ver {mes} a enero» enseña el resto (`?todo=1`).
- Al final, `NoticeStrip` sin contador: «Para facturar o corregir una factura, díselo al bot».

**Gastos (`/gastos`):**
1. **Migración `006_categoria_gastos.sql`:**
   - `alter table gastos add column categoria text` con `check (categoria in ('software_ia','email','publicidad','hosting_dominios','apis_datos','formacion','equipos','comidas','otros'))`, nullable;
   - índice si hace falta.

   Etiquetas en español en `lib/` (un solo sitio).
2. **El bot pone la categoría:**
   - `GastoExtraido` (`lib/claude.ts`) gana `categoria` (enum de arriba), con la descripción «Categoría del gasto según lo que se compra»;
   - se guarda al confirmar;
   - corregible respondiendo al borrador, como el resto de campos.

   **Sin efecto en ningún cálculo.**
3. **Relleno de los gastos antiguos:** `scripts/categorias.sql` con `update … set categoria = … where categoria is null`, por proveedor y concepto (Anthropic, Replit, Cursor → software_ia; Salesforge, Zoho, Proton, Paddle «plataforma email» → email; Meta, «Shopify app store ads», «servicio de marketing» → publicidad; Framer, ionos, Fly.io, Cloudflare, dominio, hosting, servidor → hosting_dominios; Apify, Google Cloud → apis_datos; el resto → otros). Lo ejecuta Jose en el SQL Editor; el plan da el `select` de comprobación (gastos sin categoría = 0).
4. **Pantalla:**
   - cabecera, `SegmentedControl` y tarjeta con la base gastada;
   - tarjeta «Por categoría»: barras horizontales; tocar filtra con `?categoria=`, y `Badge` con la X para quitar el filtro;
   - `ListGroup` por mes (proveedor sin forma jurídica, «fecha · categoría», importe con IVA, `Badge` del tipo de IVA y desglose); al tocar abre el archivo original;
   - tarjeta «Por qué casi no hay IVA deducible»: `StackedBar` por tipo de IVA y el texto del lienzo, con el % calculado;
   - si hay gastos en borrador, `Alert` `help` «N gastos sin confirmar en el bot»;
   - desde el día 28, `ListGroup` «Faltan este mes», con `proveedoresQueFaltan` de `lib/recordatorios.ts`, la misma función que el aviso de fin de mes del cron (no duplicarla).
   - **Nombre sin forma jurídica:** función `nombreCorto(proveedor)` que quita «, PBC», «Inc.», «Ltd», «s.r.o.», «Oy», «SL», «B.V.»… Úsala también en el aviso de fin de mes del cron: así se arregla el pendiente técnico de «Anthropic, PBC».

**Comprueba:**
- Tests de `nombreCorto`.
- La migración aplicada en el Postgres de pruebas.
- Un gasto nuevo por foto en el bot guarda la categoría.
- Las 56 conversaciones de la prueba de integración siguen pasando en el Mac de Jose.

## Fase D · Impuestos

**`/impuestos`:**
1. Tarjeta del trimestre abierto o próximo (fondo brand-200, radio 16):
   - días que quedan, plazo y fecha de domiciliación (`plazoTrimestral`);
   - 303 [71] y 130 a ingresar previstos;
   - «Preparar el {t}T» → `/impuestos/{año}/{t}`;
   - `Badge` «provisional» si el trimestre no ha terminado.
2. «Presentados»: un `ListItem` por trimestre presentado, con la fecha y los importes **de `presentaciones`** y `Badge` «presentado».
3. «Resumen anual»: 390 → `/impuestos/{año}/390`, y una línea informativa del 349.
4. «Pagado en {año}»: IRPF a cuenta y IVA ingresado, de `presentaciones`.

**`/impuestos/[anio]/[t]`:**
- `PageHeader` con «‹ Impuestos».
- `SegmentedControl` en modo `tabs`: 303 · 130 · 349 (`?m=`).
- Tarjeta «A ingresar · casilla [x]» (`text-display`) con una frase de por qué. Ejemplo del 130 a 0: «Lo pagado de 1T a 3T ya cubre el 20 % de tu rendimiento del año».
- Si el modelo está presentado y el importe no coincide con IVAn: las dos cifras y el motivo conocido (cuota de autónomo en el 130 de la gestoría). Es la base visual del aviso B2 del plan del cierre; aquí solo se muestra.
- **Casillas con `CopyValue`:** todas las de hoy, las que están a 0 en gris.
  - El formato que se copia es el de la Sede: sin separador de miles y con coma decimal (`1216,02`; los negativos con `-`). Función `formatoSede(n)`, con test.
- «Cómo presentarlo»: lista de 4 pasos (Sede → modelo → copiar casillas → decírselo al bot).
- El 349 sigue como lista (clave, nombre, VAT, base).

**`/impuestos/[anio]/390`:** el contenido actual de `/anual/[anio]` con el mismo patrón (`PageHeader`, tarjetas, `CopyValue`, enlace compensar/devolver).

**Comprueba:**
- Test de `formatoSede`.
- Con los datos reales: 4T 2026 con el 130 a 0 €; 1T con 1.503,78 € presentado frente a 1.216,02 € de IVAn.
- Copiar una casilla en el móvil.

## Fase E · Segundo nivel y limpieza

- `/detalle/impuestos-y-cuota`, `/detalle/salud` y `/detalle/como-se-calcula`, como en el lienzo: `PageHeader` con «‹ Inicio».
  - **Impuestos y cuota:** total, `StackedBar` (cuota, IRPF a cuenta y resto) y los dos textos: el IVA no cuenta; la Renta cierra la cuenta.
  - **Salud:** un `CardIndicator` por indicador, primero los que están en riesgo.
  - **Cómo se calcula:** textos fijos. Las cifras de la amortización salen de `bienes_inversion`, no se escriben a mano.
- Borrar el CSS antiguo de `globals.css` y `components/Filas.tsx`, `components/Casillas.tsx` y `components/Nav.tsx` si ya no se usan.

**Comprueba:**
- `npm test`, `npm run typecheck` y la prueba de integración en el Mac.
- Revisión visual en Vercel a 390 y 1440 px de todas las pantallas del lienzo.
- Lighthouse de accesibilidad ≥ 95 en `/` y `/impuestos/2026/4`.

## Notas de ejecución

### Fase A (23/11/2026, Claude Code, rama `plan/rediseno-a`)

- Instalado `@glinglo/vela-ds@0.3.0`, `tailwindcss` y `@tailwindcss/postcss`. `.npmrc` añadido tal cual el plan (sin token).
- `app/globals.css`: añadido el bloque de Tailwind v4 + tema Vela + marca lila delante del CSS antiguo, que sigue intacto (conviven hasta la fase E).
- Inter cargado con `next/font/google` en `app/layout.tsx`, con `variable: "--font-inter"` en el `<html>`.
- **Rutas:** `/trimestre/[anio]/[t]` → `/impuestos/[anio]/[t]`; `/anual/[anio]` → `/impuestos/[anio]/390`. Creada además `/impuestos` (índice), que no existía antes: muestra la lista de trimestres (igual que hacía Inicio) y un enlace al 390, con su `PageHeader`. Redirecciones (no permanentes) en `next.config.ts` para las rutas antiguas. Actualizados los enlaces internos: `href` de `siguientesPasos` en `lib/libro.ts`, `enlacePanel` en `lib/agente.ts`, y los enlaces cruzados entre las páginas de trimestre/390. `rutaSegura` no necesitó cambios (ya aceptaba las rutas nuevas).
- **Navegación:** `components/PanelNav.tsx` (nuevo, cliente) con `NavMovil` (`TabBar` de Vela, bot en el centro con `centerAction`, oculta en escritorio con `lg:hidden`) y `NavEscritorio` (`SidebarNav` de Vela con el botón «Abrir el bot» arriba, oculta en móvil con `hidden lg:flex`). El punto amarillo de Impuestos usa la misma condición que el primer paso de `siguientesPasos` (texto que empieza por «Presentar»), calculada en `app/(panel)/layout.tsx` con `contextoPasos`. El layout ya no usa el `Nav` viejo (`components/Nav.tsx` queda sin usar; el plan pide borrarlo en la fase E, así que no lo he tocado).
- **Año en la navegación:** `components/AnioDropdown.tsx` (nuevo, cliente, `Dropdown` de Vela) añadido como `actions` del `PageHeader` en Inicio, Ventas, Gastos e Impuestos; navega conservando la ruta actual. La `TabBar`/`SidebarNav` llevan el `?anio=` de la página actual si no es el año en curso (función `enlaces()` en `PanelNav.tsx`).
- **PageHeader en las 4 secciones:** sustituido el `<div className="cabecera">` de Inicio, Ventas y Gastos por `PageHeader`; el resto del contenido de cada página sigue igual (se rediseña en las fases B y C). Las páginas de trimestre y 390 también usan `PageHeader` con `back`.
- `Button` de Vela no tiene `asChild`: el botón «Abrir el bot» de `NavEscritorio` usa `onClick` con `window.location.href` en vez de envolver un `<a>`.

**Comprobaciones:**
- `npm test`: 78 tests, 10 ficheros, todos en verde.
- `npm run typecheck`: sin errores (tras borrar `.next`, que tenía tipos cacheados de las rutas viejas).
- `next build` en local con `GITHUB_PACKAGES_TOKEN` cargado: compila bien. Rutas generadas: `/`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos/[anio]/[t]`, `/impuestos/[anio]/390`, más las de siempre.
- Pendiente de Jose: revisar en el preview de Vercel las 4 pestañas, el bot central, la barra lateral a 1440 px, las redirecciones antiguas y el enlace `/panel` del bot a `/impuestos/2026/4` (no lo he podido probar sin desplegar).

### Fase A.1 (23/11/2026, Claude Code, rama `plan/rediseno-a`)

- Instalado `@glinglo/vela-ds@0.3.1`.
- **Barra lateral con enlaces de verdad:** `components/PanelNav.tsx` ya no usa `window.location`; `SidebarNavItem` lleva `href` (con el `?anio=` calculado) y el `Button` de «Abrir el bot» también usa `href` en vez de `onClick`.
- **«Abrir el bot» en otra pestaña:** `target="_blank"` en el `Button` de escritorio y en el `centerAction` del `TabBar` de móvil.
- **`Paso.clave`:** añadida al tipo `Paso` en `lib/libro.ts` y rellenada en cada `pasos.push(...)` de `siguientesPasos` (`"plazo" | "gastos" | "facturar" | "iban" | "direccion" | "mac" | "cuota" | "verifactu"`), sin tocar el orden ni la lógica. El aviso de Impuestos en `app/(panel)/layout.tsx` ya no depende del texto: usa `pasos.find(p => p.clave === "plazo" && p.nivel !== "info")`, y de ahí saca también el trimestre (del `href` del paso, `/impuestos/{año}/{t}`) para el `badge` (`<Badge type="onhold">{t}T</Badge>`) de la barra lateral; en móvil se mantiene el punto (`TabBarItem` no tiene `badge`, solo `dot`). Test nuevo `tests/libro.test.ts` con la `clave` de cada paso, incluyendo los casos del 23/11, el 28/11 (facturar) y el 29/01 (plazo del 4T anterior).
- **Barra lateral a todo el alto:** `sticky top-0 h-dvh overflow-y-auto` en el `className` de `SidebarNav`.
- **Pie de la barra lateral:** `footer` de `SidebarNav` con el enlace «Excel {año}» (`/api/exportar?anio=`, con el año de la URL actual o el año en curso) y «Jose» con la inicial en un círculo `brand-100`.
- **`aria-label` distintos:** «Secciones» en `SidebarNav` (escritorio) y «Secciones (móvil)» en `TabBar` (móvil), para que no choquen como referencia de accesibilidad.
- `themeColor` en `app/layout.tsx`: `#F8FAFC` (`gray-50` de Vela), en vez de `#f6f5f2`.

**Comprobaciones:**
- `npm test`: 83 tests, 11 ficheros, todos en verde (añadido `tests/libro.test.ts`).
- `npm run typecheck`: sin errores.
- `npm run build` en local con `GITHUB_PACKAGES_TOKEN` cargado: compila bien.
- Pendiente de Jose en el preview de Vercel a 1440 px: que la barra lateral llegue hasta abajo y quede fija al hacer scroll; que el clic central en «Ventas» la abra en otra pestaña; que «Abrir el bot» abra Telegram en otra pestaña; que Impuestos no muestre badge hoy (23/11, el 4T abre el 1 de enero).
