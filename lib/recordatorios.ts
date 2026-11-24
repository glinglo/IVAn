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

  const porProveedor = new Map<string, { nombre: string; confirmados: Set<string>; cualquiera: Set<string> }>();
  for (const g of gastos) {
    if (g.estado === "descartado") continue;
    const clave = claveProveedor(g);
    if (!clave) continue;
    const mes = g.fecha.slice(0, 7);
    let e = porProveedor.get(clave);
    if (!e) {
      e = { nombre: g.proveedor ?? clave, confirmados: new Set(), cualquiera: new Set() };
      porProveedor.set(clave, e);
    }
    e.cualquiera.add(mes);
    if (g.estado === "confirmado") e.confirmados.add(mes);
  }

  const faltan: string[] = [];
  const nuevos: string[] = [];
  for (const e of porProveedor.values()) {
    if (e.cualquiera.has(mesActual)) continue;
    const mesesRecurrentes = [m1, m2, m3].filter((m) => e.confirmados.has(m)).length;
    if (mesesRecurrentes >= 2) {
      faltan.push(e.nombre);
    } else if (e.confirmados.has(m1) && !e.confirmados.has(m2) && !e.confirmados.has(m3)) {
      nuevos.push(e.nombre);
    }
  }
  faltan.sort((a, b) => a.localeCompare(b));
  nuevos.sort((a, b) => a.localeCompare(b));
  return { faltan, nuevos };
}

