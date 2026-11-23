import { db, getAjustes } from "./db";
import { modoParalelo } from "./externas";
import { euros, hoyMadrid, mesAnterior, nombreMes, rangoTrimestre, sumarDias } from "./fiscal";
import { avisosDeHoy, proveedoresQueFaltan, type Aviso, type GastoProveedor } from "./recordatorios";

const MAX_PROVEEDORES_EN_LISTA = 12;

async function avisoBorradores(): Promise<string> {
  const { count } = await db().from("gastos").select("id", { count: "exact", head: true }).eq("estado", "borrador");
  return count ? `\n⚠️ Tienes ${count} gasto(s) sin confirmar en el chat.` : "";
}

async function resumenTrimestre(anio: number, t: number): Promise<string> {
  const { desde, hasta } = rangoTrimestre(anio, t);
  const [fact, gas] = await Promise.all([
    db().from("facturas").select("base").eq("estado", "emitida").gte("fecha", desde).lte("fecha", hasta),
    db().from("gastos").select("base").eq("estado", "confirmado").gte("fecha", desde).lte("fecha", hasta),
  ]);
  const suma = (rows: { base: unknown }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.base ?? 0), 0);
  return (
    `\n\nEn el ${t}T: ${fact.data?.length ?? 0} facturas emitidas (${euros(suma(fact.data))} de base) · ` +
    `${gas.data?.length ?? 0} gastos (${euros(suma(gas.data))}).`
  );
}

const lista = (nombres: string[]) =>
  nombres.length > MAX_PROVEEDORES_EN_LISTA
    ? `${nombres.slice(0, MAX_PROVEEDORES_EN_LISTA).join(", ")} y ${nombres.length - MAX_PROVEEDORES_EN_LISTA} más`
    : nombres.join(", ");

/** Texto del aviso de fin de mes: factura (según el modo) y los gastos que suelen llegar cada mes. */
async function textoFinDeMes(hoy: string, paralelo: boolean): Promise<string> {
  const mes = nombreMes(hoy);
  const desde = `${mesAnterior(mesAnterior(mesAnterior(hoy.slice(0, 7))))}-01`;
  const { data } = await db().from("gastos").select("proveedor, nif, fecha, estado").gte("fecha", desde).neq("estado", "descartado");
  const { faltan, nuevos } = proveedoresQueFaltan((data ?? []) as GastoProveedor[], hoy);

  const l: string[] = [`🧾 Fin de ${mes}: dos cosas antes de cerrar el mes.`];
  l.push(
    paralelo
      ? "1. Factura: hazla en Selfconta y mándame el PDF. (En modo normal: «/factura Zapflow 3060».)"
      : "1. Factura: ¿toca facturar? Por ejemplo: «/factura Zapflow 3060».",
  );
  l.push(
    `2. Gastos: mándame todas las facturas de gasto de ${mes} (foto o PDF), también las de proveedores nuevos o compras sueltas.`,
  );
  l.push(
    faltan.length
      ? `Suelen llegar cada mes y aún no tengo las de ${mes}: ${lista(faltan)}.`
      : `De los que suelen llegar cada mes, ya tengo todos los de ${mes}. 👍`,
  );
  if (nuevos.length) l.push(`Nuevos el mes pasado: ${lista(nuevos)}. Si es una suscripción, mándame también la de ${mes}.`);
  return l.join("\n");
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
    if (a.tipo === "facturar") {
      texto = await textoFinDeMes(hoy, paralelo);
      const pendientes = await clientesSinFacturar(hoy);
      if (pendientes.length) texto += `\nEl mes pasado facturaste a ${pendientes.join(", ")} y este mes todavía no.`;
    }
    if (a.trimestre) texto += await resumenTrimestre(a.trimestre.anio, a.trimestre.t);
    texto += await avisoBorradores();
    await enviar(texto);
    const claves = [a.clave, ...(a.tambien ?? [])].map((clave) => ({ clave }));
    await db().from("recordatorios_enviados").upsert(claves, { onConflict: "clave" });
  }
  return avisos;
}
