import ExcelJS from "exceljs";
import { cargarLibro, resumenTrimestre } from "./libro";
import { pyg } from "./calculo";
import { rangoTrimestre } from "./fiscal";

const EUR = '#,##0.00 "€"';

function hoja(wb: ExcelJS.Workbook, nombre: string, columnas: { header: string; key: string; width: number; eur?: boolean }[]) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.eur ? { numFmt: EUR } : {} }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F3F3" } };
  return ws;
}

export async function exportarXlsx(anio: number): Promise<ArrayBuffer> {
  const libro = await cargarLibro(anio);
  const wb = new ExcelJS.Workbook();
  wb.creator = "IVAn";

  const ventas = hoja(wb, "Ventas", [
    { header: "Nº", key: "numero", width: 10 },
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Cliente", key: "cliente", width: 24 },
    { header: "NIF/VAT", key: "nif_cliente", width: 16 },
    { header: "Concepto", key: "concepto", width: 50 },
    { header: "Base", key: "base", width: 12, eur: true },
    { header: "IVA", key: "iva", width: 10, eur: true },
    { header: "Retención", key: "retencion", width: 11, eur: true },
    { header: "Total", key: "total", width: 12, eur: true },
  ]);
  [...libro.facturas].reverse().forEach((f) => ventas.addRow({ ...f, fecha: new Date(f.fecha) }));

  const gastos = hoja(wb, "Gastos", [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Proveedor", key: "proveedor", width: 28 },
    { header: "País", key: "pais", width: 6 },
    { header: "NIF/VAT", key: "nif", width: 16 },
    { header: "Nº factura", key: "numero_factura", width: 20 },
    { header: "Concepto", key: "concepto", width: 28 },
    { header: "Tipo IVA", key: "tipo", width: 16 },
    { header: "Base", key: "base", width: 12, eur: true },
    { header: "IVA soportado", key: "iva", width: 13, eur: true },
  ]);
  [...libro.gastos].reverse().forEach((g) => gastos.addRow({ ...g, fecha: new Date(g.fecha) }));

  const tri = hoja(wb, "Trimestres", [
    { header: "Casilla", key: "casilla", width: 46 },
    { header: "1T", key: "t1", width: 13, eur: true },
    { header: "2T", key: "t2", width: 13, eur: true },
    { header: "3T", key: "t3", width: 13, eur: true },
    { header: "4T", key: "t4", width: 13, eur: true },
  ]);
  const r = [1, 2, 3, 4].map((t) => resumenTrimestre(libro, t));
  const fila = (casilla: string, f: (x: (typeof r)[number]) => number) =>
    tri.addRow({ casilla, t1: f(r[0]), t2: f(r[1]), t3: f(r[2]), t4: f(r[3]) });
  tri.addRow({ casilla: "MODELO 303 · IVA" }).font = { bold: true };
  fila("[01] Base 21 %", (x) => x.m303.c01);
  fila("[03] Cuota 21 %", (x) => x.m303.c03);
  fila("[10] Base adquisiciones intracomunitarias (ISP)", (x) => x.m303.c10);
  fila("[11] Cuota", (x) => x.m303.c11);
  fila("[12] Base otras ISP (fuera UE)", (x) => x.m303.c12);
  fila("[13] Cuota", (x) => x.m303.c13);
  fila("[27] Total devengado", (x) => x.m303.c27);
  fila("[28] Base deducible interiores", (x) => x.m303.c28);
  fila("[29] Cuota deducible interiores", (x) => x.m303.c29);
  fila("[36] Base deducible intracomunitarias", (x) => x.m303.c36);
  fila("[37] Cuota deducible intracomunitarias", (x) => x.m303.c37);
  fila("[45] Total a deducir", (x) => x.m303.c45);
  fila("[46] Resultado régimen general", (x) => x.m303.c46);
  fila("[59] Servicios a empresas UE", (x) => x.m303.c59);
  fila("[120] No sujetas (fuera UE)", (x) => x.m303.c120);
  fila("[110] A compensar de periodos anteriores", (x) => x.m303.c110);
  fila("[78] Compensación aplicada", (x) => x.m303.c78);
  fila("[71] RESULTADO 303", (x) => x.m303.c71).font = { bold: true };
  tri.addRow({});
  tri.addRow({ casilla: "MODELO 130 · IRPF (acumulado)" }).font = { bold: true };
  fila("[01] Ingresos", (x) => x.m130.c01);
  fila("[02] Gastos deducibles", (x) => x.m130.c02);
  fila("[03] Rendimiento neto", (x) => x.m130.c03);
  fila("[04] 20 %", (x) => x.m130.c04);
  fila("[05] Pagos anteriores", (x) => x.m130.c05);
  fila("[06] Retenciones", (x) => x.m130.c06);
  fila("[07]/[19] RESULTADO 130", (x) => x.m130.aIngresar).font = { bold: true };

  const pl = hoja(wb, "P&L", [
    { header: "Concepto", key: "c", width: 46 },
    { header: "Importe", key: "v", width: 14, eur: true },
  ]);
  const p = pyg(libro.datos, rangoTrimestre(anio, 4).hasta);
  [
    ["Ingresos", p.ingresos],
    ["Gastos con factura", p.gastosFacturas],
    ["Seguridad Social del titular", p.seguridadSocial],
    ["Amortizaciones", p.amortizaciones],
    ["Diferencia", p.diferencia],
    ["Gastos de difícil justificación (5 %)", p.dificilJustificacion],
    ["Rendimiento neto", p.rendimientoNeto],
    ["Retenciones soportadas", p.retenciones],
  ].forEach(([c, v]) => pl.addRow({ c, v }));

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
