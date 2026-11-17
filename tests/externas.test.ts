import { describe, expect, it } from "vitest";
import { esPropia, modoParalelo, nifSinPais, normalizarNumero, pistasDePropia, siguienteNumero } from "../lib/externas";

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
  it("detecta pistas de factura propia", () => {
    const ajustes = { nombre: "Jose Bautista Gallego", nif: "00000000T", serie: "", digitos_numero: 5, ultimo_numero: 336 };
    const clientes = [{ nombre: "Zapflow Oy", nif: "FI26899624" }];
    const base = { proveedor: null, numero_factura: null, nif_destinatario: null };

    expect(pistasDePropia({ ...base, proveedor: "José Bautista" }, ajustes, clientes)).toEqual([{ tipo: "nombre", texto: "el emisor se llama como tú" }]);
    expect(pistasDePropia({ ...base, proveedor: "BAUTISTA GALLEGO, JOSE" }, ajustes, clientes)).toEqual([{ tipo: "nombre", texto: "el emisor se llama como tú" }]);
    expect(pistasDePropia({ ...base, proveedor: "Gallego Hermanos SL" }, ajustes, clientes)).toEqual([]);

    expect(pistasDePropia({ ...base, numero_factura: "337" }, ajustes, clientes)).toEqual([{ tipo: "numero", texto: "el número 00337 es el siguiente de tu serie" }]);
    expect(pistasDePropia({ ...base, numero_factura: "00337" }, ajustes, clientes)).toEqual([{ tipo: "numero", texto: "el número 00337 es el siguiente de tu serie" }]);
    expect(pistasDePropia({ ...base, numero_factura: "00338" }, ajustes, clientes)).toEqual([]);
    expect(pistasDePropia({ ...base, numero_factura: "97A706DA-1920528" }, ajustes, clientes)).toEqual([]);

    expect(pistasDePropia({ ...base, nif_destinatario: "FI 26899624" }, ajustes, clientes)).toEqual([{ tipo: "cliente", texto: "el cliente es Zapflow Oy, uno de los tuyos" }]);
    expect(pistasDePropia({ ...base, nif_destinatario: ajustes.nif }, ajustes, clientes)).toEqual([]);

    expect(
      pistasDePropia({ proveedor: "Framer B.V.", numero_factura: "INV-2026-9981", nif_destinatario: ajustes.nif }, ajustes, clientes),
    ).toEqual([]);

    expect(
      pistasDePropia(
        { proveedor: "BAUTISTA GALLEGO, JOSE", numero_factura: "00337", nif_destinatario: "FI26899624" },
        ajustes,
        clientes,
      ),
    ).toEqual([
      { tipo: "nombre", texto: "el emisor se llama como tú" },
      { tipo: "numero", texto: "el número 00337 es el siguiente de tu serie" },
      { tipo: "cliente", texto: "el cliente es Zapflow Oy, uno de los tuyos" },
    ]);
  });
});
