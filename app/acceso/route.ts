import { NextResponse } from "next/server";
import { COOKIE, SESION_DIAS, crearToken, verificarToken } from "@/lib/sesion";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!verificarToken(url.searchParams.get("t"), "enlace")) {
    return NextResponse.redirect(new URL("/sin-acceso", url));
  }
  const res = NextResponse.redirect(new URL("/", url));
  res.cookies.set(COOKIE, crearToken("sesion"), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESION_DIAS * 86_400,
  });
  return res;
}
