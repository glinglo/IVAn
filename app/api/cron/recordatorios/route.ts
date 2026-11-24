import { erroSeguro, getBot } from "@/lib/bot";
import { ejecutarRecordatorios } from "@/lib/cron";
import { copiaSiToca } from "@/lib/copia";
import { InputFile } from "grammy";
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
  // La copia va aparte: si falla, los avisos ya han salido; y al revés.
  let copia: string | null = null;
  try {
    const r = await copiaSiToca((bytes, nombre, caption) =>
      bot.api.sendDocument(env.allowedUserId, new InputFile(Buffer.from(bytes), nombre), { caption }),
    );
    copia = r?.nombre ?? null;
  } catch (e) {
    console.error("copia", erroSeguro(e));
    await bot.api.sendMessage(env.allowedUserId, `⚠️ No he podido hacer la copia de seguridad: ${e instanceof Error ? e.message : String(e)}. Pídemela con /copia.`).catch(() => {});
  }
  return Response.json({ enviados: avisos.map((a) => a.clave), copia });
}
