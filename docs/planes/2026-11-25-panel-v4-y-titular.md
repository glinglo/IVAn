# Panel v4: tu negocio en un vistazo, menú en móvil, Impuestos con filtros y campo de titular

Estado: **Aprobado** (Jose, 25/11/2026)
25/11/2026 · Plan de Claude (proyecto IVAn)

**Se ejecuta por fases:** G.1 → G.4, una por sesión de Claude Code y un PR por fase contra `wip/v0`. Este plan va en la rama `plan/panel-v4-g1`, donde se hace la G.1. Las siguientes, en `plan/panel-v4-g2`, `-g3` y `-g4`, cada una desde `wip/v0` con la anterior ya fusionada. Jose revisa cada fase en la vista previa de Vercel antes de la siguiente.

## Por qué

- **Inicio contesta «¿qué dice Hacienda?» y Jose pregunta «¿cuánto me queda limpio?».** La cifra grande es el rendimiento neto (jerga y antes del IRPF), «Te queda» está casi al final de la tarjeta, y la tarjeta tiene unas 12 piezas y tres notas al pie.
- **«Te queda» mezcla cuenta fiscal y dinero real:** resta la amortización y el 5 % de difícil justificación, que no salen de la cuenta del banco.
- **Los semáforos de margen y gastos siempre salen en verde** (≈ 70 % y < 10 %): no avisan de nada. Lo que sí importa (la facturación baja respecto a 2025 y Zapflow es el 97 %) está escondido en Ventas.
- **Móvil:** la barra inferior ocupa altura fija para algo que se usa poco (casi siempre se entra con `/panel` desde el bot).
- **Impuestos:** una fila por trimestre junta el 303 y el 130, y el 349 y el 390 no salen. Solo se ve un año.
- **Titular:** Jose quiere poder vender IVAn a gestorías más adelante. Marcar cada fila con su titular ahora, con un solo titular, es barato; hacerlo después, con datos dentro, no.

## Diseño

- **Lienzo:** https://claude.ai/artifact/M9CekvBAAgtGMCAjgatDMf, fila «Propuesta 25/11 · v4: tu negocio en un vistazo». Tableros `InicioEscritorio4`, `InicioMovil4`, `MenuMovil`, `ImpuestosEscritorio4` e `ImpuestosMovil4`.
- **Copia en el repo** (Claude Code no ve el lienzo): `docs/planes/referencia/panel-v4/*.html`. Son maquetas estáticas: se abren con el navegador, sin servidor. Las cifras son de ejemplo (de enero a octubre de 2026); las buenas salen del código.
- Si el plan y una maqueta no coinciden, **manda el plan**. Apúntalo en las notas.

## Decisiones (Jose, 25/11/2026)

- **«Te queda» es dinero real:** facturado − gastos − cuota de autónomo − IRPF. **Sin la Renta** por ahora: sigue la decisión «sin proyección de cierre de año». El IVA no cuenta (no es de Jose).
- **El IRPF de cada mes es el 20 % de su beneficio fiscal** (lo que va al 130). Así el mes en que se paga el 130 no sale hundido, y los errores de arrastre de la gestoría no afectan.
- **Solo meses cerrados.** El mes en curso no entra en las cifras hasta que termina (Jose mete los gastos el último día).
- **Objetivo: 3.000 € netos al mes.** Se guarda en `ajustes` y se cambia por el bot.
- **Móvil sin barra inferior.** Cabecera con «IVAn», el icono del bot y una hamburguesa que abre un panel lateral con todas las secciones, el Excel, el perfil, Configuración y Cerrar sesión. El escritorio no cambia.
- **Impuestos:** una fila por presentación, con filtros en desplegables (año, modelo y estado); el saldo de IVA a favor, en la columna derecha.
- **Un solo selector de periodo** (desplegable) en lugar de año + segmentos.
- **Chat en el panel: no en esta fase.** Primero se prueba en Telegram (plan aparte).
- **Titular:** columna en todas las tablas desde ya, sin cambiar todavía lo que lee el código ni las claves únicas.
- **Umbrales nuevos** (propuestos por Claude y confirmados por Jose al aprobar el plan):
  - **Objetivo:** «bien» si lo que queda al mes llega al objetivo; si no, «atención».
  - **Ritmo frente al año anterior** (de enero al último trimestre cerrado, el mismo dato que Ventas): «bien» si es ≥ 0 %; «atención» de 0 % a −10 % (incluido); «riesgo» por debajo de −10 %.
  - Los demás, como ya estaban: dependencia de un cliente ≥ 70 % = riesgo; gastos ≤ 20 % de lo facturado = bien.

## Lo que NO cambia

- `lib/calculo.ts` no se toca y `tests/calculo.test.ts` sigue pasando igual.
- **Regla técnica de Vela en páginas de servidor** (plan del rediseño): sigue igual. Ninguna función cruza de una página de servidor a un componente de Vela; los componentes con funciones van envueltos en uno propio con `"use client"`.
- El bot, salvo `/ajustes objetivo:` (G.3).
- `/impuestos/[anio]/[t]` y `/impuestos/[anio]/390`.
- Ventas y Gastos, salvo el selector de periodo (G.3).
- La barra lateral de escritorio.
- El saldo de 752,97 € sigue siendo solo un aviso: no entra en ningún cálculo hasta el plan del cierre del 4T.

---

## Fase G.1 · Campo de titular (sin cambios visibles)

