import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/sesion";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/sin-acceso?salida=1", req.url), 303);
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
