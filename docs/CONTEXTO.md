# IVAn: contexto del proyecto

> Documento de traspaso. Resume todo lo hablado y decidido hasta el 17/11/2026 (actualizado tras la Fase 1): la contabilidad de Jose, los datos fiscales de 2026 y el plan de IVAn.

## 1. Qué es y por qué

- **Jose Bautista Gallego**: autónomo en Barcelona (El Masnou), estimación directa simplificada, IVA trimestral, epígrafe IAE 763. Diseñador UX/UI y desarrollador full-stack. Consultora: btsta.me.
- Paga **52 €/mes a una gestoría** que trabaja con Selfconta. Le parece caro para 2-3 facturas al mes y los trimestrales, y Selfconta le resulta incómodo: solo se usa desde el ordenador y todo es manual.
- **Objetivo:** dejar la gestoría y llevarlo él mismo con una herramienta propia, **IVAn**: un bot de Telegram con Claude (texto, voz, fotos y PDF) más un panel web mínimo. Tiene que ser mobile first y quitarle el trabajo manual.
- Inspiración: melso.ai/agente (gestoría con agente de IA en WhatsApp y gestores humanos que presentan). IVAn es la versión para él, sin gestor humano: **presentar ante la AEAT sigue siendo cosa suya**, con Cl@ve en la Sede.
- Idea de negocio relacionada, separada y no prioritaria ahora: un agente de WhatsApp vendido a gestorías.

## 2. Forma de trabajar

- **Investigar → planificar → ejecutar.** No construir ni subir código sin un «dale» explícito de Jose.
- **Reparto (decidido el 17/11/2026):** Claude, en el proyecto de claude.ai, investiga y planifica; los planes van en `docs/planes/` del repo (los leen Claude y Claude Code); Jose los aprueba; **Claude Code ejecuta** en `/Users/usuario/dev/IVAn`. Claude no escribe el código de la app.
- Siempre en español, directo y sin jerga. A Jose le gustan las comparativas honestas (build vs buy, pros y contras).
- Claude no presenta nada en Hacienda: prepara las casillas y Jose presenta.

## 3. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Libro 2026 (hoja de cálculo de Claude) | https://claude.ai/artifact/XrC97eCu9CnrazzNH8KVBN · pestañas: Trimestres, P&L gestoría, Ventas, Gastos, Clientes, Mis datos (NIF, dirección, IBAN) |
| Repo | https://github.com/glinglo/IVAn · `main` = documentación · `wip/v0` = código en curso |
| Carpeta local | `/Users/usuario/dev/IVAn` (enlazada a `origin`; tras el primer push: `git pull origin main`) |
| Datos de origen | Exportes de Selfconta 2026 (ventas, gastos, movimientos), P&L de la gestoría, borrador de la Renta 2024 |

## 4. Datos fiscales 2026 (cerrados)

**Clientes**
- **Zapflow Oy** (Finlandia, VAT FI26899624): servicios intracomunitarios, sin IVA, inversión del sujeto pasivo, va al 349 con clave S. Una factura al mes, unos 3.020-3.060 €: «UX services for Zapflow platform (Mes AAAA) + Cursor subscription». Factura en inglés. **Falta su dirección fiscal** (está en el PDF de la factura 00336). Jose envía las facturas él mismo: IVAn solo las genera y le avisa.
- **Volta Cultural SL** (B23853039): nacional, 21 % de IVA y 15 % de retención (factura 00333, 1.020 € de base).
- Numeración 2026: de 00326 a 00336, sin serie. **Siguiente: 00337.** El 349 lo presentaba la gestoría y Jose está dado de alta en el ROI.

**Ventas 2026 (hasta octubre):** 29.460 € de base.
- Por trimestre: 9.060 / 8.760 / 8.580 / 3.060 €.
- Retenciones: 153 € (Volta, 3T).

**Gastos 2026:** 71 facturas, 2.041,44 € de base. Clasificación del IVA:
- **IVA soportado:** proveedores españoles (ionos, 10dencehispahard).
- **ISP UE:** proveedores de la UE sin IVA (Meta IE, Google Cloud IE, Framer NL, Zoho NL, Surfer PL, Apify CZ, Salesforge EE). Van a las casillas 10/11 y 36/37 y al 349 con clave I.
- **ISP fuera UE:** Anthropic, Replit, Cursor, Fly.io, Cloudflare, Figma (EE. UU.), Shopify (CA), Proton (CH), Paddle sin IVA (GB). Van a las casillas 12/13 y 28/29.
- **Sin IVA deducible:** las dos facturas de Paddle con IVA cobrado. Ese IVA cuenta como gasto, igual que hacía la gestoría.

**Faltan facturas de gasto:**
- Cursor de marzo a octubre (lo refactura a Zapflow cada mes, pero solo hay una factura).
- Apify de octubre.
- Las de la propia gestoría: su casilla 128 está a 0.

**Cuota de autónomo:** unos 452 €/mes (estimada; faltan los recibos reales). Jose decidió meterla como gasto en el 130.
- La gestoría la deja fuera del 130 y la mete en la Renta (casilla 0186; en la Renta 2024 fueron 5.155,20 €). No se ha perdido dinero: solo se adelanta más durante el año.

