# IVAn

Herramienta de contabilidad propia de Jose (autónomo, estimación directa simplificada): bot de Telegram con Claude + panel web mínimo para emitir facturas, registrar gastos y preparar los trimestrales (303, 130, 349).

**Lee primero `docs/CONTEXTO.md`**: decisiones, datos fiscales de 2026, plan aprobado y estado del código.

## Reglas de trabajo
- Español siempre. Investigar → planificar → ejecutar: no construir, hacer commit ni push sin el OK explícito de Jose.
- **Reparto:** Claude (proyecto IVAn en claude.ai) investiga y escribe los planes en `docs/planes/`; Jose los aprueba; **Claude Code ejecuta** solo planes con estado «Aprobado» y apunta al final del plan qué hizo. Si el plan no encaja con el código, para y lo apunta; no improvises. Ver `docs/planes/README.md`.
- Las cifras fiscales salen de `lib/calculo.ts`; cualquier cambio tiene que seguir pasando `tests/calculo.test.ts`, que reproduce la hoja y el P&L de la gestoría.
- Nunca subir datos personales al repo: `supabase/seed/ajustes.local.sql` (NIF, dirección, IBAN) está en `.gitignore`. Las claves van en `.env.local` y en Vercel.
- Una factura emitida no se modifica (hay triggers en la base de datos); la emisión pasa solo por `lib/facturacion.ts`, que es donde irá Verifactu (julio de 2027).

## Stack
Next.js 16 (App Router) en Vercel · Supabase (Postgres + Storage) · grammY (Telegram) · Anthropic SDK (agente y lectura de facturas) · OpenAI (transcripción de voz) · pdf-lib · exceljs · vitest.

```
npm install
npm test           # reglas fiscales y cálculo
npm run typecheck
npm run dev
```
