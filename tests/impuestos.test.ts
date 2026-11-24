import { describe, expect, it } from "vitest";
import { frase130, frase303, saldoIvaCompensar } from "../lib/impuestos";

describe("frase303", () => {
  it("resultado cero", () => {
    expect(frase303(0)).toBe("Lo que cobras de IVA y lo que deduces se compensan");
  });
  it("a ingresar", () => {
    expect(frase303(207.46)).toBe("IVA cobrado menos el deducible");
  });
  it("a compensar", () => {
    expect(frase303(-26.1)).toBe("Te sale a favor: queda para compensar");
  });
});

describe("frase130", () => {
  it("1T con gastos que superan el 20 %", () => {
    expect(frase130(-10, 1)).toBe("Tus gastos superan el 20 % de tu rendimiento del 1T");
  });
  it("4T ya cubierto por los pagos anteriores", () => {
    expect(frase130(0, 4)).toBe("Lo pagado de 1T a 3T ya cubre el 20 % de tu rendimiento del año");
  });
  it("a ingresar", () => {
    expect(frase130(1216.02, 1)).toBe("20 % del rendimiento menos lo ya pagado y las retenciones");
  });
});

describe("saldoIvaCompensar", () => {
  it("con los datos reales: falta en el 2T de 2026", () => {
    const presentaciones = [
      { anio: 2026, trimestre: 1, casillas: { "110": 755.53, "78": 0, "87": 755.53, "71": -2.42 } },
      { anio: 2026, trimestre: 2, casillas: { "110": 2.42, "78": 0, "87": 2.42, "71": -0.42 } },
      { anio: 2026, trimestre: 3, casillas: { "110": 2.84, "78": 2.84, "87": 0, "71": 207.46 } },
    ];
    const r = saldoIvaCompensar(presentaciones)!;
    expect(r.anio).toBe(2026);
    expect(r.trimestre).toBe(2);
    expect(r.esperado).toBe(757.95);
    expect(r.presentado).toBe(2.42);
    expect(r.falta).toBe(755.53);
  });

  it("un [110] mayor de lo esperado (a favor) no se avisa", () => {
    const presentaciones = [
      { anio: 2025, trimestre: 3, casillas: { "110": 300.7, "78": 0, "87": 300.7, "71": -376.67 } },
      { anio: 2025, trimestre: 4, casillas: { "110": 679.93, "78": 0, "87": 679.93, "71": -75.6 } },
    ];
    expect(saldoIvaCompensar(presentaciones)).toBeNull();
  });

  it("todo cuadra: null", () => {
    const presentaciones = [
      { anio: 2023, trimestre: 1, casillas: { "110": 459.04, "78": 0, "87": 459.04, "71": -32.38 } },
      { anio: 2023, trimestre: 2, casillas: { "110": 491.42, "78": 0, "87": 491.42, "71": -56.44 } },
    ];
    expect(saldoIvaCompensar(presentaciones)).toBeNull();
  });

  it("trimestres sin casillas (sin presentar todavía) se ignoran en la cadena", () => {
    const presentaciones = [
      { anio: 2026, trimestre: 1, casillas: { "110": 755.53, "78": 0, "87": 755.53, "71": -2.42 } },
      { anio: 2026, trimestre: 2, casillas: null },
    ];
    expect(saldoIvaCompensar(presentaciones)).toBeNull();
  });

  it("sin presentaciones, null", () => {
    expect(saldoIvaCompensar([])).toBeNull();
  });
});