### Qué se busca

Que cada fila diga de quién es, aunque hoy solo haya un titular. Cuando llegue un segundo (una gestoría con clientes), lo que faltará será filtrar en el código y cambiar las claves únicas, pero los datos ya estarán marcados.

### Migración `supabase/migrations/010_titulares.sql`

```sql
-- Titular de los datos. Hoy solo hay uno (Jose); prepara IVAn para tener varios.
create table if not exists titulares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nif text not null unique,
  telegram_user_id bigint unique,
  created_at timestamptz not null default now()
);
alter table titulares enable row level security;

-- El titular sale de ajustes si ya existe (base en marcha). En una base nueva, el seed lo crea.
insert into titulares (nombre, nif)
select nombre, nif from ajustes where id = 1
on conflict (nif) do nothing;

-- Mientras haya un solo titular, las filas nuevas se marcan solas con él.
-- Con 0 o con 2 o más titulares, falla: así nadie mezcla datos sin decir de quién son.
create or replace function titular_unico() returns uuid
language plpgsql stable as $$
declare
  n int;
  v uuid;
begin
  select count(*) into n from titulares;
  if n <> 1 then
    raise exception 'Hay % titulares: indica titular_id', n;
  end if;
  select id into v from titulares limit 1;
  return v;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ajustes', 'clientes', 'facturas', 'gastos', 'cuotas_autonomo',
    'bienes_inversion', 'presentaciones', 'mensajes', 'recordatorios_enviados'
  ] loop
    execute format('alter table %I add column if not exists titular_id uuid references titulares(id)', t);
    execute format('update %I set titular_id = titular_unico() where titular_id is null and exists (select 1 from %I)', t, t);
    execute format('alter table %I alter column titular_id set default titular_unico()', t);
    execute format('alter table %I alter column titular_id set not null', t);
  end loop;
end $$;

create index if not exists facturas_titular_idx on facturas (titular_id);
create index if not exists gastos_titular_idx on gastos (titular_id);
create index if not exists presentaciones_titular_idx on presentaciones (titular_id);
```

- **Probado por Claude el 25/11/2026** en un Postgres 16 limpio, con las migraciones 001-009:
  - **Base vacía:** la migración pasa.
  - **Con `ajustes.prueba.sql` y `datos_2026.sql`:**
    - 1 titular; 11 facturas y 71 gastos con `titular_id`;
    - una fila nueva toma el titular sola;
    - con dos titulares, el insert falla con «Hay 2 titulares: indica titular_id»;
    - el trigger `facturas_inmutables` no bloquea el `update` de las facturas emitidas, porque no mira `titular_id`.
  - Hay que repetirlo en el Mac de Jose con `reset-db.sh`.
- Los permisos de `service_role` sobre la tabla nueva salen de los `alter default privileges` de la 005. Si `scripts/integracion/grants.sql` concede permisos tabla a tabla, añadir `titulares`.

### Lo que NO se cambia todavía (y por qué)

Estas claves únicas siguen como están porque el código hace `upsert` con ellas (`lib/agente.ts`, `lib/copia.ts`, `lib/cron.ts`). Se cambiarán cuando haya un segundo titular, junto con el código:

- `facturas.numero` (único en toda la tabla);
- `presentaciones (modelo, anio, trimestre)`;
- `cuotas_autonomo.mes` (clave primaria);
- `recordatorios_enviados.clave` (clave primaria);
- `ajustes.id = 1` (una sola fila).

El código **no filtra** por `titular_id` en ninguna consulta. No se añade nada a `lib/db.ts` en esta fase.

### Archivos

- **Seeds:** `supabase/seed/ajustes.ejemplo.sql` y `scripts/integracion/ajustes.prueba.sql`. Antes del `insert into ajustes`, una línea que cree el titular con el mismo nombre y NIF (`insert into titulares (nombre, nif) values (…) on conflict (nif) do nothing;`). Buscar con `grep` cualquier otro `insert into ajustes`.
- **`lib/copia.ts`:**
  - `TABLAS` empieza por `"titulares"` (las referencias primero) y `CLAVE_ORDEN.titulares = "id"`.
  - **Restaurar una copia antigua** (sin `titulares`): antes de insertar nada, crear el titular con el `nombre` y el `nif` de la fila de `ajustes` de la copia. Así las filas sin `titular_id` toman el valor por defecto. La `version` de la copia se queda en `1`: una copia sin la tabla se sigue pudiendo restaurar.
- **`scripts/restaurar.ts`:** si el paso anterior vive ahí y no en `lib/copia.ts`, va ahí. Actualizar el comentario de cabecera (migraciones hasta la 010).
- **`docs/PUESTA_EN_MARCHA.md`:** migración 010 y el alta del titular en una base nueva.
- **Tests:** en `tests/` (donde estén los de la copia, o uno nuevo `tests/copia.test.ts`): restaurar una copia sin `titulares` crea el titular desde `ajustes`; `TABLAS` empieza por `titulares`.

### SQL que ejecuta Jose en Supabase (después de fusionar el PR)

1. El contenido de `010_titulares.sql` en el SQL Editor.
2. Su ID de Telegram en el titular:
   ```sql
   update titulares set telegram_user_id = 593355817;
   ```
