// Copia de seguridad: Supabase gratis no guarda copias, así que IVAn manda cada semana a tu
// Telegram un .json.gz con todas las tablas. Se restaura con scripts/restaurar.ts.
// Los archivos (PDF y fotos) no van dentro: los PDF de IVAn se regeneran con los datos y los
// originales de gastos y de Selfconta ya están en el chat de Telegram.

import { gzipSync } from "node:zlib";
import { db } from "./db";
import { hoyMadrid, sumarDias } from "./fiscal";

/** En orden de restauración (las referencias primero). */
export const TABLAS = [
  "ajustes", "clientes", "facturas", "gastos", "cuotas_autonomo",
  "bienes_inversion", "presentaciones", "mensajes", "recordatorios_enviados",
] as const;
const CLAVE_ORDEN: Record<(typeof TABLAS)[number], string> = {
  ajustes: "id", clientes: "id", facturas: "id", gastos: "id", cuotas_autonomo: "mes",
  bienes_inversion: "id", presentaciones: "id", mensajes: "id", recordatorios_enviados: "clave",
};
export const CADA_DIAS = 7;

export interface Copia {
  version: 1;
  creada: string;
  tablas: Record<string, Record<string, unknown>[]>;
}

async function todas(tabla: (typeof TABLAS)[number]) {
  const filas: Record<string, unknown>[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db().from(tabla).select("*").order(CLAVE_ORDEN[tabla]).range(desde, desde + 999);
    if (error) throw new Error(`Copia de ${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) return filas;
  }
}

export async function crearCopia(): Promise<{ copia: Copia; bytes: Uint8Array; nombre: string }> {
  const tablas: Copia["tablas"] = {};
  for (const t of TABLAS) tablas[t] = await todas(t);
  const copia: Copia = { version: 1, creada: new Date().toISOString(), tablas };
  const bytes = gzipSync(Buffer.from(JSON.stringify(copia)));
  return { copia, bytes: new Uint8Array(bytes), nombre: `IVAn-copia-${hoyMadrid()}.json.gz` };
}

type Enviar = (bytes: Uint8Array, nombre: string, texto: string) => Promise<unknown>;

/** Crea la copia, la manda y apunta la fecha. */
export async function enviarCopia(enviar: Enviar, hoy = hoyMadrid()) {
  const { copia, bytes, nombre } = await crearCopia();
  const emitidas = copia.tablas.facturas.filter((f) => f.estado === "emitida").length;
  const gastos = copia.tablas.gastos.filter((g) => g.estado === "confirmado").length;
  await enviar(
    bytes,
    nombre,
    `💾 Copia de seguridad de IVAn: ${emitidas} facturas y ${gastos} gastos. Guárdala; no hace falta abrirla.`,
  );
  await db().from("recordatorios_enviados").upsert({ clave: `copia-${hoy}` }, { onConflict: "clave" });
  return { nombre, emitidas, gastos };
}

/** Manda la copia si la última tiene 7 días o más (o no hay ninguna). Se llama desde el cron diario. */
export async function copiaSiToca(enviar: Enviar, hoy = hoyMadrid()) {
  const { data } = await db()
    .from("recordatorios_enviados")
    .select("clave")
    .like("clave", "copia-%")
    .order("clave", { ascending: false })
    .limit(1);
  const ultima = data?.[0]?.clave?.slice("copia-".length) as string | undefined;
  if (ultima && ultima > sumarDias(hoy, -CADA_DIAS)) return null;
  return enviarCopia(enviar, hoy);
}

/** Vuelca una copia en una base de datos con las migraciones aplicadas. No pisa lo que ya exista. */
export async function restaurarCopia(copia: Copia): Promise<Record<string, number>> {
  if (copia.version !== 1) throw new Error(`Versión de copia desconocida: ${copia.version}`);
  const hechas: Record<string, number> = {};
  for (const t of TABLAS) {
    let filas = copia.tablas[t] ?? [];
    // mensajes.id es «generated always»: se deja que la base de datos ponga uno nuevo.
    if (t === "mensajes") filas = filas.map(({ id: _id, ...resto }) => resto);
    for (let i = 0; i < filas.length; i += 500) {
      const lote = filas.slice(i, i + 500);
      const q =
        t === "mensajes"
          ? db().from(t).insert(lote)
          : db().from(t).upsert(lote, { onConflict: CLAVE_ORDEN[t], ignoreDuplicates: true });
      const { error } = await q;
      if (error) throw new Error(`Restaurando ${t}: ${error.message}`);
    }
    hechas[t] = filas.length;
  }
  return hechas;
}
