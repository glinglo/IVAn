// Datos para la pantalla de Inicio (resultados): series mensuales, cascada, salud e indicadores
// de impuestos y cuota. Funciones puras: usan `pyg` y `meses` de `lib/calculo.ts` sin modificarlo.

import type { Libro, Paso } from "./libro";
import { meses, modelo130, pyg } from "./calculo";
import { rangoTrimestre, round2 } from "./fiscal";

export interface MesSerie {
  mes: string;
  ingresos: number;
  gastos: number;
  cuota: number;
  pendiente: boolean;
}

/** Un elemento por mes de enero a `hasta`, como la diferencia entre dos acumulados de `pyg`. */
export function seriesMensuales(libro: Libro, hasta: string, hoy: string): MesSerie[] {
  const todosLosMeses = meses(`${hasta.slice(0, 4)}-01-01`, hasta);
  let anterior = { ingresos: 0, gastosFacturas: 0, seguridadSocial: 0 };
  const out: MesSerie[] = [];
  for (const mes of todosLosMeses) {
    const esUltimo = mes === todosLosMeses[todosLosMeses.length - 1];
    const finMes = esUltimo ? hasta : diaFin(mes);
    const p = pyg(libro.datos, finMes);
    out.push({
      mes,
      ingresos: round2(p.ingresos - anterior.ingresos),
      gastos: round2(p.gastosFacturas - anterior.gastosFacturas),
      cuota: round2(p.seguridadSocial - anterior.seguridadSocial),
      pendiente: mes === hoy.slice(0, 7) && !libro.facturas.some((f) => f.fecha.startsWith(mes)),
    });
    anterior = { ingresos: p.ingresos, gastosFacturas: p.gastosFacturas, seguridadSocial: p.seguridadSocial };
  }
  return out;
}

/** "2026-03" → "2026-03-31" */
function diaFin(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

export interface FilaCascada {
  label: string;
  value: number;
  kind: "total" | "minus" | "result";
}

/** Filas de la cascada «de lo facturado al rendimiento», a partir del resultado de `pyg`. */
export function cascada(p: ReturnType<typeof pyg>): FilaCascada[] {
  return [
    { label: "Ingresos", value: p.ingresos, kind: "total" },
    { label: "Gastos con factura", value: p.gastosFacturas, kind: "minus" },
    { label: "Cuota de autónomo", value: p.seguridadSocial, kind: "minus" },
    { label: "Amortización", value: p.amortizaciones, kind: "minus" },
    { label: "Difícil justificación (5 %)", value: p.dificilJustificacion, kind: "minus" },
    { label: "Rendimiento neto", value: p.rendimientoNeto, kind: "result" },
  ];
}

export interface Indicador {
  clave: "margen" | "gastos" | "dependencia";
  valor: number | null;
  estado: "bien" | "atencion" | "riesgo";
  cliente?: string;
}

/** Tres indicadores de salud del negocio, con los umbrales de «Decisiones». */
export function salud(libro: Libro, p: ReturnType<typeof pyg>): Indicador[] {
  if (p.ingresos === 0) {
    return [
      { clave: "margen", valor: null, estado: "bien" },
      { clave: "gastos", valor: null, estado: "bien" },
      { clave: "dependencia", valor: null, estado: "bien" },
    ];
  }
  const margen = p.rendimientoNeto / p.ingresos;
  const gastosSobreVentas = p.gastosFacturas / p.ingresos;

  const porCliente = new Map<string, number>();
  for (const f of libro.facturas) {
    if (f.fecha < p.desde || f.fecha > p.hasta) continue;
    porCliente.set(f.cliente, round2((porCliente.get(f.cliente) ?? 0) + f.base));
  }
  let clienteTop: string | undefined;
  let baseTop = 0;
  for (const [cliente, base] of porCliente) {
    if (base > baseTop) {
      baseTop = base;
      clienteTop = cliente;
    }
  }
  const dependencia = baseTop / p.ingresos;

  return [
    { clave: "margen", valor: margen, estado: margen >= 0.5 ? "bien" : "atencion" },
    { clave: "gastos", valor: gastosSobreVentas, estado: gastosSobreVentas <= 0.2 ? "bien" : "atencion" },
    { clave: "dependencia", valor: dependencia, estado: dependencia >= 0.7 ? "riesgo" : "bien", cliente: clienteTop },
  ];
}

export interface EstadoCuota {
  cuotaPagada: number;
  pagado130: { importe: number; estimado: boolean };
}

/** Cuota de autónomo pagada y 130 pagado en los trimestres cerrados del periodo, con los importes
 * reales de `presentaciones` cuando se conocen. */
export function estadoYCuota(libro: Libro, hasta: string): EstadoCuota {
  const p = pyg(libro.datos, hasta);
  const anio = Number(hasta.slice(0, 4));
  let importe = 0;
  let estimado = false;
  for (let t = 1; t <= 4; t++) {
    if (rangoTrimestre(anio, t).hasta > hasta) break;
    const real = libro.datos.pagado130(anio, t);
    if (real !== null) {
      importe = round2(importe + real);
    } else {
      estimado = true;
      importe = round2(importe + modelo130(libro.datos, anio, t).aIngresar);
    }
  }
  return { cuotaPagada: p.seguridadSocial, pagado130: { importe, estimado } };
}

export interface Avisos {
  destacado: Paso | null;
  resto: Paso[];
}

/** Separa el aviso destacado (tarjeta grande) del resto (franja), según la urgencia y el día. */
export function clasificarAvisos(pasos: Paso[], hoy: string): Avisos {
  let destacado = pasos.find((p) => p.nivel === "urgente") ?? null;
  if (!destacado && Number(hoy.slice(8, 10)) >= 28) {
    destacado = pasos.find((p) => p.clave === "facturar") ?? pasos.find((p) => p.clave === "gastos") ?? null;
  }
  const resto = destacado ? pasos.filter((p) => p !== destacado) : pasos;
  return { destacado, resto };
}

export interface AvisosVisibles {
  tarjeta: Paso | null;
  franja: Paso[];
}

/** Qué se pinta en Inicio: la tarjeta (si hay destacado y no está oculto) y la franja (el resto,
 * más el destacado al principio si el usuario lo ha ocultado). Ocultar la tarjeta no borra la tarea. */
export function avisosVisibles({ destacado, resto, oculto }: { destacado: Paso | null; resto: Paso[]; oculto: boolean }): AvisosVisibles {
  if (destacado && !oculto) {
    return { tarjeta: destacado, franja: resto };
  }
  return { tarjeta: null, franja: destacado ? [destacado, ...resto] : resto };
}