3. Comprobación (todas las filas con titular; tiene que salir 0 en la segunda columna de cada tabla):
   ```sql
   select 'titulares' as tabla, count(*) as filas, 0 as sin_titular from titulares
   union all select 'facturas', count(*), count(*) filter (where titular_id is null) from facturas
   union all select 'gastos', count(*), count(*) filter (where titular_id is null) from gastos
   union all select 'presentaciones', count(*), count(*) filter (where titular_id is null) from presentaciones
   union all select 'cuotas_autonomo', count(*), count(*) filter (where titular_id is null) from cuotas_autonomo
   union all select 'clientes', count(*), count(*) filter (where titular_id is null) from clientes;
   ```
   `titulares` = 1 fila.

### Comprueba

- `npm test`, `npm run typecheck` y `npm run build`.
- `scripts/integracion/reset-db.sh` en el Mac de Jose (crea la base con las migraciones y los seeds) y **las 56 conversaciones**. Después, la prueba de restauración (`reset-db.sh --vacia` y restaurar una copia de antes de esta fase).
- Un gasto nuevo por el bot y una factura en modo paralelo se guardan con `titular_id` sin tocar el código que inserta.

---

## Fase G.2 · Menú en móvil

Maqueta: `MenuMovil.html` y la cabecera de `InicioMovil4.html`.

- **`components/PanelNav.tsx`:** `NavMovil` pasa a ser `CabeceraMovil` (`"use client"`), solo por debajo de `lg`:
  - A la izquierda, «IVAn».
  - A la derecha, dos botones de 44 × 44 px:
    - **Bot:** icono `Send`, fondo lila claro, `aria-label="Abrir el bot"`, enlace a `https://t.me/Ivanelgestorbot` en otra pestaña.
    - **Menú:** icono `Menu` de lucide, `aria-label="Abrir el menú"`. Si hay `trimestreAviso`, un punto amarillo en la esquina y el `aria-label` lo dice («Abrir el menú (hay un aviso en Impuestos)»).
  - El menú es un `Sheet` de Vela con `side="right"`:
    1. Cabecera con «IVAn» y el botón de cerrar.
    2. «Abrir el bot», botón principal lila a todo el ancho.
    3. Inicio, Ventas, Gastos e Impuestos (con la etiqueta amarilla `{t}T` si hay aviso), con la sección activa marcada como en la barra lateral.
    4. Separador y «Excel {año}» (`/api/exportar?anio=…`).
    5. Abajo: el nombre de `ajustes` con su inicial, «Configuración» y «Cerrar sesión» en rojo. Salen de `menuCuenta`, como en escritorio.
  - Se cierra con la X, al tocar fuera, con Esc y al navegar.
- **`app/(panel)/layout.tsx`:**
  - Fuera el `tabBar`.
  - La cabecera móvil va arriba, fija al hacer scroll (`sticky top-0`, con fondo blanco y borde inferior). Si `AppShell` de Vela no tiene sitio para una cabecera móvil, se pinta encima de `children` con `lg:hidden`.
  - `mainClassName`: `pb-24` pasa a `pb-8` (era el hueco de la barra).
- **`components/AccionesCabecera.tsx`:** fuera el avatar con menú (`lg:hidden`), que ahora está en el panel lateral. Si el componente se queda sin nada que pintar, se borra (G.3 quita también el desplegable del año).
- El nombre del perfil sale de `ajustes.nombre`: el layout ya carga datos en el servidor y se lo pasa como texto.

### Comprueba

- A 390 px: no hay barra inferior; la hamburguesa abre el panel desde la derecha; el punto sale con el 4T pendiente; cerrar con X, tocando fuera y con Esc; tocar una sección navega y cierra; el icono del bot abre Telegram.
- A 1440 px: nada cambia.
- `npm test`, typecheck, build y `next start` + `curl` a `/`, `/ventas`, `/gastos`, `/impuestos` y `/ajustes`: todas dan `200`.

---

## Fase G.3 · Inicio v4

Maquetas: `InicioEscritorio4.html` e `InicioMovil4.html`.

### Datos

- **Migración `supabase/migrations/011_objetivo.sql`:**
  ```sql
  alter table ajustes add column if not exists objetivo_neto_mensual numeric(10,2);
  ```
  Campo `objetivo_neto_mensual: number | null` en `Ajustes` (`lib/db.ts`).
- **SQL para Jose después de fusionar:** el contenido de la 011 y
  ```sql
  update ajustes set objetivo_neto_mensual = 3000 where id = 1;
  select objetivo_neto_mensual from ajustes;
  ```
- **Bot, `/ajustes`** (`lib/bot.ts`):
  - Acepta `objetivo`: `/ajustes objetivo: 3000` (o `3.000`, `3000 €`) guarda el número; `ninguno` lo borra.
  - Responde «✅ Objetivo: 3.000 € limpios al mes».
  - El resumen de `/ajustes` sin argumentos añade una línea «Objetivo: 3.000 € al mes» (o «sin objetivo») y el ejemplo de uso.
- **Configuración** (`/ajustes`): grupo «Tu objetivo» con «Te queda al mes: 3.000 €» (o «Sin objetivo»).

### Funciones nuevas: `lib/negocio.ts`, con tests en `tests/negocio.test.ts`

Todas puras, a partir de `Libro` y de `pyg` (sin tocar `lib/calculo.ts`).

