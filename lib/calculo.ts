// Cálculo de los modelos 303, 130 y 349 y del P&L. Funciones puras: reciben los datos ya
// leídos de la base de datos. Reproducen la hoja de cálculo y el P&L de la gestoría.

import { rangoTrimestre, round2 } from "./fiscal";

export interface FacturaCalc {
  fecha: string;
  base: number;
  iva_pct: number;
  iva: number;
  retencion: number;
  tipo: "nacional" | "ue" | "fuera_ue";
  cliente?: string;
  nif_cliente?: string | null;
}

export interface GastoCalc {
  fecha: string;
  base: number;
  iva: number;
  tipo: "IVA soportado" | "ISP UE" | "ISP fuera UE" | "Sin IVA deducible";
  proveedor?: string | null;
  nif?: string | null;
  pais?: string | null;
}

export interface BienCalc {
  fecha_compra: string;
  base: number;
  pct_anual: number;
}

export interface DatosCalc {
  facturas: FacturaCalc[];
  gastos: GastoCalc[];
  /** Cuota de autónomo de cada mes ("YYYY-MM") */
  cuotaMes: (mes: string) => number;
  bienes: BienCalc[];
  /** Importe realmente ingresado en el 130 de cada trimestre, si se conoce */
  pagado130: (anio: number, t: number) => number | null;
  ivaCompensarInicial: number;
}

export const PCT_DIFICIL_JUSTIFICACION = 0.05;
export const MAX_DIFICIL_JUSTIFICACION = 2000;
const IVA_ISP = 0.21;

const enRango = (fecha: string, desde: string, hasta: string) => fecha >= desde && fecha <= hasta;
const suma = <T>(xs: T[], f: (x: T) => number) => round2(xs.reduce((s, x) => s + f(x), 0));

