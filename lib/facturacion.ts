// Único punto de emisión de facturas. Desde el 1 de julio de 2027 (Verifactu para autónomos)
// la emisión tiene que generar el registro de facturación, el QR y enviarlo a la AEAT o a un
// proveedor homologado: eso se engancha en registrarVerifactu() sin tocar el resto.

import { db, getAjustes, getClientes, nums, subirArchivo, descargarArchivo, type Cliente, type Factura } from "./db";
import { calcularImportes, hoyMadrid } from "./fiscal";
import { interpretarFactura } from "./claude";
import { generarFacturaPDF } from "./pdf";
import { modoParalelo, textoModoParalelo } from "./externas";

const NUMERICOS: (keyof Factura)[] = ["base", "iva_pct", "iva", "retencion_pct", "retencion", "total"];

export async function getFactura(id: string): Promise<Factura | null> {
  const { data } = await db().from("facturas").select("*").eq("id", id).maybeSingle();
  return data ? nums(data as Factura, NUMERICOS) : null;
}

/** Borrador (de IVAn o de registro de una externa) asociado a un mensaje del bot. */
export async function facturaPorMensaje(messageId: number): Promise<Factura | null> {
  const { data } = await db()
    .from("facturas")
    .select("*")
    .eq("telegram_message_id", messageId)
    .eq("estado", "borrador")
    .maybeSingle();
  return data ? nums(data as Factura, NUMERICOS) : null;
}

async function contextoClientes(clientes: Cliente[]) {
  const { data } = await db()
    .from("facturas")
    .select("cliente_id, concepto, fecha")
    .eq("estado", "emitida")
    .order("fecha", { ascending: false })
    .limit(60);
  return clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    idioma: c.idioma,
    ultimos_conceptos: (data ?? []).filter((f) => f.cliente_id === c.id).slice(0, 3).map((f) => f.concepto as string),
  }));
}

export type ResultadoBorrador =
  | { ok: true; factura: Factura; cliente: Cliente }
  | { ok: false; duda: string };

/** Crea (o rehace) un borrador a partir de texto libre. */
export async function prepararBorrador(texto: string, anterior?: Factura): Promise<ResultadoBorrador> {
  const clientes = await getClientes();
  if (clientes.length === 0) return { ok: false, duda: "No hay clientes. Añade uno con /cliente_nuevo." };
  const hoy = hoyMadrid();
  const p = await interpretarFactura({
    texto,
    hoy,
    clientes: await contextoClientes(clientes),
    borradorActual: anterior
      ? { cliente_id: anterior.cliente_id, base: anterior.base, concepto: anterior.concepto, fecha: anterior.fecha }
      : undefined,
  });
  const cliente = clientes.find((c) => c.id === p.cliente_id);
  if (!cliente || p.base === null || !p.concepto) {
    return { ok: false, duda: p.duda ?? "No me queda claro el cliente o el importe." };
  }
  const imp = calcularImportes(cliente, p.base);
  const fila = {
    fecha: p.fecha ?? hoy,
    cliente_id: cliente.id,
    concepto: p.concepto,
    tipo: cliente.tipo,
    ...imp,
  };
  const q = anterior
    ? db().from("facturas").update(fila).eq("id", anterior.id).eq("estado", "borrador")
    : db().from("facturas").insert({ ...fila, estado: "borrador" });
  const { data, error } = await q.select("*").single();
  if (error) throw error;
  return { ok: true, factura: nums(data as Factura, NUMERICOS), cliente };
}