1. **`mesesCerrados(anio, periodo, hoy)`**: los meses `YYYY-MM` del periodo (`periodo` = `null` para el año, o 1-4) que ya han terminado.
   - En un año pasado, todos los meses del periodo.
   - Si el periodo no tiene ningún mes terminado (enero, o el trimestre recién empezado), devuelve el mes en curso marcado como `abierto: true`.
2. **`bolsilloMes(libro, mes)`** → `{ facturado, gastos, cuota, irpf, teQueda }`:
   - **facturado:** suma de la base de las facturas del mes. La subvención del Mac no entra: no es dinero que llegue este año.
   - **gastos:** suma de la `base` de los gastos confirmados del mes, **sin** el límite de comidas de `limitesRestauracion` (es lo que salió de la cuenta). El IVA deducible no cuenta, porque se recupera en el 303. En «Sin IVA deducible» el IVA ya va dentro de la `base` (`lib/gastos.ts`).
   - **cuota:** `datos.cuotaMes(mes)`.
   - **irpf:** `max(0, 20 % × (rendimiento neto acumulado a fin de mes − el acumulado a fin del mes anterior))`, con `pyg`, igual que `seriesMensuales`. Ese rendimiento incluye la amortización, el 5 % y la subvención, porque es la base del 130.
   - **teQueda** = facturado − gastos − cuota − irpf. Puede ser negativo.
3. **`bolsillo(libro, meses)`**: las sumas de los meses, más `alMes` (teQueda entre el número de meses) y `meses` (para los textos).
4. **`reparto100(b)`**: `{ paraTi, autonomo, irpf, gastos }` en euros enteros que suman exactamente 100, con el método del resto mayor. Si `teQueda ≤ 0`, `paraTi` = 0 y el resto se reparte entre los otros tres.
5. **`facturacionParaObjetivo(b, objetivo)`** = `objetivo / 0,8 + (gastos + cuota) / meses`, redondeado a decenas. Aproximación: ignora que la amortización y el 5 % bajan un poco el IRPF; se queda del lado prudente.
6. **`saludNegocio(...)`** → lista de indicadores `{ clave, estado: "bien" | "atencion" | "riesgo" | "info", titulo, detalle, enlace: { texto, href } }`, ordenada: riesgo, atención, info y bien.
   - **objetivo:**
     - sin objetivo: `info`, «Ponte un objetivo» con el detalle «Dile al bot: /ajustes objetivo: 3000».
     - con objetivo y sin llegar: `atencion`. Título «Te faltan {objetivo − alMes} € al mes para tu objetivo». Detalle «Para quedarte {objetivo} € limpios, tendrías que facturar ≈ {facturacionParaObjetivo} € al mes. Hoy facturas {facturado/meses} €». Enlace «Ver ventas» → `/ventas`.
     - si llega: `bien`, «Llegas a tu objetivo».
   - **ritmo:** de `comparativaAnual(...)`, con los umbrales de arriba.
     - Título: «Facturas un 26 % menos que en 2025» (o «más»).
     - Detalle: «De enero a septiembre: 26.400 €, frente a 35.804 € en 2025 y 41.399 € en 2024», con los años que haya.
     - Enlace: «Ver la comparativa» → `/ventas`.
     - Sin comparativa (primer trimestre del año), no sale.
   - **dependencia:** de `dependencia(libro)`.
     - Título: «Zapflow es el 97 % de lo que facturas», con `nombreCorto` y el porcentaje redondeado como en Ventas.
     - Detalle: «Si se va, te quedas casi sin ingresos. A partir del 70 % lo marcamos como riesgo».
     - Enlace: «Ver clientes» → `/ventas`.
   - **gastos:** gastos entre facturado del periodo. «bien» si es ≤ 20 % («Gastos: 8 % de lo facturado»); si no, «atención».
   - **impuestos al día:** «bien» si todos los 303 y 130 del año cuyo plazo ya terminó están en `presentaciones`; si falta alguno, «riesgo», con el enlace a `/impuestos`.
   - El margen deja de ser un indicador de Inicio.

**Tests** (con fixtures pequeños, más uno con la forma de los datos de 2026):
- un mes normal, un mes sin facturas (teQueda negativo) y un mes con una comida por encima del límite (cuenta entera);
- la suma de los `bolsilloMes` de un año = `bolsillo` del año;
- `reparto100` suma 100 en varios casos, incluido `teQueda` negativo;
- `facturacionParaObjetivo` con 3.000 €, gastos 2.251 €, cuota 4.529,30 € y 10 meses → 4.430 €;
- `mesesCerrados`: 25/11/2026 con «Año» → enero a octubre; con 4T → octubre; 15/01/2027 con «Año» → enero de 2027 abierto;
- `saludNegocio`: el orden, −10 % es «atención» y −10,1 % es «riesgo», y sin objetivo sale «info».

### Selector de periodo único

- **`components/SelectorPeriodo.tsx`** (`"use client"`), con el `Dropdown` de Vela:
  - Opciones por año con datos (el año en curso y los anteriores con facturas en IVAn): «Año 2026» y los trimestres que ya tengan algún mes (1T…4T).
  - Mismos parámetros de URL que hoy: `?anio=` y `?periodo=`.
  - La etiqueta del botón la pasa la página. En Inicio: «Año 2026 · ene–oct» / «4T 2026 · octubre» (solo meses cerrados). En Ventas y Gastos: «Año 2026» / «4T 2026».
