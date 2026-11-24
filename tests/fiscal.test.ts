import { describe, expect, it } from "vitest";
import {
  calcularImportes, clasificarGasto, euros, formatoSede, pct, plazoAbierto, plazoTrimestral, rangoTrimestre, tipoClientePorPais,
} from "../lib/fiscal";
import { avisosDeHoy } from "../lib/recordatorios";
import { generarFacturaPDF, limpiar } from "../lib/pdf";

describe("clasificarGasto", () => {
  const ok = { ivaEspanol: true, aMiNombre: true };
  it("proveedor español o con IVA español a mi nombre → IVA soportado", () => {
    expect(clasificarGasto("ES", 2.42, ok)).toBe("IVA soportado");
    expect(clasificarGasto("GB", 0.94, ok)).toBe("IVA soportado");
  });
  it("UE sin IVA → ISP UE; resto → ISP fuera UE", () => {
    expect(clasificarGasto("IE", 0, ok)).toBe("ISP UE");
    expect(clasificarGasto("ee", 0, ok)).toBe("ISP UE");
    expect(clasificarGasto("US", 0, ok)).toBe("ISP fuera UE");
    expect(clasificarGasto("CH", 0, ok)).toBe("ISP fuera UE");
    expect(clasificarGasto(null, 0, ok)).toBe("ISP fuera UE");
  });
  it("IVA no español, o español sin mi NIF → Sin IVA deducible", () => {
    expect(clasificarGasto("GB", 2.56, { ivaEspanol: false, aMiNombre: true })).toBe("Sin IVA deducible");
    expect(clasificarGasto("ES", 4.2, { ivaEspanol: true, aMiNombre: false })).toBe("Sin IVA deducible");
  });
});

describe("calcularImportes", () => {
  it("cliente nacional: 21% IVA y 15% retención (Volta 00333)", () => {
    expect(calcularImportes({ tipo: "nacional", iva_pct: 21, retencion_pct: 15 }, 1020)).toMatchObject({
      iva: 214.2, retencion: 153, total: 1081.2, mencion: null,
    });
  });
  it("cliente UE: sin IVA, con mención de inversión del sujeto pasivo", () => {
    const r = calcularImportes({ tipo: "ue", iva_pct: 21, retencion_pct: 15 }, 3060);
    expect(r).toMatchObject({ iva: 0, retencion: 0, total: 3060 });
    expect(r.mencion).toMatch(/sujeto pasivo/);
  });
  it("cliente fuera UE: no sujeta", () => {
    expect(calcularImportes({ tipo: "fuera_ue", iva_pct: 21, retencion_pct: 15 }, 500).mencion).toMatch(/art. 69/);
  });
  it("tipo de cliente por país", () => {
    expect(tipoClientePorPais("FI")).toBe("ue");
    expect(tipoClientePorPais("es")).toBe("nacional");
    expect(tipoClientePorPais("GB")).toBe("fuera_ue");
  });
});

describe("plazos", () => {
  it("4T 2026 acaba el lunes 1 feb 2027 (el 30 ene es sábado)", () => {
    expect(plazoTrimestral(2026, 4)).toMatchObject({ apertura: "2027-01-01", fin: "2027-02-01" });
  });
  it("3T 2026 acaba el 20 oct", () => {
    expect(plazoTrimestral(2026, 3).fin).toBe("2026-10-20");
  });
  it("plazo abierto", () => {
    expect(plazoAbierto("2026-11-17")).toBeNull();
    expect(plazoAbierto("2027-01-15")?.t).toBe(4);
    expect(plazoAbierto("2026-04-05")).toMatchObject({ anio: 2026, t: 1 });
  });
  it("rango de trimestre", () => {
    expect(rangoTrimestre(2026, 4)).toEqual({ desde: "2026-10-01", hasta: "2026-12-31" });
    expect(rangoTrimestre(2026, 1)).toEqual({ desde: "2026-01-01", hasta: "2026-03-31" });
  });
});

describe("avisos", () => {
  it("apertura del plazo el 1 de enero", () => {
    const a = avisosDeHoy("2027-01-01", new Set());
    expect(a.map((x) => x.clave)).toEqual(["2026-4T-apertura"]);
  });
  it("a 10 días, y no repite", () => {
    const enviados = new Set(["2026-4T-apertura"]);
    expect(avisosDeHoy("2027-01-22", enviados).map((x) => x.clave)).toEqual(["2026-4T-d10"]);
    enviados.add("2026-4T-d10");
    expect(avisosDeHoy("2027-01-23", enviados)).toEqual([]);
  });
  it("si se salta días, manda solo el más urgente y marca los demás", () => {
    const a = avisosDeHoy("2027-01-31", new Set());
    expect(a[0].clave).toBe("2026-4T-d1");
    expect(a[0].tambien).toEqual(expect.arrayContaining(["2026-4T-d10", "2026-4T-d3", "2026-4T-apertura"]));
  });
  it("día 28: recordatorio de facturar", () => {
    expect(avisosDeHoy("2026-11-28", new Set()).map((x) => x.clave)).toEqual(["facturar-2026-11"]);
  });
});

describe("formato y PDF", () => {
  it("euros", () => {
    expect(euros(3060)).toBe("3.060,00 €");
    expect(euros(1081.2)).toBe("1.081,20 €");
    expect(euros(-4.98)).toBe("-4,98 €");
  });
  it("pct: sin decimales redondea, con decimales usa coma", () => {
    expect(pct(70)).toBe("70 %");
    expect(pct(7.6, 1)).toBe("7,6 %");
    expect(pct(26.4)).toBe("26 %");
  });
  it("formatoSede: sin separador de miles, coma decimal, negativos con -", () => {
    expect(formatoSede(1216.02)).toBe("1216,02");
    expect(formatoSede(-32.38)).toBe("-32,38");
    expect(formatoSede(0)).toBe("0,00");
    expect(formatoSede(4433.456)).toBe("4433,46");
  });
  it("limpia caracteres que la fuente no pinta", () => {
    expect(limpiar("Disseny i implementació · ✓ → 中")).toBe("Disseny i implementació · ? ? ?");
  });
  it("genera un PDF", async () => {
    const pdf = await generarFacturaPDF({
      numero: "00337", fecha: "2026-11-30", idioma: "en",
      emisor: { nombre: "Test", nif: "00000000T", direccion: "Calle 1", iban: "ES00 0000" },
      cliente: { nombre: "Cliente Oy", nif: "FI00000000", direccion: "Street 1", pais: "Finland" },
      concepto: "UX services", base: 3060, iva_pct: 0, iva: 0, retencion_pct: 0, retencion: 0, total: 3060,
      mencion: "Reverse charge",
    });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
