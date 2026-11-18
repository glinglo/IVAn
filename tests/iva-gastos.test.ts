// IVA de los gastos: el tipo que pone la factura (nunca se deduce del producto) y si se puede
// deducir. Ver docs/planes/2026-11-18-iva-de-los-gastos.md.
import { describe, expect, it } from "vitest";
import { clasificarGasto, validarDesglose, type LineaIva } from "../lib/fiscal";
import { construirFila } from "../lib/gastos";
import type { GastoExtraido } from "../lib/claude";
import { limitesRestauracion, modelo303, modelo390, pyg, type DatosCalc, type GastoCalc } from "../lib/calculo";

const datos = (gastos: GastoCalc[], facturadoAnio = 30000): DatosCalc => ({
  facturas: [{ fecha: "2026-01-10", base: facturadoAnio, iva_pct: 21, iva: facturadoAnio * 0.21, retencion: 0, tipo: "nacional" }],
  gastos,
  cuotaMes: () => 0,
  bienes: [],
  pagado130: () => null,
  ivaCompensarInicial: 0,
});

const extraido = (p: Partial<GastoExtraido>): GastoExtraido => ({
  es_factura: true,
  proveedor: "Proveedor",
  nif_proveedor: "B00000000",
  pais: "ES",
  numero_factura: "1",
  fecha: "2026-11-10",
  concepto: "gasto",
  categoria: "otro",
  moneda: "EUR",
  base: 0,
  iva: 0,
  total: 0,
  desglose_iva: [],
  iva_espanol: true,
  nif_destinatario: "00000000T",
  notas: null,
  ...p,
});

const NIF = "00000000T";

describe("validarDesglose", () => {
  it("céntimos: 0,41 € al 21 % (0,09 €) se acepta", () => {
    const l: LineaIva[] = [{ pct: 21, base: 0.41, cuota: 0.09 }];
    expect(validarDesglose(l, 0.41, 0.09, 0.5)).toEqual([]);
  });

  it("luz en noviembre: se acepta el 10 % que pone la factura (el tipo nunca se deduce del producto)", () => {
    const l: LineaIva[] = [{ pct: 10, base: 60, cuota: 6 }];
    expect(validarDesglose(l, 60, 6, 66)).toEqual([]);
  });

  it("cuota que no cuadra: avisa", () => {
    const l: LineaIva[] = [{ pct: 21, base: 100, cuota: 10 }];
    const avisos = validarDesglose(l, 100, 10, 110);
    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos[0]).toMatch(/21 %/);
  });

  it("tipo que no existe: el 5 % no es un tipo de IVA español", () => {
    const l: LineaIva[] = [{ pct: 5, base: 100, cuota: 5 }];
    const avisos = validarDesglose(l, 100, 5, 105);
    expect(avisos[0]).toMatch(/5 % no es un tipo de IVA español/);
  });
});

describe("clasificarGasto", () => {
  it("IVA no español → Sin IVA deducible", () => {
    expect(clasificarGasto("GB", 2.56, { ivaEspanol: false, aMiNombre: true })).toBe("Sin IVA deducible");
  });
  it("IVA español sin mi NIF → Sin IVA deducible", () => {
    expect(clasificarGasto("ES", 4.2, { ivaEspanol: true, aMiNombre: false })).toBe("Sin IVA deducible");
  });
});

