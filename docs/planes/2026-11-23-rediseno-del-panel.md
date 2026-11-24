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

## Regla técnica: Vela en páginas de servidor (desde Vela 0.4.1)

Vela es un paquete de **componentes de cliente** (`"use client"`). Las páginas de IVAn son de servidor y pueden pintarlos, pero **solo pasándoles datos** (texto, números, fechas, arrays, elementos JSX), **nunca funciones**.

- Una función que llega a un componente de Vela desde una página de servidor (`format` de `Waterfall`/`BarChart`, `onChange` de `SegmentedControl`, `onClose` de `Sheet`, `onDismiss` de `NoticeCard`, cualquier `onClick`…) **compila bien con `next build`**, pero la página da **error 500** al abrirse: «Functions cannot be passed directly to Client Components». Comprobado el 23/11/2026 con Next 16.4.6.
- Si hace falta una función, el componente de Vela va dentro de un componente propio de IVAn con `"use client"` (como `components/AnioDropdown.tsx` y `components/PanelNav.tsx`), y la página le pasa solo los datos. Ejemplos: `components/Cascada.tsx` (con el `format` de euros dentro), `components/AvisosInicio.tsx` (franja, drawer y ocultar la tarjeta) y `components/Periodo.tsx` (selector que cambia la URL).
- `cn` en código de servidor se importa desde `@glinglo/vela-ds/utils`.
- **Comprobación de cada fase, además de `next build`:** `next start` en local y `curl -s -o /dev/null -w "%{http_code}"` a cada página de la fase con una cookie de sesión válida (o comprobarlo en la vista previa). Todas tienen que dar `200`. Si una da `500`, mirar el registro: casi seguro es una función que cruza al cliente.

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

## Fase A.2 · Retoques tras la revisión visual (23/11/2026)

En la misma rama `plan/rediseno-a`, **antes de fusionar el PR #10**. **Depende de Vela 0.4.1** (planes `2026-11-23-vela-0-4-0.md` y `2026-11-23-vela-0-4-1.md` de `glinglo/vela-ds`): barra lateral con ancho propio y contraíble, y compatible con páginas de servidor. La 0.4.0 no sirve: rompe `next build`. Lo que vio Jose en la vista previa:

1. **La barra inferior móvil no está fija:** se coloca como una columna más, a la derecha del contenido.
   - Envolver la `TabBar` en un contenedor `fixed inset-x-0 bottom-0 z-40 lg:hidden`.
   - Al `<main>`, padding inferior para que la barra no tape el final: `pb-[calc(96px+env(safe-area-inset-bottom))]` en móvil y `lg:pb-10` en escritorio.
   - Comprobar a 390 px que la barra queda abajo y se ve el final de la página.
2. **Barra lateral con Vela 0.4.1:**
   - `npm install @glinglo/vela-ds@0.4.1`;
   - el ancho lo pone Vela: quitar cualquier ancho propio;
   - `collapsible`, con el estado guardado en la cookie `ivan_barra=contraida|expandida` (un año, `path=/`, `SameSite=Lax`);
   - el layout (servidor) lee la cookie con `cookies()` y pasa `defaultCollapsed`, para que no haya salto al cargar;
   - `onCollapsedChange` escribe la cookie;
   - `logoCollapsed` = la «I» de IVAn.
3. **«Abrir el bot»** pasa a ser un `SidebarNavItem` con `variant="primary"`, `href={BOT_URL}`, `target="_blank"` e icono `Send`. Así se contrae como los demás.
4. **Iconos como en el lienzo,** con `lucide-react` (el mismo set que usa Vela; añadirlo como dependencia con la misma versión mayor que Vela):

   | Sección | Icono |
   |---|---|
   | Inicio | `House` |
   | Ventas | `TrendingUp` |
   | Gastos | `Receipt` |
   | Impuestos | `Landmark` |
   | Bot | `Send` (avión de papel, Telegram; el de ahora parece un candado) |

   20 px en la barra inferior, 16 px en la lateral y 22 px en el botón central. Fuera los `path` dibujados a mano de `PanelNav.tsx`.
5. **Pie de la barra lateral:**
   - «Excel {año}» pasa a ser un `SidebarNavItem` con `href` e icono `Download` (hoy es un `<a>` sin estilo). Se adelanta desde la fase B.
   - El usuario pasa a `SidebarNavUser` con la inicial en un círculo `brand-100` / `brand-800`. Sin menú todavía: si `SidebarNavUser` solo existe como botón, usar una fila con el mismo aspecto que no sea interactiva y apuntarlo en las notas.

**Comprueba:**
- `npm test` y `npm run typecheck`.
- En la vista previa:
  - a 390 px, la barra fija abajo con el avión de papel en el centro y el contenido completo por encima;
  - a 1440 px, la barra de 240 px con los iconos nuevos;
  - el botón junto al logo la contrae a iconos, y al recargar la página sigue contraída;
  - contraída, al pasar el ratón por un icono sale su nombre;
  - «Excel 2026» con el mismo estilo que las secciones.

## Fase A.3 · Barra contraída uniforme, menú de usuario y Configuración (23/11/2026)

En la misma rama `plan/rediseno-a`, **antes de fusionar el PR #10**. **Depende de Vela 0.4.2** (`Menu`, `SidebarNavUser` con `menu` e `initials`, y elementos contraídos iguales).

1. **`npm install @glinglo/vela-ds@0.4.2`.**
2. **Menú de usuario** (decidido por Jose el 23/11/2026) con dos acciones:
   - «Configuración» → `/ajustes`, icono `Settings`;
   - «Cerrar sesión», icono `LogOut`, variante `danger`.

   Dónde va:
   - **Escritorio:** `<SidebarNavUser name="Jose" initials="J" menu={…} />` en el pie de la barra lateral.
   - **Móvil** (no hay barra lateral): un círculo de 36 px con la «J» (`brand-100` / `brand-800`), con `aria-label="Menú de cuenta"`, a la derecha de la cabecera de cada página, junto al selector de año (`lg:hidden`). Abre el mismo `Menu` con `placement="bottom-end"`.

   El selector de año y el menú se juntan en un componente de cliente, `components/AccionesCabecera.tsx`, que usan las páginas: así no cruza ninguna función desde el servidor. Los elementos del menú se definen en un solo sitio, `components/menuCuenta.tsx`.
3. **Cerrar sesión:**
   - `app/salir/route.ts` con **solo `POST`**: borra la cookie de sesión (mismo nombre, `path=/` y `maxAge: 0`) y responde `303` a `/sin-acceso?salida=1`;
   - en el menú, `onSelect` hace `fetch("/salir", { method: "POST" })` y después `location.assign("/sin-acceso?salida=1")`;
   - **no** usar `GET` para cerrar sesión: un enlace precargado podría cerrarla sin querer;
   - `app/sin-acceso/page.tsx`: si llega `salida=1`, el título es «Has cerrado sesión» y se mantiene el texto de cómo volver a entrar con `/panel`.
4. **Página `/ajustes` («Configuración»), solo lectura:** como todo el panel, no edita. Los cambios se siguen haciendo en el bot (`/ajustes …`).
   - `PageHeader` «Configuración», sin selector de año.
   - **«Tus datos»** (`ListGroup`): nombre, NIF, dirección, email y teléfono. El IBAN enmascarado: solo los 4 últimos dígitos, p. ej. `ES•• •••• •••• •••• •••• 1234`.
   - **«Facturas»:**
     - siguiente número (`serie` + `ultimo_numero + 1` con `digitos_numero`);
     - quién emite: «Selfconta, hasta el {fecha}; IVAn solo registra» si hay modo paralelo (`modoParalelo` de `lib/externas.ts`), o «IVAn».
   - **«Cuota de autónomo»:**
     - la cuota por defecto (`cuota_autonomo_mensual`), en euros;
     - cuántos meses hay registrados del año en curso (`cuotas_autonomo`).
   - **«Bienes que se amortizan»:** de `bienes_inversion`, uno por fila (descripción, fecha de compra, base y % anual), con la amortización anual calculada como en `lib/calculo.ts` (**reutilizar la función, no recalcular**).
   - **«Clientes»:** los activos, con país, tipo (UE sin IVA / nacional con IVA y retención) y `Badge` «falta dirección» si no la tienen.
   - Al final, `NoticeStrip` sin contador: «Para cambiar algo, díselo al bot: /ajustes» → abre el bot en otra pestaña.
   - **No mostrar `iva_compensar_inicial`:** los 755,53 € no aparecen hasta el plan del cierre del 4T.
   - Página protegida por el layout del panel (`exigirSesion`), como las demás.

**Comprueba:**
- `npm test`, `npm run typecheck`, `next build` y `next start` con cada página dando 200, incluida `/ajustes`.
- Con `curl -X POST` a `/salir`, la respuesta es `303` y trae `Set-Cookie` con la cookie de sesión caducada. Un `GET /salir` no cierra la sesión (405).
- En la vista previa:
  - con la barra contraída, «Abrir el bot», el activo y el hover son cuadrados iguales;
  - el menú del usuario se abre hacia arriba (expandida) o a la derecha (contraída) y se maneja con el teclado (flechas, Enter y Esc);
  - en móvil, la «J» de la cabecera abre el mismo menú;
  - «Cerrar sesión» lleva a «Has cerrado sesión», y volver atrás no deja ver el panel;
  - «Configuración» muestra los datos con el IBAN enmascarado.

## Fase A.4 · Botón del bot, tooltips y menú visible con la barra contraída (23/11/2026)

En la misma rama `plan/rediseno-a`, **antes de fusionar el PR #10**. **Depende de Vela 0.5.0** (capa flotante, `Tooltip`, `SidebarNav` con `action`).

Lo que vio Jose en la vista previa de la A.3:
- con la barra contraída, el menú del usuario no se ve, porque se abre por debajo y la barra lo recorta;
- faltan tooltips laterales;
- «Abrir el bot» va pegado a las secciones y parece un elemento más del menú.

1. **`npm install @glinglo/vela-ds@0.5.0`.**
2. **`components/PanelNav.tsx` (`NavEscritorio`):**
   - Quitar el `<SidebarNavItem variant="primary" …>Abrir el bot</SidebarNavItem>` de la lista.
   - Pasarlo como `action={{ label: "Abrir el bot", icon: <Send size={16} />, href: BOT_URL, target: "_blank" }}` en `SidebarNav`. Vela lo pinta como `Button` `primary`, separado de las secciones por un separador.
   - Las secciones, el «Excel {año}» y el usuario no cambian: los tooltips y el menú flotante los pone Vela.
   - Se puede quitar el `overflow-y-auto` de la barra si ya no hace falta. Si se deja, el menú y los tooltips tienen que verse igual, porque van en un portal.
