# Puesta en marcha de IVAn

Unos 45 minutos. Todo en plan gratis. Las claves se guardan en `.env.local` (tu ordenador) y en Vercel; nunca en el repo.

## 1. Telegram

1. En Telegram, abre **@BotFather** → `/newbot` → nombre `IVAn` → usuario, p. ej. `IvanGestorBot`. Copia el **token** → `TELEGRAM_BOT_TOKEN`.
2. Abre **@userinfobot** y copia tu **ID** numérico → `TELEGRAM_ALLOWED_USER_ID`. El bot ignora a cualquier otra persona.
3. Genera dos cadenas aleatorias largas para `TELEGRAM_WEBHOOK_SECRET` y `PANEL_SECRET`:
   ```
   openssl rand -hex 32
   ```
   y otra más para `CRON_SECRET`.

## 2. Supabase (base de datos y archivos)

1. supabase.com → New project. **Región: Frankfurt (eu-central-1)** o París, para que los datos se queden en la UE. Guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. **SQL Editor**, ejecuta en este orden (copiar y pegar cada archivo):
   1. `supabase/migrations/001_init.sql`
   2. `supabase/migrations/002_storage.sql`
   3. Tu `supabase/seed/ajustes.local.sql`: copia `ajustes.ejemplo.sql` con ese nombre y pon tu NIF, dirección, email e IBAN. No se sube al repo.
   4. `supabase/seed/datos_2026.sql`
3. Comprueba: `select count(*) from facturas;` → 11 · `select count(*), sum(base) from gastos;` → 71 · 2041.44.
4. **Project Settings → API**: copia la URL del proyecto → `SUPABASE_URL` y la clave secreta (`service_role` o `sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY`. Esa clave da acceso total: solo en `.env.local` y Vercel.

Supabase pausa los proyectos gratis tras 7 días sin actividad; el aviso diario de IVAn lee la base de datos y lo mantiene despierto.

## 3. Claves de IA

- **Anthropic**: console.anthropic.com → API keys → `ANTHROPIC_API_KEY`. Pon un límite de gasto mensual bajo (p. ej. 10 $).
- **OpenAI** (solo para notas de voz): platform.openai.com → API keys → `OPENAI_API_KEY`. También con límite de gasto.

## 4. Vercel

1. vercel.com → Add New → Project → importa `glinglo/IVAn`. Rama de producción: la que tenga el código (hoy `wip/v0`; cuando se fusione, `main`).
2. **Settings → Environment Variables**: todas las de `.env.example` con sus valores. `APP_URL` = la URL que te da Vercel (`https://….vercel.app`).
3. Despliega. El aviso diario ya va en `vercel.json` (09:00-10:00 hora de Madrid).

## 5. Conectar el bot

En tu ordenador, con `.env.local` relleno:

```
npm install
npm run set-webhook
```

Debe mostrar la URL `…/api/telegram` y `pending_update_count: 0`.

## 6. Primera prueba (sin gastar números de factura)

1. `/start` → te contesta.
2. «¿Cómo va el trimestre?» → 4T: IVA 0 €, IRPF 277,03 € (con los datos de 2026 cargados).
3. `/panel` → abre el enlace en el móvil; las cifras deben ser las de la hoja.
4. Manda la foto de un gasto real → revisa el borrador → ✅.
5. «Factura a Zapflow 3.060 de noviembre» → mira el borrador y **pulsa ❌ Cancelar**. El número solo se asigna al pulsar ✅.

Mientras dure el paralelo con Selfconta (noviembre y diciembre), **no emitas facturas reales con IVAn**: se emiten en Selfconta y se registran en IVAn con su número. La primera factura real de IVAn es la 00339 (enero).

## Pruebas en local

```
npm test                                         # reglas fiscales y cálculo
scripts/integracion/reset-db.sh                  # Postgres local en :54322
POSTGREST_BIN=… scripts/integracion/arrancar.sh  # PostgREST en :3001
npx tsx scripts/integracion/conversaciones.ts    # 32 conversaciones simuladas
```
