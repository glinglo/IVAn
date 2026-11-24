import { waitUntil } from "@vercel/functions";
import type { Update } from "grammy/types";
import { erroSeguro, getBot, manejarActualizacion } from "@/lib/bot";
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
      .then((bot) => manejarActualizacion(bot, update))
      // Nunca el objeto del error entero (puede llevar el ctx y, dentro, el token del bot).
      .catch((e) => console.error("update", update.update_id, erroSeguro(e))),
  );
  return Response.json({ ok: true });
}
