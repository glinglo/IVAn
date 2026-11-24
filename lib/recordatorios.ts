import { diasEntre, fechaES, mesAnterior, plazoAbierto, rangoTrimestre, trimestreDe } from "./fiscal";

export interface Aviso {
  clave: string; // para no repetirlo
  tipo: "apertura" | "plazo" | "facturar";
  texto: string;
  /** Claves que se dan por enviadas junto a esta (avisos menos urgentes ya superados). */
  tambien?: string[];
  trimestre?: { anio: number; t: number };
  diasRestantes?: number;
}

const UMBRALES = [10, 3, 1] as const;

/**
 * Qué avisos tocan hoy. Pura: recibe la fecha y las claves ya enviadas.
 * - Al abrirse el plazo de un trimestre.
 * - A 10, 3 y 1 días del fin (solo el más urgente pendiente, para no mandar tres de golpe).
 * - Desde el día 28 de cada mes, recordatorio para facturar (una vez).
 */
export function avisosDeHoy(hoy: string, enviados: Set<string>): Aviso[] {
  const avisos: Aviso[] = [];
  const plazo = plazoAbierto(hoy);
  if (plazo) {
    const id = `${plazo.anio}-${plazo.t}T`;
    const quedan = diasEntre(hoy, plazo.fin);
    const pendientes = UMBRALES.filter((n) => quedan <= n && !enviados.has(`${id}-d${n}`));
    if (pendientes.length) {
      const n = pendientes[pendientes.length - 1];
      avisos.push({
        clave: `${id}-d${n}`,
        tambien: [...pendientes.slice(0, -1).map((m) => `${id}-d${m}`), `${id}-apertura`],
        tipo: "plazo",
        trimestre: { anio: plazo.anio, t: plazo.t },
        diasRestantes: quedan,
        texto:
          `⏰ ${quedan === 0 ? "Hoy es el último día" : quedan === 1 ? "Mañana acaba el plazo" : `Quedan ${quedan} días`} ` +
          `para presentar el ${plazo.t}T ${plazo.anio}: ${plazo.modelos}.\n` +
          `Fin: ${fechaES(plazo.fin)} · domiciliación hasta aprox. ${fechaES(plazo.finDomiciliacion)}.`,
      });
    } else if (!enviados.has(`${id}-apertura`)) {
      avisos.push({
        clave: `${id}-apertura`,
        tipo: "apertura",
        trimestre: { anio: plazo.anio, t: plazo.t },
        diasRestantes: quedan,
        texto:
          `📂 Ha cerrado el ${plazo.t}T ${plazo.anio}. Plazo para presentar ${plazo.modelos} hasta el ${fechaES(plazo.fin)}.\n` +
          `Mándame ahora las facturas de gasto que te falten de ${fechaES(rangoTrimestre(plazo.anio, plazo.t).desde)} ` +
          `a ${fechaES(rangoTrimestre(plazo.anio, plazo.t).hasta)}.`,
      });
    }
  }

  const [y, m, d] = hoy.split("-");
  // Desde el 28: si el aviso diario se salta un día, sale al siguiente (una vez al mes).
  if (Number(d) >= 28 && !enviados.has(`facturar-${y}-${m}`)) {
    avisos.push({
      clave: `facturar-${y}-${m}`,
      tipo: "facturar",
      texto: "🧾 Fin de mes. ¿Toca facturar? Escribe por ejemplo: /factura Zapflow 3060",
    });
  }
  return avisos;
}

/** Trimestre en curso y el anterior, para los resúmenes. */
export function trimestreActual(hoy: string) {
  const { anio, t } = trimestreDe(hoy);
  return { anio, t, ...rangoTrimestre(anio, t) };
}

// ---------- Proveedores que faltan a fin de mes ----------

export interface GastoProveedor {
  proveedor: string | null;
  nif: string | null;
  fecha: string;
  estado: "borrador" | "confirmado" | "descartado";
  /** Base + IVA. Solo lo usan `suscripciones` y `cambiosGastos`. */
  importe?: number;
}