3. **Móvil:** sin cambios. La `TabBar` ya tiene el bot como acción central.
4. **El CSS antiguo no debe pisar a Vela.** Jose vio en DevTools el `text-secondary` de los elementos de la barra tachado.
   - **La causa:** en Tailwind 4 las utilidades van en `@layer utilities`, y cualquier regla fuera de una capa les gana, sea cual sea su especificidad. `app/globals.css` tiene `a { color: inherit; text-decoration: none; }` fuera de capa, así que los enlaces de Vela heredan el color en vez de usar sus clases.
   - **El arreglo, en `app/globals.css`:**
     - Borrar la línea `a { color: inherit; text-decoration: none; }`. El reset de Tailwind ya lo hace, y dentro de su capa.
     - Meter todo el CSS antiguo que va después de los `@theme` (`*`, `body`, `h1`, `h2`, `code`, `.card`, `.paso`, `.chips`, `.nav`…) dentro de `@layer base { … }`. Los `@import`, `@source` y `@theme` se quedan fuera.
   - **Las páginas antiguas tienen que verse igual:** dentro de la misma capa, lo que va después sigue ganando al reset de Tailwind.

**Comprueba:**
- `npm test`, `npm run typecheck`, `next build` y `next start` con cada página dando 200.
- En `app/globals.css` no queda ninguna regla de estilo fuera de `@layer`, salvo los `@theme`/`@import`/`@source`.
- En la vista previa, con DevTools:
  - ninguna clase de Vela sale tachada en la barra, la cabecera, el menú ni Configuración;
  - el texto de las secciones no activas usa `--color-text-secondary`;
  - las páginas que aún no se han rediseñado (trimestre, 390) se ven como antes.
- En el HTML de `/` (servidor): «Abrir el bot» aparece una sola vez en la barra, como enlace con `target="_blank"`, y no hay ningún `role="tooltip"` ni `role="menu"`.
- En la vista previa, **con la barra contraída:**
  - el menú del usuario se ve entero a la derecha, con su borde de abajo alineado con la «J»;
  - al pasar el ratón por cada sección, por el botón del bot, por «Excel» y por la «J», sale un tooltip a la derecha con su nombre, sin el recuadro gris del navegador;
  - con Tab también salen;
  - el botón del bot es un cuadrado lila de 40 px, separado de las secciones por una línea.
- **Con la barra expandida:**
  - «Abrir el bot» es un botón lila a todo el ancho, separado de las secciones;
  - no hay tooltips;
  - el menú del usuario se abre hacia arriba.

## Fase B · Inicio = resultados y avisos

> **Revisada el 24/11/2026 contra el código de `wip/v0`** (después de fusionar las fases A–A.4). Rama `plan/rediseno-b`, creada desde `wip/v0`. Usa **Vela 0.5.0** (la que ya está instalada) y **no depende de la 0.6.0**, que se hace a la vez en el otro repo.

**Lo que no se toca en esta fase**, para no pisar la B.1 ni las fases C y D:
- `app/(panel)/layout.tsx`, `components/PanelNav.tsx` y `components/AccionesCabecera.tsx`;
- las páginas de Ventas, Gastos, Impuestos y Configuración;
- `lib/calculo.ts`.

### Datos

Funciones nuevas **puras** en un fichero nuevo, `lib/inicio.ts` (así no se mezclan con los pasos de `lib/libro.ts`), con sus tests en `tests/inicio.test.ts`. Usan `pyg` y `meses` de `lib/calculo.ts` **sin modificarlo**.

- **`seriesMensuales(libro, hasta)`:** un elemento por mes, desde enero hasta el mes de `hasta`: `{ mes: "YYYY-MM", ingresos, gastos, cuota, pendiente }`.
  - **Cómo calcularlo para que cuadre siempre con `pyg`:** cada mes es la diferencia entre dos acumulados, `pyg(libro.datos, finDeMes)` menos `pyg(libro.datos, finDelMesAnterior)` (en enero, lo de enero). Así se respetan los límites de restauración que aplica `pyg`, sin volver a calcularlos.
    - `ingresos` = diferencia de `ingresos`;
    - `gastos` = diferencia de `gastosFacturas`;
    - `cuota` = diferencia de `seguridadSocial`.
  - El último mes usa `hasta` en vez de fin de mes.
  - `pendiente: true` solo en el mes en curso (el de `hasta`, si el año es el actual) mientras no tenga ninguna factura.
- **`cascada(p)`**, con `p` el resultado de `pyg`: las filas para `Waterfall`.
  - Ingresos (`total`);
  - − gastos con factura, − cuota de autónomo, − amortización y − 5 % de difícil justificación (`minus`);
  - rendimiento neto (`result`).

  Etiquetas en español claro: «Ingresos», «Gastos con factura», «Cuota de autónomo», «Amortización», «Difícil justificación (5 %)», «Rendimiento neto». Si una fila es 0, se queda (con 0 €): así siempre se ve la misma estructura.
- **`salud(libro, p)`:** tres indicadores `{ clave, valor, estado: "bien" | "atencion" | "riesgo" }`, con los umbrales de «Decisiones»:
  - **margen** = rendimiento neto / ingresos: `bien` si ≥ 50 %, `atencion` si no;
  - **gastos sobre ventas** = gastos con factura / ingresos: `bien` si ≤ 20 %, `atencion` si no;
  - **dependencia** = base del cliente con más facturación / ingresos, en el mismo periodo que `p`: `riesgo` si ≥ 70 %, `bien` si no. Devuelve también el nombre del cliente.

  Con ingresos 0, los tres devuelven `valor: null` y `estado: "bien"`. Nada de dividir por cero.
- **`estadoYCuota(libro, hasta)`:**
  - cuota de autónomo pagada en el periodo (= `seguridadSocial` de `pyg`);
  - 130 pagado: suma por trimestre cerrado del importe real de `presentaciones` (modelo `130`); si falta, el calculado con `modelo130`, marcado `estimado: true`.

  No se pinta en esta fase: lo usará la pantalla «Impuestos y cuota» de la fase E. Se hace ahora con sus tests para que la E solo pinte.
- **`clasificarAvisos(pasos, hoy)`** devuelve `{ destacado: Paso | null, resto: Paso[] }`:
  - **`destacado`:** el primer paso con `nivel === "urgente"`. Si no hay ninguno y el día de `hoy` es **≥ 28**, el primer paso con `clave === "facturar"` o, si no hay, con `clave === "gastos"`.
  - **`resto`:** todos los demás, en el mismo orden. El destacado no se repite.
- **Texto del paso de facturar en modo paralelo:** si `modoParalelo(ajustes, hoy)` (`lib/externas.ts`), el paso `facturar` que genera `siguientesPasos` dice «Registrar la factura de {mes} de {cliente}», con el detalle «La emite Selfconta: mándale el PDF al bot». Es el único cambio en `lib/libro.ts`, con su test en `tests/libro.test.ts`.

### Periodo

- Parámetro de URL **`periodo`**: `anio` (por defecto) | `1` | `2` | `3` | `4`. Convive con `?anio=`.
- **`hasta` según el periodo:**
  - `anio` → hoy si el año es el actual, o el 31/12 si está cerrado;
  - trimestre `t` → el último día de ese trimestre, o hoy si el trimestre está en curso.

  Es **acumulado desde enero**, como el 130. Los trimestres futuros del año actual salen desactivados en el control.
- El subtítulo lo dice:
  - «Tus resultados de {año}, hasta hoy»;
  - «Tus resultados de {año} (año cerrado)»;
  - «Acumulado hasta el 30/09».

### Componentes de cliente nuevos

Por la regla técnica de arriba: ninguna función cruza desde la página.
- **`components/Periodo.tsx`:** `SegmentedControl` (Año · 1T · 2T · 3T · 4T). Su `onChange` cambia `?periodo=` con `router.push` y mantiene `?anio=`. Recibe `{ valor, anio, disponibles }`.
- **`components/Cascada.tsx`:** `Waterfall` con el `format` de euros dentro, sin céntimos (`euros(n).replace(/,\d\d €/, " €")`, como hoy). Recibe las filas.
- **`components/Barras.tsx`:** `BarChart` con dos series:
  - «Ingresos» en `var(--color-chart-primary)`;
  - «Gastos» = gastos con factura + cuota, en `var(--color-chart-muted)`.

  `pending` en el mes pendiente y etiquetas de mes cortas («ene», «feb»…). Recibe la serie. Comprueba los nombres exactos de los tokens de gráfico en `theme.css` de Vela antes de usarlos.
- **`components/AvisosInicio.tsx`**, que recibe `{ destacado, resto, ocultoHoy }`:
  - **Tarjeta grande:** si hay `destacado` y `!ocultoHoy`, `NoticeCard`:
    - variante `urgent` si su nivel es `urgente`, `pending` si viene por el día 28, `brand` en otro caso;
    - `action` con su `href`, o «Abrir el bot» (`https://t.me/Ivanelgestorbot`) si no tiene;
    - `onDismiss` escribe la cookie `ivan_aviso_oculto={clave}:{hoy}` (`path=/`, un día, `SameSite=Lax`) y la oculta.

    **Cookie y no `localStorage`:** la página la lee en el servidor y no pinta la tarjeta, así no aparece y desaparece al cargar. Es el mismo patrón que la barra contraída. Al día siguiente la fecha ya no coincide y vuelve a salir.
  - **Franja:** si `resto.length > 0`, `NoticeStrip` con `count={resto.length}`, título «{n} cosas por hacer» («1 cosa por hacer» si es una) y subtítulo «La próxima: {texto del primero}». Al pulsarla abre un `Sheet` «Por hacer» con todos los pasos de `resto`:
    - título y detalle;
    - `Badge` según el nivel: `urgente` → «Urgente», `pendiente` → «Pendiente», `info` → sin badge;
    - la acción: `Button` `secondary` `size="sm"` con el `href` del paso, o «Abrir el bot» si no tiene.
  - **Si `resto` está vacío y no hay destacado:** una línea de texto «Todo al día» con `text-tertiary`, sin franja ni drawer. **No usar `NoticeStrip` con `count={0}`**: la franja sin número llega con Vela 0.6.0, en la fase B.1.

### Pantalla `/`

Reescribir `app/(panel)/page.tsx`. Sigue siendo de servidor y solo pasa datos.

**Móvil**, de arriba abajo:
1. `PageHeader` «Hola, Jose», con el subtítulo del periodo y `actions={<AccionesCabecera anio anioActual />}`, igual que ahora.
2. `AvisosInicio`.
3. `Periodo`.
4. **Tarjeta «Rendimiento neto»:**
   - la cifra en `text-display`;
   - el `Badge` del margen («Margen 70 %», `success` si `bien`, `onhold` si `atencion`);
   - debajo, «≈ X € al mes» (rendimiento / meses transcurridos del periodo, sin céntimos).
