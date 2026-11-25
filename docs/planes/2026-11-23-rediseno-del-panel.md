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
- **Añadido el 24/11/2026 (fase C.2):** la regla no es solo "no pases una función como prop". Una función exportada por un módulo `"use client"` de Vela (p. ej. `toneFor`, junto a `Avatar`) **no se puede ni llamar** desde código de servidor, aunque sea pura y el resultado que devuelve sí sea serializable: «Attempted to call toneFor() from the server but toneFor is on the client». El arreglo es el mismo: un componente propio con `"use client"` que la llama por dentro (aquí, `components/AvatarProveedor.tsx`) y al que la página le pasa solo el nombre.

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

**Antes de empezar (añadido el 24/11/2026, tras la B.3):**
- Rama `plan/rediseno-c` desde `wip/v0` (ya con Vela 0.7.1). No se toca `lib/calculo.ts`.
- **El periodo funciona igual que en Inicio:** el mismo componente `Periodo` (`variant="contrast"`, trimestres futuros desactivados, `useTransition`). «Año» = de enero a hoy; **1T…4T = solo ese trimestre** (no acumulado), en las cifras, en los clientes, en las categorías y en la lista.
- Importes con `euros()` / `eurosSinCentimos()` (ya llevan el espacio de no separación).

**Retoques de Inicio que quedaron de la B.3 (de paso, en esta fase):**
1. **Eyebrow de la tarea «facturar del mes»:** hoy dice «2 de 2 · Info». Que diga «Este mes», como en el lienzo (`PorHacerEstados`). En `cuandoPaso` (o donde se arma el eyebrow), para `clave === "facturar"` sin `dias`: «Este mes». Las demás tareas sin `dias` siguen con su nivel. Test.
2. **Espacio de «Más detalle»:** entre el título «Más detalle» y su primera fila hay bastante más aire que entre «Por hacer» y su primera tarea. Que sea el mismo (12 px). Si sale del relleno de `ListItem`, ajústalo con su `className`; si no se puede desde IVAn, para y apúntalo como cambio de Vela.

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

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-c`)

- **Retoques de Inicio pendientes de la B.3:**
  1. `cuandoPaso` (`lib/libro.ts`) devuelve «Este mes» para `clave === "facturar"` sin `dias` (antes caía al «Info» del nivel); el resto de pasos sin `dias` siguen devolviendo `null`. Test nuevo en `tests/libro.test.ts`.
  2. «Más detalle» (columna derecha de Inicio, `app/(panel)/page.tsx`): `ListItem` de Vela 0.7.1 lleva un `py-3` fijo en su propio componente (sin `className` que llegue ahí), así que el hueco con «Por hacer» no se puede igualar quitando relleno de Vela. Se compensa desde IVAn con `-mt-3` en el `<ul>` que envuelve las dos filas de «Más detalle», para que el hueco visual quede igual que el de «Por hacer» a su primera tarea. Apuntado por si Vela expone el relleno de `ListItem` como `className` en el futuro.
- **Ventas (`app/(panel)/ventas/page.tsx`):** reescrita con el patrón de periodo de Inicio (`Periodo`, trimestres futuros desactivados, «Año» = acumulado, 1T…4T = solo ese trimestre). Tarjeta de base facturada, tarjeta «Clientes» (`StackedBar` + `ListItem` con base, % del total y tipo), facturas en `ListGroup` por mes (los 3 meses más recientes del periodo, con «Ver {mes} a {mes}» para el resto vía `?todo=1`), fila de modo paralelo cuando el mes en curso no tiene factura y el pasado sí, y `NoticeStrip` final al bot. `FacturaLista` (`lib/libro.ts`) gana `retencion_pct` y `origen` (la consulta de `cargarLibro` no los traía); el badge «Selfconta» usa `origen === "externa"` en vez de deducirlo del tipo de cliente.
- **Gastos (`app/(panel)/gastos/page.tsx`):** migración `supabase/migrations/006_categoria_gastos.sql` (columna `categoria` con el `check` del enum y su índice). `lib/categorias.ts` nuevo con `CATEGORIAS_GASTO` y `ETIQUETA_CATEGORIA` (un solo sitio para las etiquetas en español). `GastoExtraido` (`lib/claude.ts`) gana `categoria_gasto` (el enum, con la descripción «Categoría del gasto según lo que se compra»; se llama distinto del `categoria` ya existente de «restauracion»/«otro», que es para la manutención y no se toca); `construirFila` (`lib/gastos.ts`) lo guarda como `categoria` en la fila. Al corregirse un gasto respondiendo al borrador, `corregirGasto` vuelve a pasar por `construirFila`, así que la categoría es corregible igual que el resto de campos, sin código adicional. `scripts/categorias.sql` creado para que Jose lo ejecute a mano (relleno de los gastos antiguos por proveedor/concepto y el `select count(*) ... where categoria is null` de comprobación), sin ejecutarlo desde aquí.
  - Pantalla: tarjeta de base gastada, «Por categoría» (filas propias con una barra de fondo y un `<a>` a `?categoria=`, no un componente de Vela: `StackedBar` no admite segmentos enlazables — apuntado como posible mejora de Vela), `ListGroup` por mes con `nombreCorto(proveedor)`, `Alert variant="help"` si hay borradores, «Faltan este mes» con `proveedoresQueFaltan` (reutilizada tal cual, sin duplicar su lógica) y la tarjeta «Por qué casi no hay IVA deducible» (`StackedBar` por tipo de IVA con el % calculado).
  - `nombreCorto` (`lib/texto.ts`, nuevo) quita la forma jurídica del final («Anthropic, PBC» → «Anthropic», «Cursor Inc.» → «Cursor»…). Se usa en Gastos y en `lib/cron.ts` (`lista()`, el aviso de fin de mes), cerrando el pendiente técnico de «Anthropic, PBC». Tests en `tests/texto.test.ts`.
- **Comprobado:** `npm test` (111 tests, con los nuevos de `nombreCorto` y de `cuandoPaso`/«Este mes»), `npm run typecheck` y `npm run build` sin errores.
- **Migración 006 sin aplicar en esta sesión:** este entorno no tiene credenciales de conexión directa a Postgres (solo la `SUPABASE_SERVICE_ROLE_KEY` para la API REST, sin forma de ejecutar DDL arbitrario); la comprobación con `next start` + `curl` lo confirma: con la migración sin aplicar, **todas** las páginas que pasan por `cargarLibro` (`/`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos/2026/4`, `/ajustes`) dan `500` («column gastos.categoria does not exist»), porque la consulta de gastos ya pide esa columna. Pendiente de que Jose aplique `006_categoria_gastos.sql` en el SQL Editor de Supabase; tras eso, repetir la comprobación de `curl` con cookie de sesión.
- **Prueba de integración de las 56 conversaciones:** no se puede ejecutar desde este entorno (es en el Mac de Jose); queda pendiente, como ya avisaba el plan.

### Notas de ejecución (Claude Code, 24/11/2026, revisión visual de la fase C)

