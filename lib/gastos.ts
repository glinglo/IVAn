import { randomUUID } from "node:crypto";
import { db, getAjustes, nums, subirArchivo, type Gasto } from "./db";
import { extraerGasto, corregirGasto, type GastoExtraido, type LineaIvaExtraida } from "./claude";
import { tipoCambioBCE } from "./cambio";
import { clasificarGasto, round2, validarDesglose, hoyMadrid, type LineaIva } from "./fiscal";

const NUMERICOS: (keyof Gasto)[] = ["base", "iva", "importe_original", "tipo_cambio", "manutencion_limite"];

const normalizaNif = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^ES/, "");

/** Pasa el desglose de la factura a euros, línea a línea. Si una línea no trae base o cuota
 * (solo pone total con IVA incluido y el %), se descarta: no hay con qué ajustarla sola. */
function convertirDesglose(lineas: LineaIvaExtraida[], cambio: number | null): LineaIva[] {
  const aEuros = (n: number) => (cambio ? round2(n / cambio) : round2(n));
  return lineas
    .filter((l) => l.base !== null && l.cuota !== null)
    .map((l) => ({ pct: l.tipo_pct, base: aEuros(l.base!), cuota: aEuros(l.cuota!) }));
}

/** Las líneas convertidas pueden quedar a 1-2 céntimos del total por el redondeo línea a línea;
 * se ajusta en la línea de mayor base para que la suma cuadre con `base` e `iva`. */
function ajustarRedondeo(lineas: LineaIva[], base: number, iva: number): LineaIva[] {
  if (!lineas.length) return lineas;
  let mayor = 0;
  for (let i = 1; i < lineas.length; i++) if (lineas[i].base > lineas[mayor].base) mayor = i;
  const diffBase = round2(base - round2(lineas.reduce((s, l) => s + l.base, 0)));
  const diffIva = round2(iva - round2(lineas.reduce((s, l) => s + l.cuota, 0)));
  return lineas.map((l, i) => (i === mayor ? { ...l, base: round2(l.base + diffBase), cuota: round2(l.cuota + diffIva) } : l));
}

/** Convierte lo extraído en la fila del libro: euros, desglose de IVA, tipo de gasto y avisos.
 * Pura salvo por el tipo de cambio, que se pasa ya resuelto (null si la moneda es EUR). */
export function construirFila(x: GastoExtraido, nifPropio: string, cambio: number | null) {
  const fecha = x.fecha ?? hoyMadrid();
  const moneda = (x.moneda || "EUR").toUpperCase();
  let base = x.base;
  let iva = x.iva ?? 0;
  let importe_original: number | null = null;
  if (moneda !== "EUR" && base !== null && cambio) {
    importe_original = base;
    base = round2(base / cambio);
    iva = round2(iva / cambio);
  }
  let desglose = ajustarRedondeo(convertirDesglose(x.desglose_iva, moneda === "EUR" ? null : cambio), base ?? 0, iva);
  // El total impreso es el que de verdad valida que no falte ninguna línea; si no viene, no se
  // comprueba ese punto (no hay con qué comparar).
  const totalFactura = x.total !== null ? (cambio ? round2(x.total / cambio) : round2(x.total)) : null;
  const avisos = base !== null ? validarDesglose(desglose, base, iva, totalFactura) : [];

  const aMiNombre = x.nif_destinatario ? normalizaNif(x.nif_destinatario) === normalizaNif(nifPropio) : false;
  let tipo = clasificarGasto(x.pais, iva, { ivaEspanol: x.iva_espanol, aMiNombre });
  const notasSinIva: string[] = [];
  if (tipo === "Sin IVA deducible" && base !== null) {
    if (!x.iva_espanol) notasSinIva.push("IVA de otro país (o OSS): no se deduce, se suma al gasto.");
    else if (!aMiNombre) notasSinIva.push("No veo tu NIF en la factura: pide la factura con tu NIF y reenvíamela para sustituir este gasto.");
    base = round2(base + iva);
    iva = 0;
    // El desglose ya no representa el IVA deducido (no hay ninguno): se deja vacío.
    desglose = [];
  }
  const notas = [...(x.notas ? [x.notas] : []), ...avisos.map((a) => `⚠️ ${a}`), ...notasSinIva].join(" ") || null;

  return {
    fecha,
    proveedor: x.proveedor,
    pais: x.pais?.toUpperCase() ?? null,
    nif: x.nif_proveedor,
    numero_factura: x.numero_factura,
    concepto: x.concepto,
    tipo,
    base,
    iva,
    moneda,
    importe_original,
    tipo_cambio: cambio,
    desglose,
    a_mi_nombre: aMiNombre,
    extraccion: { ...x, notas },
  };
}

/** Convierte lo extraído en la fila del libro (resuelve el tipo de cambio si hace falta). */
async function aFila(x: GastoExtraido, nifPropio: string) {
  const fecha = x.fecha ?? hoyMadrid();
  const moneda = (x.moneda || "EUR").toUpperCase();
  const cambio = moneda !== "EUR" && x.base !== null ? await tipoCambioBCE(fecha, moneda) : null;
  return construirFila(x, nifPropio, cambio);
}

export interface ArchivoLeido {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  extraido: GastoExtraido;
  nifPropio: string;
}

