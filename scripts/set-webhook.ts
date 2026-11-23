// Uso: APP_URL=https://tu-app.vercel.app npm run set-webhook  (con .env.local cargado)
import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.env.APP_URL;
if (!token || !secret || !url) throw new Error("Faltan TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET o APP_URL");

// GrammyError lleva el payload de la llamada (aquí, secret_token) en una propiedad propia: su
// .message ya es seguro ("Call to 'setWebhook' failed! (401: Unauthorized)"), pero el objeto
// entero no, así que nunca se deja escapar: solo ese mensaje, en un Error nuevo.
function sinSecretos(e: unknown): never {
  throw e instanceof Error ? new Error(e.message) : new Error(String(e));
}

const bot = new Bot(token);
try {
  await bot.api.setWebhook(`${url.replace(/\/$/, "")}/api/telegram`, {
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await bot.api.setMyCommands([
    { command: "factura", description: "Preparar una factura: /factura Zapflow 3060" },
    { command: "gastos", description: "Gastos del trimestre" },
    { command: "pdf", description: "PDF de una factura: /pdf 00337" },
    { command: "panel", description: "Enlace al panel (15 minutos)" },
    { command: "exportar", description: "Excel del año" },
    { command: "copia", description: "Copia de seguridad ahora" },
    { command: "clientes", description: "Lista de clientes" },
    { command: "ajustes", description: "Tus datos (IBAN, email…)" },
    { command: "ayuda", description: "Qué puedo hacer" },
  ]);
  console.log("Webhook:", await bot.api.getWebhookInfo());
} catch (e) {
  sinSecretos(e);
}
