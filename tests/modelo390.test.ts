import { describe, expect, it } from "vitest";
import datos from "./fixtures/datos_2026.json";
import { modelo303, modelo390, type DatosCalc } from "../lib/calculo";

const d: DatosCalc = {
  facturas: datos.facturas as DatosCalc["facturas"],
  gastos: datos.gastos as DatosCalc["gastos"],
  cuotaMes: () => 452,
  bienes: [],
  pagado130: () => null,
  ivaCompensarInicial: 0,
};

describe("390 de 2026 con los datos hasta octubre", () => {
  const m = modelo390(d, 2026);
  const ts = [1, 2, 3, 4].map((t) => modelo303(d, 2026, t));
  const sum = (f: (x: (typeof ts)[number]) => number) => Math.round(ts.reduce((s, x) => s + f(x), 0) * 100) / 100;

  it("el devengado es la suma de los cuatro 303", () => {
    expect(m.c05).toBe(sum((t) => t.c07));
    expect(m.c06).toBe(sum((t) => t.c09));
    expect(m.c551).toBe(sum((t) => t.c10));
    expect(m.c552).toBe(sum((t) => t.c11));
    expect(m.c27).toBe(sum((t) => t.c12));
    expect(m.c28).toBe(sum((t) => t.c13));
    expect(m.c34).toBe(sum((t) => t.c27));
  });
  it("el deducible es la suma de los cuatro 303", () => {
    expect(m.c48).toBe(sum((t) => t.c28));
    expect(m.c49).toBe(sum((t) => t.c29));
    expect(m.c597).toBe(sum((t) => t.c36));
    expect(m.c598).toBe(sum((t) => t.c37));
    expect(m.c64).toBe(sum((t) => t.c45));
    expect(m.c65).toBe(sum((t) => t.c46));
  });
  it("cifras de la hoja", () => {
    expect(m).toMatchObject({
      c05: 1020, c06: 214.2,
      c551: 1008.64, c552: 211.81,
      c27: 980.61, c28: 205.93,
      c33: 3009.25, c34: 631.94, c47: 631.94,
      c605: 1012.66, c606: 212.67, c48: 1012.66, c49: 212.67,
      c597: 1008.64, c598: 211.81, c64: 424.48, c65: 207.46,
      c85: 0, c86: 207.46, c95: 207.46, c97: 0, c98: 0, c662: 0,
      c99: 1020, c103: 28440, c110: 0, c108: 29460,
    });
    expect(m.cuadra).toBe(true);
  });
  it("todo el IVA español de 2026 es al 21 %", () => {
    expect(m.c190 + m.c191 + m.c603 + m.c604).toBe(0);
  });
});

describe("390: casos que no salen en 2026", () => {
  const extra = (gastos: DatosCalc["gastos"], facturas: DatosCalc["facturas"] = []): DatosCalc => ({
    ...d,
    gastos: [...d.gastos, ...gastos],
    facturas: [...d.facturas, ...facturas],
  });
  it("un gasto al 10 % va a 603/604", () => {
    const m = modelo390(extra([{ fecha: "2026-11-10", base: 100, iva: 10, tipo: "IVA soportado", proveedor: "Restaurante" }]), 2026);
    expect([m.c603, m.c604]).toEqual([100, 10]);
    expect(m.cuadra).toBe(true);
  });
  it("si el 4T sale a compensar va a la 97, o a la 98 si se pide devolución", () => {
    const dd = extra([{ fecha: "2026-11-10", base: 1000, iva: 210, tipo: "IVA soportado", proveedor: "Tienda" }]);
    const t4 = modelo303(dd, 2026, 4);
    expect(t4.c71).toBe(-210);
    expect(modelo390(dd, 2026)).toMatchObject({ c97: 210, c98: 0, cuadra: true });
    expect(modelo390(dd, 2026, "devolver")).toMatchObject({ c97: 0, c98: 210, cuadra: true });
  });
  it("cuotas que quedan sin compensar de trimestres anteriores van a la 662", () => {
    // Un gasto grande en el 1T: −502,42; el 3T (+210,30) solo compensa una parte
    const dd = extra([{ fecha: "2026-02-10", base: 2380.95, iva: 500, tipo: "IVA soportado", proveedor: "Ordenador" }]);
    const m = modelo390(dd, 2026);
    expect(m).toMatchObject({ c95: 0, c97: 0, c662: 292.54, c86: -292.54, cuadra: true });
  });
  it("un IVA raro (p. ej. 5 %) avisa en vez de inventarse la casilla", () => {
    expect(() => modelo390(extra([{ fecha: "2026-11-10", base: 100, iva: 5, tipo: "IVA soportado" }]), 2026)).toThrow(/5 %/);
  });
});
