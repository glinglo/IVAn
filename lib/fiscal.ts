// Reglas fiscales de un autónomo en España (IVA general, estimación directa simplificada).
// Funciones puras: sin red ni base de datos, para poder probarlas.

export const PAISES_UE = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "EL", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export type TipoGasto = "IVA soportado" | "ISP UE" | "ISP fuera UE" | "Sin IVA deducible";
export type TipoCliente = "nacional" | "ue" | "fuera_ue";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Cómo entra un gasto en el 303:
 * - Proveedor español, o factura con IVA cobrado → IVA soportado deducible (casillas 28/29).
 * - Proveedor de otro país de la UE sin IVA → adquisición intracomunitaria de servicios con
 *   inversión del sujeto pasivo (10/11 devengado, 36/37 deducible, y va al 349 con clave I).
 * - Proveedor de fuera de la UE sin IVA → otras operaciones con inversión del sujeto pasivo
 *   (12/13 devengado, 28/29 deducible).
 */
export function clasificarGasto(pais: string | null | undefined, iva: number): TipoGasto {
  const p = (pais ?? "").toUpperCase();
  if (iva > 0 || p === "ES") return "IVA soportado";
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

/** 3060.5 → "3.060,50 €" (sin espacios especiales, para que el PDF lo pueda pintar). */
export function euros(n: number): string {
  const [ent, dec] = Math.abs(round2(n)).toFixed(2).split(".");
  const conPuntos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}${conPuntos},${dec} €`;
}
