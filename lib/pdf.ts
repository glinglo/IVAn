import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { euros, fechaES } from "./fiscal";

export interface DatosPDF {
  numero: string;
  fecha: string; // YYYY-MM-DD
  idioma: "es" | "en";
  emisor: { nombre: string; nif: string; direccion: string; email?: string | null; telefono?: string | null; iban?: string | null };
  cliente: { nombre: string; nif?: string | null; direccion?: string | null; pais?: string | null };
  concepto: string;
  base: number;
  iva_pct: number;
  iva: number;
  retencion_pct: number;
  retencion: number;
  total: number;
  mencion?: string | null;
}

// Las fuentes estándar de PDF usan WinAnsi: cambiamos lo que no sepan pintar.
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function limpiar(texto: string): string {
  return [...texto.normalize("NFC")]
    .map((ch) => {
      const c = ch.codePointAt(0)!;
      if (ch === "\n") return " ";
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.includes(ch)) return ch;
      if (c === 0x202f || c === 0x2009) return " ";
      return "?";
    })
    .join("");
}

function partir(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of limpiar(texto).split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(prueba, size) <= ancho) actual = prueba;
    else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

const T = {
  es: {
    titulo: "FACTURA", numero: "Nº factura", fecha: "Fecha", emisor: "Emisor", cliente: "Cliente",
    concepto: "Concepto", importe: "Importe", base: "Base imponible", iva: "IVA", ret: "Retención IRPF",
    total: "Total", pago: "Forma de pago: transferencia bancaria", nif: "NIF",
  },
  en: {
    titulo: "FACTURA / INVOICE", numero: "Nº factura / Invoice no.", fecha: "Fecha / Date", emisor: "Emisor / From",
    cliente: "Cliente / Bill to", concepto: "Concepto / Description", importe: "Importe / Amount",
    base: "Base imponible / Subtotal", iva: "IVA / VAT", ret: "Retención IRPF / Withholding", total: "Total",
    pago: "Pago por transferencia / Payment by bank transfer", nif: "NIF / VAT",
  },
};

export async function generarFacturaPDF(d: DatosPDF): Promise<Uint8Array> {
  const t = T[d.idioma];
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Factura ${d.numero}`);
  pdf.setAuthor(limpiar(d.emisor.nombre));
  const page: PDFPage = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const negro = rgb(0.1, 0.1, 0.1);
  const gris = rgb(0.45, 0.45, 0.45);
  const linea = rgb(0.85, 0.85, 0.85);
  const M = 50;
  const W = 595.28 - 2 * M;

  const texto = (s: string, x: number, y: number, o: { size?: number; f?: PDFFont; color?: typeof negro } = {}) =>
    page.drawText(limpiar(s), { x, y, size: o.size ?? 10, font: o.f ?? font, color: o.color ?? negro });
  const derecha = (s: string, xDcha: number, y: number, o: { size?: number; f?: PDFFont } = {}) => {
    const f = o.f ?? font;
    const size = o.size ?? 10;
    texto(s, xDcha - f.widthOfTextAtSize(limpiar(s), size), y, { size, f });
  };

  let y = 790;
  texto(t.titulo, M, y, { size: 20, f: bold });
  derecha(`${t.numero}: ${d.numero}`, M + W, y + 4, { f: bold });
  derecha(`${t.fecha}: ${fechaES(d.fecha)}`, M + W, y - 12);

  // Emisor y cliente en dos columnas
  y -= 50;
  const col = W / 2;
  texto(t.emisor, M, y, { size: 8, color: gris });
  texto(t.cliente, M + col, y, { size: 8, color: gris });
  y -= 14;
  const bloque = (lineas: (string | null | undefined)[], x: number, yIni: number) => {
    let yy = yIni;
    lineas.filter(Boolean).forEach((l, i) => {
      for (const parte of partir(l!, i === 0 ? bold : font, 10, col - 20)) {
        texto(parte, x, yy, { f: i === 0 ? bold : font });
        yy -= 13;
      }
    });
    return yy;
  };
  const yE = bloque(
    [d.emisor.nombre, `${t.nif}: ${d.emisor.nif}`, d.emisor.direccion, d.emisor.email, d.emisor.telefono],
    M,
    y,
  );
  const yC = bloque(
    [d.cliente.nombre, d.cliente.nif ? `${t.nif}: ${d.cliente.nif}` : null, d.cliente.direccion, d.cliente.pais],
    M + col,
    y,
  );
  y = Math.min(yE, yC) - 25;

  // Tabla de conceptos
  page.drawRectangle({ x: M, y: y - 6, width: W, height: 20, color: rgb(0.95, 0.95, 0.95) });
  texto(t.concepto, M + 8, y, { f: bold, size: 9 });
  derecha(t.importe, M + W - 8, y, { f: bold, size: 9 });
  y -= 24;
  const lineasConcepto = partir(d.concepto, font, 10, W - 140);
  derecha(euros(d.base), M + W - 8, y);
  for (const l of lineasConcepto) {
    texto(l, M + 8, y);
    y -= 14;
  }
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: linea });

  // Totales
  y -= 22;
  const xEtiqueta = M + W - 260;
  const fila = (etiqueta: string, valor: string, f: PDFFont = font, size = 10) => {
    texto(etiqueta, xEtiqueta, y, { f, size });
    derecha(valor, M + W - 8, y, { f, size });
    y -= 16;
  };
  fila(t.base, euros(d.base));
  fila(`${t.iva} (${d.iva_pct}%)`, euros(d.iva));
  if (d.retencion > 0) fila(`${t.ret} (${d.retencion_pct}%)`, `-${euros(d.retencion)}`);
  y -= 2;
  page.drawLine({ start: { x: xEtiqueta, y: y + 10 }, end: { x: M + W, y: y + 10 }, thickness: 0.5, color: linea });
  y -= 4;
  fila(t.total, euros(d.total), bold, 12);

  // Mención legal y pago
  y -= 20;
  if (d.mencion) {
    for (const l of partir(d.mencion, font, 9, W)) {
      texto(l, M, y, { size: 9 });
      y -= 12;
    }
    y -= 8;
  }
  if (d.emisor.iban) {
    texto(t.pago, M, y, { size: 9, color: gris });
    y -= 12;
    texto(`IBAN: ${d.emisor.iban}`, M, y, { size: 10, f: bold });
  }

  return pdf.save();
}