describe("construirFila", () => {
  it("Paddle con IVA: no deducible, el IVA pasa a la base", () => {
    const x = extraido({
      proveedor: "Paddle.com", nif_proveedor: "EU372017215", pais: "GB", base: 12.18, iva: 2.56, total: 14.74,
      desglose_iva: [{ tipo_pct: 21, base: 12.18, cuota: 2.56 }], iva_espanol: false, nif_destinatario: NIF,
    });
    const fila = construirFila(x, NIF, null);
    expect(fila.tipo).toBe("Sin IVA deducible");
    expect(fila.base).toBe(14.74);
    expect(fila.iva).toBe(0);
    expect(fila.desglose).toEqual([]);
    expect(fila.extraccion.notas).toMatch(/IVA de otro país/);
  });

  it("Ticket sin NIF: no deducible, pide la factura con el NIF", () => {
    const x = extraido({
      base: 20, iva: 4.2, total: 24.2, desglose_iva: [{ tipo_pct: 21, base: 20, cuota: 4.2 }],
      iva_espanol: true, nif_destinatario: null,
    });
    const fila = construirFila(x, NIF, null);
    expect(fila.tipo).toBe("Sin IVA deducible");
    expect(fila.base).toBe(24.2);
    expect(fila.iva).toBe(0);
    expect(fila.extraccion.notas).toMatch(/pide la factura con tu NIF/);
  });

  it("ionos: sin desglose, igual que ahora", () => {
    const x = extraido({ proveedor: "Ionos", base: 1, iva: 0.21, total: 1.21, desglose_iva: [], nif_destinatario: NIF });
    const fila = construirFila(x, NIF, null);
    expect(fila.tipo).toBe("IVA soportado");
    expect(fila.base).toBe(1);
    expect(fila.iva).toBe(0.21);
    expect(fila.desglose).toEqual([]);
  });

  it("gasto en USD con IVA español: cada línea se pasa a euros y suman el total exacto", () => {
    const x = extraido({
      moneda: "USD", base: 70, iva: 12.5, total: 82.5,
      desglose_iva: [
        { tipo_pct: 21, base: 50, cuota: 10.5 },
        { tipo_pct: 10, base: 20, cuota: 2 },
      ],
      nif_destinatario: NIF,
    });
    const fila = construirFila(x, NIF, 1.16); // 1 EUR = 1,16 USD
    expect(fila.base).toBe(60.34);
    expect(fila.iva).toBe(10.78);
    const sumaBase = fila.desglose.reduce((s, l) => s + l.base, 0);
    const sumaCuota = fila.desglose.reduce((s, l) => s + l.cuota, 0);
    expect(Math.round(sumaBase * 100) / 100).toBe(fila.base);
    expect(Math.round(sumaCuota * 100) / 100).toBe(fila.iva);
    expect(fila.tipo).toBe("IVA soportado");
  });

  it("restaurante mixto: desglose con dos tipos y aviso si no cuadra", () => {
    const x = extraido({
      proveedor: "Restaurante", categoria: "restauracion", base: 50, iva: 6.1, total: 56.1,
      desglose_iva: [
        { tipo_pct: 10, base: 40, cuota: 4 },
        { tipo_pct: 21, base: 10, cuota: 2.1 },
      ],
      nif_destinatario: NIF,
    });
    const fila = construirFila(x, NIF, null);
    expect(fila.tipo).toBe("IVA soportado");
    expect(fila.base).toBe(50);
    expect(fila.iva).toBe(6.1);
    expect(fila.desglose).toEqual([
      { pct: 10, base: 40, cuota: 4 },
      { pct: 21, base: 10, cuota: 2.1 },
    ]);
  });
});

describe("construirFila: validarDesglose contra el total impreso", () => {
  it("avisa si el total impreso no coincide, aunque base + iva de la extracción sí cuadren", () => {
    const x = extraido({
      base: 100, iva: 21, total: 123, // la factura trae una propina de 2 € que no está en el desglose
      desglose_iva: [{ tipo_pct: 21, base: 100, cuota: 21 }], nif_destinatario: NIF,
    });
    const fila = construirFila(x, NIF, null);
    expect(fila.extraccion.notas).toMatch(/no coincide con el total/);
  });

  it("sin total impreso, no se comprueba ese punto (pero el resto de avisos siguen)", () => {
    const x = extraido({
      base: 100, iva: 21, total: null,
      desglose_iva: [{ tipo_pct: 5, base: 100, cuota: 5 }], nif_destinatario: NIF,
    });
    const fila = construirFila(x, NIF, null);
    expect(fila.extraccion.notas).not.toMatch(/no coincide con el total/);
    expect(fila.extraccion.notas).toMatch(/5 % no es un tipo de IVA español/);
  });
});

describe("limitesRestauracion", () => {
  const restauranteMixto: GastoCalc = {
    fecha: "2026-11-10",
    base: 50,
    iva: 6.1,
    tipo: "IVA soportado",
    uso: "manutencion",
    manutencion_limite: 26.67,
    desglose: [
      { pct: 10, base: 40, cuota: 4 },
      { pct: 21, base: 10, cuota: 2.1 },
    ],
  };

  it("trabajando fuera: cuenta hasta el límite diario, el IVA se reparte en proporción", () => {
    const r = limitesRestauracion(datos([restauranteMixto]), "2026-12-31");
    const g = r.gastos[0];
    expect(g.iva).toBe(2.9); // 1,90 (10 %) + 1,00 (21 %)
    expect(g.base).toBe(23.77); // 19,02 (10 %) + 4,75 (21 %)
    expect(g.desglose).toEqual([
      { pct: 10, base: 19.02, cuota: 1.9 },
      { pct: 21, base: 4.75, cuota: 1 },
    ]);
  });

  it("dos comidas el mismo día: entre las dos, el límite diario como máximo", () => {
    const comida1: GastoCalc = {
      fecha: "2026-11-10", base: 18, iva: 2, tipo: "IVA soportado", uso: "manutencion", manutencion_limite: 26.67,
      desglose: [{ pct: 10, base: 18, cuota: 1.8 }],
    };
    const comida2: GastoCalc = {
      fecha: "2026-11-10", base: 13, iva: 2, tipo: "IVA soportado", uso: "manutencion", manutencion_limite: 26.67,
      desglose: [{ pct: 10, base: 13, cuota: 1.3 }],
    };
    const r = limitesRestauracion(datos([comida1, comida2]), "2026-12-31");
    const total = r.gastos.reduce((s, g) => s + g.base + g.iva, 0);
    expect(total).toBeLessThanOrEqual(26.68);
  });

  it("1 % de atenciones a clientes: lo que pasa del límite no cuenta", () => {
    const atencion: GastoCalc = { fecha: "2026-11-10", base: 300, iva: 0, tipo: "Sin IVA deducible", uso: "atencion_cliente" };
    // factura de 29.460 € → 1 % = 294,60 €
    const r = limitesRestauracion(datos([atencion], 29460), "2026-12-31");
    expect(r.limite1pctAtenciones).toBe(294.6);
    expect(r.gastos[0].base).toBe(294.6);
    expect(r.disponibleAtenciones).toBe(0);
  });

  it("invité a un cliente: cabe en el 1 %, nada en el 303 ni el 390, cuenta en el 130", () => {
    const atencion: GastoCalc = { fecha: "2026-11-10", base: 56.1, iva: 0, tipo: "Sin IVA deducible", uso: "atencion_cliente" };
    const d = datos([atencion], 29460);
    const r = limitesRestauracion(d, "2026-12-31");
    expect(r.gastos[0].base).toBe(56.1); // cabe entero en el 1 % (294,60 €)
    const m303 = modelo303(d, 2026, 4);
    expect(m303.c28).toBe(0);
    expect(m303.c29).toBe(0);
    const p = pyg(d, "2026-12-31");
    expect(p.gastosFacturas).toBe(56.1);
  });
});