- **Regla técnica incumplida en Gastos:** el `StackedBar` de «Por qué casi no hay IVA deducible» recibía `format={eurosSinCentimos}` directamente desde `app/(panel)/gastos/page.tsx` (página de servidor), lo que daba error 500 («Functions cannot be passed directly to Client Components»; React #441 en producción). Pasado a `components/GraficoTipoIva.tsx`, un componente propio con `"use client"` (igual que `Cascada.tsx`): la página le pasa solo `parts` (datos) y el componente mete `format` dentro. Revisado el resto de `gastos/page.tsx` y `ventas/page.tsx`: no quedaba ninguna otra función cruzando al cliente.
- **Ventas, fila «Pendiente» del modo paralelo:** el título decía «Factura de {mes pasado} · {cliente}», pero la fila avisa de la factura que falta **este** mes (el cliente ya facturado el mes pasado y no en el actual). Cambiado a `mesActual`.
- **Selector de periodo de Ventas y Gastos:** no seguía el patrón de Inicio (un único `Periodo` siempre visible, sin `fullWidth`). Puesto como en `app/(panel)/page.tsx`: compacto (`fullWidth={false}`, implícito) en un `<div className="hidden lg:block">` y a todo el ancho (`fullWidth`) en un `<div className="lg:hidden">`.
- **Ventas, `aside` del `ListGroup` por mes:** sumaba `f.base` (base imponible) mientras cada `ListItem` de la lista enseña `f.total` (el total cobrado) — el subtotal del grupo no cuadraba con lo que se ve en las filas. Cambiado a sumar `f.total`.
- **Comprobación de la regla técnica (migración 006 ya aplicada):** `next build` + `next start` en local y `curl` con cookie de sesión a `/`, `/ventas`, `/ventas?periodo=3`, `/gastos`, `/gastos?periodo=3`, `/gastos?categoria=software_ia` e `/impuestos`: las siete dan `200`.
- `npm test` (112 tests) y `npm run typecheck` sin errores. La prueba de integración de las 56 conversaciones sigue pendiente de repetirse desde este entorno (como en la nota anterior); no la he vuelto a correr porque este cambio es solo de las páginas del panel, sin tocar el bot.
- **Un gasto nuevo por foto guardando la categoría:** no comprobado end-to-end (necesita Telegram y la migración aplicada); el código de `lib/gastos.ts`/`lib/claude.ts` ya pasa `categoria_gasto` → `categoria` en el `insert`/`update`, pendiente de probarlo en real tras aplicar la migración.

## Fase C.2 · Ventas y Gastos v2: cifras con contexto (24/11/2026)

**Diseño aprobado por Jose el 24/11/2026** en el lienzo, fila «Propuesta 24/11 · Ventas y Gastos v2»: `VentasEscritorio2`, `VentasMovil2`, `GastosEscritorio2` y `GastosMovil2`. Las cifras de los dibujos son de los datos reales, salvo Cursor de enero a julio (aproximado) y el coste de las suscripciones (en el dibujo, una suposición; aquí manda la regla del punto 6).

**Empieza solo cuando se cumplan las dos cosas:**
- la fase C (PR #18) está fusionada en `wip/v0`;
- Vela 0.8.0 está publicada (plan `2026-11-24-vela-0-8-0.md` de `vela-ds`: `BarChart` con `stacked` y `showValues`, `Avatar` con `tone` y `toneFor`, y `Meter`).

Rama nueva `plan/rediseno-c2` desde `wip/v0`, con `npm install @glinglo/vela-ds@0.8.0`. No se toca `lib/calculo.ts`. Sigue valiendo la «Regla técnica: Vela en páginas de servidor».

### Qué cambia con el periodo (regla para las dos páginas)

- **El selector va dentro de la tarjeta principal**, como en «Resultados» de Inicio: `CardHeader` con el título («Facturado» / «Gastado»), el subtítulo del periodo y `Periodo` en `actions` (escritorio); en móvil, debajo del título a todo el ancho.
- **Cambian con 1T…4T** (solo ese trimestre, como en la fase C): la cifra, el gráfico por mes, Clientes / Por categoría, la lista y la tarjeta del IVA.
- **No cambian:** en Ventas, «Próxima factura», «Dependencia de un cliente» (siempre el año) y «Cada año»; en Gastos, «Tus suscripciones» y «Lo que ha cambiado» (siempre los últimos meses).

### Datos

1. **Migración `007_ingresos_historicos.sql`:** `alter table presentaciones add column if not exists ingresos_acumulados numeric(12,2)` con el comentario «Facturado de enero al fin del trimestre (130). Para comparar con años anteriores».
2. **`scripts/historico-ingresos.sql`** (lo ejecuta Jose en el SQL Editor): `update presentaciones set ingresos_acumulados = … where modelo = '130' and anio = … and trimestre = …`, con estos valores (de los justificantes; en 2025 se quita el Kit Digital, 2.000 € desde el 2T, porque no es facturación):

   | | 1T | 2T | 3T | 4T |
   |---|---|---|---|---|
   | 2023 | 15.710,31 | 35.562,01 | 45.551,59 | 57.619,45 |
   | 2024 | 11.244,44 | 30.831,06 | 41.399,05 | 53.734,05 |
   | 2025 | 9.831,16 | 24.291,49 | 35.803,55 | 44.263,55 |

   Con el `select` de comprobación (12 filas con valor). Y en el mismo script, la unificación de Cursor: `update gastos set proveedor = 'Anysphere, Inc. (Cursor)' where proveedor ilike '%anysphere%' or proveedor ilike 'cursor%';` (hoy está como «Anysphere», «Anysphere, Inc. (Cursor)» y «Cursor»).
3. **`nombreCorto`:** si el nombre acaba en un paréntesis, devuelve lo de dentro: «Anysphere, Inc. (Cursor)» → «Cursor». Test.

### Funciones (en `lib/`, todas con tests)

4. **`comparativaAnual(libro, historico, hoy)`:** compara de enero al fin del **último trimestre cerrado** del año en curso. Año en curso: suma de las facturas; años anteriores: `ingresos_acumulados` del 130 de ese trimestre. Devuelve los años que haya (hasta 4) y el % frente al año anterior. Sin trimestre cerrado o sin histórico: `null`. Test con los datos reales: hasta el 3T, 26.400 € frente a 35.803,55 € → −26 %.
5. **`proximaFactura(libro, hoy, paralelo)`:** clientes facturados el mes pasado sin factura en el mes en curso → mes, cliente, importe estimado (lo facturado a ese cliente el mes pasado) y días hasta fin de mes. Sustituye a la fila «Pendiente» de la fase C. Texto según el modo: en paralelo, «La emite Selfconta: mándale el PDF al bot»; si no, «Díselo al bot: «factura a {cliente} …»».
6. **`suscripciones(gastos, hoy)`:** mismo criterio que `proveedoresQueFaltan` (gasto confirmado en al menos 2 de los 3 meses anteriores; reutiliza `claveProveedor` y saca la parte común a una función, sin duplicar).
   - **Activas:** coste al mes = lo gastado en el último mes con gasto; total al mes y × 12 al año.
   - **«Sin factura desde…»:** proveedores que este año fueron recurrentes (gasto en 2 meses seguidos) y no tienen gasto en los 2 últimos meses: el mes del último gasto. Hasta 3, el más reciente primero.
7. **`cambiosGastos(gastos, hoy)`:** para cada suscripción activa, el último mes cerrado frente a la media de los 3 anteriores: «Sube» o «Baja» si cambia al menos un 50 % y 10 €; «Sin factura» si no tiene gasto en el último mes cerrado. Hasta 3. Test: Cursor 17 → 72 € en octubre es «Sube».
8. **`dependencia(libro)`:** cliente principal del año y su parte de lo facturado; `riesgo` si ≥ 70 %.
9. **Colores fijos por categoría** en `lib/categorias.ts` (los del dibujo, como tokens o variables CSS de gráfico), para el gráfico apilado y las barras de «Por categoría».

### Ventas (`/ventas`)

10. **Tarjeta «Facturado»:** cabecera con el periodo; la cifra (`text-display`); «{N} facturas · ≈ X € al mes de media»; con «Año» y si hay comparativa, `Badge` «{x} % más/menos que en {año−1} de enero a {mes}» (verde si sube, amarillo si baja). Separador. `BarChart` por mes con `showValues` en escritorio, el mes en curso `pending` con el importe estimado de `proximaFactura` (si lo hay).
11. **Escritorio, columna derecha** (en móvil, debajo de la tarjeta principal, en este orden):
    - «Próxima factura»: tarjeta lila (como el dibujo) con eyebrow «Próxima factura · en {N} días», título «{Mes} · {cliente}», texto con el importe estimado y botón «Abrir el bot» (`target="_blank"`, en un componente de cliente si hace falta).
    - «Dependencia de un cliente»: la cifra, «de lo que facturas es de {cliente}», `Meter` con umbral 0,7 («70 %»), tono `warning` si hay riesgo (y `Badge` «Riesgo») o `success` si no, y la frase «Si {cliente} se va, se va casi todo. A partir del 70 % lo marcamos como riesgo» (solo con riesgo).
    - «Clientes»: la barra apilada de siempre y una fila por cliente con `Avatar` (`toneFor`), «{país} · {tipo} · {%}» y la base.
    - «De enero a {mes}, cada año»: una barra horizontal por año con su importe; el año en curso en lila. Debajo, en `text-caption`: «De tus 130 presentados (2025 sin el Kit Digital)». Sin comparativa, no se pinta.
12. **Facturas:** escritorio, tabla (Nº, Fecha, Cliente, Tipo con `Badge`, Base, Total) con las 6 más recientes del periodo y «Ver las {N}» (`?todo=1`); móvil, lista (Nº · cliente, fecha · tipo, total). Fuera el `Badge` «sin PDF»: la fila abre el PDF si lo hay.

### Gastos (`/gastos`)

13. **Tarjeta «Gastado»:** cabecera con el periodo; la cifra; «{N} gastos · X € de IVA deducible»; `Badge` «{x} % de lo que facturas» (verde hasta el 20 %, amarillo por encima) y, si es ≤ 20 %, otro gris «Por debajo del 20 %: sano». Separador. `BarChart` `stacked` por categoría y mes, con leyenda y `showValues` en escritorio.
14. **Escritorio, columna izquierda bajo la tarjeta:** «Lo que ha cambiado» (hasta 3 tarjetas pequeñas: amarilla «Sube», verde «Baja», gris «Sin factura»; si no hay, no se pinta) y la lista por mes de la fase C con `Avatar` (`toneFor`) y el total del mes.
15. **Escritorio, columna derecha** (en móvil, tras la tarjeta principal: suscripciones, cambios, categorías, lista e IVA):
    - «Tus suscripciones»: «≈ X € al mes», «{N} suscripciones activas · ≈ Y € al año», una fila por suscripción (`Avatar`, nombre, una pista corta y el coste al mes) y, debajo, «Sin factura desde…» con nombre y mes.
    - «Por categoría»: como en la fase C, con los colores del punto 9.
    - IVA: «¿Por qué casi no hay IVA que deducir?», barra de dos partes y «El {x} % de lo que gastas viene de fuera de España o no lleva tu NIF: no tiene IVA que deducir».

**Comprueba:**
- `npm test` (con los tests nuevos de los puntos 3 a 8), `npm run typecheck`, `next build` y `next start` con `curl` y cookie a `/ventas`, `/ventas?periodo=3`, `/gastos`, `/gastos?periodo=3`, `/gastos?categoria=software_ia`, `/` e `/impuestos`, todas en `200`.
- Prueba de integración de las 56 conversaciones (cambia `nombreCorto`, que usa el aviso de fin de mes del cron).
- Vista previa a 1440 y 390 px frente a los cuatro dibujos. Con los datos reales: «26 % menos que en 2025 de enero a septiembre»; dependencia 97 % con riesgo; Gastos «7,6 % de lo que facturas»; Cursor sale como «Cursor»; las suscripciones salen de la regla del punto 6.

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-c2`)

- **Vela 0.8.0** instalada. Precondiciones cumplidas: PR #18 (fase C) fusionado en `wip/v0` y Vela 0.8.0 publicada (comprobado contra el registro de `@glinglo/vela-ds`).
- **Migración `007_ingresos_historicos.sql`:** añade `presentaciones.ingresos_acumulados`. **`scripts/historico-ingresos.sql`** creado con los 12 valores de la tabla del plan (2023–2025, 1T–4T) vía `insert ... on conflict do update`, más la unificación de Cursor; lo ejecuta Jose en el SQL Editor, no esta sesión.
- **`nombreCorto`** (`lib/texto.ts`): si el nombre acaba en un paréntesis, devuelve lo de dentro («Anysphere, Inc. (Cursor)» → «Cursor»); si no, sigue quitando la forma jurídica del final. Tests nuevos. También **`iniciales(nombre)`** (nuevo, para los `Avatar`: "Zapflow Oy" → "ZO", "Cursor" → "CU").
- **Funciones nuevas en `lib/libro.ts`** (todas con tests en `tests/libro.test.ts`): `comparativaAnual`, `proximaFactura`, `dependencia`, y `cargarHistoricoIngresos()` (consulta `presentaciones` por el 130). `FacturaLista` gana `pais_cliente` (la consulta de `cargarLibro` no lo traía; hace falta para la fila de cliente en Ventas).
- **Funciones nuevas en `lib/recordatorios.ts`** (tests en `tests/recordatorios.test.ts`): `suscripciones` y `cambiosGastos`, reutilizando `claveProveedor` y una nueva `agruparPorProveedor` (resumen por mes: confirmado sí/no e importe) de la que también pasa a depender `proveedoresQueFaltan`, sin duplicar la lógica de agrupación. `GastoProveedor` gana `importe?` (base + IVA), que solo usan estas dos funciones nuevas.
- **Colores por categoría** (`lib/categorias.ts`, `COLOR_CATEGORIA`): esta sesión no tenía acceso a los valores exactos del lienzo, así que son una aproximación razonable con los tokens de color ya existentes (`brand`, `blue`, `orange`, `yellow`, `green`, `gray`). Si no coinciden con el dibujo, hay que ajustarlos ahí (un solo sitio).
- **Hallazgo nuevo sobre la regla técnica:** `toneFor` (junto a `Avatar`) no se puede ni **llamar** desde una página de servidor, aunque sea una función pura — no es solo "no pasar funciones como prop". Apuntado como addenda a la "Regla técnica" de este plan. Arreglado con `components/AvatarProveedor.tsx` (`"use client"`), que las páginas usan pasándole solo el nombre.
- **Componentes de cliente nuevos:** `GraficoVentasMes.tsx` (`BarChart` de Ventas, con `showValues` en escritorio y sin en móvil, por el mismo patrón de doble render que `Cascada.tsx`), `GraficoGastosMes.tsx` (`BarChart` `stacked` de Gastos por categoría y mes, mismo patrón) y `AvatarProveedor.tsx`. `GraficoTipoIva.tsx` (de la fase C) se reutiliza tal cual para la barra de dos partes de Gastos.
- **Ventas (`app/(panel)/ventas/page.tsx`):** reescrita. Tarjeta «Facturado» con `CardHeader` (periodo dentro, como en Inicio), cifra, media mensual, `Badge` de la comparativa (solo con «Año») y `GraficoVentasMes`. Columna/sección con «Próxima factura» (tarjeta `bg-brand-100`, sin componente de cliente: `Button href` y `target="_blank"` son datos, no funciones), «Dependencia de un cliente» (`Meter` con umbral 0,7), «Clientes» (la `StackedBar` de siempre + fila con `AvatarProveedor`, país, tipo y %) y «De enero a… cada año» (barras propias, sin componente de Vela). Facturas en tabla (escritorio) o lista (móvil), con «Tipo» en `Badge` y sin los `Badge` «sin PDF»/«Selfconta» de la fase C (no estaban en el punto 12 de este plan). El orden es el mismo en escritorio y en móvil (una sola columna lateral), así que no hace falta duplicar nada con `order-*`.
- **Gastos (`app/(panel)/gastos/page.tsx`):** reescrita. El orden de las secciones es **distinto** en escritorio (dos columnas: tarjeta+cambios+lista a la izquierda, suscripciones+categorías+IVA a la derecha) y en móvil (tarjeta, suscripciones, cambios, categorías, lista, IVA): resuelto con una rejilla CSS (`lg:grid-cols-[1fr_320px]`) y `order-N` en móvil / `lg:col-start` + `lg:row-start` en escritorio para cada sección, en vez de duplicar el JSX. «Lo que ha cambiado» usa `CardMetrics` (de Vela, sin funciones) con un fondo (`bg-yellow-100`/`bg-green-100`/`bg-gray-100`) por tipo de cambio. El `% de lo que facturas` compara el gasto del periodo (base + IVA) con la base facturada del mismo periodo (de `libro.facturas`, ya cargado). «Faltan este mes», «Tus suscripciones» y «Lo que ha cambiado» usan una consulta aparte (`gastosRecientes`, desde octubre del año pasado) con `base` e `iva`, siempre relativa a hoy y no al periodo ni al año de la página, como pide el plan.
- **`npm test`** (131 tests, con los nuevos de `comparativaAnual`, `proximaFactura`, `dependencia`, `suscripciones`, `cambiosGastos`, `nombreCorto` e `iniciales`), **`npm run typecheck`** y **`npm run build`** sin errores.
- **Comprobación con `next start` + `curl`** (cookie de sesión, con la migración 007 **sin aplicar** en el Supabase de `.env.local`): `/`, `/gastos`, `/gastos?periodo=3`, `/gastos?categoria=software_ia` e `/impuestos` dan `200`; **`/ventas` y `/ventas?periodo=3` dan `500`** («column presentaciones.ingresos_acumulados does not exist»), porque `cargarHistoricoIngresos()` ya pide esa columna — el mismo patrón que la migración 006 sin aplicar en la fase C. Pendiente de que Jose aplique `007_ingresos_historicos.sql` (y, si quiere los datos históricos ya, `scripts/historico-ingresos.sql`) en el SQL Editor de Supabase; tras eso, repetir la comprobación de `/ventas`.
- **Prueba de integración de las 56 conversaciones:** sí se ha podido ejecutar en este entorno (hay Postgres y PostgREST locales) — `reset-db.sh` aplica también la migración 007 a la base de pruebas, así que ahí **sí** tiene la columna. Las 56 pasan.

## Fase C.3 · Retoques tras la revisión de la C.2 (24/11/2026)

**Aprobado por Jose el 24/11/2026**, tras ver la vista previa de la C.2. En la misma rama `plan/rediseno-c2` y el mismo PR #19.

**Las dos páginas**
1. **Aire bajo la cabecera, como en Inicio:** contenedor `flex flex-col gap-8` entre `PageHeader` y el contenido. `PageHeader` con subtítulo «Lo que has facturado en {año}» / «En qué se va el dinero en {año}».
2. **Subtítulo de la tarjeta principal = el periodo**, como «Resultados» de Inicio: «Acumulado de enero a hoy», «2T · de abril a junio»… (hoy dice «Ventas de 2026» / «Gastos de 2026», que repite la cabecera).
3. **Espacios de no separación** en todo texto hecho a mano con «%» o «€» (`70 %`, `20 %`, «De cada 100 €…»): hoy «70 %» se parte en dos líneas en la tarjeta de dependencia. Si hay más de dos sitios, una ayuda `pct(n)` junto a `euros()`.
4. **La franja «Para facturar o corregir una factura, díselo al bot»** se corta en la columna derecha: va al final de la columna izquierda (escritorio) y al final de la página (móvil), a todo el ancho.

**Ventas**
5. **Media al mes sobre los meses ya facturados:** hoy divide entre 11 (con noviembre, sin factura) y da 2.678 €; tiene que ser 29.460 / 10 = 2.946 €. Meses con alguna factura del periodo, o meses cerrados si no hay ninguna en el mes en curso.
6. **El `Badge` de la comparativa:** «26 % menos que en 2025 de enero a septiembre» (sin el «−» delante, que con «menos» es doble negativo); al subir, «12 % más que…». Signo con el valor absoluto.
7. **«Próxima factura»:** el mes con mayúscula («Noviembre · Zapflow Oy»); debajo del importe, el texto del modo (en paralelo: «La emite Selfconta: mándale el PDF al bot»), que hoy no sale; y el botón «Abrir el bot» en el estilo principal (oscuro), como en el dibujo.
8. **La barra del mes pendiente** lleva su valor como estimación: «≈ 3.060 €», para que no parezca facturado.
9. **Clientes:** el tipo como en la tabla y el dibujo: «ES · 21 % · −15 % · 3 %» en vez de «Nacional».

**Gastos**
10. **El gráfico de la tarjeta principal pasa a una sola serie: el total por mes** (como Ventas: mismo color de marca, `showValues`, mes en curso `pending` si no tiene gastos). Motivo: con 9 categorías la leyenda se monta sobre los valores y no se lee, y el «dónde» ya lo cuenta «Por categoría», que se queda tal cual (a Jose le encanta). Nada de donut: repite «Por categoría» y se lee peor que las barras.
11. **«Lo que ha cambiado» se quita como sección** (hoy solo dice «Sube» sin cifras y deja un hueco grande debajo). Lo útil pasa dentro de «Tus suscripciones»: en cada suscripción cuyo coste cambie (la regla de `cambiosGastos`), una pista corta bajo el nombre: «↑ antes 17 €» / «↓ antes 90 €».
12. **«Tus suscripciones» solo con las que siguen vivas:** activa = recurrente (2 de los 3 meses anteriores) **y** con gasto en el último mes cerrado. Hoy Apify sale activa (25 €) aunque no cobró en octubre.
    - La que era recurrente y no tiene gasto en el último mes cerrado sale como una fila gris al final: «Apify · sin factura en octubre» (sin importe). Así sirve de aviso de fin de mes.
    - **Fuera la lista «Sin factura desde…»:** mezcla bajas de hace meses con gastos que no son suscripciones (Meta Ads, ionos) y no ayuda a decidir nada.
    - Con los datos de hoy: Anthropic 90 € y Cursor 71 € → «≈ 161 € al mes · 2 suscripciones activas · ≈ 1.932 € al año», más la fila gris de Apify.
13. **El `Badge` del porcentaje con un decimal:** «7,6 % de lo que facturas» (hoy «8 %»).
14. **Tests:** actualiza los de `suscripciones` (Apify sin gasto en el último mes ya no es activa) y quita los de `cambiosGastos` que dejen de usarse (si la función se queda solo para la pista del punto 11, sus tests siguen).

**Comprueba:** `npm test`, `typecheck`, `build`, `curl` con cookie a `/ventas`, `/ventas?periodo=3`, `/gastos`, `/gastos?periodo=3` en `200`; integración solo si cambia algo que use el bot. En la vista previa: Ventas «≈ 2.946 € al mes de media» y «26 % menos…»; Gastos con barras de una serie sin solapes, suscripciones «≈ 161 € al mes» con la pista de Cursor y la fila de Apify, y ningún hueco grande en la columna izquierda.

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-c2`, fase C.3)

- **Punto 1 (aire + subtítulos):** las dos páginas dentro de un `flex flex-col gap-8` como Inicio. `PageHeader` de Ventas: «Lo que has facturado en {año}»; de Gastos: «En qué se va el dinero en {año}».
- **Punto 2 (subtítulo de la tarjeta = periodo):** mismo cálculo que «Resultados» de Inicio (`Acumulado de enero a hoy` / `Año {año} completo` / `{T} · de {mes} a {mes o "hoy"}`), copiado tal cual en Ventas y Gastos.
- **Punto 3 (NBSP en los porcentajes a mano):** nueva `pct(n, decimales?)` en `lib/fiscal.ts` (mismo espacio de no separación que `euros()`), con test. Sustituye todos los `{n} %` escritos a mano en Ventas y Gastos (dependencia, dos del `Meter`, comparativa, tipo de cliente, badge de gastos/facturado, IVA).
- **Punto 4 (franja al final):** en Ventas, sacada del `<aside>` a un `<div className="lg:col-start-1">` después de las dos columnas de la rejilla: en escritorio cae debajo de la columna izquierda (la rejilla la coloca en la siguiente fila de esa columna), y en móvil es el último elemento de la página.
- **Punto 5 (media mensual):** cuenta los meses del periodo con alguna factura, o cerrados (no el mes en curso) si no la tienen — así noviembre sin facturar no cuenta y la media sale sobre los meses ya facturados.
- **Punto 6 (signo de la comparativa):** quitado el `+`/`−` delante; siempre el valor absoluto con «más»/«menos».
- **Punto 7 (Próxima factura):** mes capitalizado (`capitaliza`, local a la página); se enseña siempre `proxima.texto` bajo el importe (en paralelo, «La emite Selfconta…»; si no, «Díselo al bot: «factura a…»», que ya traía `proximaFactura` pero no se pintaba); botón «Abrir el bot» a `variant="primary"`.
- **Punto 8 (barra del mes pendiente como estimación):** resuelto dentro de `GraficoMes` (antes `GraficoVentasMes`, ahora genérica para las dos páginas): compara cada valor con el del mes `pendiente` y le añade «≈ » si coincide. No es a prueba de empate exacto entre dos meses con el mismo importe, pero es el único mes `pendiente` en la práctica.
- **Punto 9 (tipo de cliente):** la fila de «Clientes» usa el mismo `detalleTipo` que la tabla de facturas (`21 % · −15 %` para nacional, el `Badge` de tipo para el resto) en vez de «Nacional» a secas.
- **Punto 10 (gráfico de Gastos a una serie):** `GraficoGastosMes.tsx` (apilado, 9 categorías) se queda sin uso y se ha borrado; Gastos usa la misma `GraficoMes` que Ventas, con «Gastado» como serie.
- **Puntos 11 y 12 (suscripciones):** `lib/recordatorios.ts` reescrito. `suscripciones()` ahora exige, para estar activa, recurrencia (2 de los 3 meses anteriores) **y** gasto confirmado en el último mes cerrado (antes bastaba con cualquier mes reciente, por eso Apify salía activa sin cobrar en octubre); si es recurrente pero no tiene ese gasto, pasa a `sinFacturaUltimoMes` (la fila gris, sin importe). Se quita `sinFacturaDesde` (la lista de bajas antiguas). La pista «↑/↓ antes X €» sale de `cambiosGastos()`, que `suscripciones()` llama por dentro y cuyo resultado (con el nuevo campo `antes`) adjunta a cada suscripción activa — la sección «Lo que ha cambiado» se ha quitado de la página. `cambiosGastos` se queda como función con sus propios tests, usada solo por `suscripciones`.
- **Punto 13 (un decimal):** `pct(pctSobreFacturado, 1)` → «7,6 % de lo que facturas».
- **Punto 14 (tests):** `tests/recordatorios.test.ts` actualizado: el caso de Apify ahora comprueba `sinFacturaUltimoMes` (antes `sinFacturaDesde`); el de Cursor comprueba `cambio: { tipo: "sube", antes: 17 }`; los de `cambiosGastos` siguen, con `antes` añadido a «sube»/«baja».
- **Rejilla de Gastos simplificada:** al quitar «Lo que ha cambiado» quedan 2 filas en la columna izquierda (tarjeta, lista) y 3 en la derecha (suscripciones, categorías, IVA); orden en móvil: tarjeta, suscripciones, categorías, lista, IVA.
- No he comprobado las cifras exactas del lienzo (2.946 €/mes, −26 %, 161 €/mes…) contra los datos reales de producción — solo la lógica con los tests. Jose puede confirmarlas en la vista previa.
- **`npm test`** (132 tests), **`npm run typecheck`** y **`npm run build`** sin errores. **`next start` + `curl`** con cookie a `/`, `/ventas`, `/ventas?periodo=3`, `/gastos`, `/gastos?periodo=3`, `/gastos?categoria=software_ia` e `/impuestos`: las siete dan `200` **sin ningún error en el registro** — la migración 007 ya está aplicada en el Supabase de `.env.local` (antes de esta fase daba 500 en `/ventas`, como apunté en la C.2).
- No he repetido la prueba de integración de las 56 conversaciones: estos cambios no tocan el bot (solo las páginas del panel y las funciones de `lib/libro.ts`/`lib/recordatorios.ts` que ya cubren sus tests unitarios); `proveedoresQueFaltan`, que sí usa el cron del bot, no cambia de comportamiento, solo de implementación interna (`agruparPorProveedor` compartida).

## Fase C.4 · Retoques tras la segunda revisión de la C.2 (24/11/2026)

**Aprobado por Jose el 24/11/2026.** En la misma rama `plan/rediseno-c2` y el mismo PR #19. Requiere Vela 0.8.1 (plan `2026-11-24-vela-0-8-1.md` de `vela-ds`: la etiqueta «70 %» del `Meter` ya no la pisa la línea); si aún no está publicada, haz el resto y deja ese punto para el final.

**Las dos páginas (escritorio)**
1. **Los `Badge` a la derecha de la cifra, no debajo:** la fila de la cifra es `flex items-end justify-between gap-4 flex-wrap`: a la izquierda, la cifra y su línea («11 facturas · …» / «81 gastos · …»); a la derecha, los `Badge` (en columna si son dos, alineados a la derecha). En móvil, debajo como ahora.
2. **Sin valores encima de las barras** (`showValues` fuera), como en Inicio: la cifra exacta sale en el tooltip al pasar el ratón y en la fila de detalle en móvil. Se lee más limpio y no compite con la cifra grande.
3. **Bug del «≈»:** `GraficoMes` decide la estimación comparando el valor (`v === valorPendiente`), así que octubre (3.060 €, ya facturado) sale como «≈ 3.060 €». Que lo decida el índice/`pending` del mes, nunca el valor. En Gastos, el mes en curso sin gastos no lleva valor ni «≈ 0 €».
4. **Abrir el PDF en un panel lateral, no en otra pestaña** (escritorio): al pulsar una factura (Ventas) o un gasto (Gastos), se abre el `Sheet` de Vela por la derecha (unos 640 px) con:
   - cabecera: número o proveedor, fecha e importe;
   - el archivo: PDF en un `<iframe>` (o `<object>`) de `/api/archivo?path=…`, a toda la altura; si es imagen (foto de un ticket), `<img>` ajustada al ancho;
   - abajo, «Abrir en otra pestaña» y «Descargar».
   - Comprueba que `/api/archivo` responde con `Content-Disposition: inline` y que nada impide mostrarlo en un `iframe` del mismo dominio.
   - En móvil, como ahora (otra pestaña): los visores de PDF dentro de un `iframe` van mal en iOS.
   - Es un componente de cliente propio (`VisorArchivo.tsx`) que recibe la ruta y los datos; la página no le pasa funciones.
5. **Ventas, tabla:** la columna «Tipo» como en Clientes: «21 % · −15 %» en vez de «Nacional».

**Gastos**
6. **Las dos columnas independientes:** hoy «Por categoría» empieza a la altura de la lista de la izquierda y deja un hueco bajo «Tus suscripciones». La derecha va en su propio `flex flex-col gap-4` (como en Ventas), sin compartir filas de grid con la izquierda.
7. **El porcentaje sobre la misma base que la cifra:** «7,7 %» sale de base + IVA (2.257,87 €), y la cifra grande es la base (2.251,13 €) → «7,6 %». Usa la base en los dos.

**Comprueba:** `npm test`, `typecheck`, `build`, `curl` con cookie a `/ventas` y `/gastos` en `200`. En la vista previa (escritorio): badges a la derecha de la cifra; barras sin números encima y octubre sin «≈»; al pulsar la 00336 o un gasto de Anthropic, el PDF en el panel lateral; en Gastos, «Por categoría» justo bajo «Tus suscripciones»; «7,6 % de lo que facturas».

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-c2`, fase C.4)

- **Vela 0.8.1:** no estaba publicada al empezar la fase; hecho todo lo demás primero y, al acabar, ya estaba publicada — instalada al final, con `npm test`/`typecheck`/`build`/`curl` repetidos después para comprobar que nada cambia con ella.
- **Punto 1 (badges a la derecha):** la fila de la cifra en las dos tarjetas principales es ahora `flex items-end justify-between gap-4 flex-wrap`; en móvil, al no caber, el `flex-wrap` los baja debajo como antes.
- **Punto 2 y 3 (barras y el bug del «≈»):** `GraficoMes` reescrito. Quitado `showValues`; ya no hay dos variantes de render por breakpoint (antes `hidden lg:block`/`lg:hidden` duplicados, ahora un único `BarChart`). Ya no decide el «≈» comparando valores (`v === valorPendiente`, el bug): ahora selecciona un mes (`selectedIndex`, con el mismo patrón de `Barras.tsx` de Inicio — en móvil, el último con datos; en escritorio, al pasar el ratón) y pinta una fila de detalle propia bajo el gráfico que mira `mes.pendiente` (el índice, no el valor) para decidir el «≈». El tooltip nativo de `BarChart` (sin «≈», con el importe tal cual) sigue siendo el detalle en escritorio. En Gastos, si el mes en curso no tiene gastos, `valor` es `null` (sin barra, con `pendingLabel="sin cerrar"` en el tooltip) en vez de una barra a cero con «≈ 0 €».
- **Punto 4 (`VisorArchivo.tsx`):** nuevo, de cliente. Al pulsar una factura o un gasto con archivo: en escritorio (`matchMedia("(min-width: 1024px)")`), abre un `Sheet` con el PDF en un `iframe` (o la foto en una `img`) de `/api/archivo?path=…`, más «Abrir en otra pestaña» y «Descargar»; en móvil, `window.open` en otra pestaña, como antes. **No recibe una función de la página**: recibe la fila ya pintada (`ListItem`, un `<button>`, un `<div>`…) como `children` y le añade su propio `onClick` con `cloneElement` — así la función que decide dónde abrirlo nunca cruza de la página de servidor a este componente. Comprobado con `curl` que `/api/archivo` no manda `Content-Disposition: attachment` ni `X-Frame-Options` (no hay cabecera `Content-Disposition` en absoluto, pero tampoco nada que lo fuerce a descarga o bloquee el `iframe`): un PDF real se ve bien embebido.
- **Punto 5 (tipo de cliente en la tabla):** la columna «Tipo» de Ventas usa ahora `detalleTipoFactura` (compartida con la fila de «Clientes») en vez de `Badge` con «Nacional»/«UE»/«Fuera UE».
- **Punto 6 (columnas independientes de Gastos):** vuelto al patrón de Ventas: un `<aside>` propio en `flex flex-col gap-4` con «Tus suscripciones», «Por categoría» e IVA, sin compartir filas de grid con la columna izquierda (tarjeta, lista, «Faltan este mes» y el texto final). **Efecto en el orden de móvil, no pedido explícitamente por este punto pero consecuencia directa de "como en Ventas":** antes era tarjeta → suscripciones → categorías → lista → IVA (fases C.2/C.3); ahora, al ser dos columnas independientes que se apilan en móvil, es tarjeta → lista → «Faltan este mes» → texto final → suscripciones → categorías → IVA. Apuntado por si no es lo que se quería: si hace falta recuperar el orden anterior en móvil habría que volver a la rejilla de 5 celdas con `order-N` (y entonces vuelve el hueco que resuelve este punto en escritorio) o duplicar el marcado por breakpoint.
- **Punto 7 (mismo porcentaje base):** `pctSobreFacturado` pasa a `base / facturadoBasePeriodo` (antes `(base + iva) / facturadoBasePeriodo`): ahora numerador y denominador son los dos la base, coherente con la cifra grande (`euros(base)`).
- **`npm test`** (132 tests), **`npm run typecheck`** y **`npm run build`** sin errores. **`next start` + `curl`** con cookie a `/`, `/ventas`, `/ventas?periodo=3`, `/gastos`, `/gastos?periodo=3`, `/gastos?categoria=software_ia` e `/impuestos`: las siete dan `200` sin errores en el registro, repetido tras instalar Vela 0.8.1.

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-c2`, retoque del orden en móvil de Gastos)