- Sustituye a `Periodo` y al desplegable del año de `AccionesCabecera` en **Inicio, Ventas y Gastos**. Lo que cuenta cada periodo en Ventas y Gastos no cambia: su «Año» sigue llegando hasta hoy.
- `Periodo.tsx`, `AccionesCabecera.tsx` y `BloqueResultados.tsx` se borran si se quedan sin uso. Si `BloqueResultados` sigue haciendo falta para atenuar mientras carga, se queda.

### Pantalla `/`

**Escritorio** (la misma rejilla: contenido + columna de 320 px):

1. **`PageHeader`:**
   - Título «Tu negocio» (fuera «Hola, Jose»).
   - Subtítulo «Lo que facturas, lo que gastas y lo que te queda limpio».
   - A la derecha, `SelectorPeriodo`.
2. **Tarjeta «Resultados»:**
   - **A la izquierda:**
     - Eyebrow «Te queda limpio» con ⓘ. El tooltip dice: «Lo que entra menos lo que sale de tu cuenta: gastos, cuota de autónomo e IRPF (el 20 % de tu beneficio, lo que va al 130). Sin el ajuste de la Renta».
     - Cifra grande: `alMes`, con «al mes» al lado.
     - Debajo: «{teQueda} de enero a octubre, ya restados gastos, cuota de autónomo e IRPF». Con un solo mes: «… en octubre».
     - Barra del objetivo (`Meter` de Vela) con «{pct} % de tu objetivo de 3.000 € al mes» y, a la derecha, «Faltan X €» (amarillo) o «Lo cumples» (verde).
     - Sin objetivo: ni barra ni texto. Solo «Ponte un objetivo ›», que abre el bot.
   - **A la derecha**, separadas por una línea vertical:
     - «Facturado», con «≈ X € al mes · sin IVA».
     - «Gastado» (gastos + cuota), con «Gastos X € + autónomo Y €».
   - **Debajo**, tras un separador: «De cada 100 € que facturas», con `StackedBar` (el de Ventas) de cuatro partes. Leyenda con euros: Para ti · Autónomo · IRPF · Gastos.
   - **Nota al pie, una sola:** «El IVA no cuenta: no es tuyo. El IRPF es el 20 % de tu beneficio de cada mes (lo que va al 130), sin el ajuste de la Renta. {Mes en curso} entra cuando cierres el mes. Cómo se calcula ›».
3. **Tarjeta «Salud del negocio»:**
   - Eyebrow y, a la derecha, «N a revisar · M bien».
   - Una fila por indicador que no está en «bien»: icono en un círculo del color del estado, título con su `Badge` («Atención» amarillo, «Riesgo» rojo), detalle y enlace.
   - Los «bien», al final, en una fila de pastillas verdes («Bien: Gastos: 8 % de lo facturado · Impuestos presentados al día»).
   - Si todo está bien: «Todo en verde» y las pastillas.
4. **Tarjeta «Te queda cada mes»:**
   - Una barra por mes cerrado del periodo (con un trimestre, solo sus meses, como la regla de la B.3) y el mes en curso con borde discontinuo y «abierto».
   - Línea discontinua en el objetivo, con la etiqueta «Objetivo 3.000 €».
   - Tooltip: «Octubre · Facturado 3.060 € · Te queda 2.026 €».
   - A la derecha del eyebrow, «Mejor mes: octubre, X €».
   - Un mes negativo se pinta a 0 y el tooltip enseña la cifra negativa.
   - Si `BarChart` de Vela no admite una línea de referencia, se dibuja encima en el componente de IVAn. Vela no se toca en esta fase.
5. **Columna derecha:** «Por hacer» como ahora (`PorHacerEscritorio`). **Fuera «Más detalle»**: la navegación ya está en la barra lateral y cada indicador enlaza a su página.

**Fuera de Inicio:** la cifra de rendimiento neto, la etiqueta de margen, la frase «De cada 100 €… antes del IRPF», la `Cascada`, las barras de ingresos y gastos (`Barras`) y «Más detalle» (móvil y escritorio). Los componentes que se queden sin uso se borran; `Cascada` sigue si la usa «Cómo se calcula».

**Móvil**, en este orden:
1. Título «Tu negocio».
2. `SelectorPeriodo` a todo el ancho.
3. `AvisosInicio` (franja o tarjeta, sin cambios).
4. «Resultados», con Facturado y Gastado lado a lado debajo de la cifra.
5. «Salud del negocio».
6. «Te queda cada mes».

### `/detalle/como-se-calcula`

- **Arriba, una sección nueva, «Lo que te queda»**, con las cuentas del periodo:
  - facturado;
  - − gastos;
  - − cuota de autónomo;
  - − IRPF («20 % de X € de beneficio»);
  - = te queda.
- **Debajo, lo que ya hay** (la cascada hasta el rendimiento neto), con el título «Lo que ve Hacienda: rendimiento neto, la base del 130 y de la Renta».
- **Un párrafo corto sobre por qué no coinciden:**
  - la amortización y el 5 % no salen de tu cuenta;
  - lo que has pagado de verdad es el 130 más las retenciones;
  - la Renta lo ajusta al final.

### Comprueba (con los datos reales a 25/11/2026)

- **«Año 2026 · ene–oct»:**
  - facturado **29.460,00 €**;
  - cuota **4.529,30 €** (10 × 452,93 €);
  - gastos, lo que dé la base (≈ 2.250 €): apuntarlo;
  - IRPF ≈ 4.250 €;
  - **te queda ≈ 18.400 €, ≈ 1.840 € al mes, ≈ 61 % de 3.000 €**.
