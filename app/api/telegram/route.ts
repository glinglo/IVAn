import { waitUntil } from "@vercel/functions";
import type { Update } from "grammy/types";
import { getBot } from "@/lib/bot";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

// Telegram espera respuesta rápida: contestamos 200 al momento y procesamos en segundo plano.
export async function POST(req: Request) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== env.webhookSecret) {
    return new Response("unauthorized", { status: 401 });
  }
  const update = (await req.json()) as Update;
  waitUntil(
    getBot()
      .then((bot) => bot.handleUpdate(update))
      .catch((e) => console.error("update", update.update_id, e)),
  );
  return Response.json({ ok: true });
}