- **Pedido aparte, tras la C.4:** en móvil, «Tus suscripciones» y «Por categoría» tenían que volver a ir justo después de la tarjeta «Gastado» y antes de la lista (el orden de la C.2/C.3), sin que vuelva el hueco de escritorio que arregló el punto 6 de la C.4.
- **Gastos (`app/(panel)/gastos/page.tsx`):** la rejilla pasa a 3 celdas en vez de 2: la tarjeta (`lg:col-start-1 lg:row-start-1`), el `<aside>` de suscripciones/categorías/IVA (`lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start`, para que ocupe las dos filas de la izquierda sin que su altura dependa de la de la lista) y un bloque nuevo con el `Alert` de borradores, la lista por mes, «Faltan este mes» y el texto final (`lg:col-start-1 lg:row-start-2`). `lg:grid-cols-[minmax(0,1fr)_320px]` pasa a `_340px` (pedido en el mensaje). El orden del DOM es tarjeta → `aside` → bloque de la lista, igual en las dos anchuras: en móvil (`flex-col`) sale tal cual (el orden pedido); en escritorio la rejilla lo recoloca sin tocar el marcado.
- Comprobado con `curl` contra el HTML servido (cookie de sesión): el orden de las cabeceras en el documento es «Gastado» → «Tus suscripciones» → «Por categoría» → «Por qué casi no hay IVA que deducir» → (lista, «Faltan este mes» si aplica) → el texto ISP, y las clases `lg:col-start-*`/`lg:row-start-*`/`lg:row-span-2`/`lg:self-start` están donde pide el mensaje. No había herramienta de captura de pantalla disponible en esta sesión para comprobarlo visualmente a 390 y 1440 px; lo de arriba es la comprobación estructural equivalente. Pendiente de que Jose lo confirme en la vista previa.
- `npm test` (132), `npm run typecheck`, `npm run build` y `next start` + `curl` a las siete páginas: sin errores.



