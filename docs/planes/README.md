# Planes de IVAn

Cómo trabajamos: **investigar → planificar → ejecutar**.

| Fase | Quién | Dónde |
|---|---|---|
| Investigar | Claude (proyecto IVAn en claude.ai) | Fuentes oficiales (AEAT, BOE), la hoja de 2026, el código |
| Planificar | Claude escribe el plan aquí; **Jose lo aprueba** | `docs/planes/AAAA-MM-DD-tema.md` |
| Ejecutar | **Claude Code**, en `/Users/usuario/dev/IVAn` | El código, siguiendo el plan |
| Revisar (opcional) | Claude, contra el plan | Notas al final del plan |

Reglas:
- Claude Code solo ejecuta planes con estado **Aprobado**. Si algo del plan no encaja con el código, para y lo apunta en «Notas de ejecución» en vez de improvisar.
- Commit y push solo con el OK de Jose.
- Al terminar, Claude Code cambia el estado a **Hecho** y rellena «Notas de ejecución» (qué hizo, qué cambió respecto al plan, cómo quedaron los tests).
- Las cifras fiscales siempre con su fuente. Si una cifra o un plazo puede haber cambiado, se vuelve a comprobar antes de ejecutar.
- `referencia/` guarda código de ejemplo. Sirve para orientarse, no es obligatorio usarlo.

## Planes

| Plan | Estado | Prioridad |
|---|---|---|
| [Revisión de las Fases 1 y 2](2026-11-17-revision-fases-1-2.md) | Hecho | 1 |
| [303: ventas al 21 % en las casillas 07/09](2026-11-17-303-casillas-07-09.md) | Hecho | 2 (antes del 4T) |
| [Modelo 390](2026-11-17-modelo-390.md) | Hecho | 3 (antes del 4T) |
| [Ajustes tras la revisión](2026-11-17-ajustes-revision.md) | Hecho | 1 (antes del 30/11) |
| [IVA de los gastos: tipo por línea y si se deduce](2026-11-18-iva-de-los-gastos.md) | Hecho | 1 (antes de registrar gastos reales) |
| [Puesta en marcha: permisos de Supabase, webhook y región](2026-11-18-puesta-en-marcha-ajustes.md) | Hecho | 1 (antes de crear las cuentas) |
| [Lectura de facturas con Claude Sonnet 5.5 y errores visibles](2026-11-22-claude-sin-tool-choice.md) | Hecho | 1 (bloquea gastos y facturas) |
| [Retoques tras la puesta en marcha: aviso de fin de mes con gastos](2026-11-23-retoques-tras-la-puesta-en-marcha.md) | Hecho | 1 (antes del 28/11) |

## Plantilla

```
# Título
Estado: Borrador | Aprobado | Aprobado | Hecho
Fecha · Autor del plan

## Por qué
## Lo que se sabe (fuentes)
## Alcance (sí / no)
## Cambios, archivo por archivo
## Cómo sabremos que está bien (tests y cifras esperadas)
## Riesgos y dudas
## Notas de ejecución (las rellena Claude Code)
```