5. **Tarjeta «De lo facturado al rendimiento»:** `Cascada`.
6. **Tarjeta «Ingresos y gastos por mes»:** `Barras`, con la nota «El 5 % y la amortización se calculan sobre el año».
7. **«Más detalle»:** `ListGroup` con los destinos que **ya existen**:
   - «Impuestos» → `/impuestos` (con `?anio=`);
   - «En qué se van los gastos» → `/gastos` (con `?anio=`).

   «Salud del negocio», «Impuestos y cuota» y «Cómo se calcula» se añaden en la fase E, cuando existan sus páginas. **Nada de enlaces a páginas que aún dan 404.**

**Las tarjetas:** `Card` de Vela (no tiene prop de título), con el título dentro como `<h2 className="text-eyebrow text-tertiary">`, el estilo por defecto de los títulos de tarjeta. Sin el CSS antiguo (`.card`, `.kpis`, `.filas`) en esta página.

**Escritorio (`lg`)**, en filas con `flex-wrap` y `gap` de Vela:
- aviso (tarjeta o franja) a todo el ancho;
- rendimiento (1/3) + cascada (2/3);
- barras (2/3) + «Más detalle» (1/3).

**Se quita de Inicio:** los tres KPI antiguos, «Siguientes pasos» (ahora es el aviso), «Pérdidas y ganancias» (ahora es la cascada) y «Trimestres» (están en Impuestos). Si `components/Filas.tsx` deja de usarse en todo el panel, **no lo borres**: eso es de la fase E.

### Comprueba

- **`npm test`**, con los tests nuevos de `tests/inicio.test.ts`:
  - **`seriesMensuales`:** la suma de los 12 meses es igual al `pyg` del 31/12 en ingresos, gastos con factura y cuota, al céntimo, con los datos de prueba de `tests/calculo.test.ts`. Y lo mismo hasta una fecha a mitad de mes.
  - **`cascada`:** el último valor es el `rendimientoNeto` de `pyg`.
  - **`salud`:** los tres umbrales justo en el límite (50 %, 20 %, 70 %) y con ingresos 0.
  - **`clasificarAvisos`** con fechas fijas:
    - 24/11 sin urgentes → `destacado` null;
    - 28/11 con paso `facturar` → destacado;
    - 28/11 con `gastos` y sin `facturar` → destacado el de gastos;
    - 29/01 con un plazo urgente → destacado el urgente.
  - **`estadoYCuota`:** con y sin el importe real del 130.
- **`npm run typecheck`, `next build` y `next start`:**
  - `curl` con cookie de sesión a `/`, `/?periodo=3`, `/?anio=2025` y `/?anio=2025&periodo=4`: todas dan 200;
  - el resto de páginas del panel también.
- **Con los datos reales a hoy:** el rendimiento neto de `/` es el mismo que daba la página antigua y que da `pyg` (en torno a 20.600 €, y sale de `pyg`, no se escribe). Apunta la cifra en las notas.
- **Vista previa** (Jose):
  - sin cosas urgentes y antes del día 28, se ve la franja y no la tarjeta grande;
  - la franja abre el drawer con todos los pasos;
  - al cambiar de periodo, cambian la cifra, la cascada y el subtítulo;
  - en escritorio, las tres filas.

### Notas de ejecución (Claude Code, 24/11/2026)

- `lib/inicio.ts` y `tests/inicio.test.ts` hechos tal cual el plan: `seriesMensuales`, `cascada`, `salud`, `estadoYCuota` y `clasificarAvisos`, con `pyg` y `meses` de `lib/calculo.ts` sin tocarlo. `npm test` pasa (12 ficheros, 96 tests con los nuevos).
- `estadoYCuota`: "por trimestre cerrado" se interpretó como los trimestres cuyo `rangoTrimestre(...).hasta <= hasta`; el trimestre en curso no entra en la suma. No se pinta en esta fase (queda para la pantalla «Impuestos y cuota» de la fase E), como dice el plan.
- Texto de `facturar` en modo paralelo: añadido en `lib/libro.ts` con `modoParalelo` de `lib/externas.ts` y `nombreMes` de `lib/fiscal.ts`, con su test en `tests/libro.test.ts`.
- **Desviación del plan, apuntada como pide la regla de trabajo:** `SegmentedControlOption` de Vela 0.5.0 no tiene campo para deshabilitar una opción (solo `label`/`value`), así que «los trimestres futuros del año actual salen desactivados en el control» se implementó quitándolos de la lista en vez de mostrarlos deshabilitados. `components/Periodo.tsx` filtra `disponibles` del lado del servidor (calculado en la página con el trimestre de hoy). Si Jose prefiere verlos deshabilitados en gris, hace falta en Vela una prop `disabled` por opción (fuera del alcance de esta fase).
- Badges de `AvisosInicio` (franja → Sheet «Por hacer»): como el plan no fija qué `BadgeType` usar para «Urgente»/«Pendiente», se eligió `destructive` para urgente y `onhold` (el mismo que ya usa el badge de trimestre en la barra lateral) para pendiente.
- `NoticeCard` `action`: cuando el paso no tiene `href` propio, se usa el bot (`https://t.me/Ivanelgestorbot`) con la etiqueta «Abrir el bot»; con `href` propio la etiqueta es «Ver» (el tipo `action` de `NoticeCard` en 0.5.0 no admite `target`, así que no se puede abrir en otra pestaña — solo aplica al enlace del bot, que de todas formas es interno al panel salvo cuando no hay `href`).
- `app/(panel)/layout.tsx`, `components/PanelNav.tsx`, `components/AccionesCabecera.tsx`, las páginas de Ventas/Gastos/Impuestos/Configuración y `lib/calculo.ts` no se han tocado, tal como pide esta fase.
- Comprobado: `npm test`, `npm run typecheck`, `next build` y `next start` (puerto 3177, el 3100/3101 estaban ocupados en esta máquina) con `curl` y cookie de sesión real: `/`, `/?periodo=3`, `/?anio=2025`, `/?anio=2025&periodo=4`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos/2026/4`, `/impuestos/2026/390` y `/ajustes` dan todas `200`.
- **Cifra real a hoy (24/11/2026):** rendimiento neto de `/` = **20.572,12 €**, igual que el que da `pyg(libro.datos, hoy)` (no escrito a mano). Está en el entorno de los ~20.600 € que estimaba el plan.
- Sin vista previa de Vercel disponible en esta sesión (sin acceso al navegador): la comprobación visual de la franja/tarjeta, el drawer «Por hacer», la cascada y las barras con los tokens de marca queda pendiente de que Jose la revise en el despliegue de la rama.

### Correcciones de la revisión (Claude Code, 24/11/2026)

- **Tarjeta y franja a la vez:** `avisosVisibles({ destacado, resto, oculto })` nueva en `lib/inicio.ts` (con tests en `tests/inicio.test.ts`, incluido el caso del 28/11 con tarjeta y franja juntas). `components/AvisosInicio.tsx` ya no sale de la función al pintar la tarjeta: calcula `tarjeta`/`franja` con la misma regla (destacado visible → franja = resto; destacado oculto → franja = [destacado, ...resto]) y pinta ambas piezas en el mismo fragmento. «Todo al día» solo cuando no hay tarjeta y la franja está vacía.
- **Ancho de escritorio:** añadido `lg:max-w-5xl` a la clase del `<main>` en `app/(panel)/layout.tsx`, como único cambio de esta fase en el layout.
- **Tarjetas siempre en columna en móvil:** las 4 `Card` de `app/(panel)/page.tsx` llevan `basis-full` además de su `lg:basis-…`.
- **`?periodo=` futuro:** en `app/(panel)/page.tsx`, cuando `anio === anioActual` y el trimestre pedido no está en curso, `hasta` se limita a `min(rangoTrimestre(anio, periodo).hasta, hoy)` (comparación de cadenas ISO).
- Comprobado: `npm test` (100 tests, con los 3 casos nuevos de `avisosVisibles` y el del 28/11), `npm run typecheck`, `next build` y `next start` (puerto 3100) con `curl` y una cookie de sesión generada con `crearToken("sesion")`: `/`, `/?periodo=3`, `/?anio=2025`, `/?anio=2025&periodo=4`, `/?periodo=4`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos/2026/4`, `/impuestos/2026/390` y `/ajustes` dan todas `200`.
- Sin vista previa de Vercel en esta sesión: la comprobación visual (filas de escritorio a 1440 px, columna única a 390 px) queda pendiente de que Jose la revise en el despliegue de la rama.

### Correcciones de la revisión (Claude, 24/11/2026)

Se hacen en la misma rama `plan/rediseno-b`, **antes de fusionar el PR #11**. Siguen con Vela 0.5.0.

1. **La tarjeta grande no debe esconder la franja.**
   - **El fallo:** hoy `AvisosInicio` devuelve solo la `NoticeCard` cuando hay destacado. Del día 28 en adelante, o con un plazo urgente, el resto de cosas por hacer desaparece de Inicio.
   - **El arreglo:**
     - **Tarjeta:** se pinta si hay `destacado` y no está oculto.
     - **Franja:** se pinta debajo si la lista para la franja no está vacía. La lista es `resto`, más el `destacado` al principio si el usuario lo ha ocultado. Ocultar la tarjeta no borra la tarea: pasa a la franja y al drawer.
     - **«Todo al día»:** solo si no hay destacado y `resto` está vacío.
   - **Tests:** añadir a `tests/inicio.test.ts`, o en una función pura nueva `avisosVisibles({ destacado, resto, oculto })` en `lib/inicio.ts`, los casos:
     - destacado visible con resto → tarjeta y franja con el resto;
     - destacado oculto → sin tarjeta y franja con el destacado primero;
     - sin nada → «Todo al día».
2. **El escritorio está limitado a 560 px.**
   - **El fallo:** el `main` lleva la clase antigua `.app` (`max-width: 560px`), así que en escritorio la fila «rendimiento (1/3) + cascada (2/3)» deja la tarjeta del rendimiento en unos 180 px.
   - **El arreglo:** en `app/(panel)/layout.tsx`, añadir `lg:max-w-5xl` (1024 px) a la `className` del `main`. Es el **único** cambio permitido en el layout en esta fase. Las utilidades ganan a `.app` desde la fase A.4. Las páginas aún sin rediseñar se verán más anchas en escritorio: es aceptable hasta las fases C y D.
3. **En móvil, las tarjetas tienen que ir siempre una debajo de otra.**
   - **El fallo:** con `flex-wrap` y sin `basis`, en anchos intermedios (una tablet, por ejemplo) dos tarjetas estrechas pueden quedar lado a lado.
   - **El arreglo:** las cuatro `Card` de Inicio llevan `basis-full` y su `lg:basis-…` actual.