## Fase D · Impuestos (reescrita el 24/11/2026)

**Diseño aprobado por Jose el 24/11/2026** en el lienzo, fila «Propuesta 24/11 · Impuestos v2 (fase D)»: `ImpuestosEscritorio2` (`/impuestos`) y `TrimestreEscritorio2` (`/impuestos/2026/4`, modelo 130). En móvil, los dibujos `Impuestos` y `Trimestre` del 23/11 con los patrones de las fases B.3–C.4: las pestañas dentro de la tarjeta principal, los `Badge` debajo de la cifra, espacios de no separación en «€» y «%».

Rama `plan/rediseno-d` desde `wip/v0` (Vela 0.9.0). No se toca `lib/calculo.ts`. Sigue valiendo la «Regla técnica: Vela en páginas de servidor» y sus añadidos (`toneFor`, nada de render-props desde la página).

### Datos

1. **Migración `008_casillas_presentadas.sql`:** `alter table presentaciones add column if not exists casillas jsonb` («Casillas clave tal como se presentaron: para el 303, 110, 78, 87 y 71»).
2. **`scripts/historico-casillas.sql`** (lo ejecuta Jose): `update presentaciones set casillas = '{"110": …, "78": …, "87": …, "71": …}' where modelo = '303' and anio = … and trimestre = …`, con el `select` de comprobación (15 filas con casillas). Valores, de los justificantes (todo negativo quedó «a compensar»):

   | 303 | [110] | [78] | [87] | [71] |
   |---|---|---|---|---|
   | 2023 1T | 459,04 | 0 | 459,04 | −32,38 |
   | 2023 2T | 491,42 | 0 | 491,42 | −56,44 |
   | 2023 3T | 547,86 | 0 | 547,86 | −3,27 |
   | 2023 4T | 551,13 | 0 | 551,13 | −26,10 |
   | 2024 1T | 577,23 | 0 | 577,23 | −89,50 |
   | 2024 2T | 666,73 | 462,21 | 204,52 | 0,00 |
   | 2024 3T | 204,52 | 204,52 | 0 | 471,87 |
   | 2024 4T | 0 | 0 | 0 | 644,97 |
   | 2025 1T | 0 | 0 | 0 | −26,10 |
   | 2025 2T | 26,10 | 0 | 26,10 | −274,60 |
   | 2025 3T | 300,70 | 0 | 300,70 | −376,67 |
   | 2025 4T | 679,93 | 0 | 679,93 | −75,60 |
   | 2026 1T | 755,53 | 0 | 755,53 | −2,42 |
   | 2026 2T | 2,42 | 0 | 2,42 | −0,42 |
   | 2026 3T | 2,84 | 2,84 | 0 | 207,46 |

   Solo se muestran; **no entran en ningún cálculo** de IVAn (eso es la B3 del plan del cierre, en diciembre).

### Funciones (en `lib/`, todas con tests)

3. **`formatoSede(n)`:** sin separador de miles y con coma decimal (`1216,02`; negativos con `-`).
4. **`sinDatos(libro)`** y **`cargarAniosConPresentaciones()`**, como decía el apartado «Años anteriores a IVAn» (abajo).
5. **`saldoIvaCompensar(presentaciones303)`:** recorre los 303 en orden; el [110] esperado de cada trimestre es el [87] del anterior más lo que dejó «a compensar» (−[71] si fue negativo). Si un [110] presentado es **menor** que el esperado, devuelve el trimestre y lo que falta. Test con los datos reales: 2T 2026, esperado 757,95 €, presentado 2,42 € → faltan 755,53 €. El 4T 2025 trae 2,56 € de más (sin explicar, a favor de Jose): eso no se avisa; solo se avisa lo que falta.
6. **Frases del porqué** (`lib/impuestos.ts` o donde encaje), con tests:
   - 303: 0 → «Lo que cobras de IVA y lo que deduces se compensan»; > 0 → «IVA cobrado menos el deducible»; < 0 → «Te sale a favor: queda para compensar».
   - 130: [07] ≤ 0 → «Lo pagado de 1T a 3T ya cubre el 20 % de tu rendimiento del año» (en el 1T: «Tus gastos superan…»); > 0 → «20 % del rendimiento menos lo ya pagado y las retenciones».

### `/impuestos`

7. **Tarjeta «Próximo»** (lila, radio 16; roja como la tarjeta urgente de Inicio si quedan ≤ 10 días de plazo): eyebrow «Próximo · en {N} días» (o «Quedan {N} días» con el plazo abierto, con `cuandoPaso`), título «{t}T de {año}», plazo y domiciliación (`plazoTrimestral`), las dos cifras previstas de IVAn (303 [71] y 130 [19]) con su frase, `Badge` «Provisional» si el trimestre no ha terminado, botón «Preparar el {t}T» y, en el 4T, «También 349 y 390».
8. **«Presentados en {año}»:** escritorio, tabla (Trimestre con enlace, Presentado, 303 con `Badge` «Ingresado» / «A compensar» / «Resultado cero», 130, `Badge` «Presentado»); móvil, lista. Debajo, en `text-caption`, «El 130 de la gestoría no incluía tu cuota de autónomo como gasto; por eso IVAn calcula otra cifra», **solo** si algún 130 presentado difiere de IVAn.
9. **Columna derecha** (en móvil, tras «Presentados»):
   - **Aviso del saldo** (amarillo), si `saldoIvaCompensar` encuentra algo: «A revisar en el cierre · {X} € de IVA a tu favor · La gestoría no los arrastró en el 303 del {t}T. Decidimos en enero si se compensan en el 4T o pides la devolución.»
   - **«Pagado en {año}»:** total; «IRPF a cuenta X · IVA Y»; `BarChart` `stacked` por trimestre (IRPF + IVA ingresado), con el trimestre en curso `pending`.
   - **«Lo pagado cada año»:** una barra por año de `presentaciones` (130 [19] + 303 positivos), el año en curso en lila con «hasta {t}T».
   - **«Resumen anual»:** filas al 390 y al 349 con su pista.
10. **Años sin datos** (`sinDatos`): como el apartado de abajo; además, sin aviso del saldo si no hay casillas y con «Lo pagado cada año» igual.

### `/impuestos/[anio]/[t]`

11. **Cabecera:** «‹ Impuestos», `h1` «{t}T de {año}» y el plazo como subtítulo.
12. **Tarjeta principal:** título «Modelo {m} · {IVA|IRPF|UE}» y subtítulo; las pestañas 303 · 130 · 349 (`SegmentedControl` en modo pestañas, `?m=`) en la cabecera de la tarjeta, como el periodo de Inicio; «A ingresar · casilla [x]» en grande con su frase; a la derecha los `Badge` («Provisional» o «Presentado el dd/mm»; en el 130, «Cuota de autónomo incluida»). Si está presentado y no coincide con IVAn: «Presentado X € · IVAn calcula Y €» y el motivo conocido.
13. **Casillas:** rejilla de 2 columnas (1 en móvil); cada una con su número, nombre, importe y `CopyValue` (copia `formatoSede`); a 0 en gris; resaltadas la 07 y la 19 (130) y la 71 (303). En el 303, también [110], [78] y [87] (de lo calculado; si el trimestre está presentado y hay `casillas`, las presentadas). El 349, como lista (clave, nombre, VAT, base).
14. **Columna derecha:** «Plazo» (lila: días, fechas, domiciliación, avisos del bot); «Cómo presentarlo» (4 pasos según el modelo y «Abrir la Sede», `target="_blank"`); «Este trimestre también» (los otros modelos con su estado).
15. **Años sin datos:** solo el resultado presentado (303 [71] y 130 [19], con la fecha) y la línea gris.

