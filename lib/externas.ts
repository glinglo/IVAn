// Modo paralelo: facturas emitidas en otro programa (Selfconta) que se registran en el libro
// con SU número, sin generar otra. La numeración sigue sin huecos: registrar_factura_externa()
// solo acepta la siguiente de la serie y mueve el contador para que IVAn continúe después.

import { randomUUID } from "node:crypto";
import { db, getAjustes, getClientes, nums, subirArchivo, type Ajustes, type Cliente, type Factura } from "./db";
import { extraerFacturaEmitida, type FacturaEmitidaExtraida } from "./claude";
import { MENCIONES, calcularImportes, fechaES, hoyMadrid, round2 } from "./fiscal";

const NUMERICOS: (keyof Factura)[] = ["base", "iva_pct", "iva", "retencion_pct", "retencion", "total"];

/** NIF sin espacios ni guiones y sin prefijo de país. */
export const nifSinPais = (s: string | null | undefined) =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^[A-Z]{2}(?=[0-9A-Z]*\d)/, "");

/** ¿La ha emitido el propio autónomo? */
export const esPropia = (nifEmisor: string | null | undefined, nifPropio: string) =>
  !!nifEmisor && nifSinPais(nifEmisor) === nifSinPais(nifPropio);

/** «337» → «00337» con la serie y los dígitos de los ajustes. */
export function normalizarNumero(numero: string, a: Pick<Ajustes, "serie" | "digitos_numero">): string {
  const n = numero.trim();
  const sinSerie = a.serie && n.startsWith(a.serie) ? n.slice(a.serie.length) : n;
  return /^\d+$/.test(sinSerie) ? a.serie + sinSerie.padStart(a.digitos_numero, "0") : n;
}

export const siguienteNumero = (a: Pick<Ajustes, "serie" | "digitos_numero" | "ultimo_numero">) =>
  a.serie + String(a.ultimo_numero + 1).padStart(a.digitos_numero, "0");

export function modoParalelo(a: Pick<Ajustes, "emitir_desde">, hoy = hoyMadrid()): boolean {
  return !!a.emitir_desde && hoy < a.emitir_desde;
}
export const textoModoParalelo = (a: Pick<Ajustes, "emitir_desde">) =>
  `Modo paralelo hasta el ${fechaES(a.emitir_desde!)}: emítela en Selfconta y mándame su PDF, que la registro con su número.`;

function buscarCliente(clientes: Cliente[], x: FacturaEmitidaExtraida): Cliente | undefined {
  const nif = nifSinPais(x.cliente_nif);
  if (nif) {
    const c = clientes.find((c) => nifSinPais(c.nif) === nif);
    if (c) return c;
  }
  const nombre = (x.cliente_nombre ?? "").toLowerCase().trim();
  if (!nombre) return undefined;
  return clientes.find((c) => c.nombre.toLowerCase() === nombre) ?? clientes.find((c) => nombre.includes(c.nombre.toLowerCase().split(" ")[0]));
}

export type ResultadoExterna =
  | { ok: true; factura: Factura; cliente: Cliente; avisos: string[] }
  | { ok: false; duda: string };

/** Lee el PDF de una factura emitida fuera y deja un borrador de registro (no toca la numeración). */
export async function prepararExterna(archivo: { bytes: Uint8Array; mime: string; ext: string }): Promise<ResultadoExterna> {
  const [ajustes, clientes] = await Promise.all([getAjustes(), getClientes()]);
  const x = await extraerFacturaEmitida(archivo, ajustes.nif);
  if (!x.numero || x.base === null || !x.fecha) {
    return { ok: false, duda: "Es una factura tuya, pero no leo bien el número, la fecha o la base. ¿Me mandas el PDF original?" };
  }
  const cliente = buscarCliente(clientes, x);
  if (!cliente) {
    return {
      ok: false,
      duda: `No tengo a ${x.cliente_nombre ?? "este cliente"}${x.cliente_nif ? ` (${x.cliente_nif})` : ""}. Añádelo con /cliente_nuevo y vuelve a mandarme el PDF.`,
    };
  }
  const numero = normalizarNumero(x.numero, ajustes);
  const { data: existente } = await db().from("facturas").select("id").eq("numero", numero).maybeSingle();
  if (existente) return { ok: false, duda: `La ${numero} ya está en el libro.` };

  const avisos: string[] = [];
  const siguiente = siguienteNumero(ajustes);
  if (numero !== siguiente) avisos.push(`Toca la ${siguiente} y esta es la ${numero}: registra antes las que falten.`);
  const esperado = calcularImportes(cliente, x.base);
  const difiere = (a: number, b: number) => Math.abs(round2(a) - round2(b)) > 0.01;
  if (difiere(x.iva, esperado.iva) || difiere(x.retencion, esperado.retencion)) {
    avisos.push(
      `Para ${cliente.nombre} esperaba IVA ${esperado.iva_pct} % y retención ${esperado.retencion_pct} %, ` +
        `y la factura lleva IVA ${x.iva_pct} % y retención ${x.retencion_pct} %. Se registra tal cual; revísalo.`,
    );
  }
  const total = x.total ?? round2(x.base + x.iva - x.retencion);
  if (difiere(total, x.base + x.iva - x.retencion)) avisos.push("El total no es base + IVA − retención: revisa la lectura.");
  if (x.fecha > hoyMadrid()) avisos.push("La fecha es futura.");

  // El PDF original de Selfconta es el que vale: se guarda como el PDF de la factura.
  const path = `facturas/${x.fecha.slice(0, 4)}/externas/${numero}-${randomUUID().slice(0, 8)}.${archivo.ext}`;
  await subirArchivo(path, archivo.bytes, archivo.mime);
  // Si quedó un borrador de registro anterior de la misma factura, se sustituye.
  await db().from("facturas").delete().eq("estado", "borrador").eq("origen", "externa").eq("numero_externo", numero);
  const { data, error } = await db()
    .from("facturas")
    .insert({
      fecha: x.fecha,
      cliente_id: cliente.id,
      concepto: x.concepto ?? "(sin concepto)",
      base: round2(x.base),
      iva_pct: x.iva_pct,
      iva: round2(x.iva),
      retencion_pct: x.retencion_pct,
      retencion: round2(x.retencion),
      total: round2(total),
      tipo: cliente.tipo,
      mencion: cliente.tipo === "nacional" ? null : MENCIONES[cliente.tipo],
      estado: "borrador",
      origen: "externa",
      numero_externo: numero,
      pdf_path: path,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ok: true, factura: nums(data as Factura, NUMERICOS), cliente, avisos };
}

/** Pasa el borrador de registro al libro con su número. Lanza el error de la base de datos si no toca. */
export async function registrarExterna(id: string): Promise<string> {
  const { data, error } = await db().rpc("registrar_factura_externa", { p_factura_id: id });
  if (error) throw new Error(error.message);
  return data as string;
}
