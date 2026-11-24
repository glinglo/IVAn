import { describe, expect, it } from "vitest";
import { siguientesPasos, type ContextoPasos, type Libro } from "../lib/libro";
import type { Ajustes } from "../lib/db";

const ajustes = (over: Partial<Ajustes> = {}): Ajustes => ({
  nombre: "Jose",
  nif: "00000000A",
  direccion: "Calle Falsa 1",
  email: null,
  telefono: null,
  iban: "ES0000000000000000000000",
  serie: "2026",
  ultimo_numero: 1,
  digitos_numero: 5,
  cuota_autonomo_mensual: 300,
  iva_compensar_inicial: 0,
  emitir_desde: null,
  ...over,
});

const libro = (over: Partial<Libro> = {}): Libro => ({
  anio: 2026,
  ajustes: ajustes(),
  facturas: [],
  gastos: [],
  presentaciones: [],
  datos: { facturas: [], gastos: [], cuotaMes: () => 300, bienes: [], pagado130: () => null, ivaCompensarInicial: 0 },
  bienesAproximados: 0,
  cuotasRegistradas: 12,
  ...over,
});

const ctx = (over: Partial<ContextoPasos> = {}): ContextoPasos => ({
  hoy: "2026-11-23",
  libro: libro(),
  libroAnterior: null,
  gastosPorConfirmar: 0,
  clientesSinDireccion: [],
  ...over,
});

describe("siguientesPasos: clave de cada paso", () => {
  it("23/11: el 4T no ha abierto, el paso de plazo es solo informativo", () => {
    const pasos = siguientesPasos(ctx());
    expect(pasos.every((p) => p.clave)).toBe(true);
    expect(pasos.find((p) => p.clave === "plazo" && p.nivel !== "info")).toBeUndefined();
  });

  it("28/11: facturar un cliente del mes pasado sin factura este mes, clave 'facturar'", () => {
    const l = libro({
      facturas: [
        {
          id: "1",
          numero: "1",
          fecha: "2026-10-05",
          cliente: "Acme",
          nif_cliente: null,
          concepto: "Servicios",
          base: 1000,
          iva_pct: 21,
          iva: 210,
          retencion: 0,
          total: 1210,
          tipo: "nacional",
          pdf_path: null,
        },
      ],
    });
    const pasos = siguientesPasos(ctx({ hoy: "2026-11-28", libro: l }));
    const paso = pasos.find((p) => p.clave === "facturar");
    expect(paso).toBeDefined();
    expect(paso?.nivel).toBe("pendiente");
    expect(paso?.texto).toBe("Facturar este mes a Acme");
  });

  it("28/11 en modo paralelo: el paso de facturar dice que lo emite Selfconta", () => {
    const l = libro({
      ajustes: { ...libro().ajustes, emitir_desde: "2027-01-01" },
      facturas: [
        {
          id: "1",
          numero: "1",
          fecha: "2026-10-05",
          cliente: "Acme",
          nif_cliente: null,
          concepto: "Servicios",
          base: 1000,
          iva_pct: 21,
          iva: 210,
          retencion: 0,
          total: 1210,
          tipo: "nacional",
          pdf_path: null,
        },
      ],
    });
    const pasos = siguientesPasos(ctx({ hoy: "2026-11-28", libro: l }));
    const paso = pasos.find((p) => p.clave === "facturar");
    expect(paso?.texto).toBe("Registrar la factura de noviembre de Acme");
    expect(paso?.detalle).toBe("La emite Selfconta: mándale el PDF al bot");
  });

  it("29/01: plazo del 4T del año anterior abierto, clave 'plazo'", () => {
    const anterior = libro({ anio: 2026 });
    const pasos = siguientesPasos(ctx({ hoy: "2027-01-29", libro: libro({ anio: 2027 }), libroAnterior: anterior }));
    const paso = pasos.find((p) => p.clave === "plazo");
    expect(paso).toBeDefined();
    expect(paso?.href).toBe("/impuestos/2026/4");
  });

  it("gastos sin confirmar, IBAN y Mac aproximado llevan su clave", () => {
    const l = libro({ ajustes: ajustes({ iban: null }), bienesAproximados: 1 });
    const pasos = siguientesPasos(ctx({ libro: l, gastosPorConfirmar: 2 }));
    expect(pasos.find((p) => p.clave === "gastos")).toBeDefined();
    expect(pasos.find((p) => p.clave === "iban")).toBeDefined();
    expect(pasos.find((p) => p.clave === "mac")).toBeDefined();
  });

  it("cliente sin dirección lleva clave 'direccion'", () => {
    const pasos = siguientesPasos(ctx({ clientesSinDireccion: ["Acme"] }));
    expect(pasos.find((p) => p.clave === "direccion")).toBeDefined();
  });
});