/** Sin mayúsculas, sin formas jurídicas (S.L., Inc., Ltd, B.V....) y sin espacios de más. */
function normalizarProveedor(nombre: string): string {
  return nombre
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(S\s?L\s?U?|S\s?A|S\s?COOP|INC|LTD|LLC|L\s?L\s?P|B\s?V|GMBH|CORP|CO|PLC|OY|AB|AS|AG)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function claveProveedor(g: { proveedor: string | null; nif: string | null }): string | null {
  if (g.nif) return g.nif.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const n = normalizarProveedor(g.proveedor ?? "");
  return n || null;
}

interface MesProveedor {
  confirmado: boolean;
  importe: number;
}
interface ResumenProveedor {
  nombre: string;
  porMes: Map<string, MesProveedor>;
}

/** Agrupa los gastos por proveedor (por `claveProveedor`), con un resumen por mes: si hay algún
 * gasto confirmado ese mes y cuánto suma (solo los confirmados). Lo reutilizan `proveedoresQueFaltan`,
 * `suscripciones` y `cambiosGastos`. */
function agruparPorProveedor(gastos: GastoProveedor[]): Map<string, ResumenProveedor> {
  const porProveedor = new Map<string, ResumenProveedor>();
  for (const g of gastos) {
    if (g.estado === "descartado") continue;
    const clave = claveProveedor(g);
    if (!clave) continue;
    let e = porProveedor.get(clave);
    if (!e) {
      e = { nombre: g.proveedor ?? clave, porMes: new Map() };
      porProveedor.set(clave, e);
    }
    const mes = g.fecha.slice(0, 7);
    const confirmado = g.estado === "confirmado";
    const importe = confirmado ? g.importe ?? 0 : 0;
    const actual = e.porMes.get(mes);
    if (!actual) e.porMes.set(mes, { confirmado, importe });
    else {
      actual.confirmado = actual.confirmado || confirmado;
      actual.importe += importe;
    }
  }
  return porProveedor;
}

/**
 * Proveedores que suelen llegar cada mes y de los que aún no hay factura del mes en curso, y los
 * que empezaron a llegar el mes pasado. Pura: recibe los gastos de los últimos 4 meses (el actual y
 * los 3 anteriores), de cualquier estado salvo descartado.
 * - Recurrente: al menos un gasto confirmado en 2 de los 3 meses anteriores al actual.
 * - Falta: recurrente y sin ningún gasto (confirmado o en borrador) en el mes en curso.
 * - Nuevo el mes pasado: un gasto confirmado en el mes anterior, ninguno en los dos de antes, y
 *   ninguno todavía en el mes en curso.
 */
export function proveedoresQueFaltan(gastos: GastoProveedor[], hoy: string): { faltan: string[]; nuevos: string[] } {
  const mesActual = hoy.slice(0, 7);
  const m1 = mesAnterior(mesActual);
  const m2 = mesAnterior(m1);
  const m3 = mesAnterior(m2);
  const porProveedor = agruparPorProveedor(gastos);

  const faltan: string[] = [];
  const nuevos: string[] = [];
  for (const e of porProveedor.values()) {
    if (e.porMes.has(mesActual)) continue;
    const confirmadoEn = (mes: string) => e.porMes.get(mes)?.confirmado ?? false;
    const mesesRecurrentes = [m1, m2, m3].filter(confirmadoEn).length;
    if (mesesRecurrentes >= 2) {
      faltan.push(e.nombre);
    } else if (confirmadoEn(m1) && !confirmadoEn(m2) && !confirmadoEn(m3)) {
      nuevos.push(e.nombre);
    }
  }
  faltan.sort((a, b) => a.localeCompare(b));
  nuevos.sort((a, b) => a.localeCompare(b));
  return { faltan, nuevos };
}

// ---------- Suscripciones (Gastos v2) ----------

export interface SuscripcionActiva {
  nombre: string;
  costeMes: number;
  /** Pista corta si ha subido o bajado frente a la media de los 3 meses anteriores (`cambiosGastos`). */
  cambio?: { tipo: "sube" | "baja"; antes: number };
}

export interface Suscripciones {
  activas: SuscripcionActiva[];
  /** Recurrente pero sin gasto en el último mes cerrado: una fila gris de aviso, sin importe. */
  sinFacturaUltimoMes: { nombre: string }[];
}

/**
 * Mismo criterio de recurrencia que `proveedoresQueFaltan` (confirmado en 2 de los 3 meses
 * anteriores a hoy). Activa: además, con gasto confirmado en el último mes cerrado (su coste al
 * mes). Si no: recurrente pero sin gasto en el último mes cerrado, como aviso de fin de mes.
 */
export function suscripciones(gastos: GastoProveedor[], hoy: string): Suscripciones {
  const mesActual = hoy.slice(0, 7);
  const m1 = mesAnterior(mesActual);
  const m2 = mesAnterior(m1);
  const m3 = mesAnterior(m2);
  const porProveedor = agruparPorProveedor(gastos);
  const cambiosPorNombre = new Map(cambiosGastos(gastos, hoy).map((c) => [c.nombre, c]));

  const activas: SuscripcionActiva[] = [];
  const sinFacturaUltimoMes: { nombre: string }[] = [];

  for (const e of porProveedor.values()) {
    const confirmadoEn = (mes: string) => e.porMes.get(mes)?.confirmado ?? false;
    const recurrente = [m1, m2, m3].filter(confirmadoEn).length >= 2;
    if (!recurrente) continue;
    if (!confirmadoEn(m1)) {
      sinFacturaUltimoMes.push({ nombre: e.nombre });
      continue;
    }
    const cambio = cambiosPorNombre.get(e.nombre);
    activas.push({
      nombre: e.nombre,
      costeMes: e.porMes.get(m1)!.importe,
      cambio: cambio && cambio.tipo !== "sin_factura" ? { tipo: cambio.tipo, antes: cambio.antes! } : undefined,
    });
  }
  activas.sort((a, b) => b.costeMes - a.costeMes);
  sinFacturaUltimoMes.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { activas, sinFacturaUltimoMes };
}

export interface CambioGasto {
  nombre: string;
  tipo: "sube" | "baja" | "sin_factura";
  /** Media de los 3 meses anteriores. Solo en «sube»/«baja». */
  antes?: number;
}

/**
 * Para cada suscripción activa (mismo criterio que `suscripciones`), compara el último mes cerrado
 * con la media de los 3 anteriores: «sube»/«baja» si cambia al menos un 50 % y 10 €; «sin_factura»
 * si no hay gasto confirmado en el último mes cerrado. Hasta 3.
 */
export function cambiosGastos(gastos: GastoProveedor[], hoy: string): CambioGasto[] {
  const mesActual = hoy.slice(0, 7);
  const m1 = mesAnterior(mesActual);
  const m2 = mesAnterior(m1);
  const m3 = mesAnterior(m2);
  const m4 = mesAnterior(m3);
  const porProveedor = agruparPorProveedor(gastos);

  const cambios: CambioGasto[] = [];
  for (const e of porProveedor.values()) {
    const confirmadoEn = (mes: string) => e.porMes.get(mes)?.confirmado ?? false;
    const activa = [m1, m2, m3].filter(confirmadoEn).length >= 2;
    if (!activa) continue;
    if (!confirmadoEn(m1)) {
      cambios.push({ nombre: e.nombre, tipo: "sin_factura" });
      continue;
    }
    const actual = e.porMes.get(m1)!.importe;
    const media = [m2, m3, m4].reduce((s, m) => s + (e.porMes.get(m)?.importe ?? 0), 0) / 3;
    if (media === 0) continue;
    const diferencia = actual - media;
    if (Math.abs(diferencia) >= 10 && Math.abs(diferencia / media) >= 0.5) {
      cambios.push({ nombre: e.nombre, tipo: diferencia > 0 ? "sube" : "baja", antes: media });
    }
  }
  return cambios.slice(0, 3);
}

