// Textos y comprobaciones de la pantalla de Impuestos que no son del cálculo fiscal (eso sigue en
// lib/calculo.ts): el saldo de IVA a compensar que arrastró la gestoría y las frases del porqué.

import { round2 } from "./fiscal";
import type { Casillas303, Presentacion } from "./libro";

export function frase303(c71: number): string {
  if (c71 === 0) return "Lo que cobras de IVA y lo que deduces se compensan";
  if (c71 > 0) return "IVA cobrado menos el deducible";
  return "Te sale a favor: queda para compensar";
}

export function frase130(c07: number, t: number): string {
  if (c07 <= 0) {
    return t === 1
      ? "Tus gastos superan el 20 % de tu rendimiento del 1T"
      : `Lo pagado de 1T a ${t - 1}T ya cubre el 20 % de tu rendimiento del año`;
  }
  return "20 % del rendimiento menos lo ya pagado y las retenciones";
}

export interface SaldoFaltante {
  anio: number;
  trimestre: number;
  esperado: number;
  presentado: number;
  falta: number;
}

/**
 * El [110] esperado de cada 303 es el [87] del trimestre anterior más lo que dejó «a compensar»
 * (−[71] si fue negativo). Si un [110] presentado es menor que el esperado, la gestoría no arrastró
 * ese saldo: devuelve el primer trimestre donde falta y cuánto. Un [110] mayor (a favor de Jose,
 * sin explicar) no se avisa, solo lo que falta. Pura: recibe los 303 presentados con sus casillas.
 */
export function saldoIvaCompensar(presentaciones303: Pick<Presentacion, "anio" | "trimestre" | "casillas">[]): SaldoFaltante | null {
  const ordenadas = [...presentaciones303]
    .filter((p): p is { anio: number; trimestre: number; casillas: Casillas303 } => !!p.casillas)
    .sort((a, b) => a.anio - b.anio || a.trimestre - b.trimestre);

  let esperado110 = 0;
  for (const p of ordenadas) {
    const c110 = p.casillas["110"] ?? 0;
    const c87 = p.casillas["87"] ?? 0;
    const c71 = p.casillas["71"] ?? 0;
    if (c110 < round2(esperado110) - 0.01) {
      return { anio: p.anio, trimestre: p.trimestre, esperado: round2(esperado110), presentado: c110, falta: round2(esperado110 - c110) };
    }
    esperado110 = c87 + Math.max(0, -c71);
  }
  return null;
}