### `/impuestos/[anio]/390`

16. Mismo patrón: cabecera con «‹ Impuestos», tarjeta con las casillas en rejilla con `CopyValue`, y el enlace compensar/devolver. Sin datos: la línea gris, nada a cero.

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
- `npm test` (con `formatoSede`, `sinDatos`, `cargarAniosConPresentaciones`, `saldoIvaCompensar` y las frases), `npm run typecheck`, `next build` y `next start` con `curl` y cookie a `/impuestos`, `/impuestos?anio=2025`, `/impuestos?anio=2023`, `/impuestos/2026/3`, `/impuestos/2026/4?m=130`, `/impuestos/2026/4?m=349`, `/impuestos/2023/1` y `/impuestos/2026/390`, todas en `200`.
- Prueba de integración de las 56 conversaciones (cambian enlaces y textos que usa el bot, como `/panel` a un trimestre).
- Con los datos reales: «Pagado en 2026» = 4.640,92 € (IRPF 4.433,46 · IVA 207,46); aviso de 755,53 €; 4T con 303 y 130 a 0 €; 1T con 1.503,78 € presentado frente a 1.216,02 € de IVAn; `/impuestos?anio=2025` con los 4 trimestres (−26,10 / −274,60 / −376,67 / −75,60 y 1.728,18 / 2.496,92 / 1.534,39 / 1.442,56) y «Pagado en 2025» = 7.202,05 €, sin ningún 0,00 € calculado.
- Copiar una casilla en el móvil pega `4433,46`.
- El selector de Impuestos ofrece 2026, 2025, 2024 y 2023; el de Inicio, Ventas y Gastos, solo 2026.
- Vista previa a 1440 y 390 px frente a los dibujos.

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-d`)

- **Datos:** `supabase/migrations/008_casillas_presentadas.sql` (columna `presentaciones.casillas`). `scripts/historico-casillas.sql` con los 15 trimestres de 303 de la tabla del plan. **El 130 por trimestre solo se ha podido rellenar para 2025** (1.728,18 / 2.496,92 / 1.534,39 / 1.442,56 €, los mismos que da la «Comprueba» del plan como referencia): para 2023 y 2024 el plan solo da el total anual del 130 (en `historico-ingresos.sql`, como `ingresos_acumulados`, que es otra cosa), no el desglose por trimestre, y `presentaciones` necesita una fila por trimestre. Por eso el punto opcional «Histórico» (filas anuales 130+303 de 2023-2025) **no se ha hecho**: con 2023 y 2024 sin 130 por trimestre, «Pagado en 2023/2024» en el panel saldría incompleto (solo la parte del 303). Jose puede rellenarlos más adelante con un script parecido si tiene el desglose a mano.
- **`lib/fiscal.ts`:** `formatoSede(n)`, con test.
- **`lib/libro.ts`:** `sinDatos(libro)`; `rangoAniosDesde(anioMin, anioActual)` (pura, con test) y `cargarAniosConPresentaciones(anioActual)` (la consulta); `cargarPresentaciones303()` y `cargarPagadoPorAnio()` (consultas, sin test, como `cargarHistoricoIngresos`). `Presentacion` gana `casillas: Casillas303 | null`.
- **`lib/impuestos.ts` (nuevo):** `frase303`, `frase130` y `saldoIvaCompensar`, todas con tests — ninguna toca `lib/calculo.ts`. `saldoIvaCompensar` reproduce el ejemplo del plan exacto: 2T 2026, esperado 757,95 €, presentado 2,42 € → faltan 755,53 €.
- **Importante — `casillas` fuera de la consulta compartida `cargarLibro()`:** probado primero metiendo `casillas` en el `select` de `cargarLibro` (como se hizo con `ingresos_acumulados` en la C.2), pero como `cargarLibro` la usan **todas** las páginas del panel, sin la migración 008 aplicada se caía `/`, `/ventas` y `/gastos` además de Impuestos — mucho más radio de explosión que las migraciones anteriores. Revertido: `cargarLibro` no pide `casillas` (pone `null` siempre) y las páginas de Impuestos que la necesitan la piden aparte (`cargarPresentaciones303()`, o una consulta suelta en `/impuestos/[anio]/[t]` para el trimestre concreto), **sin lanzar si falla la consulta** (al estilo de `cargarPresentaciones303`, que si la migración no está devuelve `[]` en vez de un error): así, sin la migración 008, solo se resiente lo que depende de verdad de `casillas` (el aviso del saldo y las casillas 110/78/87 presentadas, que caen al cálculo de IVAn), y el resto del panel sigue en pie. Apuntado como patrón a seguir la próxima vez que se añada una columna de uso estrecho.
- **`components/AccionesCabecera.tsx`:** nueva prop opcional `anios` (si no se pasa, sigue con los 3 últimos de siempre); Impuestos le pasa `cargarAniosConPresentaciones(anioActual)`, Inicio/Ventas/Gastos no cambian.
- **Componentes de cliente nuevos:** `PestanasModelo.tsx` (pestañas 303 · 130 · 349, cambia `?m=`, mismo patrón que `Periodo.tsx`) y `GraficoPagos.tsx` (`BarChart` apilado IRPF+IVA por trimestre).
- **`/impuestos/[anio]/[t]`:** reescrita con pestañas en la cabecera de la tarjeta, cifra grande con su frase, badges a la derecha, casillas en `CopyValue` (2 columnas), 349 como lista, y la columna «Plazo»/«Cómo presentarlo» (pasos fijos por modelo, botón a `https://sede.agenciatributaria.gob.es` — no hay enlace profundo al modelo concreto, la Sede va por sesión)/«Este trimestre también». Años `sinDatos`: solo el resultado presentado y la línea gris, o «No hay datos de este trimestre» si no hay nada.
- **`/impuestos/[anio]/390`:** mismo patrón, casillas con `CopyValue`, sin datos: mensaje explicando por qué (no `notFound()`, para no dar un 404 al pulsar el enlace del 4T cuando aún no hay 390 que calcular).
- **`/impuestos` (índice):** tarjeta «Próximo» (`NoticeCard`, `urgent` si quedan ≤ 10 días de un plazo abierto, `brand` si no) calculada con `plazoAbierto`, igual que el paso «plazo» de `siguientesPasos`; «Presentados en {año}» (tabla/lista); columna derecha con el aviso del saldo (si `saldoIvaCompensar` encuentra algo, solo en el año en curso), «Pagado en {año}» (calculado por IVAn, con `GraficoPagos`) y «Lo pagado cada año» (de `presentaciones`, no recalculado). Años `sinDatos`: lista de lo presentado y el total, sin la tarjeta «Próximo» ni el aviso del saldo.
- **`components/Casillas.tsx` queda sin uso** tras esta fase (las 3 páginas que lo usaban ya no lo hacen). `components/Nav.tsx` y `components/Filas.tsx` **ya estaban sin usar desde antes** de esta fase (no los importa nada): comprobado con una búsqueda de sus imports en todo `app/` y `components/`. Los tres, y el CSS antiguo que solo ellos usan, quedan listos para borrarse en la fase E sin esperar a nada más — no los he tocado porque esa fase es la que lo tiene asignado explícitamente.
- **No verificado con los datos reales de producción:** las cifras exactas de la «Comprueba» (4.640,92 €, 1.216,02 € del 1T, etc.) no se han comprobado contra Supabase en esta sesión; la lógica está probada con los tests y la integración, pero la comprobación visual con los números reales queda para Jose en la vista previa.
- **`npm test`** (148 tests, con los nuevos de `formatoSede`, `sinDatos`, `rangoAniosDesde` y `lib/impuestos.ts`), **`npm run typecheck`** y **`npm run build`** sin errores.
- **`next start` + `curl`** con cookie a `/`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos?anio=2025`, `/impuestos?anio=2023`, `/impuestos/2026/3`, `/impuestos/2026/4?m=130`, `/impuestos/2026/4?m=349`, `/impuestos/2023/1` e `/impuestos/2026/390`: las once dan `200`, **incluso sin la migración 008 aplicada** en el Supabase de `.env.local` (gracias a que `casillas` no está en la consulta compartida). Pendiente de que Jose aplique `008_casillas_presentadas.sql` y, si quiere el histórico ya, `scripts/historico-casillas.sql`, en el SQL Editor de Supabase; con la migración aplicada, el aviso del saldo y las casillas 110/78/87 presentadas deberían aparecer.
- **Prueba de integración de las 56 conversaciones:** todas pasan (en la base local, con la migración 008 ya aplicada por `reset-db.sh`). No hizo falta cambiar ningún enlace ni texto del bot: el único enlace de Impuestos que usa el agente (`resumen_390` → `/impuestos/{anio}/390`) ya apuntaba bien desde antes; `/panel` sigue mandando a `/` (Inicio), sin cambios.

## Fase D.1 · Años anteriores con la misma estructura que el año en curso (24/11/2026)

Al revisar la vista previa, `/impuestos?anio=2025` queda como una lista suelta, no como el resto del panel. Hay tres problemas:
- la etiqueta «Presentados» queda pegada al subtítulo, porque falta el `gap-8` de la rama con datos;
- todo va a una columna;
- no hay gráfico ni comparativa entre años.

Los datos ya están en Supabase: los importes de `presentaciones` y, desde la migración 008, las casillas del 303. Así que los años `sinDatos` pueden usar la misma maqueta que 2026. Lo único que cambia es la fuente: lo presentado en vez de lo calculado.

**Regla:** en `/impuestos` y `/impuestos/[anio]/[t]` no hay dos maquetas. La rama `sinDatos` usa el mismo esqueleto (contenedor `flex flex-col gap-8`, rejilla `lg:grid-cols-[minmax(0,1fr)_340px]`, mismas tarjetas) y solo oculta lo que no tiene sentido sin facturas.

### `/impuestos?anio=X` sin datos

**Columna izquierda.** Tarjeta «Presentados en {año}» con la misma tabla que en 2026:
- Trimestre: enlace a `/impuestos/{año}/{t}`.
- Presentado: la fecha.
- 303: importe [71] y badge («A compensar» / «Ingresado» / «Resultado cero»).
- 130: importe [19].
- En móvil, la misma lista con enlace que en 2026.
- La línea gris «Presentado por la gestoría…» va dentro de la tarjeta, al pie, como `text-caption`.

**Columna derecha:**
- «Pagado en {año}»: total, «IRPF a cuenta X · IVA Y» y `GraficoPagos` por trimestre, alimentado desde `presentaciones` (130 = `importe`; IVA = `max(0, importe del 303)`). 2025 → IRPF 7.202,05 € · IVA 0 €.
- «Lo pagado cada año»: la misma tarjeta, con el año elegido resaltado.
- Sin «Próximo», sin aviso del saldo y sin «Resumen anual», porque no hay 390 que calcular.

**Mejora también para 2026:** en la tabla «Presentados», que las columnas 303 y 130 enseñen el importe además del badge. Hoy en escritorio solo sale el badge y hay que entrar al trimestre para ver la cifra.

### `/impuestos/[anio]/[t]` sin datos

- Mismo esqueleto que con datos: tarjeta con las pestañas 303 · 130 y columna derecha. No hay pestaña 349, porque de esos años no hay facturas.
- Subtítulo: «Presentado el {fecha}», en vez de «Plazo: del … al …», que no aporta nada en un trimestre cerrado.
- **303:** cifra grande [71] con `frase303`, y la rejilla de casillas con `CopyValue` usando las casillas presentadas ([110], [78], [87], [71]). Sin casillas calculadas.
- **130:** cifra grande [19], el importe presentado. Sin desglose, porque no lo tenemos.
- Columna derecha: solo la línea gris. Sin «Cómo presentarlo» ni «Este trimestre también».

**Comprueba:**
- `/impuestos?anio=2025` a 1440 px: dos columnas como 2026. Tabla con −26,10 / −274,60 / −376,67 / −75,60 y 1.728,18 / 2.496,92 / 1.534,39 / 1.442,56. «Pagado en 2025» = 7.202,05 € con gráfico.
- `/impuestos?anio=2024`: 303 del 3T 471,87 «Ingresado» y del 4T 644,97 «Ingresado». «Pagado en 2024» = 9.933,21 € (IRPF 8.816,37 · IVA 1.116,84).
- `/impuestos/2024/2`: [110] 666,73 · [78] 462,21 · [87] 204,52 · [71] 0,00.
- Móvil a 390 px: todo apilado, con la misma separación que 2026.
- `npm test`, `npm run typecheck`, `next build` y `curl` a las once rutas de la fase D.

### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-d`)

