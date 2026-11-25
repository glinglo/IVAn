import { describe, expect, it } from "vitest";
import datos from "./fixtures/datos_2026.json";
import {
  amortizacionDelAnio,
  amortizacionDelAnioPorBien,
  modelo130,
  modelo303,
  modelo349,
  nifComunitario,
  pyg,
  subvencionesDelAnio,
  type DatosCalc,
} from "../lib/calculo";

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
    expect(t3).toMatchObject({ c07: 1020, c09: 214.2, c10: 76.2, c11: 15.99, c12: 154.73, c13: 32.5, c27: 262.69, c59: 7560, c110: 2.84 });
    expect(modelo303(d, 2026, 2).c87).toBe(2.42);
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

describe("Subvención de capital (Kit Digital del Mac)", () => {
  const mac = { fecha_compra: "2025-08-20", base: 2399.0, pct_anual: 26, subvencion: 1000 };

  it("subvencionesDelAnio: 260 € en 2026, 65 € hasta el 1T", () => {
    expect(subvencionesDelAnio([mac], "2026-12-31")).toBe(260);
    expect(subvencionesDelAnio([mac], "2026-03-31")).toBe(65);
  });

  it("un bien sin subvención da 0", () => {
    expect(subvencionesDelAnio([{ fecha_compra: "2025-01-01", base: 2399.08, pct_anual: 26 }], "2026-12-31")).toBe(0);
  });

  it("pyg y el 130 del 4T incluyen la subvención en los ingresos y el rendimiento", () => {
    const conSubvencion: DatosCalc = { ...base(452), bienes: [mac] };
    const p = pyg(conSubvencion, "2026-12-31");
    expect(p.subvenciones).toBe(260);
    expect(p.rendimientoNeto).toBe(20549.28); // 20302,26 sin subvención + 247,02 (260 € menos el 5 % de la propia subvención)
    const m130 = modelo130(conSubvencion, 2026, 4);
    expect(m130.c01).toBe(29720); // 29460 + 260
  });
});

describe("amortizacionDelAnioPorBien", () => {
  const bienes = [
    { fecha_compra: "2025-01-01", base: 2399.08, pct_anual: 26 },
    { fecha_compra: "2026-06-01", base: 1000, pct_anual: 26 },
  ];

  it("suma lo mismo que amortizacionDelAnio", () => {
    const porBien = amortizacionDelAnioPorBien(bienes, "2026-12-31");
    expect(porBien.reduce((s, v) => s + v, 0)).toBe(amortizacionDelAnio(bienes, "2026-12-31"));
  });

  it("un bien comprado a mitad de año solo amortiza desde entonces", () => {
    const porBien = amortizacionDelAnioPorBien(bienes, "2026-12-31");
    expect(porBien[1]).toBeGreaterThan(0);
    expect(amortizacionDelAnioPorBien(bienes, "2026-05-31")[1]).toBe(0);
  });
});