/** Meses "YYYY-MM" desde `desde` hasta `hasta` (ambos incluidos). */
export function meses(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let [y, m] = desde.slice(0, 7).split("-").map(Number);
  const [yh, mh] = hasta.slice(0, 7).split("-").map(Number);
  while (y < yh || (y === yh && m <= mh)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m === 13) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Amortización acumulada de un bien hasta una fecha: lineal por meses desde el mes de compra. */
export function amortizacionAcumulada(b: BienCalc, hasta: string): number {
  if (hasta < b.fecha_compra) return 0;
  const n = meses(b.fecha_compra, hasta).length;
  return Math.min(b.base, round2((b.base * b.pct_anual) / 100 / 12 * n));
}

/** Amortización de todos los bienes entre el 1 de enero del año de `hasta` y `hasta`. */
export function amortizacionDelAnio(bienes: BienCalc[], hasta: string): number {
  const finAnterior = `${Number(hasta.slice(0, 4)) - 1}-12-31`;
  return round2(bienes.reduce((s, b) => s + amortizacionAcumulada(b, hasta) - amortizacionAcumulada(b, finAnterior), 0));
}

// ---------- P&L (rendimiento de la actividad) ----------

export interface PyG {
  desde: string;
  hasta: string;
  ingresos: number;
  gastosFacturas: number;
  seguridadSocial: number;
  amortizaciones: number;
  diferencia: number;
  dificilJustificacion: number;
  gastosDeducibles: number;
  rendimientoNeto: number;
  retenciones: number;
}

/** Rendimiento de la actividad desde el 1 de enero hasta `hasta` (estimación directa simplificada). */
export function pyg(d: DatosCalc, hasta: string): PyG {
  const desde = `${hasta.slice(0, 4)}-01-01`;
  const fs = d.facturas.filter((f) => enRango(f.fecha, desde, hasta));
  const gs = d.gastos.filter((g) => enRango(g.fecha, desde, hasta));
  const ingresos = suma(fs, (f) => f.base);
  const gastosFacturas = suma(gs, (g) => g.base);
  const seguridadSocial = round2(meses(desde, hasta).reduce((s, m) => s + d.cuotaMes(m), 0));
  const amortizaciones = amortizacionDelAnio(d.bienes, hasta);
  const diferencia = round2(ingresos - gastosFacturas - seguridadSocial - amortizaciones);
  const dificilJustificacion = round2(Math.min(Math.max(diferencia, 0) * PCT_DIFICIL_JUSTIFICACION, MAX_DIFICIL_JUSTIFICACION));
  const gastosDeducibles = round2(gastosFacturas + seguridadSocial + amortizaciones + dificilJustificacion);
  return {
    desde,
    hasta,
    ingresos,
    gastosFacturas,
    seguridadSocial,
    amortizaciones,
    diferencia,
    dificilJustificacion,
    gastosDeducibles,
    rendimientoNeto: round2(ingresos - gastosDeducibles),
    retenciones: suma(fs, (f) => f.retencion),
  };
}

// ---------- Modelo 130 ----------

export interface Modelo130 {
  anio: number;
  t: number;
  pyg: PyG;
  c01: number; // ingresos acumulados
  c02: number; // gastos deducibles acumulados
  c03: number; // rendimiento neto
  c04: number; // 20 %
  c05: number; // pagos fraccionados anteriores
  c06: number; // retenciones acumuladas
  c07: number; // resultado
  aIngresar: number;
  usaPagosReales: boolean;
}

export function modelo130(d: DatosCalc, anio: number, t: number): Modelo130 {
  const { hasta } = rangoTrimestre(anio, t);
  const p = pyg(d, hasta);
  const c04 = Math.max(0, round2(p.rendimientoNeto * 0.2));
  let c05 = 0;
  let usaPagosReales = false;
  for (let k = 1; k < t; k++) {
    const real = d.pagado130(anio, k);
    if (real !== null) usaPagosReales = true;
    c05 += real ?? modelo130(d, anio, k).aIngresar;
  }
  c05 = round2(c05);
  const c07 = round2(c04 - c05 - p.retenciones);
  return {
    anio,
    t,
    pyg: p,
    c01: p.ingresos,
    c02: p.gastosDeducibles,
    c03: p.rendimientoNeto,
    c04,
    c05,
    c06: p.retenciones,
    c07,
    aIngresar: Math.max(0, c07),
    usaPagosReales,
  };
}

// ---------- Modelo 303 ----------

export interface Modelo303 {
  anio: number;
  t: number;
  c01: number; c03: number; // régimen general 21 %
  c10: number; c11: number; // adquisiciones intracomunitarias de servicios (ISP UE)
  c12: number; c13: number; // otras operaciones con inversión del sujeto pasivo (fuera UE)
  c27: number; // total devengado
  c28: number; c29: number; // deducible operaciones interiores
  c36: number; c37: number; // deducible adquisiciones intracomunitarias
  c45: number; // total a deducir
  c46: number; // resultado régimen general
  c59: number; // entregas intracomunitarias de servicios (clientes UE)
  c120: number; // no sujetas por reglas de localización (clientes fuera UE)
  c110: number; // cuotas a compensar de periodos anteriores
  c78: number; // compensación aplicada
  c71: number; // resultado (+ ingresar / − compensar o devolver)
  pendienteCompensar: number;
}

export function modelo303(d: DatosCalc, anio: number, t: number): Modelo303 {
  const { desde, hasta } = rangoTrimestre(anio, t);
  const fs = d.facturas.filter((f) => enRango(f.fecha, desde, hasta));
  const gs = d.gastos.filter((g) => enRango(g.fecha, desde, hasta));
  const isp = (tipo: GastoCalc["tipo"]) => gs.filter((g) => g.tipo === tipo);

  const c01 = suma(fs.filter((f) => f.tipo === "nacional" && f.iva_pct === 21), (f) => f.base);
  const c03 = suma(fs, (f) => f.iva);
  const c10 = suma(isp("ISP UE"), (g) => g.base);
  const c11 = suma(isp("ISP UE"), (g) => round2(g.base * IVA_ISP));
  const c12 = suma(isp("ISP fuera UE"), (g) => g.base);
  const c13 = suma(isp("ISP fuera UE"), (g) => round2(g.base * IVA_ISP));
  const c27 = round2(c03 + c11 + c13);
  const soportado = isp("IVA soportado");
  const c28 = round2(suma(soportado, (g) => g.base) + c12);
  const c29 = round2(suma(soportado, (g) => g.iva) + c13);
  const c36 = c10;
  const c37 = c11;
  const c45 = round2(c29 + c37);
  const c46 = round2(c27 - c45);
  const c59 = suma(fs.filter((f) => f.tipo === "ue"), (f) => f.base);
  const c120 = suma(fs.filter((f) => f.tipo === "fuera_ue"), (f) => f.base);
  const c110 = t === 1 ? d.ivaCompensarInicial : modelo303(d, anio, t - 1).pendienteCompensar;
  const c78 = round2(Math.min(c110, Math.max(c46, 0)));
  const c71 = round2(c46 - c78);
  return {
    anio, t, c01, c03, c10, c11, c12, c13, c27, c28, c29, c36, c37, c45, c46, c59, c120, c110, c78, c71,
    pendienteCompensar: round2(c110 - c78 + Math.max(0, -c46)),
  };
}

// ---------- Modelo 349 ----------

export interface Linea349 {
  clave: "S" | "I";
  nombre: string;
  nif: string;
  base: number;
}

/** Operaciones intracomunitarias del trimestre agrupadas por operador. */
export function modelo349(d: DatosCalc, anio: number, t: number): Linea349[] {
  const { desde, hasta } = rangoTrimestre(anio, t);
  const lineas = new Map<string, Linea349>();
  const add = (clave: "S" | "I", nombre: string, nif: string, base: number) => {
    const k = `${clave}|${nif || nombre}`;
    const l = lineas.get(k) ?? { clave, nombre, nif, base: 0 };
    l.base = round2(l.base + base);
    lineas.set(k, l);
  };
  for (const f of d.facturas) {
    if (f.tipo === "ue" && enRango(f.fecha, desde, hasta)) add("S", f.cliente ?? "?", f.nif_cliente ?? "", f.base);
  }
  for (const g of d.gastos) {
    if (g.tipo === "ISP UE" && enRango(g.fecha, desde, hasta)) add("I", g.proveedor ?? "?", g.nif ?? "", g.base);
  }
  return [...lineas.values()].sort((a, b) => a.clave.localeCompare(b.clave) || b.base - a.base);
}
