import { describe, expect, it } from "vitest";
import { frase130, frase303, resultado130Mostrado, saldoIvaCompensar } from "../lib/impuestos";

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
  it("con la serie completa (2023 a 3T de 2026): falta en el 2T de 2026, 752,97 €", () => {
    const presentaciones = [
      { anio: 2023, trimestre: 1, casillas: { "110": 459.04, "78": 0, "87": 459.04, "71": -32.38 } },
      { anio: 2023, trimestre: 2, casillas: { "110": 491.42, "78": 0, "87": 491.42, "71": -56.44 } },
      { anio: 2023, trimestre: 3, casillas: { "110": 547.86, "78": 0, "87": 547.86, "71": -3.27 } },
      { anio: 2023, trimestre: 4, casillas: { "110": 551.13, "78": 0, "87": 551.13, "71": -26.1 } },
      { anio: 2024, trimestre: 1, casillas: { "110": 577.23, "78": 0, "87": 577.23, "71": -89.5 } },
      { anio: 2024, trimestre: 2, casillas: { "110": 666.73, "78": 462.21, "87": 204.52, "71": 0 } },
      { anio: 2024, trimestre: 3, casillas: { "110": 204.52, "78": 204.52, "87": 0, "71": 471.87 } },
      { anio: 2024, trimestre: 4, casillas: { "110": 0, "78": 0, "87": 0, "71": 644.97 } },
      { anio: 2025, trimestre: 1, casillas: { "110": 0, "78": 0, "87": 0, "71": -26.1 } },
      { anio: 2025, trimestre: 2, casillas: { "110": 26.1, "78": 0, "87": 26.1, "71": -274.6 } },
      { anio: 2025, trimestre: 3, casillas: { "110": 300.7, "78": 0, "87": 300.7, "71": -376.67 } },
      // El 3T de 2025 dejaba un esperado de 677,37 €, pero este 4T trajo 679,93 € (2,56 € de más sin
      // explicar): no se arrastra el exceso a los trimestres siguientes.
      { anio: 2025, trimestre: 4, casillas: { "110": 679.93, "78": 0, "87": 679.93, "71": -75.6 } },
      { anio: 2026, trimestre: 1, casillas: { "110": 755.53, "78": 0, "87": 755.53, "71": -2.42 } },
      { anio: 2026, trimestre: 2, casillas: { "110": 2.42, "78": 0, "87": 2.42, "71": -0.42 } },
      { anio: 2026, trimestre: 3, casillas: { "110": 2.84, "78": 2.84, "87": 0, "71": 207.46 } },
    ];
    const r = saldoIvaCompensar(presentaciones)!;
    expect(r.anio).toBe(2026);
    expect(r.trimestre).toBe(2);
    expect(r.esperado).toBe(755.39);
    expect(r.presentado).toBe(2.42);
    expect(r.falta).toBe(752.97);
  });

  it("una serie sin excesos da lo mismo que la regla anterior", () => {
    const presentaciones = [
      { anio: 2026, trimestre: 1, casillas: { "110": 755.53, "78": 0, "87": 755.53, "71": -2.42 } },
      { anio: 2026, trimestre: 2, casillas: { "110": 2.42, "78": 0, "87": 2.42, "71": -0.42 } },
      { anio: 2026, trimestre: 3, casillas: { "110": 2.84, "78": 2.84, "87": 0, "71": 207.46 } },
    ];
    const r = saldoIvaCompensar(presentaciones)!;
    expect(r.esperado).toBe(757.95);
    expect(r.presentado).toBe(2.42);
    expect(r.falta).toBe(755.53);
  });

  it("la [78] aplicada en 2024 (462,21 € y 204,52 €) no provoca aviso", () => {
    const presentaciones = [
      { anio: 2024, trimestre: 1, casillas: { "110": 577.23, "78": 0, "87": 577.23, "71": -89.5 } },
      { anio: 2024, trimestre: 2, casillas: { "110": 666.73, "78": 462.21, "87": 204.52, "71": 0 } },
      { anio: 2024, trimestre: 3, casillas: { "110": 204.52, "78": 204.52, "87": 0, "71": 471.87 } },
      { anio: 2024, trimestre: 4, casillas: { "110": 0, "78": 0, "87": 0, "71": 644.97 } },
    ];
    expect(saldoIvaCompensar(presentaciones)).toBeNull();
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

describe("resultado130Mostrado", () => {
  it("resultado negativo: a ingresar 0, adelantado de más con el valor absoluto", () => {
    expect(resultado130Mostrado(-150.32)).toEqual({ aIngresar: 0, adelantadoDeMas: 150.32 });
  });
  it("resultado positivo: a ingresar tal cual, sin adelantado", () => {
    expect(resultado130Mostrado(1216.02)).toEqual({ aIngresar: 1216.02, adelantadoDeMas: null });
  });
  it("resultado cero: a ingresar 0, sin adelantado", () => {
    expect(resultado130Mostrado(0)).toEqual({ aIngresar: 0, adelantadoDeMas: null });
  });
});