describe("modelo390 con desglose", () => {
  it("reparte el restaurante mixto entre 603/604 (10 %) y 605/606 (21 %)", () => {
    const restauranteMixto: GastoCalc = {
      fecha: "2026-11-10", base: 50, iva: 6.1, tipo: "IVA soportado", uso: "manutencion", manutencion_limite: 26.67,
      desglose: [
        { pct: 10, base: 40, cuota: 4 },
        { pct: 21, base: 10, cuota: 2.1 },
      ],
    };
    const m = modelo390(datos([restauranteMixto]), 2026);
    expect(m.c603).toBe(19.02);
    expect(m.c604).toBe(1.9);
    expect(m.c605).toBe(4.75);
    expect(m.c606).toBe(1);
  });

  it("luz en noviembre: un solo tipo, 603/604", () => {
    const luz: GastoCalc = { fecha: "2026-11-05", base: 60, iva: 6, tipo: "IVA soportado", desglose: [{ pct: 10, base: 60, cuota: 6 }] };
    const m = modelo390(datos([luz]), 2026);
    expect(m.c603).toBe(60);
    expect(m.c604).toBe(6);
  });

  it("ionos (sin desglose) sigue usando tipoSoportado()", () => {
    const ionos: GastoCalc = { fecha: "2026-11-05", base: 1, iva: 0.21, tipo: "IVA soportado" };
    const m = modelo390(datos([ionos]), 2026);
    expect(m.c605).toBeCloseTo(1, 2);
    expect(m.c606).toBeCloseTo(0.21, 2);
  });
});

describe("303, casilla 28", () => {
  it("solo suma las bases de las líneas con pct > 0", () => {
    const g: GastoCalc = {
      fecha: "2026-11-05", base: 100, iva: 4, tipo: "IVA soportado",
      desglose: [
        { pct: 0, base: 50, cuota: 0 },
        { pct: 4, base: 50, cuota: 4 },
      ],
    };
    const m = modelo303(datos([g]), 2026, 4);
    expect(m.c28).toBe(50);
    expect(m.c29).toBe(4);
  });

  it("gasto español sin IVA y sin desglose: no suma base ni da error en el 390", () => {
    const g: GastoCalc = { fecha: "2026-11-05", base: 30, iva: 0, tipo: "IVA soportado" };
    const m303 = modelo303(datos([g]), 2026, 4);
    expect(m303.c28).toBe(0);
    expect(m303.c29).toBe(0);
    expect(() => modelo390(datos([g]), 2026)).not.toThrow();
    const m390 = modelo390(datos([g]), 2026);
    expect(m390.c48).toBe(0);
    expect(m390.c49).toBe(0);
  });
});

describe("atención a cliente tras una corrección", () => {
  it("un gasto ya marcado como atención a cliente no entra en las casillas 28/29 ni rompe el 390", () => {
    // Simula un gasto que sigue con tipo «IVA soportado» en la base de datos (por ejemplo, tras
    // corregirlo con Claude sin pasar por aplicarCorreccion) pero con uso = atencion_cliente.
    const g: GastoCalc = {
      fecha: "2026-11-10", base: 50, iva: 6.1, tipo: "IVA soportado", uso: "atencion_cliente",
      desglose: [
        { pct: 10, base: 40, cuota: 4 },
        { pct: 21, base: 10, cuota: 2.1 },
      ],
    };
    const d = datos([g], 29460);
    const m303 = modelo303(d, 2026, 4);
    expect(m303.c28).toBe(0);
    expect(m303.c29).toBe(0);
    expect(() => modelo390(d, 2026)).not.toThrow();
  });
});

describe("manutención sin desglose", () => {
  it("un ticket sin NIF de 60 € marcado como manutención cuenta hasta el límite diario", () => {
    const g: GastoCalc = {
      fecha: "2026-11-10", base: 60, iva: 0, tipo: "Sin IVA deducible", uso: "manutencion", manutencion_limite: 26.67,
    };
    const p = pyg(datos([g]), "2026-12-31");
    expect(p.gastosFacturas).toBe(26.67);
  });
});
