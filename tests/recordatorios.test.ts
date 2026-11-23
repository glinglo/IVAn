// Aviso de fin de mes con los gastos: proveedores recurrentes de los que aún no hay factura del
// mes en curso. Ver docs/planes/2026-11-23-retoques-tras-la-puesta-en-marcha.md.
import { describe, expect, it } from "vitest";
import { proveedoresQueFaltan, type GastoProveedor } from "../lib/recordatorios";

const HOY = "2026-11-23";
const g = (proveedor: string, fecha: string, estado: GastoProveedor["estado"] = "confirmado", nif: string | null = null): GastoProveedor => ({
  proveedor,
  nif,
  fecha,
  estado,
});

describe("proveedoresQueFaltan", () => {
  it("Cursor en agosto, septiembre y octubre, nada en noviembre: falta", () => {
    const gastos = [g("Cursor", "2026-08-05"), g("Cursor", "2026-09-05"), g("Cursor", "2026-10-05")];
    expect(proveedoresQueFaltan(gastos, HOY).faltan).toEqual(["Cursor"]);
  });

  it("Cursor solo en agosto: no es recurrente, no falta", () => {
    const gastos = [g("Cursor", "2026-08-05")];
    const r = proveedoresQueFaltan(gastos, HOY);
    expect(r.faltan).toEqual([]);
    expect(r.nuevos).toEqual([]);
  });

  it('"Figma, Inc." y "FIGMA INC" son el mismo proveedor', () => {
    const gastos = [g("Figma, Inc.", "2026-08-10"), g("FIGMA INC", "2026-09-10"), g("Figma Inc.", "2026-10-10")];
    expect(proveedoresQueFaltan(gastos, HOY).faltan).toEqual(["Figma, Inc."]);
  });

  it("un gasto de Cursor de noviembre en borrador: no falta", () => {
    const gastos = [
      g("Cursor", "2026-08-05"), g("Cursor", "2026-09-05"), g("Cursor", "2026-10-05"),
      g("Cursor", "2026-11-05", "borrador"),
    ];
    expect(proveedoresQueFaltan(gastos, HOY).faltan).toEqual([]);
  });

  it("Supabase solo en octubre: nuevo el mes pasado, no en la lista de recurrentes", () => {
    const gastos = [g("Supabase", "2026-10-15")];
    const r = proveedoresQueFaltan(gastos, HOY);
    expect(r.faltan).toEqual([]);
    expect(r.nuevos).toEqual(["Supabase"]);
  });

  it("Supabase en octubre y en noviembre: no sale en ninguna lista", () => {
    const gastos = [g("Supabase", "2026-10-15"), g("Supabase", "2026-11-15")];
    const r = proveedoresQueFaltan(gastos, HOY);
    expect(r.faltan).toEqual([]);
    expect(r.nuevos).toEqual([]);
  });

  it("se identifica por NIF cuando lo hay, aunque el nombre cambie", () => {
    const gastos = [
      g("Google Cloud EMEA Ltd", "2026-08-05", "confirmado", "IE123"),
      g("Google Ireland Limited", "2026-09-05", "confirmado", "IE123"),
      g("Google Cloud", "2026-10-05", "confirmado", "IE123"),
    ];
    expect(proveedoresQueFaltan(gastos, HOY).faltan).toEqual(["Google Cloud EMEA Ltd"]);
  });

  it("un gasto descartado no cuenta para nada", () => {
    const gastos = [
      g("Cursor", "2026-08-05", "descartado"), g("Cursor", "2026-09-05", "descartado"), g("Cursor", "2026-10-05", "descartado"),
    ];
    const r = proveedoresQueFaltan(gastos, HOY);
    expect(r.faltan).toEqual([]);
    expect(r.nuevos).toEqual([]);
  });
});