**Amortización:** Mac comprado en 2025 por unos 2.900 € con IVA (2.399,08 € de base). Al 26 % de la tabla simplificada son 623,76 €/año. **Falta la fecha exacta de compra.**

**Resultados 2026** (con cuota y amortización; cuadran al céntimo con la hoja):

| | 1T | 2T | 3T | 4T (solo octubre) |
|---|---|---|---|---|
| 303 [71] | −2,42 € | −0,42 € | 207,46 € | 0 € |
| 130 a ingresar | 1.216,02 € | 1.272,90 € | 1.141,50 € | 277,03 € |

- P&L de la gestoría (sin cuota): rendimiento neto de 25.455,06 €. Reproducido exacto.
- Renta 2024: ingresos de 53.734,05 €, rendimiento neto de 44.900,40 €, resultado a ingresar de 402,80 €.
- Los 303/130/349 de 1T a 3T de 2026 los presentó la gestoría. **Faltan los importes reales**, que se consultan en la Sede en «consultar declaraciones presentadas».

**Reglas y fechas clave**
- 4T 2026: 303, 130, 349 y 390 hasta el **lunes 1 de febrero de 2027**. La domiciliación cierra aprox. el 25-27 de enero.
- Difícil justificación: 5 % con un máximo de 2.000 € (el 10 % de 2026 es solo para Ceuta).
- El 347 no aplica: ningún cliente ni proveedor español pasa de 3.005,06 €.
- Verifactu: obligatorio para autónomos desde el 1 de julio de 2027 (RDL 15/2025). La emisión de facturas de IVAn está aislada en un único módulo para adaptarla.
- **Paralelo con Selfconta (noviembre y diciembre de 2026), decidido el 17/11:** Selfconta sigue emitiendo (00337 de noviembre, 00338 de diciembre) porque obliga a crear la factura allí. IVAn **no emite** en esos meses: registra esas facturas con su número y lleva los gastos y los cálculos en paralelo para compararlos. Las facturas de prueba nunca van al libro real (una emitida no se puede borrar y contaría en el 303 y el 130). **La primera factura real de IVAn es la 00339 (enero de 2027).** Si todo cuadra, Jose se da de baja de Selfconta y de la gestoría en enero.
- Pendiente de decidir: si la gestoría presenta el 4T (propuesta: pagar enero y usar sus casillas para validar las de IVAn) o lo presenta Jose con IVAn. Preguntárselo a la gestoría y avisarles por el apoderamiento en la Sede.
- **Copia de seguridad:** tiene que ser gratis. Supabase gratis no guarda copias, así que el bot manda cada 7 días a Telegram un `.json.gz` con todas las tablas (no en GitHub: el repo no puede llevar datos personales). `/copia` la pide al momento; `scripts/restaurar.ts` la restaura.

## 5. IVAn: el plan aprobado (v0)

- **Nombre:** IVAn («Iván del IVA»), elegido porque suena bien por voz. Castor queda en reserva como mascota o nombre de producto. Usuario de Telegram por crear en @BotFather (p. ej. @IvanGestorBot).
- **Arquitectura:** bot de Telegram con webhook → Next.js en Vercel → Claude API (agente con herramientas) → Supabase (Postgres y Storage para los PDF). Notas de voz transcritas con OpenAI gpt-4o-mini-transcribe, porque Claude no acepta audio. Un cron diario de Vercel para los avisos.
- **El bot:**
  - Facturas por texto o voz («Iván, factura a Zapflow 3.060 de noviembre»): borrador, botón ✅ y PDF numerado.
  - Gastos por foto o PDF: Claude extrae los datos, los clasifica y se confirman con ✅. Las correcciones se hacen respondiendo al borrador.
  - Consultas («¿cómo va el trimestre?»).
  - «Presentado el 303 del 4T…».
  - `/panel` (enlace firmado, 15 min), `/exportar` (.xlsx), `/pdf 00337`.
  - Avisos de plazos (a 10, 3 y 1 días) y de facturar a fin de mes.
- **Panel web** (mobile first):
  - **Inicio:** KPIs de ventas, gastos y beneficio, P&L, siguientes pasos y trimestres. Cada trimestre enlaza a sus casillas de 303, 130 y 349, listas para copiar en la Sede.
  - **Ventas:** lista de facturas con PDF.
  - **Gastos:** lista de gastos con su archivo original.
- **Canal:** el agente no depende de Telegram, así que WhatsApp sería añadir un adaptador más adelante.
- **Coste:** Vercel y Supabase en plan gratis; Claude y la transcripción, céntimos al mes.

## 6. Estado del código (rama `wip/v0`)