4. **Un `?periodo=` futuro.** Si llega por URL un trimestre que aún no ha empezado (p. ej. `?periodo=4` en septiembre), `hasta` no puede pasar de hoy: limitarlo con `min(hasta, hoy)` cuando el año es el actual.

**Comprueba:**
- `npm test` con los casos nuevos, `npm run typecheck`, `next build` y `next start` con todas las páginas en 200 (incluida `/?periodo=4` en el año actual).
- Con un `hoy` simulado al 28/11 en un test: tarjeta y franja a la vez.
- **Vista previa:**
  - a 1440 px, las filas de escritorio con la tarjeta del rendimiento a un tercio de ~1.000 px;
  - a 390 px, todo en una columna.

## Fase B.1 · Estructura con Vela 0.6.0 (24/11/2026)

**Empieza solo cuando se cumplan las dos cosas:**
- Vela 0.6.0 está publicada;
- la fase B está fusionada en `wip/v0`.

Va en una rama nueva, `plan/rediseno-b1`, desde `wip/v0`. Así no choca con la B, porque las dos tocan Inicio.

1. **`npm install @glinglo/vela-ds@0.6.0`.**
2. **`app/(panel)/layout.tsx`:**
   - sustituir el `div` con `display: flex` y el `main` con márgenes a mano por `AppShell`;
   - `sidebar={<Suspense fallback={null}><NavEscritorio …/></Suspense>}`;
   - `tabBar={<Suspense fallback={null}><NavMovil …/></Suspense>}`;
   - `mainClassName="app lg:max-w-5xl"` (el ancho de escritorio de las correcciones de la fase B).

   Se mantienen la sesión, la cookie de la barra y el aviso del trimestre tal cual.
3. **`components/PanelNav.tsx`:**
   - quitar de `NavEscritorio` el `className="hidden lg:flex sticky top-0 h-dvh"`;
   - quitar de `NavMovil` el `div` `fixed inset-x-0 bottom-0 z-40 lg:hidden`.

   Todo eso lo hace ya `AppShell`.
4. **`components/AccionesCabecera.tsx`:** el botón con estilos en línea pasa a ser `<AvatarButton size="md" aria-label="Menú de cuenta" className="lg:hidden"><Avatar initials="J" size="md" /></AvatarButton>` como disparador del `Menu`. En Vela 0.6.0, `AvatarButton` recibe el `Avatar` como hijo.
5. **`NoticeCard` del bot en otra pestaña:** si Vela 0.6.0 trae `action.target`, el aviso sin `href` propio abre el bot con `target: "_blank"`.
6. **Configuración (`app/(panel)/ajustes/page.tsx`):** el pie pasa del `<section className="card"><a>…` a `NoticeStrip` **sin `count`** («Para cambiar algo, díselo al bot» · «/ajustes») con `href` al bot.

   `NoticeStrip` con `href` no lleva función, así que vale en una página de servidor. Si necesita `target="_blank"` y la franja no lo admite, para y apúntalo.
7. **Inicio, «Todo al día»:** la línea de texto de `AvisosInicio` pasa a `NoticeStrip` sin `count`, sin `href` ni `onClick`.

**Comprueba:**
- `npm test`, `npm run typecheck`, `next build` y `next start` con todas las páginas en 200.
- En el HTML de `/`: un solo `<main>`; ningún `style="display:flex"` ni `fixed inset-x-0` escritos en IVAn.
- En la vista previa:
  - en móvil (390 px), el final de cada página no queda tapado por las pestañas, y la «J» se ve igual y abre el menú;
  - en escritorio, la barra sigue fija al hacer scroll y se contrae como antes;
  - el pie de Configuración es una franja.

### Notas de ejecución (Claude Code, 24/11/2026)

- `@glinglo/vela-ds@0.6.0` instalado. Comprobados antes de tocar código: `AppShell` (`sidebar`, `tabBar`, `mainClassName`), `AvatarButton`/`Avatar`, `NoticeCard.action.target` y `NoticeStrip` con `count` opcional, tal como describe el plan.
- `app/(panel)/layout.tsx`: el `div style={{ display: "flex" }}` y el `main` con estilos a mano se sustituyen por `AppShell`, con `sidebar`/`tabBar` en `Suspense` igual que antes y `mainClassName="app lg:max-w-5xl"`. Sesión, cookie de la barra y aviso del trimestre sin tocar.
- `components/PanelNav.tsx`: quitado `className="hidden lg:flex sticky top-0 h-dvh"` de `NavEscritorio` y el `<div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">` que envolvía `NavMovil`; lo pone ya `AppShell`.
- `components/AccionesCabecera.tsx`: el botón con estilos en línea pasa a `<AvatarButton size="md" aria-label="Menú de cuenta" className="lg:hidden"><Avatar initials="J" size="md" /></AvatarButton>` como disparador del `Menu`, como pide el punto 4.
- `NoticeCard` del bot en otra pestaña: `AvisosInicio.tsx` usa `action.target: "_blank"` cuando el paso no tiene `href` propio (Vela 0.6.0 ya lo admite).
- `app/(panel)/ajustes/page.tsx`: el pie pasa de `<section className="card"><a>…</a></section>` a `<NoticeStrip title="Para cambiar algo, díselo al bot" subtitle="/ajustes" href={BOT_URL} />`, sin `count`.
  - **Desviación apuntada:** `NoticeStrip` (tipo `NoticeStripProps` de Vela 0.6.0) no tiene prop `target`, solo `href`. El plan ya preveía este caso («si necesita `target="_blank"` y la franja no lo admite, para y apúntalo»): se deja sin `target`, así que el enlace al bot en Configuración abre en la misma pestaña (antes abría en otra con `target="_blank"` en el `<a>`). Falta en Vela una prop `target` en `NoticeStrip` para igualarlo al resto del panel.
