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

export interface Resultado130Mostrado {
  /** La [19]: nunca negativa. */
  aIngresar: number;
  /** Si el resultado ([07], presentado o calculado) es negativo, cuánto se ha adelantado de más
   * (se recupera en la Renta, no en el 130). `null` si no es negativo. */
  adelantadoDeMas: number | null;
}

/** El 130 no sale a devolver: si el resultado es negativo, se presenta tal cual en la [07], pero lo
 * que de verdad se ingresa (la [19]) es 0,00 €. */
export function resultado130Mostrado(resultado: number): Resultado130Mostrado {
  return resultado < 0 ? { aIngresar: 0, adelantadoDeMas: round2(-resultado) } : { aIngresar: round2(resultado), adelantadoDeMas: null };
}

export interface SaldoFaltante {
  anio: number;
  trimestre: number;
  esperado: number;
  presentado: number;
  falta: number;
}

/**
 * El [110] esperado de cada 303 (salvo el primero de la serie, que se acepta tal cual: es el saldo
 * de antes de tener los datos) es el [87] del trimestre anterior, pero recalculado con el [110] que
 * tocaba (no el presentado, que puede traer de más): `min([110] presentada, esperado) − [78]`, más
 * lo que dejó «a compensar» ese trimestre (`max(0, −[71])`). Así un [110] inflado sin explicar (un
 * exceso que la gestoría no justifica) no se arrastra a los trimestres siguientes.
 *
 * Si un [110] presentado es menor que el esperado, la gestoría no arrastró ese saldo: devuelve el
 * primer trimestre donde falta y cuánto. Un [110] mayor no se avisa, solo lo que falta. Pura: recibe
 * los 303 presentados con sus casillas.
 */
export function saldoIvaCompensar(presentaciones303: Pick<Presentacion, "anio" | "trimestre" | "casillas">[]): SaldoFaltante | null {
  const ordenadas = [...presentaciones303]
    .filter((p): p is { anio: number; trimestre: number; casillas: Casillas303 } => !!p.casillas)
    .sort((a, b) => a.anio - b.anio || a.trimestre - b.trimestre);

  let esperado110: number | null = null;
  for (const p of ordenadas) {
    const c110 = p.casillas["110"] ?? 0;
    const c78 = p.casillas["78"] ?? 0;
    const c71 = p.casillas["71"] ?? 0;
    let corregido87: number;
    if (esperado110 === null) {
      corregido87 = round2(c110 - c78);
    } else {
      if (c110 < esperado110 - 0.01) {
        return { anio: p.anio, trimestre: p.trimestre, esperado: esperado110, presentado: c110, falta: round2(esperado110 - c110) };
      }
      corregido87 = round2(Math.min(c110, esperado110) - c78);
    }
    esperado110 = round2(corregido87 + Math.max(0, -c71));
  }
  return null;
}
