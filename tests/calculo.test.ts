import { describe, expect, it } from "vitest";
import datos from "./fixtures/datos_2026.json";
import { modelo130, modelo303, modelo349, nifComunitario, pyg, type DatosCalc } from "../lib/calculo";

const base = (cuota: number): DatosCalc => ({
  facturas: datos.facturas as DatosCalc["facturas"],
  gastos: datos.gastos as DatosCalc["gastos"],
  cuotaMes: () => cuota,
  bienes: [{ fecha_compra: "2025-01-01", base: 2399.08, pct_anual: 26 }],
  pagado130: () => null,
  ivaCompensarInicial: 0,
});

describe("P&L de la gestoría (sin cuota de autónomo)", () => {
  // Informe PPYGG de Selfconta 2026: 29.460 − 2.665,20 = 26.794,80; 5 % = 1.339,74; neto 25.455,06
  it("reproduce el informe", () => {
    const p = pyg(base(0), "2026-12-31");
    expect(p.ingresos).toBe(29460);
    expect(p.gastosFacturas).toBe(2041.44);
    expect(p.amortizaciones).toBe(623.76);
    expect(p.diferencia).toBe(26794.8);
    expect(p.dificilJustificacion).toBe(1339.74);
    expect(p.rendimientoNeto).toBe(25455.06);
  });
});

describe("Hoja de cálculo (cuota 452 €/mes)", () => {
  const d = base(452);
  it("303 por trimestre", () => {
    expect([1, 2, 3, 4].map((t) => modelo303(d, 2026, t).c71)).toEqual([-2.42, -0.42, 207.46, 0]);
    const t3 = modelo303(d, 2026, 3);
    expect(t3).toMatchObject({ c01: 1020, c03: 214.2, c10: 76.2, c11: 15.99, c12: 154.73, c13: 32.5, c59: 7560, c110: 2.84 });
  });
  it("130 por trimestre", () => {
    expect([1, 2, 3, 4].map((t) => modelo130(d, 2026, t).aIngresar)).toEqual([1216.02, 1272.9, 1141.5, 277.03]);
    expect(modelo130(d, 2026, 3)).toMatchObject({ c01: 26400, c05: 2488.92, c06: 153 });
  });
  it("130 usa el importe real presentado si se conoce", () => {
    const real = { ...d, pagado130: (_a: number, t: number) => (t === 1 ? 1500 : null) };
    expect(modelo130(real, 2026, 2).c05).toBe(1500);
  });
  it("349 del 1T agrupado por operador", () => {
    const l = modelo349(d, 2026, 1);
    expect(l.find((x) => x.clave === "S")).toMatchObject({ nombre: "Zapflow Oy", base: 9060 });
    expect(l.filter((x) => x.clave === "I").reduce((s, x) => s + x.base, 0)).toBeCloseTo(651, 2);
  });
  it("349: código de país y número separados, como en la Sede", () => {
    expect(nifComunitario("FI26899624")).toEqual({ pais: "FI", numero: "26899624" });
    expect(nifComunitario("04788290", "CZ")).toEqual({ pais: "CZ", numero: "04788290" });
    expect(nifComunitario("NL853695386B01", "NL")).toEqual({ pais: "NL", numero: "853695386B01" });
    expect(nifComunitario("853695386B01", "NL")).toEqual({ pais: "NL", numero: "853695386B01" });
    expect(nifComunitario("123456789", "GR")).toEqual({ pais: "EL", numero: "123456789" });
    const s = modelo349(d, 2026, 1).find((x) => x.clave === "S")!;
    expect(s).toMatchObject({ pais: "FI", numero: "26899624" });
  });
});