- Además de lo pedido en el plan, encargado también por Jose en el mismo encargo: `components/AvisosInicio.tsx` ya no repite la lógica de qué se pinta (tarjeta/franja): usa `avisosVisibles` de `lib/inicio.ts` (ya existía, de las correcciones de la fase B) en vez de calcularlo en línea. Y en el `action` de la tarjeta grande, cuando abre el bot (sin `href` propio), lleva `target: "_blank"`.
- «Todo al día» (punto 7) pasa de `<p className="text-tertiary">Todo al día</p>` a `<NoticeStrip title="Todo al día" />`, sin `count`, `href` ni `onClick`.
- Comprobado: `npm test` (100 tests, sin cambios porque esta fase no tocaba `lib/`), `npm run typecheck`, `next build` y `next start` (puerto 3177) con `curl` y una cookie de sesión generada con `crearToken("sesion")`: `/`, `/?periodo=3`, `/?anio=2025`, `/?anio=2025&periodo=4`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos/2026/4`, `/impuestos/2026/390` y `/ajustes` dan todas `200`.
- En el HTML de `/`: un solo `<main>`; sin `style="display:flex"` escrito en IVAn. El único `fixed inset-x-0` que aparece es el que pinta el propio `AppShell` de Vela para la `TabBar` (confirmado en `node_modules/@glinglo/vela-ds/dist/index.js`), no código de IVAn.
- Sin vista previa de Vercel en esta sesión: la comprobación visual (que la «J» siga igual y abra el menú en móvil, que la barra siga fija y se contraiga en escritorio) queda pendiente de que Jose la revise en el despliegue de la rama.

## Fase B.2 · Inicio v2: bloque «Resultados» y «Por hacer» en tarjetas (24/11/2026)

**Diseño aprobado por Jose el 24/11/2026** en el lienzo, fila «Propuesta 24/11 · Inicio v2»: `InicioEscritorio2` e `InicioMovil2`.

**Empieza solo cuando se cumplan las dos cosas:**
- la fase B.1 está fusionada en `wip/v0`;
- Vela 0.7.0 está publicada.

Rama nueva, `plan/rediseno-b2`, desde `wip/v0`. No se toca `lib/calculo.ts`.

1. **`npm install @glinglo/vela-ds@0.7.0`.**
2. **Cabecera de Inicio:** sin cambios de contenido. El avatar ya solo sale en móvil desde la B.1.
   - **En escritorio**, el selector de año es lo único a la derecha.
   - **En móvil**, el `Dropdown` del año va de ancho natural (`w-auto`), no a media cabecera. Si el `Dropdown` de Vela no lo permite con `className`, para y apúntalo.
3. **Separación y franja:** 24 px entre la cabecera y lo siguiente (`gap-6` en el contenedor de Inicio). La franja ya trae el relleno nuevo con Vela 0.7.0.
4. **Bloque «Resultados»:** una sola `Card` (relleno `p-4 lg:p-6`, `gap-5`) que sustituye a las tarjetas sueltas de rendimiento, cascada y barras:
   - **Cabecera:** `CardHeader` con el título «Resultados» y el subtítulo del periodo («Acumulado de enero a hoy», «Acumulado de enero al 30/09» o «Año 2025 completo»). En `actions` va `Periodo`, en escritorio.
     - **El selector:** `SegmentedControl variant="contrast"`, con `fullWidth={false}` en escritorio y `true` en móvil.
     - **En móvil** el selector va debajo del título, a todo el ancho. `Periodo` recibe una prop o se pinta dos veces con `lg:hidden` / `hidden lg:block`, lo que quede más limpio.
     - **Los trimestres futuros** salen **desactivados** (`disabled`), no ocultos. Así se cumple el plan original de la fase B.
     - **El subtítulo de la página** (`PageHeader`) pasa a «Tus resultados de {año}» a secas, porque el detalle del periodo ya va en el bloque.
   - **Separador** (`h-px bg-separator`).
   - **Rendimiento y cascada:** en escritorio, dos columnas (`lg:flex-row`, rendimiento ~1/3 y cascada ~2/3) con una línea vertical entre ellas. En móvil, una debajo de la otra, con un separador horizontal.
     - **Rendimiento:**
       - eyebrow «Rendimiento neto» (`h3`);
       - la cifra en `text-display`;
       - debajo, en `text-caption`, «Antes del IRPF de la Renta»;
       - el `Badge` del margen **a su tamaño** (`self-start`);
       - la frase «De cada 100 € que facturas, te quedan {margen}.» en `text-body`;
       - «≈ X € al mes de media» en `text-caption`.
     - **Cascada:** eyebrow «De lo facturado al rendimiento» y `Cascada`. Etiquetas largas en escritorio y cortas en móvil:
       - «Cuota de autónomo»;
       - «5 % difícil justificación» (corta: «5 % difícil justif.»).

       Las etiquetas cortas salen de `cascada()` con un parámetro, o de un mapa en `Cascada.tsx`. El `Waterfall` de la 0.7.0 ya no corta.
   - **Separador.**
   - **Barras:**
     - eyebrow «Ingresos y gastos por mes», con un botón de información (`aria-label="Cómo se calcula"`) que muestra en un `Tooltip` «Gastos = facturas + cuota. El 5 % y la amortización se calculan sobre el año.»;
     - la leyenda de Vela («Ingresos» y «Gastos y cuota»);
     - `formatValue` de euros y `pendingLabel="sin facturar"`;
     - **Con un trimestre elegido**, `highlight` con los índices de sus tres meses: el trimestre en lila y los anteriores apagados. Con «Año», sin `highlight`.
     - **Solo en móvil, la fila de detalle:** al tocar un mes (`onSelect`), debajo del gráfico sale «{Mes} · Ingresos X € · Gastos Y €». Por defecto, el último mes con datos. En escritorio, el tooltip de Vela.
     - **Nota en `text-caption`:** «{Mes} aún sin facturar.» si hay mes pendiente, más «Toca un mes para ver sus cifras.» en móvil o «Pasa el ratón por un mes para ver sus cifras.» en escritorio.
5. **Escritorio: dos columnas.**
   - **Ancho:** el `main` pasa de `lg:max-w-5xl` a `lg:max-w-7xl` (1280 px), en `mainClassName` del `AppShell`.
   - **Contenido de Inicio:** `lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start`.
     - **Izquierda:** el bloque «Resultados».
     - **Derecha:** un `aside` con `aria-label="Por hacer y más detalle"`, `lg:sticky lg:top-8` y `flex flex-col gap-4`.
   - **«Por hacer» en tarjetas**, solo en escritorio (`hidden lg:flex`):
     - **La primera tarea:** `NoticeCard` grande, y la variante sale de su nivel: `urgente` → `urgent`, `pendiente` → `pending`, `info` → `brand`.
       - eyebrow «Por hacer · 1 de N · {estado}»;
       - título y detalle;
       - la acción con su `href`, o «Abrir el bot» con `target: "_blank"`;
       - la X para ocultarla, con la misma cookie de la fase B.
     - **El resto:** `NoticeCard size="sm"`, cada una con su color de nivel, eyebrow «{i} de N · {cuándo}», título, detalle y enlace (su `href`, o el bot con `target: "_blank"`).
     - **Si se oculta la primera,** pasa a ser una compacta más al principio, igual que en móvil.
     - **Sin tareas:** una `NoticeCard size="sm"` `brand` «Todo al día», sin enlace. Si Vela la exige con `href`, una línea de texto `text-tertiary`.
   - **En móvil,** `AvisosInicio` sigue igual: franja y drawer, o tarjeta grande si es urgente o desde el día 28. Se oculta en escritorio con `lg:hidden`.
   - **«Más detalle»**, en la columna derecha en escritorio y al final en móvil, con una línea de pista en cada fila:
     - **«Impuestos»:** «{N}T pendiente · del {apertura} al {fin}» si hay un plazo sin presentar, o «Todo presentado».
     - **«En qué se van los gastos»:** «{gastos con factura} € este año».

     Los datos salen de lo que ya calcula la página. No se inventa nada: si un dato no está, la fila va sin pista.
6. **Textos de las tareas** (`lib/libro.ts`, con sus tests):
   - **El plazo sin abrir** pasa de «Próximo trimestral: 4T 2026» a:
     - texto «Presentar el 4T de 2026»;
     - detalle «Del 01/01 al 30/01».
   - **El plazo abierto** queda igual.
   - **Nuevo campo opcional `dias?: number` en `Paso`:** los días hasta el inicio del plazo (sin abrir) o hasta el final (abierto). Sirve para «En 38 días» o «Quedan 6 días» en el eyebrow y en el badge del drawer, en vez de deducirlo del texto.
   - **«N gasto(s) sin confirmar»** pasa a «1 gasto sin confirmar» o «N gastos sin confirmar», con su plural bien puesto.
7. **Carga al cambiar de periodo** (y de año): `Periodo` usa `useTransition`. Mientras `isPending`, el bloque «Resultados» va con `opacity-60` y `aria-busy="true"`. Como el bloque es de servidor, el estado se comparte con un componente de cliente pequeño (`components/BloqueResultados.tsx`) que envuelve el contenido y recibe `isPending` por contexto desde `Periodo`. Si se complica, basta con atenuar el propio selector y apuntarlo.

**Comprueba:**
- `npm test` (incluidos los textos nuevos de `siguientesPasos` y `dias`), `npm run typecheck`, `next build` y `next start` con todas las páginas en 200: `/`, `/?periodo=3`, `/?anio=2025` y `/?anio=2025&periodo=4`.
- En el HTML de `/`: un solo `h1`; «Resultados» como `h2`; ningún `role="tooltip"`.
- **Vista previa**, comparando con el lienzo:
  - **a 1440 px:** dos columnas; «Por hacer» en tarjetas fija al bajar; el selector a la derecha del título del bloque; al pasar el ratón por un mes, el tooltip con sus cifras; con 3T, los meses de julio a septiembre destacados;
  - **a 390 px:** la franja con aire; el bloque «Resultados» con el selector a todo el ancho; al tocar un mes, la fila de detalle; sin avatar en escritorio ni columna derecha en móvil;
  - **al cambiar de periodo,** el bloque se atenúa mientras carga.

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-b2`)

