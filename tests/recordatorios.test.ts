// Aviso de fin de mes con los gastos: proveedores recurrentes de los que aún no hay factura del
// mes en curso. Ver docs/planes/2026-11-23-retoques-tras-la-puesta-en-marcha.md.
import { describe, expect, it } from "vitest";
import { cambiosGastos, proveedoresQueFaltan, suscripciones, type GastoProveedor } from "../lib/recordatorios";

const HOY = "2026-11-23";
const g = (
  proveedor: string,
  fecha: string,
  estado: GastoProveedor["estado"] = "confirmado",
  nif: string | null = null,
  importe = 0,
): GastoProveedor => ({
  proveedor,
  nif,
  fecha,
  estado,
  importe,
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

describe("suscripciones", () => {
  it("Cursor recurrente y con gasto en octubre (último mes cerrado): activa, con la pista de que ha subido", () => {
    const gastos = [
      g("Cursor", "2026-07-05", "confirmado", null, 17),
      g("Cursor", "2026-08-05", "confirmado", null, 17),
      g("Cursor", "2026-09-05", "confirmado", null, 17),
      g("Cursor", "2026-10-05", "confirmado", null, 72),
    ];
    const r = suscripciones(gastos, HOY);
    expect(r.activas).toEqual([{ nombre: "Cursor", costeMes: 72, cambio: { tipo: "sube", antes: 17 } }]);
    expect(r.sinFacturaUltimoMes).toEqual([]);
  });

  it("recurrente (agosto y septiembre) pero sin gasto en octubre: fila gris, no activa", () => {
    const gastos = [g("Apify", "2026-08-10", "confirmado", null, 25), g("Apify", "2026-09-10", "confirmado", null, 25)];
    const r = suscripciones(gastos, HOY);
    expect(r.activas).toEqual([]);
    expect(r.sinFacturaUltimoMes).toEqual([{ nombre: "Apify" }]);
  });

  it("un solo mes, ni recurrente ni activa", () => {
    const gastos = [g("Figma", "2026-10-10", "confirmado", null, 15)];
    const r = suscripciones(gastos, HOY);
    expect(r.activas).toEqual([]);
    expect(r.sinFacturaUltimoMes).toEqual([]);
  });
});

describe("cambiosGastos", () => {
  it("Cursor 17 → 72 € en octubre es «Sube»", () => {
    const gastos = [
      g("Cursor", "2026-07-05", "confirmado", null, 17),
      g("Cursor", "2026-08-05", "confirmado", null, 17),
      g("Cursor", "2026-09-05", "confirmado", null, 17),
      g("Cursor", "2026-10-05", "confirmado", null, 72),
    ];
    expect(cambiosGastos(gastos, HOY)).toEqual([{ nombre: "Cursor", tipo: "sube", antes: 17 }]);
  });

  it("baja al menos un 50 % y 10 €: «Baja»", () => {
    const gastos = [
      g("Fly.io", "2026-07-05", "confirmado", null, 40),
      g("Fly.io", "2026-08-05", "confirmado", null, 40),
      g("Fly.io", "2026-09-05", "confirmado", null, 40),
      g("Fly.io", "2026-10-05", "confirmado", null, 5),
    ];
    expect(cambiosGastos(gastos, HOY)).toEqual([{ nombre: "Fly.io", tipo: "baja", antes: 40 }]);
  });

  it("activa pero sin gasto en el último mes cerrado: «sin_factura»", () => {
    const gastos = [
      g("Zoho", "2026-08-05", "confirmado", null, 20),
      g("Zoho", "2026-09-05", "confirmado", null, 20),
    ];
    expect(cambiosGastos(gastos, HOY)).toEqual([{ nombre: "Zoho", tipo: "sin_factura" }]);
  });

  it("cambio pequeño (menos del 50 % o menos de 10 €): no sale", () => {
    const gastos = [
      g("Ionos", "2026-07-05", "confirmado", null, 10),
      g("Ionos", "2026-08-05", "confirmado", null, 10),
      g("Ionos", "2026-09-05", "confirmado", null, 10),
      g("Ionos", "2026-10-05", "confirmado", null, 11),
    ];
    expect(cambiosGastos(gastos, HOY)).toEqual([]);
  });
});