- **Cuadres:**
  - facturado − gastos − cuota − IRPF = te queda, al céntimo;
  - la suma de los meses = el año;
  - el reparto suma 100.
- **«4T 2026 · octubre»:** facturado 3.060 €.
- **Salud:** «3 a revisar · 2 bien».
  - Objetivo «atención», con ≈ 4.430 € de facturación necesaria.
  - Ritmo −26 %, «riesgo».
  - Zapflow 97 % (28.440 / 29.460), «riesgo».
  - Bien: gastos ≈ 8 % e impuestos al día.
- **Bot:** `/ajustes objetivo: 3000` y `/ajustes objetivo: ninguno`. Añadir esos dos casos a las conversaciones de `scripts/integracion/conversaciones.ts`.
- **Pruebas:**
  - `npm test`, typecheck y build;
  - `next start` + `curl` a `/`, `/?anio=2026&periodo=4`, `/ventas`, `/ventas?anio=2026&periodo=3`, `/gastos`, `/ajustes` y `/detalle/como-se-calcula`, todas con `200`;
  - la integración en el Mac de Jose.
- **Revisión visual de Jose** a 1440 y 390 px, frente a las maquetas.

---

## Fase G.4 · Impuestos v4

Maquetas: `ImpuestosEscritorio4.html` e `ImpuestosMovil4.html`.

### Funciones (en `lib/impuestos.ts`, con tests en `tests/impuestos.test.ts`)

1. **`filasPresentaciones(presentaciones, librosPorAnio, hoy)`** → `FilaPresentacion[]`, con `{ modelo, anio, periodo, fecha, resultado, calculado, estado, nota?, href }`:
   - **Modelo:** «303», «130», «349» o «390». **Periodo:** 1-4, o 0 si es anual.
   - **Filas presentadas:** una por fila de `presentaciones`, de todos los años.
   - **Filas pendientes**, sin fecha y con `calculado: true`:
     - del año en curso, los trimestres hasta el actual sin presentar;
     - en enero, también el 4T y el 390 del año anterior sin presentar;
     - el 349, solo si el trimestre tiene operaciones intracomunitarias (`modelo349(...)` devuelve alguna línea);
     - el 390 del año en curso, solo cuando el trimestre actual es el 4T.
   - **resultado:**
     - **303:** la [71] presentada o `modelo303(...).c71`.
     - **130:** `resultado130Mostrado(importe ?? modelo130(...).aIngresar).aIngresar`.
     - **349:** el importe presentado; si falta (hoy pasa en todos), la suma de `base` de las líneas de `modelo349(...)` cuando el año tiene datos. Si no, `null`.
     - **390:** el importe o `null`.
   - **estado:**
     - sin fecha → `pendiente`;
     - 303: > 0 `pagado`, < 0 `compensar`, 0 `sin_importe`;
     - 130: > 0 `pagado`, 0 `sin_importe`;
     - 349 y 390: `informativa`.
   - **nota:** en el 303 donde `saldoIvaCompensar` detecta lo que falta, «No arrastró {falta} a tu favor» (hoy, el 2T de 2026 con 752,97 €).
   - **href:** `/impuestos/{anio}/{t}`, o `/impuestos/{anio}/390`.
   - **Orden:** año y periodo de más reciente a más antiguo (el 390 con el 4T de su año), y dentro de cada periodo 303, 130, 349 y 390.
2. **`filtrarPresentaciones(filas, { anio, modelo, estado })`:**
   - `anio`: un año o `"todos"`;
   - `modelo`: `iva` (303 y 390), `irpf` (130) o `349`;
   - `estado`: `pendiente`, `pagado`, `compensar` o `informativa`.

**Tests**, con la serie real:
- 2026 da 13 filas y 4 pendientes (303, 130, 349 y 390 del 4T);
- `modelo=irpf` da 4 filas;
- `estado=compensar` da el 303 del 1T y el del 2T;
- la nota del 303 del 2T dice 752,97 €;
- en enero de 2027, el 4T de 2026 sale como pendiente.

### Pantalla `/impuestos`

**Escritorio:**
1. **`PageHeader`:** «Impuestos», con el subtítulo «Todo lo presentado y lo que te toca, desde {primer año en `presentaciones`}». Sin desplegable de año: el año pasa a ser un filtro.
2. **Fila de dos tarjetas**, para el año del filtro («Todos los años» usa el año en curso):
   - **«Pagado en {año}»:** la cifra y «IRPF a cuenta X · IVA Y», como ahora.
   - **«De cada 100 € que facturas»: «X € al IRPF».**
     - X = `irpfACuenta(año, null).total` entre lo facturado en el año hasta hoy.
     - Debajo: «130 pagados y retenciones (Y €). El IVA no cuenta».
     - Solo en años con datos en IVAn; en los demás no sale.