- `@glinglo/vela-ds@0.7.0` instalado. Comprobado antes de tocar código: `NoticeStrip` ya admite `target` (resuelve la desviación apuntada en la B.1); `Dropdown` admite `className`; `SegmentedControl` admite `disabled` por opción; `CardHeader`, `BarChart` (`highlight`, `selectedIndex`, `onSelect`, `formatValue`, `pendingLabel`, `legend`), `Waterfall` y `Tooltip` tal como describe el plan.
- **Cabecera (punto 2):** sin cambios de contenido; el `Dropdown` del año lleva `className="w-auto"` en `AccionesCabecera.tsx`.
- **Bloque «Resultados» (punto 4):** nueva `Card` única en `app/(panel)/page.tsx` con `CardHeader` («Resultados» + subtítulo del periodo), `Periodo` en `actions` en escritorio y debajo del título a todo el ancho en móvil (dos renders con `lg:hidden`/`hidden lg:block`, como sugería el plan). `Periodo` (`components/Periodo.tsx`) pasa a `variant="contrast"` y a trimestres futuros `disabled` en vez de ocultos.
- **Etiquetas cortas de la cascada:** `FilaCascada` (`lib/inicio.ts`) gana `labelCorta`; `components/Cascada.tsx` pinta dos `Waterfall` (uno con `label`, otro con `labelCorta`) y los alterna con `hidden lg:block` / `lg:hidden`, igual que `Periodo`.
- **Barras (`components/Barras.tsx`):** ahora de cliente, con el botón de información (`Tooltip` de Vela), `legend`, `formatValue`, `pendingLabel="sin facturar"`, `highlight` (recibido desde la página según el trimestre elegido) y `selectedIndex`/`onSelect`. En móvil pinta la fila de detalle del mes tocado (por defecto, el último con datos) y la nota de «sin facturar»/cómo verlo cambia entre móvil y escritorio.
- **Dos columnas en escritorio (punto 5):** `mainClassName` del `AppShell` (`app/(panel)/layout.tsx`) pasa a `lg:max-w-7xl`, para todo el panel (el plan lo pide en el `AppShell`, compartido por las demás páginas; no se ha tocado el contenido de Ventas, Gastos e Impuestos, que siguen con su propio ancho).
- **«Por hacer» en tarjetas:** nuevo `components/PorHacerEscritorio.tsx` (cliente), con la misma cookie `ivan_aviso_oculto` que `AvisosInicio.tsx`. La tarea destacada usa `NoticeCard` grande con `onDismiss`; el resto, `size="sm"`. `AvisosInicio` se oculta en escritorio con `lg:hidden` (antes solo existía en móvil).
- **Textos de las tareas (punto 6, `lib/libro.ts`):** el plazo sin abrir pasa a «Presentar el {t}T de {año}» / «Del {dd/mm} al {dd/mm}»; nuevo campo `dias?: number` en `Paso` (días hasta la apertura o hasta el fin); nueva función `cuandoPaso()` para el eyebrow de las tarjetas («En N días» / «Quedan N días»); «N gasto(s) sin confirmar» con el plural bien puesto.
- **Carga con `useTransition` (punto 7):** `components/BloqueResultados.tsx` (cliente) envuelve el bloque «Resultados» y expone un contexto (`useResultadosTransition`) con `isPending`/`startTransition`; `Periodo` lo consume para envolver su `router.push`. Con `isPending`, el bloque lleva `opacity-60` y `aria-busy="true"`.
- **Desviación apuntada:** el plan pide que la primera tarjeta de «Por hacer» en escritorio lleve la X para ocultarla; `NoticeCard size="sm"` (las compactas) no admite `onDismiss` en Vela 0.7.0, así que solo la tarjeta grande se puede ocultar, igual que en móvil.
- **Desviación apuntada:** sin tareas, el plan prevé una `NoticeCard size="sm"` «Todo al día» y, si Vela la exige con `href`, una línea de texto. Como `size="sm"` exige `href` siempre (tipo `NoticeCardSmProps`), se usa directamente la línea de texto `text-tertiary`, sin enlace.
- **Comprobado:** `npm test` (100 tests, sin ningún test roto por los textos nuevos de `siguientesPasos`), `npm run typecheck`, `next build` y `next start` (puerto 3178) con `curl` y una cookie de sesión generada con `crearToken("sesion")`: `/`, `/?periodo=3`, `/?anio=2025`, `/?anio=2025&periodo=4`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos/2026/4` y `/ajustes` dan todas `200`. En el HTML de `/`: un solo `<h1>`, «Resultados» como `<h2>` y ningún `role="tooltip"`.
- **Punto 6 de Configuración, de paso:** con Vela 0.7.0, `NoticeStrip` ya admite `target`; se añade `target="_blank"` al enlace al bot en `app/(panel)/ajustes/page.tsx`, cerrando la desviación apuntada en la B.1.
- Sin vista previa de Vercel en esta sesión: queda pendiente de que Jose revise visualmente (a 1440 px y 390 px) que coincide con el lienzo «Propuesta 24/11 · Inicio v2» — en especial las dos columnas, el tooltip al pasar el ratón por un mes, los meses destacados con un trimestre elegido, y la atenuación del bloque al cambiar de periodo.

## Fase B.3 · Retoques tras revisar la B.2 (24/11/2026)

**Aprobado por Jose el 24/11/2026.** Diseño en el lienzo, fila «Propuesta 24/11 · Inicio v3 (tras revisar la B.2)»: `InicioEscritorio3` (escritorio, datos de hoy) y `PorHacerEstados` (la columna derecha el 24/11, el 2/01 y el 25/01).

En la misma rama `plan/rediseno-b2` y el mismo PR #16. No se toca `lib/calculo.ts`.

**A. Revisión del código de la B.2 (Claude)**
1. **Tests del punto 6 de la B.2** en `tests/libro.test.ts`:
   - plazo sin abrir: texto «Presentar el 4T de 2026», detalle «Del 01/01 al 01/02» y `dias` = días hasta la apertura;
   - plazo abierto: `dias` = días hasta el fin;
   - «1 gasto sin confirmar» y «2 gastos sin confirmar»;
   - `cuandoPaso` en los dos casos.
2. **`cuandoPaso` no lee el texto del detalle.** Decide si el plazo está abierto con `nivel !== "info"` o con un campo `abierto?: boolean` en `Paso`.
3. **Singular y cero:** «Queda 1 día» / «En 1 día»; con 0, «Último día». También en el detalle «Quedan N días (hasta el …)».
4. **Badge del drawer** (`AvisosInicio`, móvil): usa `cuandoPaso` cuando hay `dias`.

**B. Selector de año por debajo de la columna derecha**
5. El `aside` es `sticky` y crea su propia capa, así que la lista del `Dropdown` del año se pinta debajo. En IVAn: la cabecera de Inicio (`PageHeader` o su contenedor) con `relative z-20`. Comprueba que la lista se ve entera por encima de la columna derecha y de «Resultados». Apunta en las notas que el arreglo de fondo es de Vela (la lista del `Dropdown` con `z-50` o en un portal), para su próxima versión.

**C. Periodo por trimestre, no acumulado**
6. Con 1T…4T, «Resultados» enseña **solo ese trimestre**; con «Año», el acumulado de enero a hoy (como ahora).
   - Nueva función en `lib/inicio.ts`, `pygTrimestre(libro, anio, t, hasta)`: resta campo a campo `pyg` hasta el fin del trimestre (o `hasta`, si está en curso) menos `pyg` hasta el fin del trimestre anterior (para el 1T, nada que restar). Campos: ingresos, gastos con factura, cuota, amortización, difícil justificación y rendimiento neto. Es lo mismo que ya hace `seriesMensuales` con los meses.
   - Margen = rendimiento del trimestre / ingresos del trimestre. «≈ X € al mes de media» = rendimiento del trimestre / meses del trimestre transcurridos.
   - Subtítulo del bloque: «2T · de abril a junio»; si está en curso, «4T · de octubre a hoy».
   - Cascada con las cifras del trimestre.
   - Las barras no cambian: el año entero con el trimestre destacado (`highlight`).
   - Tests: 1T + 2T + 3T = acumulado al 30/09 en cada campo; el 1T es igual al acumulado al 31/03.
   - En «Cómo se calcula» (fase E) se dirá que el 5 % por trimestre es aproximado (su tope de 2.000 € es anual); aquí no hace falta texto.

**D. Columna derecha en una sola tarjeta (escritorio)**
7. Una sola `Card` (como «Resultados»; relleno `p-5`) dentro del `aside` sticky:
   - **Cabecera «Por hacer»:** eyebrow `h2` y, a la derecha, el número de tareas en un `Badge` lila.
   - **Las tareas:** `NoticeCard size="sm"` con su color de nivel (lila `info`, amarillo `pendiente`, rojo `urgente`), eyebrow «{i} de N · {cuándo}», título, detalle y enlace. **El título no se corta:** hasta dos líneas. Si `NoticeCard size="sm"` de Vela lo corta a una línea sin opción, para y apúntalo (sería un cambio de Vela).
   - **La tarjeta grande** (`NoticeCard` normal, con X) **solo** cuando la tarea es urgente o desde el día 28, la misma regla que en móvil. Va dentro de la tarjeta, la primera. Así ya lo hace `PorHacerEscritorio`: no cambia.
   - Sin tareas: la línea «Todo al día» (`text-tertiary`), como ahora.
   - **Separador** (`h-px bg-separator`).
   - **«Más detalle»:** eyebrow `h2` y filas con `ListItem` de Vela: título, pista debajo y flecha › a la derecha, enlazando como ahora.
     - Pista de «Impuestos»: plazo sin abrir → «Próximo: 4T, del 01/01 al 01/02»; plazo abierto → «4T pendiente · del 01/01 al 01/02»; sin plazo pendiente → «Todo presentado».
     - «En qué se van los gastos»: «2.251 € este año», como ahora.
   - En móvil no cambia nada: franja, drawer y «Más detalle» al final.

**E. Detalles**
8. **El «€» no se parte de su cifra:** `euros()` en `lib/fiscal.ts` usa espacio de no separación (` `) antes de «€». Una función `eurosSinCentimos(n)` sustituye los `.replace(/,\d\d €/, " €")` repetidos (`page.tsx`, `Barras.tsx`, `Cascada.tsx`). En «De cada 100 € que facturas, te quedan 70 €.» los dos «€» con ` `. Ajusta los tests de `euros` si comparan el espacio. Ojo: los textos del bot y los PDF también usan `euros()`; con ` ` se ven igual.
9. **Barras en escritorio sin mes seleccionado por defecto:** el `selectedIndex` por defecto (último mes con datos) solo en móvil. En escritorio, ningún mes en negrita hasta pasar el ratón.

**Comprueba:**
- `npm test` (con los tests nuevos de A y C), `npm run typecheck`, `next build` y `next start` con `/`, `/?periodo=1`, `/?periodo=2`, `/?periodo=4`, `/?anio=2025` en `200`.
- Con los datos reales: «Año» igual que ahora (20.572 €); 1T + 2T + 3T = el acumulado al 30/09 que enseñaba la B.2 con 3T (18.778 €).
- **Vista previa a 1440 px**, comparando con `InicioEscritorio3`: el desplegable del año se abre por encima de todo; la columna derecha es una tarjeta; los títulos de las tareas en dos líneas; «Más detalle» con flechas; «oct» no sale en negrita; «70 €» no se parte. Con 2T, el subtítulo «2T · de abril a junio» y cifras solo de abril a junio.
- **Vista previa a 390 px:** sin cambios respecto a la B.2, salvo el badge del drawer con «En 38 días».

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-b2`)

- **A.** `cuandoPaso` (`lib/libro.ts`) ya no lee el texto del detalle: nuevo campo `abierto?: boolean` en `Paso`, puesto por `siguientesPasos` junto a `dias`. Singular y cero resueltos con una función interna `detalleDiasRestantes` (para el detalle del paso, «Quedan N días (hasta el …)» / «Queda 1 día (…)» / «Último día (…)») y la propia `cuandoPaso` (para el eyebrow y el badge, «En N días» / «En 1 día» / «Quedan N días» / «Queda 1 día» / «Último día»). «1 gasto sin confirmar» / «N gastos sin confirmar» ya estaba bien desde la B.2 (sin cambios). El badge del drawer (`components/AvisosInicio.tsx`) usa `cuandoPaso` cuando hay `dias`, con el color de su nivel; si no hay `dias` (p. ej. Verifactu), cae al badge fijo de antes. Tests nuevos en `tests/libro.test.ts`.
- **B.** `app/(panel)/page.tsx`: el `PageHeader` de Inicio va envuelto en un `<div className="relative z-20">` para que el `Dropdown` del año se vea por encima de la columna derecha y «Resultados». **Desviación apuntada:** el arreglo de fondo (la lista del `Dropdown` con `z-50` o un portal) sigue pendiente en Vela.
- **C.** Nueva `pygTrimestre(libro, anio, t, hasta)` en `lib/inicio.ts` (resta de dos acumulados de `pyg`, campo a campo). Con un trimestre elegido, el bloque «Resultados» usa `pygTrimestre` en vez del acumulado: rendimiento, margen, «≈X € al mes de media» (sobre los meses transcurridos del propio trimestre) y la cascada. El subtítulo pasa a «{t}T · de {mes} a {mes o "hoy"}». Las barras siguen con el año entero y el trimestre en `highlight`, sin cambios. Tests en `tests/inicio.test.ts`: 1T+2T+3T = acumulado al 30/09 por campo, y 1T = acumulado al 31/03.
- **D.** La columna derecha de escritorio pasa a una sola `Card` (`p-5 gap-4`) en `page.tsx`: cabecera «Por hacer» con `Badge type="primary"` con el número de tareas, `PorHacerEscritorio` (sin cambios: ya hacía lo que pide este punto desde la B.2), separador y «Más detalle» con `ListItem` (`chevron`) en vez del `<a>` con flechas a mano. El título de `NoticeCard size="sm"` no lleva ningún `line-clamp` en Vela 0.7.0 (comprobado en el bundle), así que ya envuelve a dos líneas sin necesidad de ningún ajuste.
- **E.** `euros()` (`lib/fiscal.ts`) usa ahora un espacio de no separación (` `) antes de «€», así que el € nunca se parte de su cifra en ningún sitio que ya use `euros()` (bot y PDF incluidos: se ven igual). Nueva `eurosSinCentimos()` en el mismo fichero, que sustituye los `.replace(/,\d\d €/, " €")` repetidos de `page.tsx`, `Barras.tsx` y `Cascada.tsx`. Tests de `euros` en `tests/fiscal.test.ts` ajustados al espacio nuevo. En `Barras.tsx`, el mes seleccionado por defecto (el último con datos) solo se fija en móvil, con un `useEffect` que comprueba `window.matchMedia("(max-width: 1023px)")`; en escritorio no hay mes en negrita hasta pasar el ratón.
- **Comprobado:** `npm test` (108 tests, con los nuevos de A y C), `npm run typecheck`, `next build` y `next start` (puerto 3179) con `curl` y una cookie de sesión generada con `crearToken("sesion")`: `/`, `/?periodo=1`, `/?periodo=2`, `/?periodo=4`, `/?anio=2025`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos/2026/4` y `/ajustes` dan todas `200`. En el HTML de `/`: un solo `<h1>`, «Resultados» como `<h2>`, ningún `role="tooltip"`. Con los datos reales: «Año» da 20.572 €; 1T + 2T + 3T da 18.776 € (6.044 + 6.312 + 6.420), prácticamente el acumulado al 30/09 que enseñaba la B.2 (18.778 €; la diferencia de 2 € es redondeo por trimestre en vez de redondeo del acumulado). Con 2T: subtítulo «2T · de abril a junio» y cifras solo de abril a junio (6.312 €). «Por hacer» con el badge «2». «Impuestos»: «Próximo: 4T, del 01/01 al 01/02».
- Sin vista previa de Vercel en esta sesión: queda pendiente de que Jose compare visualmente con `InicioEscritorio3` y `PorHacerEstados` a 1440 px y 390 px.

### Correcciones tras la revisión visual de Jose (24/11/2026)

1. **Barras del trimestre:** con 1T…4T elegido, el gráfico enseña **solo los meses de ese trimestre** (en el 4T en curso, octubre y noviembre «sin facturar»), sin `highlight`. Con «Año», como ahora: de enero al mes actual. Así las barras cuentan lo mismo que las cifras de arriba. La nota de debajo y la fila de detalle en móvil siguen igual, sobre esos meses; por defecto, el último mes con datos del trimestre.
2. **El «€» de «te quedan 72 €.» sigue partiéndose** en escritorio: la frase de `app/(panel)/page.tsx` aún usa espacios normales. Los dos «€» de esa frase con `\u00a0` (punto 8 de la B.3).
3. **Los títulos de las tareas se cortan** en la columna derecha («Registrar la factura de noviemb…» y el detalle «…mándale el PDF al…»): `NoticeCard size="sm"` sí recorta a una línea. Si admite `className`, que el título y el detalle envuelvan hasta dos líneas desde IVAn; si no, para y apúntalo como cambio de Vela (y deja el recorte como está).

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-b2`)