/** Lee el archivo con Claude sin guardar nada: así se puede decidir si es un gasto o una factura propia. */
export async function leerArchivo(archivo: { bytes: Uint8Array; mime: string; ext: string }): Promise<ArchivoLeido> {
  const ajustes = await getAjustes();
  const extraido = await extraerGasto(archivo, ajustes.nif);
  return { ...archivo, extraido, nifPropio: ajustes.nif };
}

export async function registrarDesdeArchivo(leido: ArchivoLeido): Promise<Gasto> {
  const path = `gastos/${hoyMadrid().slice(0, 7)}/${randomUUID()}.${leido.ext}`;
  await subirArchivo(path, leido.bytes, leido.mime);
  const fila = await aFila(leido.extraido, leido.nifPropio);
  const { data, error } = await db()
    .from("gastos")
    .insert({ ...fila, archivo_path: path, estado: "borrador" })
    .select("*")
    .single();
  if (error) throw error;
  return nums(data as Gasto, NUMERICOS);
}

/** Límites diarios de manutención, art. 9 RIRPF: España / extranjero, y con pernocta. */
export const LIMITE_MANUTENCION = { base: 26.67, pernocta: 53.34, extranjero: 48.08, extranjeroPernocta: 91.35 };

/** Lo que diga Jose sobre dónde comió no está en la factura: se ajusta aquí, no releyendo con Claude. */
function ajustarLimiteManutencion(actual: number, texto: string): number {
  const t = texto.toLowerCase();
  const diceExtranjero = /extranjero/.test(t);
  const dicePernocta = /dorm[íi]|pernoct/.test(t);
  if (!diceExtranjero && !dicePernocta) return actual;
  const yaExtranjero = actual === LIMITE_MANUTENCION.extranjero || actual === LIMITE_MANUTENCION.extranjeroPernocta;
  const yaPernocta = actual === LIMITE_MANUTENCION.pernocta || actual === LIMITE_MANUTENCION.extranjeroPernocta;
  const extranjero = yaExtranjero || diceExtranjero;
  const pernocta = yaPernocta || dicePernocta;
  if (extranjero && pernocta) return LIMITE_MANUTENCION.extranjeroPernocta;
  if (extranjero) return LIMITE_MANUTENCION.extranjero;
  if (pernocta) return LIMITE_MANUTENCION.pernocta;
  return LIMITE_MANUTENCION.base;
}

/** Si el gasto es (o pasa a ser) una atención a un cliente, el IVA no se deduce: se suma a la base. */
function sinIvaPorAtencionCliente(fila: { tipo: Gasto["tipo"]; base: number | null; iva: number }): Partial<Gasto> {
  if (fila.tipo !== "IVA soportado" || fila.base === null) return {};
  return { base: round2(fila.base + fila.iva), iva: 0, tipo: "Sin IVA deducible", desglose: [] };
}

/** El gasto es una atención a un cliente: el IVA no se deduce (pasa a ser más gasto), como «Sin IVA deducible». */
async function marcarAtencionCliente(g: Gasto): Promise<Gasto> {
  const cambios: Partial<Gasto> = { uso: "atencion_cliente", ...sinIvaPorAtencionCliente(g) };
  const { data, error } = await db().from("gastos").update(cambios).eq("id", g.id).select("*").single();
  if (error) throw error;
  return nums(data as Gasto, NUMERICOS);
}

/** Botón de restaurante: para qué fue la comida. "personal" descarta el gasto. */
export async function setUso(id: string, uso: "manutencion" | "atencion_cliente" | "personal"): Promise<Gasto | null> {
  if (uso === "personal") {
    await setEstado(id, "descartado");
    return null;
  }
  const g = await getGasto(id);
  if (!g) return null;
  if (uso === "atencion_cliente") return marcarAtencionCliente(g);
  const { data, error } = await db()
    .from("gastos")
    .update({ uso, manutencion_limite: g.manutencion_limite ?? LIMITE_MANUTENCION.base })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return nums(data as Gasto, NUMERICOS);
}

export async function aplicarCorreccion(g: Gasto, texto: string): Promise<Gasto> {
  const t = texto.toLowerCase();
  if (g.uso !== "atencion_cliente" && /\bcliente\b/.test(t) && /(invit|era con|fue con)/.test(t)) {
    return marcarAtencionCliente(g);
  }
  if (g.uso === "manutencion" && g.manutencion_limite !== null && /extranjero|dorm[íi]|pernoct/.test(t)) {
    const manutencion_limite = ajustarLimiteManutencion(g.manutencion_limite, t);
    const { data, error } = await db().from("gastos").update({ manutencion_limite }).eq("id", g.id).select("*").single();
    if (error) throw error;
    return nums(data as Gasto, NUMERICOS);
  }
  const ajustes = await getAjustes();
  const nuevo = await corregirGasto(g.extraccion as GastoExtraido, texto, ajustes.nif);
  const fila = await aFila(nuevo, ajustes.nif);
  const filaFinal = g.uso === "atencion_cliente" ? { ...fila, ...sinIvaPorAtencionCliente(fila) } : fila;
  const { data, error } = await db().from("gastos").update(filaFinal).eq("id", g.id).select("*").single();
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