- **`/impuestos` unificada:** una sola función de página; la rama `sinDatos` ya no tiene su propio `return` con otra maqueta. Se calcula una lista común `filas: FilaTrimestre[]` (trimestre, fecha, `[71]`, `[19]`, si el 130 está presentado) desde `resumenTrimestre` cuando hay datos, o desde `libro.presentaciones` cuando no, y el resto de la página (tabla/lista «Presentados», `GraficoPagos`, «Lo pagado cada año») es el mismo JSX para los dos casos; solo «Próximo», el aviso del saldo y «Resumen anual» se condicionan a `datos`.
- **Mejora de la tabla «Presentados» (también en 2026):** las columnas 303 y 130 llevan ahora el `Badge` y el importe juntos (antes solo el `Badge`; había que entrar al trimestre para ver la cifra).
- **`/impuestos/[anio]/[t]` unificada** igual: la tarjeta principal, las pestañas y la rejilla de casillas son el mismo marcado con y sin datos. Cambios por rama:
  - `PestanasModelo` gana la prop `modelos` (opcional): sin datos, solo `["303", "130"]` (no hay 349 de esos años).
  - Subtítulo de la cabecera: el plazo con datos, «Presentado el {fecha}» sin ellos.
  - Casillas: con datos, la rejilla completa de siempre; sin datos, solo `[110]`/`[78]`/`[87]`/`[71]` tal como se presentaron (si hay `casillas`, vía la misma consulta aparte de la fase D) o, si no hay casillas guardadas, un único `CopyValue` con el resultado presentado.
  - Columna derecha: con datos, «Plazo»/«Cómo presentarlo»/«Este trimestre también»; sin datos, solo la línea gris, sin tarjetas.
- **Comprobado con los datos reales de producción** (la migración 008 y `historico-casillas.sql` ya estaban aplicados en Supabase cuando he probado esto, a diferencia de la fase D): `/impuestos?anio=2025` da «Pagado en 2025» = 7.202,05 € y la tabla con −26,10 €/1.728,18 € en el 1T (y el resto de trimestres, igual que pide la «Comprueba»); `/impuestos?anio=2024` da «Pagado en 2024» = 9.933,21 € (IRPF 8.816,37 € · IVA 1.116,84 €); `/impuestos/2024/2` da `[110]` 666,73 €, `[78]` 462,21 € y `[71]` 0,00 €. Las cuatro cifras, exactas a las de la «Comprueba» del plan.
- **`npm test`** (148, sin tests nuevos: esta fase no añade funciones, solo reordena las páginas), **`npm run typecheck`** y **`npm run build`** sin errores. **`next start` + `curl`** a las trece rutas (las once de la fase D más `/impuestos?anio=2024` e `/impuestos/2024/2`): todas en `200`. **Prueba de integración de las 56 conversaciones**: todas pasan (en la base local).
- No he podido comprobar la vista a 390 px con una herramienta de captura de pantalla (no disponible en esta sesión): comprobado por lectura del HTML servido que la rama sin datos usa la misma rejilla (`lg:grid-cols-[minmax(0,1fr)_340px]`) y el mismo `flex flex-col gap-8` que 2026, así que en móvil (sin el prefijo `lg:`) debería apilarse igual. Pendiente de que Jose lo confirme en el Mac o en el móvil.

### Retoque D.1: en 2026, lo presentado manda sobre lo calculado (24/11/2026)

En el año en curso, `/impuestos` usa `m130.aIngresar` y `m303.c71` (el cálculo de IVAn) para:
- la tabla «Presentados»;
- «Pagado en {año}»;
- `GraficoPagos`.

El 1T de 2026 se presentó con 1.503,78 € de 130, pero IVAn calcula 1.216,02 € porque cuenta la cuota de autónomo como gasto. Así que la tabla «Presentados» enseña una cifra que no se presentó, y el «Pagado» suma lo que no se pagó.

**Regla:** si el trimestre tiene fila en `presentaciones` con `importe` no nulo, se usa ese importe:
- para el 130, `importe`;
- para el 303, `importe` ([71]); en «Pagado» y en el gráfico, `max(0, importe)`.

El cálculo de IVAn solo se usa para los trimestres sin presentar (hoy, el 4T), que siguen marcados como `pendiente` en el gráfico. Es la misma fuente que los años sin datos: la rama con datos solo añade lo calculado donde falta lo presentado.

- **`/impuestos`:**
  - Tabla, «Pagado en {año}» y gráfico con esa regla.
  - La nota «El 130 de la gestoría no incluía tu cuota de autónomo como gasto…» se queda, con `algunDifiere` como ahora.
  - «Lo pagado cada año» ya sale de `presentaciones`; no cambia.
- **`/impuestos/[anio]/[t]` con datos y el modelo ya presentado:**
  - La cifra grande es la presentada.
  - Si difiere, la línea de debajo pasa a «IVAn calcula X € (cuenta tu cuota de autónomo como gasto)», en vez de «Presentado X · IVAn calcula Y».
  - Las casillas del 130 siguen siendo las calculadas, para ver de dónde sale la diferencia. La [19] se titula «Resultado según IVAn».
- **Sin presentar:** igual que ahora.

**Comprueba:**
- `/impuestos` (2026): tabla 1T 130 = 1.503,78 €. «Pagado en 2026» = **4.640,92 €** (IRPF 4.433,46 · IVA 207,46).
- `/impuestos/2026/1?m=130`: cifra grande 1.503,78 € y «IVAn calcula 1.216,02 €…».
- 2025 y 2024 siguen como en la D.1.
- `npm test`, `npm run typecheck`, `next build` y `curl` a las trece rutas.

#### Notas de ejecución (Claude Code, 24/11/2026, rama `plan/rediseno-d`)

- **`/impuestos`:** en la rama `datos`, cada trimestre usa `p303?.importe ?? m303.c71` y `p130?.importe ?? m130.aIngresar` (en vez de siempre lo calculado) para la fila de la tabla, `irpfAnio`/`ivaAnio` y `GraficoPagos`. `pendiente` en el gráfico pasa de "es el trimestre de hoy" a "no tiene `303.importe` presentado", que es justo el 4T mientras no se presente. `algunDifiere` sigue comparando contra el 130 calculado, sin cambios.
- **`/impuestos/[anio]/[t]`:** separado `calculado` (lo que da `modelo303`/`modelo130`) de `aIngresarGrande` (lo presentado si `presentadoEste`, si no lo calculado); `frase303`/`frase130` siguen leyendo `calculado`, no la cifra grande. La línea de diferencia pasa a «IVAn calcula X €» (con «(cuenta tu cuota de autónomo como gasto)» solo en el 130, como pedía el plan); la rejilla de casillas del 130 sigue viniendo de `calculado` sin tocar, con la [07] retitulada «Resultado según IVAn». El 303 no cambia su rejilla de casillas (ya usaba lo presentado en 110/78/87 desde la D).
- **Comprobado con los datos reales:** `/impuestos` (2026) → 1T 130 = 1.503,78 € en la tabla, «Pagado en 2026» = 4.640,92 € (IRPF 4.433,46 € · IVA 207,46 €), igual que pide la «Comprueba». `/impuestos/2026/1?m=130` → cifra grande 1.503,78 € y la línea «IVAn calcula X € (cuenta tu cuota de autónomo como gasto)». **La X de esa línea da 1.208,93 €, no los 1.216,02 € del plan**: la cifra exacta depende de la cuota de autónomo y los gastos de enero-marzo tal como están en Supabase en el momento de comprobarlo, que ha podido cambiar entre que se escribió el plan y esta ejecución (unas horas después, el mismo día). La lógica es la correcta (lo presentado manda, lo calculado se explica con el motivo); la cifra exacta no se ha forzado a coincidir. 2025 y 2024 siguen iguales que en la D.1 (comprobado, sin cambios).
- **`npm test`** (148, sin tests nuevos: este retoque no añade funciones de `lib/`, solo cambia qué datos usan las páginas), **`npm run typecheck`** y **`npm run build`** sin errores. **`next start` + `curl`** a las trece rutas de la D.1 más `/impuestos/2026/1` y `/impuestos/2026/1?m=130`: todas en `200`. **Prueba de integración de las 56 conversaciones**: todas pasan (en la base local).

## Fase E · Segundo nivel y limpieza

### E.1 · Inicio: «Te queda» después del IRPF a cuenta (añadido el 24/11/2026)

Jose quiere ver en Inicio lo que le queda de verdad. El rendimiento neto no cambia: es la base del 130 y de la Renta. Lo que se añade es lo que va después.

**Qué entra y qué no:**
- **IVA (303): no entra.** No es dinero de Jose y los ingresos ya van sin IVA. El saldo a compensar tampoco: es a su favor y se ve en Impuestos.
- **IRPF a cuenta: sí entra**, en dos partes:
  - **Pagado:** los importes del 130 presentados (`presentaciones`, modelo 130) más las retenciones de las facturas (`pyg().retenciones`).
  - **Por pagar:** el 130 del trimestre que aún no se ha presentado, estimado con `modelo130(d, anio, t).aIngresar`. Por ejemplo, en noviembre es el 4T, que se paga en enero. Si sale 0, la línea no aparece.

**Con el periodo seleccionado:**
- **Año:** suma de los 130 de los trimestres del año más las retenciones del año. «Por pagar» solo si hay un trimestre sin presentar.
- **1T…4T:** el 130 de ese trimestre (el presentado o, si no lo está, el estimado) más las retenciones de las facturas de ese trimestre. Así cuadra con «solo ese trimestre»: los importes del 130 ya son por trimestre.

**Función nueva en `lib/libro.ts`, con tests:** `irpfACuenta(libro, presentaciones, anio, periodo, hoy) → { pagado130, retenciones, porPagar, total }`. Casos:
- 2026 con 1T–3T presentados y el 4T estimado.
- Un trimestre presentado.
- Un trimestre sin presentar.
- 130 a 0.

**En la tarjeta «Resultados»:**
- La `Cascada` termina en «Rendimiento neto», como ahora, y sigue con dos filas en otro estilo, separadas por una línea:
  - «IRPF a cuenta» en negativo. Con «Por pagar», detalle debajo: «4.586 € pagados + ≈ X € del 4T (se paga en enero)».
  - **«Te queda ≈ …»** en negrita.
- Nota corta bajo la cascada: «El IVA no cuenta: no es tuyo. La Renta ajusta el IRPF: puede salir a pagar o a devolver».
- La cifra grande sigue siendo el rendimiento neto, que es la que cuadra con el 130 y la Renta.
- La frase «De cada 100 € que facturas, te quedan X €» pasa a «… te quedan X € antes del IRPF».
- El tooltip «Antes del IRPF de la Renta…» se queda.
- Móvil igual, con el mismo orden.

**Comprueba:** con «Año 2026», «IRPF a cuenta pagado» = 130 de 1T–3T + retenciones ≈ 4.586 €. «Te queda» = rendimiento neto − IRPF a cuenta (pagado + por pagar).

#### Notas de ejecución (Claude Code, 25/11/2026, rama `plan/rediseno-e1`)

- **`irpfACuenta(libro, presentaciones, anio, periodo, hoy)`** en `lib/libro.ts`, con tests (año con 1T-3T presentados y el 4T estimado; un trimestre presentado; un trimestre sin presentar; 130 a 0 sin que `porPagar` se añada). `pagado130` suma el `importe` de `presentaciones` (modelo 130) de los trimestres del periodo que ya lo tienen; `porPagar` suma `modelo130(...).aIngresar` de los que no, solo si sale positivo; `retenciones` sale de `libro.facturas` filtradas por el rango del periodo (año o trimestre), no de `pyg`, para no tener que exportar nada nuevo de `lib/calculo.ts`. `total = pagado130 + retenciones + porPagar`.
- **`app/(panel)/page.tsx`:** bajo la `Cascada` (mismo `lg:basis-2/3`, sin tocar `Waterfall`), una línea «IRPF a cuenta −{total}», el detalle «{pagado130+retenciones} pagados + ≈ {porPagar} del {t}T (se paga en {mes de apertura del plazo de ese trimestre})» solo si `porPagar > 0`, y «Te queda ≈ {rendimientoNeto − total}» en negrita. Nota corta debajo de toda la fila (cascada + resultados), no solo bajo la columna de la cascada: una sola línea a todo el ancho de la tarjeta es más simple que partirla por columna y no cambia el contenido. La frase de margen pasa a «…te quedan X € antes del IRPF».
- **Trimestre pendiente de la línea de detalle:** no lo devuelve `irpfACuenta` (la función no distingue qué trimestre concreto generó `porPagar`); la página lo calcula aparte como `periodo ?? (anio actual ? trimestre de hoy : 4)`, que vale mientras como mucho un trimestre esté sin presentar a la vez (el caso real).
- **Comprobado con los datos reales:** «Año 2026» → «IRPF a cuenta −4.586 €» (exacto a la «Comprueba» del plan) y «Te queda ≈ 15.985 €»; no sale la línea de detalle porque el 4T estimado da 0 o menos (ya cubierto por los pagos de 1T-3T), que es justamente el caso «si sale 0, la línea no aparece» que pedía el plan. «De cada 100 € que facturas, te quedan 70 € antes del IRPF.» se ve bien.
- **`npm test`** (152, con los 4 casos nuevos de `irpfACuenta`), **`npm run typecheck`** y **`npm run build`** sin errores. **`next start` + `curl`** a `/`, `/?periodo=3`, `/ventas`, `/gastos` e `/impuestos`: todas en `200`. **Prueba de integración de las 56 conversaciones**: todas pasan (no tocan Inicio, pero `irpfACuenta` usa `libro.presentaciones`/`facturas`, que sí comparte código con el bot — comprobado por si acaso).
- **No hecho en esta sesión** (es la parte de la fase E que sigue después de la E.1 en el plan, no pedida ahora): las páginas `/detalle/impuestos-y-cuota`, `/detalle/salud` y `/detalle/como-se-calcula`, ni la limpieza de `components/Casillas.tsx`/`Nav.tsx`/`Filas.tsx` y el CSS antiguo.