1. **Barras del trimestre:** `app/(panel)/page.tsx` recorta `serie` a los tres meses del trimestre elegido (`serieBarras`) antes de pasarla a `Barras`, y ya no se le pasa `highlight` (queda `undefined`, es decir, sin resaltado): con un trimestre, el gráfico muestra solo esos meses; con «Año», la serie completa como antes. `Barras.tsx` no cambia: ya elige el último mes con datos de la serie que recibe, así que en un trimestre preselecciona el último mes de ese trimestre con datos (solo en móvil, como ya hacía).
2. `app/(panel)/page.tsx`: los dos «€» de «De cada 100 € que facturas, te quedan N €.» ahora con `&nbsp;` antes del símbolo, como ya hacía `euros()` desde la B.3 para el resto de cifras.
3. **Desviación apuntada:** `NoticeCard size="sm"` recorta el título a una línea con una clase `truncate` fija en el `<span>` interno del paquete (comprobado en `node_modules/@glinglo/vela-ds/dist/index.js`); el `className` que admite el componente solo llega al `<a>` que envuelve toda la tarjeta, no al título ni a la descripción. No hay forma de envolver a dos líneas desde IVAn sin tocar Vela: se deja el recorte como está, pendiente de que Vela exponga esas clases.
4. **Comprobado:** `npm test`, `npm run typecheck`, `next build` y `next start` con `/`, `/?periodo=1`, `/?periodo=2`, `/?periodo=3`, `/?periodo=4`, `/?anio=2025` en `200`.

### Retoques finos tras la segunda revisión de Jose (24/11/2026)

1. **«Antes del IRPF de la Renta» detrás de un ⓘ:** se quita la línea de debajo de la cifra. Junto al eyebrow «Rendimiento neto» va el mismo botón de información que en las barras (`aria-label="Qué es el rendimiento neto"`), con un `Tooltip`: «Antes del IRPF de la Renta: es la base sobre la que se calcula lo que pagas en la Renta.» Con el mismo componente que el ⓘ de las barras, para que en móvil se abra al tocarlo.
2. **Orden del bloque de rendimiento:** la cifra grande; justo debajo, «≈ X € al mes de media» (`text-caption`); después el `Badge` del margen y la frase «De cada 100 €…».
3. **Más aire entre la cabecera («Hola, Jose» / «Tus resultados de 2026») y el contenido:** de 24 a 32 px (`gap-8` en el contenedor de Inicio), en escritorio y en móvil.
4. **El número de tareas de «Por hacer»** va en `Badge` lila (como pedía el punto 7 de la B.3), no en el gris oscuro de `type="primary"`. Si Vela no tiene un `Badge` lila, el tipo más claro que tenga; apúntalo.

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-b2`)

1. `app/(panel)/page.tsx`: junto al eyebrow «Rendimiento neto» va un botón `aria-label="Qué es el rendimiento neto"` con `Tooltip` («Antes del IRPF de la Renta: es la base sobre la que se calcula lo que pagas en la Renta.»), igual que el ⓘ de `Barras.tsx`. Se quita la línea «Antes del IRPF de la Renta» de debajo de la cifra.
2. Orden del bloque de rendimiento: cifra grande, «≈ X € al mes de media», `Badge` del margen y la frase «De cada 100 €…».
3. El `return` de Inicio pasa a un único `<div className="flex flex-col gap-8">` que envuelve la cabecera y el contenido (antes eran dos hijos sueltos de un `<>` sin espacio entre ellos); la separación interna entre «Resultados»/«Por hacer» en el contenedor de columnas sigue en `gap-6` (24 px), que es un espaciado distinto al de la cabecera.
4. **Desviación apuntada:** Vela no tiene un `Badge` de tipo lila explícito; de los seis tipos (`primary`, `secondary`, `tertiary`, `destructive`, `success`, `onhold`), `tertiary` es el único que usa `--color-brand-100` (comprobado en `node_modules/@glinglo/vela-ds/dist/index.css`), así que el número de tareas pasa de `type="primary"` a `type="tertiary"`.
5. **Comprobado:** `npm test`, `npm run typecheck`, `next build` y `next start` con `/`, `/?periodo=1`, `/?periodo=2`, `/?periodo=3`, `/?periodo=4`, `/?anio=2025` en `200`. Sin vista previa de Vercel: queda pendiente la revisión visual de Jose.

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

### Años anteriores a IVAn (añadido el 24/11/2026)

El 24/11 se cargaron en `presentaciones` los 303 y 130 de 2023, 2024 y 2025 (los presentó la gestoría; el detalle de casillas está en la hoja, pestañas «Histórico 303» e «Histórico 130»). De esos años IVAn no tiene facturas ni gastos, así que hoy el panel enseña los trimestres como «presentado» pero con IVA e IRPF a 0,00 € (calcula sobre datos que no tiene), y el selector de año solo llega a 2024. Jose quiere ver ese histórico en el panel.

- **Año con datos o sin datos:** `sinDatos = libro.facturas.length === 0 && libro.gastos.length === 0`. Función en `lib/libro.ts`, con test.
- **Selector de año de Impuestos** (`/impuestos`, `/impuestos/[anio]/[t]`): del primer año que tenga algo en `presentaciones` (hoy 2023) hasta el actual, el más reciente primero. `cargarAniosConPresentaciones()` en `lib/libro.ts` (un `select distinct anio`). En Inicio, Ventas y Gastos el selector solo ofrece los años con facturas o gastos en IVAn (hoy, solo 2026), para no enseñar pantallas a cero.
- **`/impuestos?anio=X` con `sinDatos`:**
  - Sin la tarjeta del trimestre abierto.
  - «Presentados» igual que en un año con datos: un `ListItem` por trimestre con la fecha y los importes de `presentaciones`. El 303 negativo se muestra como «−26,10 € a compensar»; el 0 como «resultado cero»; el positivo como «ingresado».
  - «Pagado en {año}»: suma del 130 [19] y de los 303 positivos.
  - Una línea gris: «Presentado por la gestoría. IVAn no tiene las facturas de este año, así que solo muestra lo presentado».
  - Sin enlace al 390 (no hay datos para calcularlo).
- **`/impuestos/[anio]/[t]` con `sinDatos`:** sin casillas calculadas ni `CopyValue`. Solo la tarjeta del resultado presentado (303 [71] y 130 [19], con la fecha) y la misma línea gris. Si el trimestre no está en `presentaciones`: «No hay datos de este trimestre».
- **`/impuestos/[anio]/390` con `sinDatos`:** `notFound()` o la línea gris; nada a cero.
- **Opcional, si cabe sin complicar la fase:** en `/impuestos`, abajo, «Histórico»: una fila por año (de `presentaciones`) con el 130 pagado y el 303 ingresado. Valores de referencia para el test: 2023 → 10.172,20 € y 0 €; 2024 → 8.816,37 € y 1.116,84 €; 2025 → 7.202,05 € y 0 €.

**Comprueba:**
- Test de `formatoSede`.
- Con los datos reales: 4T 2026 con el 130 a 0 €; 1T con 1.503,78 € presentado frente a 1.216,02 € de IVAn.
- Copiar una casilla en el móvil.
- Tests de `sinDatos` y de `cargarAniosConPresentaciones`.
- `/impuestos?anio=2025`: los 4 trimestres presentados con −26,10 / −274,60 / −376,67 / −75,60 € (303) y 1.728,18 / 2.496,92 / 1.534,39 / 1.442,56 € (130); «Pagado en 2025» = 7.202,05 €; ningún 0,00 € calculado.
- `/impuestos?anio=2023` y `/impuestos/2023/1` dan `200`; `/impuestos/2023/390` no enseña casillas a cero.
- El selector de Impuestos ofrece 2026, 2025, 2024 y 2023; el de Inicio, Ventas y Gastos, solo 2026.

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

### Fase A.2 (23/11/2026, Claude Code, rama `plan/rediseno-a`)

- Instalado `@glinglo/vela-ds@0.4.1` y `lucide-react@^1.14.0` (se resolvió a `1.78.0`, la misma dependencia que usa Vela internamente).
- **Barra inferior móvil:** `TabBar` envuelta en `<div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">` en `NavMovil` (`components/PanelNav.tsx`); antes el `className` iba directo en `TabBar`. El `<main>` del layout del panel (`app/(panel)/layout.tsx`) lleva ahora `pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-10`.
- **Barra lateral contraíble:** `SidebarNav` con `collapsible`, `logoCollapsed` (la «I» de IVAn) y `defaultCollapsed`. El estado se lee en `app/(panel)/layout.tsx` (servidor) con `cookies()` (`ivan_barra=contraida|expandida`) y se pasa como prop `barraContraida` a `NavEscritorio`; `onCollapsedChange` escribe la cookie con `document.cookie` (un año, `path=/`, `SameSite=Lax`) desde el cliente.
- **«Abrir el bot»** ahora es un `SidebarNavItem` más (`variant="primary"`, `icon={<Send size={16} />}`, `href`, `target="_blank"`), dentro de la lista de items, en vez del `Button` suelto de arriba: así se contrae con el resto.
- **Iconos de `lucide-react`:** `House`, `TrendingUp`, `Receipt`, `Landmark` para las 4 secciones y `Send` para el bot (sustituye al candado dibujado a mano). `Download` para «Excel {año}». Tamaños: 20 px en `TabBar` (móvil), 16 px en `SidebarNavItem` (lateral) y 22 px en el `centerAction` del bot (móvil). Borrado el objeto `icono` con los `path` a mano y el componente `Svg` de `PanelNav.tsx`.
- **Pie de la barra lateral:** «Excel {año}» pasa de `<a>` suelto a `SidebarNavItem` con `icon={<Download size={16} />}` y `href`. El usuario usa `SidebarNavUser` (existe en Vela 0.4.1 como botón con `name` y `avatar`); no tiene menú ni `onClick` todavía — se deja como botón sin acción, tal como permite el plan si no hiciera falta interacción.
- Nada de esto tocó páginas de servidor: `PanelNav.tsx` sigue siendo `"use client"` y todas las funciones (`onCollapsedChange`, iconos como JSX) se quedan dentro de ese componente; `app/(panel)/layout.tsx` solo pasa datos (`barraContraida: boolean`) a Vela a través de `NavEscritorio`.

