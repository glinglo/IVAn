// Reglas fiscales de un autónomo en España (IVA general, estimación directa simplificada).
// Funciones puras: sin red ni base de datos, para poder probarlas.

export const PAISES_UE = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "EL", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export type TipoGasto = "IVA soportado" | "ISP UE" | "ISP fuera UE" | "Sin IVA deducible";
export type TipoCliente = "nacional" | "ue" | "fuera_ue";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Tipos de IVA español vigentes en 2026 (art. 90 y 91 Ley 37/1992): general 21 %, reducidos 10 %
 * y 4 %, y 0 % para los casos exentos o sin tipo. El tipo SIEMPRE sale del que pone la factura:
 * IVAn no lo deduce nunca del producto ni de la fecha (los tipos reducidos temporales de la luz y
 * el gas, por ejemplo, han ido y venido según el IPC, así que copiar la factura es lo único fiable). */
export const TIPOS_IVA_ES = [0, 4, 10, 21] as const;
export type TipoIvaEs = (typeof TIPOS_IVA_ES)[number];

export interface LineaIva {
  pct: number;
  base: number;
  cuota: number;
}

/**
 * Comprueba el desglose de IVA de un gasto contra el cuadro de impuestos de la factura. No decide
 * nada: solo avisa si algo no cuadra, para que lo confirme o lo corrija Jose. Margen de 2 céntimos
 * por línea y por total, por el redondeo de los tickets con varios productos.
 */
export function validarDesglose(lineas: LineaIva[], base: number, iva: number, total: number | null): string[] {
  const avisos: string[] = [];
  for (const l of lineas) {
    if (!(TIPOS_IVA_ES as readonly number[]).includes(l.pct)) {
      avisos.push(`El ${l.pct} % no es un tipo de IVA español (0, 4, 10 o 21 %).`);
      continue;
    }
    const esperada = round2((l.base * l.pct) / 100);
    if (Math.abs(esperada - l.cuota) > 0.02) {
      avisos.push(`IVA ${l.pct} % sobre ${euros(l.base)}: la factura pone ${euros(l.cuota)} y esperaba ${euros(esperada)}.`);
    }
  }
  if (lineas.length) {
    const sumaBase = round2(lineas.reduce((s, l) => s + l.base, 0));
    const sumaCuota = round2(lineas.reduce((s, l) => s + l.cuota, 0));
    if (Math.abs(sumaBase - base) > 0.02) avisos.push(`Las líneas de IVA suman ${euros(sumaBase)} de base y la factura pone ${euros(base)}.`);
    if (Math.abs(sumaCuota - iva) > 0.02) avisos.push(`Las líneas de IVA suman ${euros(sumaCuota)} y la factura pone ${euros(iva)} de IVA.`);
  }
  if (total !== null && Math.abs(round2(base + iva) - total) > 0.02) {
    avisos.push(`Base + IVA (${euros(round2(base + iva))}) no coincide con el total (${euros(total)}).`);
  }
  return avisos;
}

/**
 * Cómo entra un gasto en el 303:
 * - IVA cobrado pero no español (VAT de otro país, o OSS), o español sin tu NIF en la factura →
 *   sin IVA deducible: la cuota pasa a ser más gasto (casilla 28/29 no lo ve).
 * - Proveedor español, o factura con IVA español y tu NIF → IVA soportado deducible (28/29).
 * - Proveedor de otro país de la UE sin IVA → adquisición intracomunitaria de servicios con
 *   inversión del sujeto pasivo (10/11 devengado, 36/37 deducible, y va al 349 con clave I).
 * - Proveedor de fuera de la UE sin IVA → otras operaciones con inversión del sujeto pasivo
 *   (12/13 devengado, 28/29 deducible).
 */
export function clasificarGasto(
  pais: string | null | undefined,
  iva: number,
  opts: { ivaEspanol: boolean; aMiNombre: boolean },
): TipoGasto {
  const p = (pais ?? "").toUpperCase();
  if (iva > 0) {
    if (!opts.ivaEspanol) return "Sin IVA deducible";
    if (!opts.aMiNombre) return "Sin IVA deducible";
    return "IVA soportado";
  }
  if (p === "ES") return "IVA soportado";
  if (PAISES_UE.has(p)) return "ISP UE";
  return "ISP fuera UE";
}

export function tipoClientePorPais(pais: string): TipoCliente {
  const p = pais.toUpperCase();
  if (p === "ES") return "nacional";
  return PAISES_UE.has(p) ? "ue" : "fuera_ue";
}

export interface ClienteFiscal {
  tipo: TipoCliente;
  iva_pct: number;
  retencion_pct: number;
}

export interface Importes {
  base: number;
  iva_pct: number;
  iva: number;
  retencion_pct: number;
  retencion: number;
  total: number;
  mencion: string | null;
}

