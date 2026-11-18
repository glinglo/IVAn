// Acceso al panel sin contraseñas: el bot genera un enlace firmado que caduca en 15 minutos;
// al abrirlo se guarda una cookie de sesión firmada válida 30 días.

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const COOKIE = "ivan_sesion";
const ENLACE_MIN = 15;
export const SESION_DIAS = 30;

type Tipo = "enlace" | "sesion";

function firmar(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function crearToken(tipo: Tipo, ahora = Date.now(), secret = env.panelSecret): string {
  const exp = ahora + (tipo === "enlace" ? ENLACE_MIN * 60_000 : SESION_DIAS * 86_400_000);
  const payload = Buffer.from(JSON.stringify({ t: tipo, exp })).toString("base64url");
  return `${payload}.${firmar(payload, secret)}`;
}

export function verificarToken(token: string | undefined | null, tipo: Tipo, ahora = Date.now(), secret = env.panelSecret): boolean {
  if (!token) return false;
  const [payload, firma] = token.split(".");
  if (!payload || !firma) return false;
  const esperada = Buffer.from(firmar(payload, secret));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return false;
  try {
    const { t, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { t: Tipo; exp: number };
    return t === tipo && typeof exp === "number" && exp > ahora;
  } catch {
    return false;
  }
}

/** Solo rutas internas del panel («/anual/2026»), nunca otra web. */
export const rutaSegura = (ir: string | null | undefined) => (ir && /^\/(?!\/)[\w\-/]*$/.test(ir) ? ir : "/");

export const enlacePanel = (ir?: string) =>
  `${env.appUrl}/acceso?t=${crearToken("enlace")}${ir && rutaSegura(ir) !== "/" ? `&ir=${encodeURIComponent(ir)}` : ""}`;