**Hecho y probado (Fase 1, 17/11/2026):**
- Reglas fiscales y cálculo de 303, 130, 349 y P&L: 23 tests que reproducen la hoja y el P&L de la gestoría.
- Esquema SQL: numeración sin huecos, facturas emitidas inmutables (probado: no se pueden borrar ni cambiar; dos ✅ a la vez emiten una sola).
- Prueba de integración (`scripts/integracion/`): Postgres + PostgREST reales con Telegram, Claude, transcripción y tipo de cambio simulados. **32 conversaciones pasan**: facturas (borrador, corrección respondiendo, falta de dirección, emisión, cancelación), gastos (foto en USD, PDF duplicado, corrección), voz, consultas con historial, presentado, cuota, /panel, /exportar, /pdf, /ajustes, avisos y seguridad del webhook y del cron.
- Panel revisado en móvil contra la base local: Inicio y los cuatro trimestres dan las cifras de la hoja, incluido el IVA a compensar que pasa del 1T y 2T al 3T (2,84 €).
- Arreglado en la Fase 1: si la factura se emitía y fallaba el envío del PDF, el bot decía «No la he emitido»; el 349 muestra país y número por separado, como los pide la Sede; el NIF del emisor sale con prefijo ES en facturas UE; el aviso de facturar sale desde el día 28 aunque el aviso diario se salte un día; /panel y /exportar en el menú del bot.
- Guía de puesta en marcha: `docs/PUESTA_EN_MARCHA.md`.

**Hecho en la Fase 2 (código, 17/11/2026):**
- Modo paralelo (`ajustes.emitir_desde`, migración 003): hasta el 1/1/2027 IVAn no emite; lo bloquean el bot y la función de la base de datos. `/ajustes emitir_desde: ninguno` lo quita.
- Facturas de Selfconta: si el PDF que llega lo ha emitido Jose (su NIF como emisor), IVAn lo lee como factura emitida, enseña «📥 … · 00337» y con ✅ la registra con su número, guarda el PDF original y mueve el contador. Solo acepta la siguiente de la serie; avisa si los importes no son los esperados para ese cliente o si el cliente no existe.
- Copia de seguridad cada 7 días desde el cron, `/copia` y `scripts/restaurar.ts` (probado: volcar → base vacía → restaurar → todo igual).
- 27 tests y 47 conversaciones simuladas pasan.

**Planes en `docs/planes/` (aprobados por Jose el 17/11/2026, para Claude Code):**
- Las Fases 1 y 2 las escribió Claude desde claude.ai, sin plan; Jose decidió dejarlas como base. Plan: [revisión por Claude Code](planes/2026-11-17-revision-fases-1-2.md).
- **303, casillas 07/09:** las ventas al 21 % van en **07 (base), 08 (tipo) y 09 (cuota)**; 01-03 son el 4 % (instrucciones oficiales del 303 de 2026). IVAn las muestra como 01/03 en el panel, el Excel y el bot. Los 303 de 1T a 3T los presentó la gestoría, así que no hay nada mal presentado. Hay que corregirlo antes del 4T. La hoja de Claude tiene el mismo rótulo (Trimestres, filas 12 y 13): la corrige Claude con el OK de Jose.
- **Modelo 390:** investigación hecha, con las casillas comprobadas con las fuentes oficiales y las cifras esperadas (con los datos hasta octubre, 86 = 207,46 € y 108 = 29.460 €). La Orden HAC/27/2026 no afecta a Jose. Hay una implementación de referencia en `docs/planes/referencia/303-y-390.patch` (no aplicada).

**Falta:**
- Puesta en marcha real (cuentas y claves de Jose) y prueba con su Telegram, con Claude de verdad: las pruebas simulan sus respuestas, así que falta ver cómo lee los PDF reales de Selfconta y de gastos.

**Datos pendientes de Jose:**
- PDF de la factura 00336 (dirección de Zapflow) y dirección fiscal de Volta Cultural.
- Fecha de compra del Mac.
- Recibos de autónomo de 2026.
- Importes reales de los 130 de 1T a 3T.
- Facturas de gasto que faltan: Cursor de marzo a octubre, Apify de octubre y las de la gestoría.

## 7. Roadmap

1. **Fase 1 · Prueba en local** (hecha el 17/11/2026).
2. **Fase 2 · Puesta en marcha** (24-29/11): código del modo paralelo y de la copia hecho; falta que Jose cree las cuentas (Supabase en la UE, Vercel, claves con límite de gasto) siguiendo `docs/PUESTA_EN_MARCHA.md` y probarlo con su Telegram.
3. **Fase 3 · Paralelo** (noviembre y diciembre): registrar 00337 y 00338 de Selfconta, gastos en los dos sitios, comparar; hablar con la gestoría. Ejecutar los planes del 303 y del 390.
4. **Fase 4 · Cierre del 4T** (enero de 2027): 303, 130, 349 y 390 con casillas, comparados con la hoja (y con los de la gestoría si los presenta). Plazo: lunes 1/02/2027; domiciliación hacia el 25-27/01 (fecha oficial pendiente). 00339 = primera factura real de IVAn.
5. **2027:** Verifactu antes del 1/07/2027 (vigente según el BOE; se habla de retrasarlo a 2028, revisar en primavera), resumen para la Renta 2026, WhatsApp si encaja.