3. **Tarjeta «Presentaciones»:**
   - Eyebrow y, a la derecha, el resumen: «2026 · 13 modelos, 4 pendientes».
   - **Filtros:** tres desplegables en fila, con su etiqueta encima. Van en `components/FiltrosImpuestos.tsx` (`"use client"`) y cambian la URL (`?anio=`, `?modelo=`, `?estado=`).
     - **Año:** «Todos los años» y cada año.
     - **Modelo:** «Todos los modelos», «IVA · 303 y 390», «IRPF · 130» e «Intracomunitarias · 349».
     - **Estado:** «Todos los estados», «Pendiente», «Pagado», «A compensar» e «Informativa».
   - **Tabla:**
     - **Modelo:** el número en negrita y el nombre debajo.
     - **Periodo:** «3T 2026» o «Año 2026».
     - **Presentado:** la fecha `dd/mm/aaaa`, o «—».
     - **Resultado**, a la derecha: el importe y, debajo, «a ingresar», «domiciliado», «a compensar», «declarado» o «calculado».
     - **Estado:** `Badge`:
       - «Pendiente» en amarillo;
       - «Pagado» en verde;
       - «A compensar», «Informativa» y «Sin importe» en gris;
       - la nota, si la hay, debajo, en amarillo y con icono de aviso.
     - Chevron. Toda la fila enlaza a `href` (un `<a>` por celda, como en la F).
     - Los pendientes llevan el importe en gris.
   - **Con «Todos los años»:** la tabla se agrupa por año, con un subtítulo por año.
   - **Con un solo año y otros con datos:** debajo, «Ver también 2023, 2024 y 2025 ›», que lleva a `?anio=todos`.
   - **Sin resultados:** «Nada con estos filtros» y «Quitar filtros».
4. **Columna derecha:**
   - «Próximo», sin cambios respecto a la F;
   - «A revisar en el cierre» (el aviso del saldo, como ahora, con el enlace «Ver el 303 del 2T ›»);
   - **«Pagado cada año»:**
     - todos los años, incluido el que se ve;
     - barra lila para el año en curso («2026 · hasta el 3T») y gris para los demás;
     - nota: «IRPF a cuenta e IVA ingresado, según lo presentado».

**Móvil**, en este orden:
1. Título.
2. «Próximo»: una franja de una línea («Próximo · abre en 37 días · 4T de 2026 · 303 y 130 ≈ 0,00 €»). Si es urgente (plazo abierto con ≤ 10 días), la tarjeta grande de ahora.
3. La tarjeta del saldo.
4. «Pagado en {año}».
5. Los filtros: tres botones-pastilla con desplegable, en una fila con scroll horizontal.
6. La lista, agrupada por periodo. Una tarjeta por grupo:
   - título «3T de 2026» y debajo «Presentado el 15/10/2026» o «Pendiente · se presenta en enero»;
   - una fila por modelo: «303 · IVA» (con la nota, si la hay), a la derecha el importe con su `Badge`, y el chevron.
7. «Pagado cada año», al final.

«De cada 100 €» no sale en móvil.

**Fuera:** la tabla de una fila por trimestre, «Pagado en {año}» y «Otros años» de la columna derecha (pasan a la fila de arriba y a «Pagado cada año») y el desplegable del año de la cabecera.

**Los años sin datos** (2023-2025) salen solo con lo presentado, como en la D.1.

### Comprueba (con los datos reales)

- **`/impuestos` (2026):**
  - 13 filas;
  - 303: 207,46 / −0,42 / −2,42 €, más el 4T calculado (≈ 0 €);
  - 130: 1.399,14 / 1.530,54 / 1.503,78 €, más el 4T (0 €);
  - nota de 752,97 € en el 303 del 2T.
- **Cifras de arriba y de la columna derecha:**
  - «Pagado en 2026»: **4.640,92 €**;
  - «De cada 100 €»: **16 €** (4.586,46 / 29.460 = 15,6);
  - «Pagado cada año»: 10.172 / 9.933 / 7.202 / 4.641 €.
- **Filtros:**
  - `?modelo=irpf` → 4 filas;
  - `?estado=compensar` → 2 filas;
  - `?anio=todos` → también las filas de 2023-2025, agrupadas.
- **Pruebas:**
  - `npm test`, typecheck y build;
  - `next start` + `curl` a `/impuestos`, `/impuestos?anio=todos`, `/impuestos?modelo=irpf`, `/impuestos?anio=2025`, `/impuestos/2026/4` y `/impuestos/2026/390`, todas con `200`;
  - la integración (comparte `lib/impuestos.ts` con el bot).
- **Revisión visual de Jose** a 1440 y 390 px, frente a las maquetas.

---

## Riesgos y dudas

- **El IRPF de «Te queda» no es lo pagado.** El 20 % del beneficio (≈ 4.250 € de enero a octubre) no coincide con los 130 presentados más las retenciones (4.586,46 €, porque la gestoría no restaba la cuota). Es lo buscado: así un mes no depende de cuándo se paga el 130. Lo explica «Cómo se calcula».
- **Los gastos sin el límite de comidas** hacen que «Te queda» use un gasto algo distinto del de `pyg`. También es lo buscado (dinero real). Hoy la diferencia es 0 o casi.
- **`titular_unico()` falla con dos titulares.** Es la protección que se quiere: nadie mete un segundo titular sin cambiar antes el código.
- **Vela 0.9.0** tiene `Dropdown`, `Sheet` con `side="right"`, `Meter` y `StackedBar` (CONTEXTO). Si `BarChart` no admite una línea de referencia, se resuelve en IVAn.
- **Justificantes:** la maqueta de Impuestos ya no lleva columna de justificante, porque IVAn no los guarda. Idea para más adelante: guardar el PDF cuando Jose le diga al bot «presentado el 303…».

## Fuera de este plan (más adelante)

