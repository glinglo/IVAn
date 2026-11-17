import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { TipoCliente, TipoGasto } from "./fiscal";

export const BUCKET = "documentos";

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface Ajustes {
  nombre: string;
  nif: string;
  direccion: string;
  email: string | null;
  telefono: string | null;
  iban: string | null;
  serie: string;
  ultimo_numero: number;
  digitos_numero: number;
  cuota_autonomo_mensual: number;
  iva_compensar_inicial: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  pais: string;
  nif: string | null;
  direccion: string | null;
  email: string | null;
  tipo: TipoCliente;
  idioma: "es" | "en";
  iva_pct: number;
  retencion_pct: number;
  activo: boolean;
}

export interface Factura {
  id: string;
  numero: string | null;
  fecha: string;
  cliente_id: string;
  concepto: string;
  base: number;
  iva_pct: number;
  iva: number;
  retencion_pct: number;
  retencion: number;
  total: number;
  tipo: TipoCliente;
  mencion: string | null;
  estado: "borrador" | "emitida" | "anulada";
  pdf_path: string | null;
  telegram_message_id: number | null;
}

export interface Gasto {
  id: string;
  fecha: string | null;
  proveedor: string | null;
  pais: string | null;
  nif: string | null;
  numero_factura: string | null;
  concepto: string | null;
  tipo: TipoGasto | null;
  base: number | null;
  iva: number;
  moneda: string;
  importe_original: number | null;
  tipo_cambio: number | null;
  a_mi_nombre: boolean | null;
  archivo_path: string | null;
  estado: "borrador" | "confirmado" | "descartado";
  telegram_message_id: number | null;
  extraccion: unknown;
}

/** Postgres devuelve numeric como string: lo pasamos a number. */
export function nums<T extends object>(row: T, keys: (keyof T)[]): T {
  const out = { ...row };
  for (const k of keys) {
    const v = out[k] as unknown;
    if (v !== null && v !== undefined) (out[k] as unknown) = Number(v);
  }
  return out;
}

export async function getAjustes(): Promise<Ajustes> {
  const { data, error } = await db().from("ajustes").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("Faltan tus datos en la tabla ajustes (ver README)");
  return data as Ajustes;
}

export async function getClientes(): Promise<Cliente[]> {
  const { data, error } = await db().from("clientes").select("*").eq("activo", true).order("nombre");
  if (error) throw error;
  return (data as Cliente[]).map((c) => nums(c, ["iva_pct", "retencion_pct"]));
}

export async function subirArchivo(path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await db().storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export async function descargarArchivo(path: string): Promise<Uint8Array> {
  const { data, error } = await db().storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Archivo no encontrado");
  return new Uint8Array(await data.arrayBuffer());
}
