// Uso: APP_URL=https://tu-app.vercel.app npm run set-webhook  (con .env.local cargado)
import { Bot } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.env.APP_URL;
if (!token || !secret || !url) throw new Error("Faltan TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET o APP_URL");

const bot = new Bot(token);
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
