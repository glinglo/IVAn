import { db, getAjustes } from "./db";
import { modoParalelo } from "./externas";
import { euros, hoyMadrid, rangoTrimestre, sumarDias } from "./fiscal";
import { avisosDeHoy, type Aviso } from "./recordatorios";

async function resumenTrimestre(anio: number, t: number): Promise<string> {
  const { desde, hasta } = rangoTrimestre(anio, t);
  const [fact, gas, borr] = await Promise.all([
    db().from("facturas").select("base").eq("estado", "emitida").gte("fecha", desde).lte("fecha", hasta),
    db().from("gastos").select("base").eq("estado", "confirmado").gte("fecha", desde).lte("fecha", hasta),
    db().from("gastos").select("id", { count: "exact", head: true }).eq("estado", "borrador"),
  ]);
  const suma = (rows: { base: unknown }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.base ?? 0), 0);
  let txt =
    `\n\nEn el ${t}T: ${fact.data?.length ?? 0} facturas emitidas (${euros(suma(fact.data))} de base) · ` +
    `${gas.data?.length ?? 0} gastos (${euros(suma(gas.data))}).`;
  if (borr.count) txt += `\n⚠️ Tienes ${borr.count} gasto(s) sin confirmar en el chat.`;
  return txt;
}

/** Clientes facturados el mes pasado que aún no tienen factura este mes. */
async function clientesSinFacturar(hoy: string): Promise<string[]> {
  const mesActual = hoy.slice(0, 7) + "-01";
  const mesPasado = sumarDias(mesActual, -1).slice(0, 7) + "-01";
  const { data } = await db()
    .from("facturas")
    .select("fecha, clientes(nombre)")
    .eq("estado", "emitida")
    .gte("fecha", mesPasado);
  const pasado = new Set<string>();
  const actual = new Set<string>();
  for (const f of (data ?? []) as unknown as { fecha: string; clientes: { nombre: string } | null }[]) {
    const nombre = f.clientes?.nombre;
    if (!nombre) continue;
    (f.fecha >= mesActual ? actual : pasado).add(nombre);
  }
  return [...pasado].filter((n) => !actual.has(n));
}

export async function ejecutarRecordatorios(
  enviar: (texto: string) => Promise<unknown>,
  hoy = hoyMadrid(),
): Promise<Aviso[]> {
  const { data } = await db().from("recordatorios_enviados").select("clave");
  const enviados = new Set((data ?? []).map((r) => r.clave as string));
  const avisos = avisosDeHoy(hoy, enviados);
  const paralelo = avisos.some((a) => a.tipo === "facturar") && modoParalelo(await getAjustes(), hoy);
  for (const a of avisos) {
    let texto = a.texto;
    if (a.tipo === "facturar" && paralelo) {
      texto = "🧾 Fin de mes. ¿Toca facturar? Hazla en Selfconta y mándame el PDF: la registro con su número.";
    }
    if (a.trimestre) texto += await resumenTrimestre(a.trimestre.anio, a.trimestre.t);
    if (a.tipo === "facturar") {
      const pendientes = await clientesSinFacturar(hoy);
      if (pendientes.length) texto += `\nEl mes pasado facturaste a ${pendientes.join(", ")} y este mes todavía no.`;
    }
    await enviar(texto);
    const claves = [a.clave, ...(a.tambien ?? [])].map((clave) => ({ clave }));
    await db().from("recordatorios_enviados").upsert(claves, { onConflict: "clave" });
  }
  return avisos;
}
