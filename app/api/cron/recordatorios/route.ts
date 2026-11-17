import { getBot } from "@/lib/bot";
import { ejecutarRecordatorios } from "@/lib/cron";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel Cron la llama cada día (vercel.json) con Authorization: Bearer CRON_SECRET.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const bot = await getBot();
  const avisos = await ejecutarRecordatorios((texto) => bot.api.sendMessage(env.allowedUserId, texto));
  return Response.json({ enviados: avisos.map((a) => a.clave) });
}