/** Avisos que impiden o desaconsejan emitir. */
export async function comprobarAntesDeEmitir(f: Factura) {
  const [ajustes, clientes] = await Promise.all([getAjustes(), getClientes()]);
  const cliente = clientes.find((c) => c.id === f.cliente_id);
  const bloqueos: string[] = [];
  const avisos: string[] = [];
  if (modoParalelo(ajustes)) bloqueos.push(textoModoParalelo(ajustes));
  if (!cliente) bloqueos.push("El cliente ya no existe.");
  else {
    if (!cliente.direccion) bloqueos.push(`Falta la dirección de ${cliente.nombre}: /cliente ${cliente.nombre} direccion: ...`);
    if (!cliente.nif) bloqueos.push(`Falta el NIF/VAT de ${cliente.nombre}: /cliente ${cliente.nombre} nif: ...`);
  }
  if (!ajustes.iban) avisos.push("No tienes IBAN en ajustes; la factura saldrá sin datos de pago (/ajustes iban: ...).");
  if (f.fecha > hoyMadrid()) avisos.push("La fecha es futura.");
  return { bloqueos, avisos, ajustes, cliente };
}

/** Asigna número correlativo, genera el PDF y lo guarda. Devuelve el PDF. */
export async function emitirFactura(id: string): Promise<{ numero: string; pdf: Uint8Array }> {
  const f = await getFactura(id);
  if (!f) throw new Error("Borrador no encontrado");
  const { bloqueos } = await comprobarAntesDeEmitir(f);
  if (bloqueos.length) throw new Error(bloqueos.join("\n"));

  const { data: numero, error } = await db().rpc("emitir_factura", { p_factura_id: id });
  if (error) throw error;
  const emitida = (await getFactura(id))!;
  await registrarVerifactu(emitida);
  const pdf = await pdfDeFactura(emitida);
  return { numero: numero as string, pdf };
}

/** Genera (o regenera) el PDF de una factura emitida y lo guarda en Storage. */
export async function pdfDeFactura(f: Factura): Promise<Uint8Array> {
  if (!f.numero) throw new Error("La factura no está emitida");
  const [ajustes, clientes] = await Promise.all([getAjustes(), getClientes()]);
  const { data: c } = await db().from("clientes").select("*").eq("id", f.cliente_id).single();
  const cliente = (c as Cliente) ?? clientes.find((x) => x.id === f.cliente_id);
  const pdf = await generarFacturaPDF({
    numero: f.numero,
    fecha: f.fecha,
    idioma: cliente.idioma,
    // En operaciones intracomunitarias el cliente comprueba el NIF-IVA en VIES: va con el prefijo ES.
    emisor: f.tipo === "ue" && !/^ES/i.test(ajustes.nif) ? { ...ajustes, nif: `ES${ajustes.nif}` } : ajustes,
    cliente: { nombre: cliente.nombre, nif: cliente.nif, direccion: cliente.direccion, pais: cliente.pais === "ES" ? null : nombrePais(cliente.pais) },
    concepto: f.concepto,
    base: f.base,
    iva_pct: f.iva_pct,
    iva: f.iva,
    retencion_pct: f.retencion_pct,
    retencion: f.retencion,
    total: f.total,
    mencion: f.mencion,
  });
  const path = `facturas/${f.fecha.slice(0, 4)}/${f.numero}.pdf`;
  await subirArchivo(path, pdf, "application/pdf");
  await db().from("facturas").update({ pdf_path: path }).eq("id", f.id);
  return pdf;
}

export async function pdfPorNumero(numero: string): Promise<{ pdf: Uint8Array; factura: Factura } | null> {
  const { data } = await db().from("facturas").select("*").eq("numero", numero).maybeSingle();
  if (!data) return null;
  const f = nums(data as Factura, NUMERICOS);
  if (f.pdf_path) {
    try {
      return { pdf: await descargarArchivo(f.pdf_path), factura: f };
    } catch {
      /* se regenera abajo */
    }
  }
  return { pdf: await pdfDeFactura(f), factura: f };
}

// Hasta el 1/7/2027 no hace nada. Después: crear registro de alta Verifactu (huella encadenada
// con la factura anterior, QR) y enviarlo a la AEAT o a un proveedor homologado.
async function registrarVerifactu(_f: Factura): Promise<void> {
  return;
}

function nombrePais(iso: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}
