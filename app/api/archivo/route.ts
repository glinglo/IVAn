import { NextResponse } from "next/server";
import { haySesion } from "@/lib/auth";
import { BUCKET, db } from "@/lib/db";

export const runtime = "nodejs";

// Abre un PDF o una foto guardada con un enlace temporal de Supabase Storage.
export async function GET(req: Request) {
  if (!(await haySesion())) return new Response("unauthorized", { status: 401 });
  const path = new URL(req.url).searchParams.get("path");
  if (!path || path.includes("..")) return new Response("bad request", { status: 400 });
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) return new Response("not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
