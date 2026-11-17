import { haySesion } from "@/lib/auth";
import { exportarXlsx } from "@/lib/exportar";
import { hoyMadrid } from "@/lib/fiscal";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await haySesion())) return new Response("unauthorized", { status: 401 });
  const anio = Number(new URL(req.url).searchParams.get("anio") ?? hoyMadrid().slice(0, 4));
  const bytes = await exportarXlsx(anio);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="ivan-${anio}.xlsx"`,
    },
  });
}