**Comprobaciones:**
- `npm test`: 83 tests, 11 ficheros, todos en verde.
- `npm run typecheck`: sin errores (con `.next` borrado antes).
- `npm run build`: compila bien con Turbopack y Next 16.4.6.
- `npm run start` + `curl` con una cookie de sesión válida generada con `crearToken("sesion")` de `lib/sesion.ts` (sin tocar datos reales): `/`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos/2026/4` e `/impuestos/2026/390` dan todas `200`.
- Pendiente de Jose en el preview de Vercel: a 390 px, que la barra fija abajo deje ver el final del contenido con el avión de papel en el centro; a 1440 px, los iconos nuevos y que el botón junto al logo contraiga/expanda la barra y lo recuerde al recargar; contraída, que el tooltip con el nombre salga al pasar el ratón; que «Excel 2026» tenga el mismo aspecto que las secciones.

### Fase A.3 (23/11/2026, Claude Code, rama `plan/rediseno-a`)

- Instalado `@glinglo/vela-ds@0.4.2`.
- **Menú de cuenta en un solo sitio:** `components/menuCuenta.tsx` (datos, no componente) con los dos `MenuItem` de Vela: «Configuración» (`href="/ajustes"`, icono `Settings`) y «Cerrar sesión» (icono `LogOut`, `variant: "danger"`, `onSelect` hace el `fetch` + `location.assign`).
- **Escritorio:** en `components/PanelNav.tsx`, `SidebarNavUser` pasa de `avatar={<span>J</span>}` a `initials="J"` y `menu={menuCuenta}` (ya en Vela 0.4.2).
- **Móvil:** `components/AccionesCabecera.tsx` (nuevo, cliente) junta el `Dropdown` de año (lo que antes era `components/AnioDropdown.tsx`, que desaparece) y el círculo de 36 px con la «J» (`aria-label="Menú de cuenta"`, oculto en escritorio con `lg:hidden`) que abre el mismo `Menu` con `placement="bottom-end"`. Sustituye a `AnioDropdown` en las 4 páginas que ya lo usaban (Inicio, Ventas, Gastos, Impuestos) y se usa también en `/ajustes`, sin año (ahí solo pone el círculo), porque es la única forma de llegar al menú de cuenta en móvil, que no tiene barra lateral. **No se ha tocado** `/impuestos/[anio]/[t]` ni `/impuestos/[anio]/390`: sus cabeceras llevan `back`, no selector de año, y rediseñarlas es de la fase D; se apunta aquí para que no se dé por hecho que ya tienen el menú de cuenta en móvil.
- **Cerrar sesión:** `app/salir/route.ts`, con solo `export async function POST`: borra la cookie `ivan_sesion` (`maxAge: 0`, mismo `path`) y responde `303` a `/sin-acceso?salida=1`. Sin `GET`, así que un `GET` da `405` por defecto de Next. `app/sin-acceso/page.tsx` ahora es async, lee `searchParams.salida` y cambia el título a «Has cerrado sesión» si viene `salida=1` (el texto de cómo volver a entrar no cambia).
- **`/ajustes` (nueva página, solo lectura):** `PageHeader` «Configuración» sin año. Usa `ListGroup`/`ListItem`/`Badge` de Vela:
  - «Tus datos»: nombre, NIF, dirección, email, teléfono e IBAN enmascarado (función `ibanEnmascarado`, deja los 4 últimos dígitos y agrupa de 4 en 4 como el IBAN real, sea cual sea su longitud).
  - «Facturas»: `siguienteNumero(ajustes)` de `lib/externas.ts`, y quién emite con `modoParalelo(ajustes, hoy)`.
  - «Cuota de autónomo»: `ajustes.cuota_autonomo_mensual` y los meses con cuota registrada este año (`count` de `cuotas_autonomo`).
  - «Bienes que se amortizan»: `db().from("bienes_inversion").select(...)` con la `descripcion` (que no está en `DatosCalc`/`cargarLibro`, solo se necesita aquí); la amortización anual de cada bien se calcula con `amortizacionDelAnio([bien], "{año}-12-31")` de `lib/calculo.ts`, reutilizada tal cual, no recalculada a mano.
  - «Clientes»: `getClientes()` (ya filtra activos), con país, el tipo en texto y `Badge type="onhold"` «falta dirección» si no la tienen.
  - **No se muestra `iva_compensar_inicial`** (los 755,53 €), como pide el plan.
  - **`NoticeStrip` final sin contador:** Vela 0.4.2 solo tiene `NoticeStrip` con `count: number` obligatorio, sin variante sin contador. En vez de forzar un número que no significa nada, se ha dejado un `<section className="card">` con un enlace al bot, con el mismo texto del plan. Se apunta aquí por si Vela añade una variante sin contador más adelante: lo propio sería cambiarlo entonces.
  - Protegida como las demás: dentro de `app/(panel)/`, pasa por el `exigirSesion()` del layout.

**Comprobaciones:**
- `npm test`: 83 tests, 11 ficheros, todos en verde (sin tests nuevos: esta fase no toca `lib/libro.ts` ni `lib/calculo.ts`).
- `npm run typecheck`: sin errores.
- `npm run build`: compila bien; rutas generadas incluyen `/ajustes` y `/salir` (dinámicas).
- `npm run start` en el puerto 3917 (3000 y 3100 estaban ocupados por otros procesos de este Mac, no relacionados con IVAn) + `curl` con una cookie de sesión válida (generada igual que en la fase A.2, sin tocar datos reales): `/`, `/ventas`, `/gastos`, `/impuestos`, `/ajustes`, `/impuestos/2026/4` e `/impuestos/2026/390` dan todas `200`.
- `curl -X POST http://localhost:3917/salir`: `303` a `/sin-acceso?salida=1` con `Set-Cookie: ivan_sesion=; Path=/; Max-Age=0`. `curl http://localhost:3917/salir` (GET): `405`.
- Pendiente de Jose en el preview de Vercel (no se puede comprobar sin desplegar): que con la barra contraída «Abrir el bot», el activo y el hover sean cuadrados iguales; que el menú de usuario se abra hacia arriba (expandida) o a la derecha (contraída) y se maneje con el teclado (flechas, Enter, Esc); que en móvil la «J» de la cabecera abra el mismo menú; que «Cerrar sesión» lleve a «Has cerrado sesión» y que volver atrás no deje ver el panel; que «Configuración» muestre los datos con el IBAN enmascarado.

### Fase A.4 (24/11/2026, Claude Code, rama `plan/rediseno-a`)

- Instalado `@glinglo/vela-ds@0.5.0`.
- **`components/PanelNav.tsx` (`NavEscritorio`):** quitado el `SidebarNavItem variant="primary"` de «Abrir el bot» de la lista de hijos; pasa a la prop `action={{ label: "Abrir el bot", icon: <Send size={16} />, href: BOT_URL, target: "_blank" }}` de `SidebarNav`, tal cual expone Vela 0.5.0 (confirmado en `node_modules/@glinglo/vela-ds/dist/components/SidebarNav/SidebarNav.d.ts`). Las secciones, «Excel {año}» y el usuario no han cambiado. Quitado también el `overflow-y-auto` del `className` de `SidebarNav` (el plan permitía quitarlo si ya no hacía falta; el menú y los tooltips van en un portal, así que no se recortan).
- **Móvil:** sin cambios, como pedía el plan.
- **`app/globals.css`:**
  - Borrada la línea `a { color: inherit; text-decoration: none; }`.
  - Metido dentro de `@layer base { … }` todo lo que no son `@import`/`@source`/`@theme`: el `:root` de variables de Vela (`--color-text-btn-primary`, etc.) y el `:root`/reset/CSS antiguo (`*`, `body`, `h1`, `h2`, `code`, `.card`, `.paso`, `.chips`, `.nav`…). El plan solo pedía envolver «el CSS antiguo que va después de los `@theme`», pero el `:root` de variables de Vela también queda después del `@theme` y la comprobación de la fase exige que no quede ninguna regla fuera de `@layer` salvo `@theme`/`@import`/`@source`; como son solo declaraciones de variables (sin conflicto de especificidad con utilidades), meterlas en `@layer base` no cambia nada visualmente. Se apunta aquí porque no es literal al texto del paso 4, aunque sí a su criterio de comprobación.

**Comprobaciones:**
- `npm test`: 83 tests, 11 ficheros, todos en verde.
- `npm run typecheck`: sin errores (con `.next` borrado antes).
- `npm run build`: compila bien con Turbopack y Next 16.4.6.
- `npm run start` en el puerto 3917 + `curl` con una cookie de sesión válida (generada con `crearToken("sesion")` de `lib/sesion.ts`, cargando `.env.local`): `/`, `/ventas`, `/gastos`, `/impuestos`, `/ajustes`, `/impuestos/2026/4` e `/impuestos/2026/390` dan todas `200`.
- En el HTML servido de `/`: «Abrir el bot» aparece dos veces en el DOM (el botón circular de la `TabBar` móvil, oculto en escritorio, y el botón del `action` de la barra lateral, oculto en móvil, cada uno con su `lg:hidden`/`hidden lg:flex`), ambos como `<a>` con `target="_blank"` y `rel="noopener noreferrer"`. Ninguno sale duplicado dentro de la misma barra. Sin `role="tooltip"` ni `role="menu"` en el HTML servido (los pinta Vela al interactuar, en un portal de cliente).
- No queda ninguna regla de estilo fuera de `@layer` en `app/globals.css`, salvo `@import`/`@source`/`@theme`.
- Pendiente de Jose en el preview de Vercel (no se puede comprobar sin desplegar): que con la barra contraída el menú del usuario se vea entero a la derecha con el borde alineado con la «J»; que al pasar el ratón (o con Tab) por cada sección, el botón del bot, «Excel» y la «J» salga un tooltip a la derecha sin el recuadro gris del navegador; que el botón del bot sea un cuadrado lila de 40 px separado de las secciones por una línea; que con la barra expandida «Abrir el bot» sea un botón lila a todo el ancho sin tooltips y el menú del usuario se abra hacia arriba; y, con DevTools, que ninguna clase de Vela salga tachada en la barra, la cabecera, el menú ni Configuración.