### E.2 · «Cómo se calcula» y limpieza (25/11/2026; sustituye a lo que quedaba de la fase E)

**Qué cambia respecto al plan original.** De las tres pantallas de detalle del lienzo solo se hace «Cómo se calcula». Las otras dos ya están cubiertas:
- **Impuestos y cuota:** la cuota está en la cascada de Inicio; el IRPF a cuenta y «Te queda», también (E.1); el resto, en Impuestos (fase D). `estadoYCuota` de `lib/inicio.ts` no lo usa nadie: se borra, con su test.
- **Salud:** el margen está en Inicio, la dependencia de un cliente en Ventas (`Meter`) y el gasto por categoría en Gastos. Otra pantalla repetiría cifras. `salud()` se queda porque Inicio usa el margen.

#### 1. `/detalle/como-se-calcula`

- `PageHeader` «Cómo se calcula», con «‹ Inicio» y el mismo selector de periodo que Inicio (`?anio=&periodo=`), para que las cifras sean las mismas que el usuario estaba mirando.
- **Una tarjeta, con una fila por paso de la cascada.** Cada fila lleva la cifra del periodo y una frase fija que explica de dónde sale:
  - **Facturado (sin IVA):** suma de las bases de tus facturas. El IVA que cobras no es tuyo.
  - **Gastos con factura:** bases de los gastos confirmados. El IVA deducible no cuenta como gasto; el no deducible, sí.
  - **Cuota de autónomo:** recibos reales de `cuotas_autonomo` y, si falta un mes, la cuota por defecto de Ajustes.
  - **Amortización:** una línea por bien de `bienes_inversion`, con descripción, base, % anual y cifra del periodo. Nada escrito a mano.
  - **Difícil justificación:** el 5 % de la diferencia, con un máximo de 2.000 € al año.
  - **= Rendimiento neto:** la base del 130 y de la Renta.
  - **IRPF a cuenta y «Te queda»:** las mismas cifras y el mismo texto que en Inicio (E.1).
- **Nota al pie:** «El IVA no entra en ninguna de estas cifras: lo que cobras de IVA se lo pasas a Hacienda en el 303».
- **Si se ejecuta después del plan de la subvención del Mac**, se añade la fila «Subvención del Mac (Kit Digital)»: se imputa al mismo ritmo que la amortización. Si se ejecuta antes, esa fila la añade aquel plan.
- **Enlaces de entrada:**
  - en «Más detalle» de Inicio (escritorio y móvil), un tercer elemento «Cómo se calcula» con la pista «De lo facturado a lo que te queda»;
  - al pie de la cascada, junto a la nota del IVA, un enlace «Cómo se calcula ›».
- Funciones nuevas: ninguna. Todo sale de `pyg`/`pygTrimestre`, `amortizacionDelAnio` (por bien) e `irpfACuenta`. Si hace falta la amortización por bien, se añade `amortizacionDelAnioPorBien` en `lib/calculo.ts`, con test.

#### 2. Limpieza

- **Borrar** `components/Casillas.tsx`, `components/Filas.tsx` y `components/Nav.tsx`: ya no los importa nadie (comprobado el 25/11).
- **`app/globals.css`:** se queda el primer bloque `@layer base { :root { … } }` con los tokens de Vela y de la marca lila, y el comentario de «solo modo claro». Se borra todo lo demás:
  - el segundo `:root` con `--bg`, `--card`, …, `--radius` y `font-family`;
  - `* { box-sizing }` y `body { margin }`: ya los pone el preflight de Tailwind;
  - las reglas globales de `h1`, `h2` y `code`;
  - y todas las clases antiguas: `.app`, `.cabecera`, `.centro`, `.card`, `.kpis`/`.kpi`, `.filas`/`.fila`, `.paso`/`.punto`/`.urgente`/`.pendiente`, `.chips`/`.chip`, `.badge`, `.tabla`, `.boton`, `.nota` y `.nav`.
- **Fondo de la página:** hoy lo pone `background: var(--bg)` en `:root`. Mirar qué fondo pinta el `AppShell` de Vela:
  - si ya lo pinta, quitarlo sin más;
  - si no, usar el token de fondo de página de Vela en `body`.

  Lo importante es que el gris claro de fondo se vea igual que ahora.
- **`app/sin-acceso/page.tsx`** usa `.centro`, `h1` y `code`. Se pasa a Vela/Tailwind: bloque centrado de ancho máximo `max-w-sm`, título con `text-title`, texto con `text-body` y `/panel` en un `<code>` con clases de Tailwind (fondo gris, redondeado). Que se vea igual de limpio que ahora.
- **Ojo con el `h2` global** (`margin: 0 0 10px; color: var(--muted)`): hoy añade 10 px bajo cada eyebrow que no tenga margen propio. Al quitarlo, alguna separación puede encoger. Recorrer las pantallas y, donde cambie, reponer la separación con una clase de Tailwind en ese sitio, no con CSS global. Incluido el `-mt-3` de «Más detalle» en Inicio: revisar si sigue haciendo falta.

**Comprueba:**
- `npm test` (sin el test de `estadoYCuota`), `npm run typecheck`, `next build`, `next start` + `curl` a todas las rutas del panel, `/detalle/como-se-calcula`, `/detalle/como-se-calcula?periodo=3` y `/sin-acceso`, y la integración de las 56 conversaciones.
- `grep` sin resultados de `var(--bg)`, `var(--muted)`, `className="card`, `className="fila`, `className="tabla` y `components/Nav` en `app/` y `components/`.
- **En «Cómo se calcula», con «Año 2026»:** la suma de las filas da exactamente el rendimiento neto de Inicio, y «IRPF a cuenta» = −4.586 €. Con 3T, las cifras del 3T de Inicio.
- **Revisión visual de Jose en la vista previa** (Claude Code no puede hacer capturas), a 1440 y 390 px: Inicio, Ventas, Gastos, Impuestos (2026 y 2025), un trimestre, el 390, Ajustes, «Cómo se calcula» y `/sin-acceso`. Que nada haya cambiado de sitio ni de separación salvo lo nuevo.
- Lighthouse de accesibilidad ≥ 95 en `/` y en `/detalle/como-se-calcula`, si se puede ejecutar. Si no, apuntarlo.

#### Notas de ejecución (Claude Code, 25/11/2026, rama `plan/rediseno-e2-codigo`)

- **Rama creada desde `wip/v0`**, que todavía no tiene el plan de la subvención del Mac fusionado: `pyg`/`modelo130` de esta rama no llevan `subvenciones`, así que «Cómo se calcula» no tiene esa fila — la añadirá aquel plan cuando se fusione, tal como el propio plan preveía («si se ejecuta antes, esa fila la añade aquel plan»).
- **`/detalle/como-se-calcula` (nueva, en `app/(panel)/`):** mismo selector de periodo que Inicio (`Periodo`, con el mismo cálculo de `hasta`/`disponibles`/`subtituloPeriodo`, copiado literal). Una tarjeta con una fila por paso, con su frase fija. La amortización lleva una línea por bien con descripción, base, % anual y la cifra del periodo.
  - **`amortizacionDelAnioPorBien(bienes, hasta)` nueva en `lib/calculo.ts`**, con 2 tests (suma lo mismo que `amortizacionDelAnio`; un bien comprado a mitad de año no amortiza antes de comprarlo). Para el año, se usa directamente; para un trimestre, la página hace la misma resta de acumulados que `pygTrimestre` pero bien a bien (con `amortizacionDelAnioPorBien` aplicada a `hasta` y al día antes del periodo), sin añadir una segunda función solo para eso.
  - Las filas de «IRPF a cuenta» y «Te queda» son literalmente las mismas de Inicio (mismo `irpfACuenta`, mismo cálculo de `tPendiente`): comprobado que la cifra coincide exactamente entre las dos pantallas (ver más abajo).
  - Enlaces añadidos: en Inicio, un tercer elemento «Cómo se calcula» en los dos «Más detalle» (móvil y escritorio); y «Cómo se calcula ›» junto a la nota del IVA bajo la cascada.
- **Limpieza:**
  - Borrados `components/Casillas.tsx`, `components/Filas.tsx` y `components/Nav.tsx`: comprobado que ya no los importaba nadie (ni antes de esta fase: `Nav.tsx` y `Filas.tsx` ya estaban huérfanos, como se apuntó en la fase D).
  - **`app/globals.css`:** el segundo `:root` (`--bg`, `--card`, `--text`, …, `--radius`), `*{box-sizing}`, `body{margin}`, `h1`/`h2`/`code` globales y todas las clases antiguas (`.app`, `.cabecera`, `.centro`, `.card`, `.kpis`/`.kpi`, `.filas`/`.fila`, `.paso`/`.punto`/`.urgente`/`.pendiente`, `.chips`/`.chip`, `.badge`, `.tabla`, `.boton`, `.nota`, `.nav`) borrados. Se queda el primer `:root` (tokens de Vela y marca lila) y un `body` nuevo con `font-family`, `color: var(--color-text-primary)`, `background: var(--color-bg-primary)` y `-webkit-font-smoothing`.
  - **Fondo de página:** el `AppShell` de Vela no pinta ningún fondo (su `div` raíz es solo `flex min-h-dvh`, sin `background`; comprobado en el bundle de `@glinglo/vela-ds`), así que hacía falta ponerlo en `body`. Usado `--color-bg-primary` (gray-50, `#f8fafc`) en vez de `--color-bg-secondary` (gray-100, `#f1f5f9`): más parecido al `#f6f5f2` de antes.
  - **`.app` sí estaba en uso** (en `app/(panel)/layout.tsx`, `mainClassName="app lg:max-w-7xl"`, el ancho y el padding del contenido): no es solo CSS muerto. Sustituido por las utilidades equivalentes de Tailwind: `max-w-[560px] mx-auto px-4 pt-4 pb-24 lg:max-w-7xl` (el `padding: 16px 16px 96px` de `.app` era top 16, horizontal 16, bottom 96 → `pt-4 px-4 pb-24`).
  - **`app/sin-acceso/page.tsx`** reescrita con Tailwind/Vela (`max-w-sm`, `text-title`, `text-body`, `<code>` con fondo gris) en vez de `.centro`/`h1`/`code`.
  - **`h2` global quitado:** los `<h2 className="text-eyebrow text-tertiary">` de las pantallas ya rediseñadas no dependían de su `margin-bottom` de 10 px para la separación (todos están dentro de un `Card`/contenedor `flex flex-col gap-*`, que ya pone un hueco por `gap` con independencia del margen propio del hijo); comprobado visualmente que el cambio es mínimo donde `Card` no lleva `gap` explícito (usa su `gap-2` por defecto) frente a los 10 px de antes. El `-mt-3` de «Más detalle» en Inicio no dependía del `h2` global (compensaba el `py-3` interno de `ListItem`, un factor aparte): se queda igual.
  - **`estadoYCuota` borrado** de `lib/inicio.ts` (y sus 2 tests): no lo usaba nadie («Impuestos y cuota» no se hace, por quedar cubierta por Inicio/Impuestos, como dice el plan). `salud()` se queda, la usa Inicio.
