// Cálculo de los modelos 303, 130 y 349 y del P&L. Funciones puras: reciben los datos ya
// leídos de la base de datos. Reproducen la hoja de cálculo y el P&L de la gestoría.

import { rangoTrimestre, round2, type LineaIva } from "./fiscal";

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
  /** Una línea por tipo de IVA, tal como lo puso la factura. Vacío = gasto antiguo sin desglose. */
  desglose?: LineaIva[];
  /** Restaurantes y hostelería: para qué fue, si Jose lo ha dicho (botón del bot). */
  uso?: "manutencion" | "atencion_cliente" | null;
  /** Límite diario de manutención que aplica a este gasto (26,67 / 48,08 / 53,34 / 91,35 €). */
  manutencion_limite?: number | null;
}

export interface BienCalc {
  fecha_compra: string;
  base: number;
  pct_anual: number;
  /** Subvención de capital que financió el bien (p. ej. el bono del Kit Digital). 0 si no hubo. */
  subvencion?: number;
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

/** Subvención de capital acumulada de un bien hasta una fecha: en la misma proporción en que se
 * amortiza (art. 14.1.b LIRPF, norma de valoración 18.ª del PGC). */
function subvencionAcumulada(b: BienCalc, hasta: string): number {
  if (!b.subvencion) return 0;
  return round2(amortizacionAcumulada(b, hasta) * (b.subvencion / b.base));
}

/** Subvención de capital que se imputa como ingreso entre el 1 de enero del año de `hasta` y
 * `hasta`: se acaba de imputar justo cuando el bien termina de amortizarse. */
export function subvencionesDelAnio(bienes: BienCalc[], hasta: string): number {
  const finAnterior = `${Number(hasta.slice(0, 4)) - 1}-12-31`;
  return round2(bienes.reduce((s, b) => s + subvencionAcumulada(b, hasta) - subvencionAcumulada(b, finAnterior), 0));
}

// ---------- Restaurantes: manutención y atenciones a clientes ----------

/**
 * Límites de deducción de los gastos de restaurante (art. 96.Uno.5º y 6º LIVA, 30.2.5ª LIRPF):
 * - Manutención (comer trabajando fuera): el total con IVA de cada día no puede pasar del límite
 *   diario; lo que pase del límite no cuenta ni en el IRPF ni su IVA se deduce. Se reparte en
 *   proporción línea a línea del desglose, para que cuadre con lo que se mete en el 390.
 * - Atenciones a clientes: nunca se deduce el IVA; el gasto cuenta en el IRPF hasta el 1 % de lo
 *   facturado en el año hasta `hasta`, por orden de fecha.
 * Pura: solo mira los gastos y facturas ya guardados.
 */
export function limitesRestauracion(
  d: DatosCalc,
  hasta: string,
): { gastos: GastoCalc[]; limite1pctAtenciones: number; disponibleAtenciones: number } {
  const desde = `${hasta.slice(0, 4)}-01-01`;
  const facturadoAnio = suma(d.facturas.filter((f) => enRango(f.fecha, desde, hasta)), (f) => f.base);
  const limite1pct = round2(facturadoAnio * 0.01);

  const totalDia = new Map<string, number>();
  for (const g of d.gastos) {
    if (g.uso !== "manutencion" || g.fecha > hasta) continue;
    totalDia.set(g.fecha, round2((totalDia.get(g.fecha) ?? 0) + g.base + g.iva));
  }
  const factorDia = new Map<string, number>();
  for (const [fecha, total] of totalDia) {
    const limite = d.gastos.find((g) => g.uso === "manutencion" && g.fecha === fecha)?.manutencion_limite ?? 26.67;
    factorDia.set(fecha, total > 0 ? Math.min(1, limite / total) : 1);
  }

  let acumuladoAtenciones = 0;
  const ajustados = new Map<GastoCalc, GastoCalc>();
  const enOrden = d.gastos.filter((g) => g.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const g of enOrden) {
    if (g.uso === "manutencion" && g.desglose?.length) {
      const factor = factorDia.get(g.fecha) ?? 1;
      const desglose = g.desglose.map((l) => ({ pct: l.pct, base: round2(l.base * factor), cuota: round2(l.cuota * factor) }));
      ajustados.set(g, { ...g, base: suma(desglose, (l) => l.base), iva: suma(desglose, (l) => l.cuota), desglose });
    } else if (g.uso === "manutencion") {
      const factor = factorDia.get(g.fecha) ?? 1;
      ajustados.set(g, { ...g, base: round2(g.base * factor), iva: round2(g.iva * factor) });
    } else if (g.uso === "atencion_cliente") {
      const total = round2(g.base + g.iva);
      const disponible = round2(Math.max(0, limite1pct - acumuladoAtenciones));
      const contado = round2(Math.min(total, disponible));
      acumuladoAtenciones = round2(acumuladoAtenciones + contado);
      ajustados.set(g, { ...g, base: contado, iva: 0, desglose: [], tipo: "Sin IVA deducible" });
    }
  }
  return {
    gastos: d.gastos.map((g) => ajustados.get(g) ?? g),
    limite1pctAtenciones: limite1pct,
    disponibleAtenciones: round2(Math.max(0, limite1pct - acumuladoAtenciones)),
  };
}

// ---------- P&L (rendimiento de la actividad) ----------

export interface PyG {
  desde: string;
  hasta: string;
  ingresos: number;
  /** Subvenciones de capital imputadas (p. ej. el Kit Digital del Mac): no es lo facturado, pero
   * cuenta como ingreso de la actividad en el rendimiento neto y en la [01] del 130. */
  subvenciones: number;
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
  const gs = limitesRestauracion(d, hasta).gastos.filter((g) => enRango(g.fecha, desde, hasta));
  const ingresos = suma(fs, (f) => f.base);
  const subvenciones = subvencionesDelAnio(d.bienes, hasta);
  const gastosFacturas = suma(gs, (g) => g.base);
  const seguridadSocial = round2(meses(desde, hasta).reduce((s, m) => s + d.cuotaMes(m), 0));
  const amortizaciones = amortizacionDelAnio(d.bienes, hasta);
  const diferencia = round2(ingresos + subvenciones - gastosFacturas - seguridadSocial - amortizaciones);
  const dificilJustificacion = round2(Math.min(Math.max(diferencia, 0) * PCT_DIFICIL_JUSTIFICACION, MAX_DIFICIL_JUSTIFICACION));
  const gastosDeducibles = round2(gastosFacturas + seguridadSocial + amortizaciones + dificilJustificacion);
  return {
    desde,
    hasta,
    ingresos,
    subvenciones,
    gastosFacturas,
    seguridadSocial,
    amortizaciones,
    diferencia,
    dificilJustificacion,
    gastosDeducibles,
    rendimientoNeto: round2(ingresos + subvenciones - gastosDeducibles),
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
    c01: round2(p.ingresos + p.subvenciones),
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
  c07: number; c09: number; // régimen general 21 %
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
  c87: number; // cuotas a compensar pendientes para periodos posteriores
  c71: number; // resultado (+ ingresar / − compensar o devolver)
  pendienteCompensar: number;
}

export function modelo303(d: DatosCalc, anio: number, t: number): Modelo303 {
  const { desde, hasta } = rangoTrimestre(anio, t);
  const fs = d.facturas.filter((f) => enRango(f.fecha, desde, hasta));
  const gs = limitesRestauracion(d, hasta).gastos.filter((g) => enRango(g.fecha, desde, hasta));
  const isp = (tipo: GastoCalc["tipo"]) => gs.filter((g) => g.tipo === tipo);

  const nacionales = fs.filter((f) => f.tipo === "nacional");
  for (const f of nacionales) {
    if (f.iva_pct !== 21) {
      throw new Error(`Factura nacional con IVA al ${f.iva_pct} % (${f.fecha}): IVAn solo sabe meter el 21 % en las casillas 07/09.`);
    }
  }
  const c07 = suma(nacionales, (f) => f.base);
  const c09 = suma(nacionales, (f) => f.iva);
  const c10 = suma(isp("ISP UE"), (g) => g.base);
  const c11 = suma(isp("ISP UE"), (g) => round2(g.base * IVA_ISP));
  const c12 = suma(isp("ISP fuera UE"), (g) => g.base);
  const c13 = suma(isp("ISP fuera UE"), (g) => round2(g.base * IVA_ISP));
  const c27 = round2(c09 + c11 + c13);
  const soportado = isp("IVA soportado");
  // Las líneas al 0 % no dan derecho a deducción: no entran en la base de la casilla 28. Un gasto sin
  // desglose y sin IVA (por ejemplo, español pero con IVA 0 €) tampoco: no hay cuota que deducir.
  const baseDeducible = (g: GastoCalc) => {
    if (g.desglose?.length) return suma(g.desglose.filter((l) => l.pct > 0), (l) => l.base);
    return g.iva > 0 ? g.base : 0;
  };
  const c28 = round2(suma(soportado, baseDeducible) + c12);
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
  const c87 = round2(c110 - c78);
  return {
    anio, t, c07, c09, c10, c11, c12, c13, c27, c28, c29, c36, c37, c45, c46, c59, c120, c110, c78, c87, c71,
    pendienteCompensar: round2(c110 - c78 + Math.max(0, -c46)),
  };
}

// ---------- Modelo 349 ----------

export interface Linea349 {
  clave: "S" | "I";
  nombre: string;
  nif: string;
  /** Como lo pide la Sede: código de país (Grecia = EL) y número sin prefijo. null si no se sabe. */
  pais: string | null;
  numero: string;
  base: number;
}

/** Separa «FI26899624» en FI + 26899624; si el VAT no lleva prefijo, usa el país del proveedor. */
export function nifComunitario(nif: string, pais?: string | null): { pais: string | null; numero: string } {
  const limpio = nif.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^([A-Z]{2})(.+)$/.exec(limpio);
  if (m && (!pais || m[1] === pais.toUpperCase() || (m[1] === "EL" && pais.toUpperCase() === "GR"))) {
    return { pais: m[1], numero: m[2] };
  }
  const p = pais ? (pais.toUpperCase() === "GR" ? "EL" : pais.toUpperCase()) : null;
  return { pais: p, numero: limpio };
}

/** Operaciones intracomunitarias del trimestre agrupadas por operador. */
export function modelo349(d: DatosCalc, anio: number, t: number): Linea349[] {
  const { desde, hasta } = rangoTrimestre(anio, t);
  const lineas = new Map<string, Linea349>();
  const add = (clave: "S" | "I", nombre: string, nif: string, base: number, pais?: string | null) => {
    const k = `${clave}|${nif || nombre}`;
    const l = lineas.get(k) ?? { clave, nombre, nif, ...nifComunitario(nif, pais), base: 0 };
    l.base = round2(l.base + base);
    lineas.set(k, l);
  };
  for (const f of d.facturas) {
    if (f.tipo === "ue" && enRango(f.fecha, desde, hasta)) add("S", f.cliente ?? "?", f.nif_cliente ?? "", f.base);
  }
  for (const g of d.gastos) {
    if (g.tipo === "ISP UE" && enRango(g.fecha, desde, hasta)) add("I", g.proveedor ?? "?", g.nif ?? "", g.base, g.pais);
  }
  return [...lineas.values()].sort((a, b) => a.clave.localeCompare(b.clave) || b.base - a.base);
}

// ---------- Modelo 390 (resumen anual de IVA) ----------
// Casillas del formulario del ejercicio 2026 (Orden EHA/3111/2009 con los cambios de la Orden
// HAC/27/2026, que no afectan a estas casillas). Solo las que usa un autónomo en régimen general
// con ventas al 21 %, servicios a clientes UE y gastos con IVA español o con inversión del sujeto pasivo.

export interface Modelo390 {
  anio: number;
  // IVA devengado
  c05: number; c06: number; // régimen ordinario al 21 % (01-02 es el 4 %, 03-04 el 10 %)
  c551: number; c552: number; // adquisiciones intracomunitarias de servicios al 21 %
  c27: number; c28: number; // IVA devengado en otros supuestos de inversión del sujeto pasivo
  c33: number; c34: number; // total bases y cuotas IVA
  c47: number; // total cuotas IVA y recargo de equivalencia
  // IVA deducible
  c190: number; c191: number; // operaciones interiores corrientes al 4 %
  c603: number; c604: number; // … al 10 %
  c605: number; c606: number; // … al 21 %
  c48: number; c49: number; // total operaciones interiores corrientes
  c637: number; c638: number; // adquisiciones intracomunitarias de servicios corrientes al 21 %
  c597: number; c598: number; // total adquisiciones intracomunitarias de servicios
  c64: number; // suma de deducciones
  c65: number; // resultado régimen general (47 − 64)
  // Resultado de la liquidación anual
  c84: number; // suma de resultados
  c85: number; // compensación de cuotas del ejercicio anterior
  c86: number; // resultado de la liquidación (84 − 85)
  // Resultado de las liquidaciones (las cuatro del 303)
  c95: number; // total resultados a ingresar en las autoliquidaciones del ejercicio
  c97: number; // resultado de la última autoliquidación: a compensar
  c98: number; // resultado de la última autoliquidación: a devolver
  c662: number; // cuotas pendientes de compensación generadas en el ejercicio (periodos distintos del último)
  // Volumen de operaciones
  c99: number; // operaciones en régimen general
  c103: number; // entregas intracomunitarias de bienes y servicios
  c110: number; // operaciones no sujetas por reglas de localización
  c108: number; // total volumen de operaciones
  trimestres: Modelo303[];
  /** 86 = 95 − 97 − 98 − 662: si no cuadra, algo no encaja con los 303. */
  cuadra: boolean;
}

/** Tipo de IVA de un gasto con IVA soportado (por su cuota), para repartirlo en el 390. */
function tipoSoportado(g: GastoCalc): 4 | 10 | 21 {
  const pct = g.base ? Math.round((g.iva / g.base) * 100) : 0;
  if (pct === 21 || pct === 10 || pct === 4) return pct;
  throw new Error(`Gasto de ${g.proveedor ?? "?"} del ${g.fecha} con IVA del ${pct} %: el 390 de IVAn solo contempla 4, 10 y 21 %`);
}

export function modelo390(d: DatosCalc, anio: number, ultimo: "compensar" | "devolver" = "compensar"): Modelo390 {
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const fs = d.facturas.filter((f) => enRango(f.fecha, desde, hasta));
  const gs = limitesRestauracion(d, hasta).gastos.filter((g) => enRango(g.fecha, desde, hasta));
  const ts = [1, 2, 3, 4].map((t) => modelo303(d, anio, t));
  const de = (tipo: GastoCalc["tipo"]) => gs.filter((g) => g.tipo === tipo);

  // Devengado: lo mismo que los cuatro 303, por casillas del 390.
  const c05 = suma(ts, (t) => t.c07);
  const c06 = suma(ts, (t) => t.c09);
  const c551 = suma(de("ISP UE"), (g) => g.base);
  const c552 = suma(de("ISP UE"), (g) => round2(g.base * IVA_ISP));
  const c27 = suma(de("ISP fuera UE"), (g) => g.base);
  const c28 = suma(de("ISP fuera UE"), (g) => round2(g.base * IVA_ISP));
  const c33 = round2(c05 + c551 + c27);
  const c34 = round2(c06 + c552 + c28);
  const c47 = c34;

  // Deducible: el IVA español por tipos (por el desglose de la factura; los gastos antiguos sin
  // desglose usan tipoSoportado()); la inversión del sujeto pasivo fuera de la UE se deduce como
  // operación interior al 21 % (igual que en las casillas 28/29 del 303).
  const soportado = de("IVA soportado");
  // Un gasto sin desglose y sin IVA (español pero con cuota 0 €) no tiene tipo que adivinar: no entra
  // en ninguna de las casillas 190-606, igual que en la casilla 28 del 303.
  const sinDesglose = soportado.filter((g) => !g.desglose?.length && g.iva > 0);
  const conDesglose = soportado.filter((g) => g.desglose?.length);
  const porTipoViejo = (pct: 4 | 10 | 21) => sinDesglose.filter((g) => tipoSoportado(g) === pct);
  const lineasPct = (pct: number) => conDesglose.flatMap((g) => g.desglose!.filter((l) => l.pct === pct));
  const c190 = round2(suma(porTipoViejo(4), (g) => g.base) + suma(lineasPct(4), (l) => l.base));
  const c191 = round2(suma(porTipoViejo(4), (g) => g.iva) + suma(lineasPct(4), (l) => l.cuota));
  const c603 = round2(suma(porTipoViejo(10), (g) => g.base) + suma(lineasPct(10), (l) => l.base));
  const c604 = round2(suma(porTipoViejo(10), (g) => g.iva) + suma(lineasPct(10), (l) => l.cuota));
  const c605 = round2(suma(porTipoViejo(21), (g) => g.base) + suma(lineasPct(21), (l) => l.base) + c27);
  const c606 = round2(suma(porTipoViejo(21), (g) => g.iva) + suma(lineasPct(21), (l) => l.cuota) + c28);
  const c48 = round2(c190 + c603 + c605);
  const c49 = round2(c191 + c604 + c606);
  const c637 = c551;
  const c638 = c552;
  const c597 = c637;
  const c598 = c638;
  const c64 = round2(c49 + c598);
  const c65 = round2(c47 - c64);

  // Resultado: las cuotas del año anterior que se aplican primero (85) y lo que dejaron los 303.
  const inicial = d.ivaCompensarInicial;
  const c85 = round2(Math.min(inicial, suma(ts, (t) => t.c78)));
  const c84 = c65;
  const c86 = round2(c84 - c85);
  const t4 = ts[3];
  const c95 = suma(ts, (t) => Math.max(t.c71, 0));
  const negativoUltimo = round2(Math.max(-t4.c71, 0));
  const c97 = ultimo === "compensar" ? negativoUltimo : 0;
  const c98 = ultimo === "devolver" ? negativoUltimo : 0;
  const c662 = round2(Math.max(0, t4.c87 - (inicial - c85)));

  const c99 = c05;
  const c103 = suma(fs.filter((f) => f.tipo === "ue"), (f) => f.base);
  const c110 = suma(fs.filter((f) => f.tipo === "fuera_ue"), (f) => f.base);
  const c108 = round2(c99 + c103 + c110);

  return {
    anio, c05, c06, c551, c552, c27, c28, c33, c34, c47,
    c190, c191, c603, c604, c605, c606, c48, c49, c637, c638, c597, c598, c64, c65,
    c84, c85, c86, c95, c97, c98, c662, c99, c103, c110, c108,
    trimestres: ts,
    cuadra: Math.abs(c86 - (c95 - c97 - c98 - c662)) < 0.005,
  };
}
