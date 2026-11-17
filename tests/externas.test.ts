import { describe, expect, it } from "vitest";
import { esPropia, modoParalelo, nifSinPais, normalizarNumero, siguienteNumero } from "../lib/externas";

describe("facturas de otro programa (modo paralelo)", () => {
  const a = { serie: "", digitos_numero: 5, ultimo_numero: 336 };
  it("normaliza el número a la serie", () => {
    expect(normalizarNumero("337", a)).toBe("00337");
    expect(normalizarNumero("00337", a)).toBe("00337");
    expect(normalizarNumero(" 00337 ", a)).toBe("00337");
    expect(normalizarNumero("2026/00337", a)).toBe("2026/00337");
    expect(normalizarNumero("A-12", { serie: "A-", digitos_numero: 4 })).toBe("A-0012");
    expect(siguienteNumero(a)).toBe("00337");
  });
  it("reconoce las facturas emitidas por uno mismo", () => {
    expect(esPropia("ES00000000T", "00000000T")).toBe(true);
    expect(esPropia("00000000-T", "00000000T")).toBe(true);
    expect(esPropia("B23853039", "00000000T")).toBe(false);
    expect(esPropia(null, "00000000T")).toBe(false);
  });
  it("compara NIF sin prefijo de país", () => {
    expect(nifSinPais("FI26899624")).toBe("26899624");
    expect(nifSinPais("B23853039")).toBe("B23853039");
    expect(nifSinPais("X1234567L")).toBe("X1234567L");
    expect(nifSinPais("NL 853695386 B01")).toBe("853695386B01");
  });
  it("modo paralelo hasta la fecha indicada, sin incluirla", () => {
    expect(modoParalelo({ emitir_desde: "2027-01-01" }, "2026-12-31")).toBe(true);
    expect(modoParalelo({ emitir_desde: "2027-01-01" }, "2027-01-01")).toBe(false);
    expect(modoParalelo({ emitir_desde: null }, "2026-12-31")).toBe(false);
  });
});
