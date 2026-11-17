import { randomUUID } from "node:crypto";
import { db, getAjustes, nums, subirArchivo, type Gasto } from "./db";
import { extraerGasto, corregirGasto, type GastoExtraido } from "./claude";
import { tipoCambioBCE } from "./cambio";
import { clasificarGasto, hoyMadrid, round2 } from "./fiscal";

const NUMERICOS: (keyof Gasto)[] = ["base", "iva", "importe_original", "tipo_cambio"];

const normalizaNif = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^ES/, "");

/** Convierte lo extraído en la fila del libro (euros, tipo de IVA, si va a mi nombre). */
async function aFila(x: GastoExtraido, nifPropio: string) {
  const fecha = x.fecha ?? hoyMadrid();
  const moneda = (x.moneda || "EUR").toUpperCase();
  let base = x.base;
  let iva = x.iva ?? 0;
  let tipo_cambio: number | null = null;
  let importe_original: number | null = null;
  if (moneda !== "EUR" && base !== null) {
    tipo_cambio = await tipoCambioBCE(fecha, moneda);
    importe_original = base;
    base = round2(base / tipo_cambio);
    iva = round2(iva / tipo_cambio);
  }
  return {
    fecha,
    proveedor: x.proveedor,
    pais: x.pais?.toUpperCase() ?? null,
    nif: x.nif_proveedor,
    numero_factura: x.numero_factura,
    concepto: x.concepto,
    tipo: clasificarGasto(x.pais, iva),
    base,
    iva,
    moneda,
    importe_original,
    tipo_cambio,
    a_mi_nombre: x.nif_destinatario ? normalizaNif(x.nif_destinatario) === normalizaNif(nifPropio) : false,
    extraccion: x,
  };
}

export async function registrarDesdeArchivo(archivo: { bytes: Uint8Array; mime: string; ext: string }): Promise<Gasto> {
  const ajustes = await getAjustes();
  const path = `gastos/${hoyMadrid().slice(0, 7)}/${randomUUID()}.${archivo.ext}`;
  await subirArchivo(path, archivo.bytes, archivo.mime);
  const extraido = await extraerGasto(archivo, ajustes.nif);
  const fila = await aFila(extraido, ajustes.nif);
  const { data, error } = await db()
    .from("gastos")
    .insert({ ...fila, archivo_path: path, estado: "borrador" })
    .select("*")
    .single();
  if (error) throw error;
  return nums(data as Gasto, NUMERICOS);
}

export async function aplicarCorreccion(g: Gasto, texto: string): Promise<Gasto> {
  const ajustes = await getAjustes();
  const nuevo = await corregirGasto(g.extraccion as GastoExtraido, texto, ajustes.nif);
  const fila = await aFila(nuevo, ajustes.nif);
  const { data, error } = await db().from("gastos").update(fila).eq("id", g.id).select("*").single();
  if (error) throw error;
  return nums(data as Gasto, NUMERICOS);
}

export async function getGasto(id: string): Promise<Gasto | null> {
  const { data } = await db().from("gastos").select("*").eq("id", id).maybeSingle();
  return data ? nums(data as Gasto, NUMERICOS) : null;
}

export async function gastoPorMensaje(messageId: number): Promise<Gasto | null> {
  const { data } = await db()
    .from("gastos")
    .select("*")
    .eq("telegram_message_id", messageId)
    .eq("estado", "borrador")
    .maybeSingle();
  return data ? nums(data as Gasto, NUMERICOS) : null;
}

export async function setEstado(id: string, estado: Gasto["estado"]) {
  const { error } = await db().from("gastos").update({ estado }).eq("id", id);
  if (error) throw error;
}

export async function setMensaje(tabla: "gastos" | "facturas", id: string, messageId: number) {
  await db().from(tabla).update({ telegram_message_id: messageId }).eq("id", id);
}

/** ¿Hay ya un gasto confirmado igual? (mismo proveedor y número, o misma fecha y base) */
export async function buscarDuplicado(g: Gasto): Promise<Gasto | null> {
  const base = db().from("gastos").select("*").eq("estado", "confirmado").neq("id", g.id).limit(1);
  if (g.numero_factura && g.nif) {
    const { data } = await base.eq("numero_factura", g.numero_factura).eq("nif", g.nif);
    if (data?.length) return data[0] as Gasto;
  }
  if (g.fecha && g.base !== null && g.proveedor) {
    const { data } = await db()
      .from("gastos")
      .select("*")
      .eq("estado", "confirmado")
      .neq("id", g.id)
      .eq("fecha", g.fecha)
      .eq("base", g.base)
      .ilike("proveedor", g.proveedor)
      .limit(1);
    if (data?.length) return data[0] as Gasto;
  }
  return null;
}

export async function gastosDelTrimestre(desde: string, hasta: string): Promise<Gasto[]> {
  const { data, error } = await db()
    .from("gastos")
    .select("*")
    .eq("estado", "confirmado")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha");
  if (error) throw error;
  return (data as Gasto[]).map((g) => nums(g, NUMERICOS));
}
