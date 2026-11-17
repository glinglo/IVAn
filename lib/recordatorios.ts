import { diasEntre, fechaES, plazoAbierto, rangoTrimestre, trimestreDe } from "./fiscal";

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