- Preguntas a IVAn desde el panel («Pregúntale a IVAn» en cada indicador) y un simulador de «¿y si…?». Antes, probar en Telegram dándole al agente una herramienta de salud del negocio y el objetivo (plan aparte).
- El panel como Mini App de Telegram.
- Varios titulares: filtrar por `titular_id`, claves únicas por titular, acceso por titular y la mesa del gestor.
- Estimación de la Renta.
- Modo oscuro.

## Notas de ejecución (las rellena Claude Code)

**Fase G.1 · Campo de titular (25/11/2026, rama `plan/panel-v4-g1`):**

- `supabase/migrations/010_titulares.sql`: tal cual el plan, sin cambios.
- `lib/copia.ts`: `TABLAS` empieza por `"titulares"` y `CLAVE_ORDEN.titulares = "id"`. Restaurar una copia sin la tabla `titulares` (de antes de esta fase) crea el titular desde la primera fila de `ajustes` con una función pura nueva, `titularDeCopiaAntigua`, antes del bucle normal; así queda testeable sin base de datos. `version` de la copia se queda en `1`, como pedía el plan.
- `scripts/restaurar.ts`: comentario de cabecera actualizado (migraciones 001-010 y la nota de que las copias antiguas crean el titular solas).
- Seeds: `supabase/seed/ajustes.ejemplo.sql` y `scripts/integracion/ajustes.prueba.sql` llevan el `insert into titulares` antes del `insert into ajustes`. No había otros `insert into ajustes` en el repo.
- `docs/PUESTA_EN_MARCHA.md`: añadida la migración 010 al paso 2. De paso se ha corregido que al paso le faltaban las migraciones 006-009 (no estaban listadas desde antes de este plan; se apunta aquí porque no es parte del plan en sí).
- `scripts/integracion/grants.sql` no se ha tocado: concede permisos con `on all tables in schema public`, así que ya cubre `titulares` sin cambios.
- Tests nuevos: `tests/copia.test.ts` (unitarios, sin base de datos) comprueban que `TABLAS` empieza por `titulares` y los tres casos de `titularDeCopiaAntigua` (copia sin titulares, copia que ya los trae, copia sin ni ajustes ni titulares).
- Comprobado en el Mac de Jose: `npm test` (166 tests), `npm run typecheck` y `npm run build`, todo en verde. `scripts/integracion/reset-db.sh` (con datos y con `--vacia`) y las 56 conversaciones de `scripts/integracion/conversaciones.ts` pasan, incluida la restauración de una copia completa en una base vacía. Además, una prueba manual aparte (script temporal, borrado al terminar) confirmó el caso que no cubren las 56 conversaciones: restaurar una copia **sin** `titulares` (como las de antes de esta fase) crea el titular desde `ajustes` y las filas toman `titular_id` por defecto.
- No se ha tocado nada de `lib/db.ts` ni filtrado por `titular_id` en ninguna consulta, como pedía el plan.
- PR abierto contra `wip/v0`, sin fusionar.

**Fase G.2 · Menú en móvil (25/11/2026, rama `plan/panel-v4-g2`):**

- `components/PanelNav.tsx`: `NavMovil` sustituido por `CabeceraMovil` (`"use client"`, solo por debajo de `lg`), con la cabecera (IVAn, botón del bot y hamburguesa) y el `Sheet` lateral (`side="right"`) con el bot, Inicio/Ventas/Gastos/Impuestos (con la etiqueta `{t}T` si hay aviso), «Excel {año}» y, abajo, el nombre de `ajustes` con su inicial más las opciones de `menuCuenta` (Configuración y Cerrar sesión), igual que en escritorio. Se cierra con la X, al tocar fuera y con Esc (lo da el `<dialog>` de `Sheet`) y al navegar (un `useEffect` sobre `usePathname()`).
- `app/(panel)/layout.tsx`: fuera el `tabBar` de `AppShell` (no tiene hueco para una cabecera móvil, así que `CabeceraMovil` se pinta como primer hijo de `children`, con `-mx-4 -mt-4 sticky top-0` para ocupar el ancho y quedar fija al hacer scroll). `mainClassName` pasa `pb-24` a `pb-8`. El layout carga `getAjustes()` para pasarle `ajustes.nombre` a `CabeceraMovil` como texto.
- `components/AccionesCabecera.tsx`: fuera el `AvatarButton` con el `Menu` de cuenta (vivía solo en móvil); el componente ahora solo pinta el desplegable del año y devuelve `null` si no hay año que mostrar. No se ha borrado el componente porque el desplegable del año lo sigue usando Inicio, Ventas, Gastos e Impuestos (lo quita la G.3).
- No se ha tocado `Periodo.tsx` ni `BloqueResultados.tsx` (no son de esta fase).
- Comprobado: `npm test` (165 tests, los mismos que antes de la fase), `npm run typecheck` y `npm run build`, todo en verde. `next start` + `curl` a `/`, `/ventas`, `/gastos`, `/impuestos` y `/ajustes` dan `307` a `/acceso` (sin cookie de sesión; es el comportamiento normal de `exigirSesion`, no una regresión de esta fase). No se ha podido hacer la comprobación visual a 390 px y 1440 px (sin navegador en este entorno): queda para la vista previa de Vercel.
- `Periodo` y `AccionesCabecera` no se han borrado: el plan los deja para la G.3, cuando llegue el selector único.
- PR abierto contra `wip/v0`, sin fusionar.