- **Comprobado con los datos reales:** `/detalle/como-se-calcula` con «Año 2026» da «Rendimiento neto» 20.572 €, «IRPF a cuenta» −4.586 € y «Te queda» ≈ 15.985 €, **exactos** a los que da Inicio con el mismo periodo. `grep` de `var(--bg)`, `var(--muted)`, `className="card`, `className="fila`, `className="tabla` y `components/Nav` en `app/`/`components/`: sin resultados.
- **`npm test`** (152, con los 2 tests nuevos de `amortizacionDelAnioPorBien` y sin los 2 borrados de `estadoYCuota`), **`npm run typecheck`** y **`npm run build`** sin errores (incluida la ruta nueva `/detalle/como-se-calcula`). **`next start` + `curl`** a `/`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos?anio=2025`, `/impuestos/2026/3`, `/impuestos/2026/390`, `/ajustes`, `/sin-acceso`, `/detalle/como-se-calcula` y `/detalle/como-se-calcula?periodo=3`: las once dan `200`. **Prueba de integración de las 56 conversaciones**: todas pasan (en la base local).
- **No hecho en esta sesión:** la revisión visual a 1440/390 px (esta sesión no tiene herramienta de capturas) y Lighthouse de accesibilidad (no se puede ejecutar aquí) — las dos quedan para Jose, tal como el propio plan permitía apuntar si no se podían hacer.

### Retoque tras la #26 (Claude Code, 25/11/2026, misma rama `plan/rediseno-e2-codigo`)

- **Rebase sobre `wip/v0`** (ya con la subvención del Mac, PR #26, fusionada): conflicto en `lib/calculo.ts` y `tests/calculo.test.ts` entre `subvencionesDelAnio` (de la #26) y `amortizacionDelAnioPorBien` (de la E.2) — las dos funciones son independientes, así que se quedan las dos, con sus tests.
- **«Cómo se calcula» ya lleva la fila «Subvención del Mac (Kit Digital)»**, justo después de «Facturado (sin IVA)» (solo si `p.subvenciones > 0`), con la misma frase que en `/impuestos/[anio]/[t]?m=130`. Comprobado que el rendimiento neto de «Cómo se calcula» sigue siendo exacto al de Inicio (20.798 €, con la subvención ya dentro de los dos). La suma «a ojo» de las filas redondeadas a euro puede quedar 1-2 € por debajo del rendimiento neto mostrado (cada fila se redondea sola con `eurosSinCentimos`, el redondeo no es acumulativo): es solo cosmético, los números exactos (en céntimos) sí cuadran, como prueban los tests.
- **El 130 nunca se enseña en negativo, en ningún sitio.** `modelo130.aIngresar` (= `Math.max(0, c07)`, en `lib/calculo.ts`) ya lo garantizaba para el cálculo, pero varios sitios enseñaban el [07] crudo (que sí puede ser negativo) en vez de eso:
  - `/impuestos/[anio]/[t]?m=130`: la cifra grande usaba `calculado`/`p.importe` directos (podían ser negativos); ahora usa `resultado130Mostrado(...).aIngresar` y, si el resultado real es negativo, una línea nueva «Has adelantado X € de más: se recuperan en la Renta.» con `resultado130Mostrado(...).adelantadoDeMas`.
  - `/impuestos` (índice): la tabla/lista «Presentados» metía `p130?.importe` tal cual en la columna 130 (y en la suma de «Pagado en {año}» y en `GraficoPagos`) — un 130 presentado en negativo se sumaba como negativo. Arreglado con el mismo `resultado130Mostrado(...).aIngresar`. La tarjeta «Próximo» tenía el mismo fallo con el [07] crudo; ahora usa `resultado130Mostrado` y añade la misma línea de «Has adelantado…» si toca.
  - **Bot (`lib/agente.ts`, herramienta `resumen`):** `a_ingresar` ya salía bien (reutilizaba `m130.aIngresar`), pero no decía nada del negativo; añadido `adelantado_de_mas` (solo si lo hay), con `resultado130Mostrado`.
  - **Función nueva `resultado130Mostrado(resultado)` en `lib/impuestos.ts`**, con 3 tests (negativo, positivo, cero), para no repetir el `Math.max(0, …)` y el cálculo del adelantado en cada sitio.
- **Comprobado con los datos reales:** el 4T de 2026 (que hoy da [07] = −518,57 €, cubierto por lo ya pagado de 1T a 3T) enseña «0,00 €» como cifra grande en `/impuestos/2026/4?m=130` y en la tarjeta «Próximo» de `/impuestos`, con «Has adelantado 518,57 € de más: se recuperan en la Renta.» en los dos sitios; la tabla «Presentados» también da «0,00 €» para ese trimestre, nunca negativo.
- **`npm test`** (158, con los 3 tests nuevos de `resultado130Mostrado`), **`npm run typecheck`** y **`npm run build`** sin errores. **`next start` + `curl`** a `/`, `/ventas`, `/gastos`, `/impuestos`, `/impuestos?anio=2025`, `/impuestos/2026/1`, `/impuestos/2026/1?m=130`, `/impuestos/2026/3`, `/impuestos/2026/390`, `/ajustes`, `/sin-acceso` y `/detalle/como-se-calcula`: las doce dan `200`. **Prueba de integración de las 56 conversaciones**: todas pasan (en la base local).
- Subido con `git push --force-with-lease` (rebase sobre `wip/v0`, reescribe el historial de la rama).


## Fase F · Impuestos con menos ruido (25/11/2026)

Al revisar la pantalla después de la E.2, `/impuestos` tiene demasiado ruido: la tarjeta «Próximo» trae seis líneas, la tabla repite cada dato con una etiqueta y la columna derecha tiene cuatro tarjetas. Diseño: lienzo, fila «Propuesta 25/11 · Impuestos v3», tableros `ImpuestosEscritorio3` e `ImpuestosMovil3`. Solo cambia el índice `/impuestos` del año en curso y el cálculo del aviso del saldo. El trimestre, el 390 y los años anteriores no cambian, salvo lo que se indica.

### 1. Cabecera

- `PageHeader`: el subtítulo pasa de «2026» (que repite el selector) a «Lo que te toca presentar y lo que ya has pagado». Igual en los años anteriores.

### 2. Tarjeta «Próximo»

- Eyebrow, título y una línea: «Próximo · en 37 días», «4T de 2026» y «Del 1 de enero al lunes 1 de febrero». Las fechas en texto, con `fechaLarga` si existe; si no, se añade a `lib/fiscal.ts` con test.
- Debajo, dos cifras grandes en fila: «303 · IVA» y «130 · IRPF», con el importe que se ingresa (el 130 con `resultado130Mostrado`, nunca negativo), y el botón «Preparar el 4T» a la derecha. En móvil, el botón ocupa todo el ancho, debajo.
- **Fuera:** la línea de domiciliación, las frases de `frase303`/`frase130`, «Has adelantado X € de más…» y «También 349 y 390». Todo eso sigue en `/impuestos/[anio]/[t]`.
- La variante `urgent` (≤ 10 días con el plazo abierto) se queda igual, con el mismo contenido reducido.

### 3. «Presentados en {año}»

- **Escritorio:** columnas Trimestre · Presentado · 303 · IVA (a la derecha) · 130 · IRPF (a la derecha) · chevron. Cada fila entera enlaza al trimestre.
  - **Presentado:** la fecha corta (`14/04`), o una sola etiqueta `Pendiente` (amarilla) si no está presentado.
  - **303:** solo el importe. Si es negativo, «a compensar» al lado, en `text-caption text-tertiary`. Sin etiqueta.
  - **130:** solo el importe que se ingresa. Sin la etiqueta «Presentado» ni «Provisional».
  - Los trimestres sin presentar llevan los importes en gris (`text-tertiary`).
- **Móvil:** un `ListItem` por trimestre. A la izquierda el trimestre y «Presentado el 14/04» (o la etiqueta `Pendiente`); a la derecha dos líneas, «303 …» y «130 …»; y el chevron.
- **Fuera:** la nota «El 130 de la gestoría no incluía tu cuota de autónomo…». Ya lo explica el trimestre con «IVAn calcula X € (cuenta tu cuota de autónomo como gasto)».

### 4. Columna derecha: dos tarjetas

- **Aviso del saldo** (si lo hay): eyebrow «A revisar en el cierre», «{falta} de IVA a tu favor» y una frase: «No se arrastraron en el 303 del {t}T. Lo decidimos en el cierre de enero».
- **«Pagado en {año}»**, una sola tarjeta:
  - la cifra grande y «IRPF a cuenta X · IVA Y», como ahora;
  - debajo, un separador y «Otros años»: una fila por año de `cargarPagadoPorAnio` (sin el año que se está viendo), con el importe sin céntimos y una barra fina gris proporcional al mayor.
- **Fuera:** `GraficoPagos` (el gráfico por trimestre repite la tabla), la tarjeta «Lo pagado cada año» (pasa a «Otros años») y la tarjeta «Resumen anual». El 390 se sigue abriendo desde el 4T («Este trimestre también» del trimestre) y desde el bot. Si `components/GraficoPagos.tsx` se queda sin uso, se borra.

### 5. El aviso del saldo: 752,97 €, no 755,53 €

El 390 de 2025 que presentó la gestoría (28/01/2026) deja **752,97 €** a compensar en la [97]: la suma de los cuatro 303 de 2025. El 303 del 4T de 2025 puso en la [110] 2,56 € más de lo que arrastraba el 3T (679,93 € frente a 677,37 €), sin origen. `saldoIvaCompensar` hoy se fía de cada [87] presentada y arrastra esos 2,56 €.

**Regla nueva** (en `lib/impuestos.ts`):
- **En la primera presentación** de la serie, se acepta la [110] tal como viene, porque es el saldo que traía de antes de los datos (459,04 € de 2022).
- **En las demás**, el saldo esperado del trimestre siguiente es `min([110] presentada, esperado) − [78] + max(0, −[71])`. Es decir: si una [110] trae más de lo esperado, no se da por bueno el exceso.
- Si una [110] presentada es menor que la esperada, se avisa del primer trimestre donde falta, como ahora.

**Tests** (en `tests/impuestos.test.ts`, con la serie real de 2023 al 3T de 2026):
- avisa del 2T de 2026, con esperado **755,39 €**, presentado **2,42 €** y falta **752,97 €**;
- una serie sin excesos da lo mismo que la regla anterior;
- la [78] aplicada en 2024 (462,21 € y 204,52 €) no provoca aviso.

Si existe un test con 755,53 €, se cambia a 752,97 € y se apunta en las notas.

**Comprueba:**
- `npm test`, `npm run typecheck`, `next build`, `next start` + `curl` a `/impuestos`, `/impuestos?anio=2025`, `/impuestos/2026/4` y `/impuestos/2026/390`, y la integración de las 56 conversaciones (el bot no cambia, pero comparte `lib/impuestos.ts`).
- **Con los datos reales:**
  - aviso de **752,97 €**;
  - «Pagado en 2026» = 4.640,92 € con «Otros años» 2025 7.202 €, 2024 9.933 € y 2023 10.172 €;
  - tabla con −2,42 / −0,42 / 207,46 / 0 y 1.503,78 / 1.530,54 / 1.399,14 / 0;
  - «Próximo» con 0 € y 0 €.
- **Revisión visual de Jose** a 1440 y 390 px frente a `ImpuestosEscritorio3` e `ImpuestosMovil3`.

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

### Arreglo suelto (24/11/2026, Claude Code, rama `plan/rediseno-c2`): texto casi blanco en modo oscuro

- **El bug:** `app/globals.css` traía, del panel antiguo, un `@media (prefers-color-scheme: dark)` que repintaba `--text` a `#ecebe6` (casi blanco) cuando el sistema está en oscuro, y `:root` pintaba `color: var(--text)`. Esta versión del panel es solo modo claro (decisión del plan, ver «Decisiones» al principio), así que con el Mac en oscuro el texto salía casi invisible sobre el fondo claro de Vela.
- **El arreglo:** quitado el bloque `@media (prefers-color-scheme: dark)` entero de `app/globals.css`; `:root` pasa de `color: var(--text)` a `color: var(--color-text-primary)` (el token de texto de Vela). Comprobado que el `--color-text-primary` de Vela no depende de `prefers-color-scheme`, sino de una clase `.dark` que esta app nunca pone (`node_modules/@glinglo/vela-ds/dist/theme.css`): se queda siempre en su valor claro, así que no reintroduce el mismo bug por otra vía.
- **Lo que no se ha tocado:** las variables antiguas (`--bg`, `--card`, `--text`, `--muted`, `--line`, `--accent`, `--ok`, `--ok-bg`, `--warn`, `--warn-bg`, `--danger`, `--danger-bg`, `--radius`) y las clases que las usan siguen en `globals.css`, porque las siguen pintando `/impuestos/[anio]/[t]`, `/impuestos/[anio]/390` y `components/Nav.tsx`/`Filas.tsx`/`Casillas.tsx` (sin rediseñar todavía). Apuntado en la fase E, que ya preveía borrar ese CSS cuando se rediseñen esas pantallas.
- **Comprobado:** `npm test` (132), `npm run typecheck` y `npm run build` sin errores. **No he podido comprobarlo en el Mac con el sistema en oscuro**: esta sesión no tiene acceso a un navegador con capturas de pantalla ni a cambiar la apariencia del sistema. Pendiente de que Jose lo confirme en su Mac en Inicio, Ventas, Gastos e Impuestos (con `prefers-color-scheme: dark`, ya no debería cambiar nada visualmente: el panel se queda en claro).