export const MENCIONES: Record<TipoCliente, string | null> = {
  nacional: null,
  ue: "Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.",
  fuera_ue: "Operación no sujeta a IVA (art. 69.Uno.1º Ley 37/1992). Not subject to Spanish VAT.",
};

export function calcularImportes(cliente: ClienteFiscal, base: number): Importes {
  const b = round2(base);
  if (cliente.tipo !== "nacional") {
    return { base: b, iva_pct: 0, iva: 0, retencion_pct: 0, retencion: 0, total: b, mencion: MENCIONES[cliente.tipo] };
  }
  const iva = round2((b * cliente.iva_pct) / 100);
  const retencion = round2((b * cliente.retencion_pct) / 100);
  return {
    base: b,
    iva_pct: cliente.iva_pct,
    iva,
    retencion_pct: cliente.retencion_pct,
    retencion,
    total: round2(b + iva - retencion),
    mencion: null,
  };
}

// ---------- Fechas ----------

/** Fecha de hoy en Madrid como YYYY-MM-DD. */
export function hoyMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
}

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toISO = (d: Date) => d.toISOString().slice(0, 10);

export function sumarDias(iso: string, dias: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return toISO(d);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((toUTC(hasta).getTime() - toUTC(desde).getTime()) / 86_400_000);
}

/** Si cae en sábado o domingo, pasa al lunes. (No contempla festivos nacionales.) */
export function siguienteHabil(iso: string): string {
  const d = toUTC(iso);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return toISO(d);
}

export function trimestreDe(iso: string): { anio: number; t: 1 | 2 | 3 | 4 } {
  const [y, m] = iso.split("-").map(Number);
  return { anio: y, t: (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4 };
}

export function rangoTrimestre(anio: number, t: number): { desde: string; hasta: string } {
  const mesIni = (t - 1) * 3 + 1;
  const desde = `${anio}-${String(mesIni).padStart(2, "0")}-01`;
  const hasta = sumarDias(t === 4 ? `${anio + 1}-01-01` : `${anio}-${String(mesIni + 3).padStart(2, "0")}-01`, -1);
  return { desde, hasta };
}

export interface Plazo {
  anio: number;
  t: number;
  apertura: string; // primer día del plazo
  fin: string; // último día para presentar (303, 130, 349)
  finDomiciliacion: string; // aproximado: 5 días antes del fin
  modelos: string;
}

/** Plazo de presentación de los trimestrales del trimestre `t` de `anio`. */
export function plazoTrimestral(anio: number, t: number): Plazo {
  const apertura = t === 4 ? `${anio + 1}-01-01` : `${anio}-${String(t * 3 + 1).padStart(2, "0")}-01`;
  const finBase = t === 4 ? `${anio + 1}-01-30` : `${anio}-${String(t * 3 + 1).padStart(2, "0")}-20`;
  const fin = siguienteHabil(finBase);
  return {
    anio,
    t,
    apertura,
    fin,
    finDomiciliacion: sumarDias(fin, -5),
    modelos: t === 4 ? "303, 130, 349 y 390 (resumen anual de IVA)" : "303, 130 y 349",
  };
}

/** El plazo que está abierto hoy, o null si no estamos en periodo de presentación. */
export function plazoAbierto(hoy: string): Plazo | null {
  const { anio, t } = trimestreDe(hoy);
  const anterior = t === 1 ? plazoTrimestral(anio - 1, 4) : plazoTrimestral(anio, t - 1);
  return hoy >= anterior.apertura && hoy <= anterior.fin ? anterior : null;
}

export const fechaES = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-11-23" → "noviembre" */
export function nombreMes(iso: string): string {
  return NOMBRES_MES[Number(iso.slice(5, 7)) - 1];
}

/** "2026-11" → "2026-10" */
export function mesAnterior(mes: string): string {
  return sumarDias(`${mes}-01`, -1).slice(0, 7);
}

/** 3060.5 → "3.060,50 €" (espacio de no separación: el € no se parte de su cifra). */
export function euros(n: number): string {
  const [ent, dec] = Math.abs(round2(n)).toFixed(2).split(".");
  const conPuntos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}${conPuntos},${dec} €`;
}

/** `euros` sin céntimos: "3.060,50 €" → "3.060 €". */
export function eurosSinCentimos(n: number): string {
  return euros(n).replace(/,\d\d €/, " €");
}

/** Un porcentaje escrito a mano, con el mismo espacio de no separación que `euros()`: 70 -> "70 %". */
export function pct(n: number, decimales = 0): string {
  const texto = decimales > 0 ? n.toFixed(decimales).replace(".", ",") : String(Math.round(n));
  return `${texto} %`;
}

/** Como lo pide la Sede: sin separador de miles, coma decimal, negativos con -. 1216.02 -> "1216,02". */
export function formatoSede(n: number): string {
  const v = round2(n);
  const [ent, dec] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${ent},${dec}`;
}
