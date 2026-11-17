// Genera muestras/factura-ejemplo.pdf para ver el diseño sin base de datos.
import { mkdirSync, writeFileSync } from "node:fs";
import { generarFacturaPDF } from "../lib/pdf";
import { calcularImportes } from "../lib/fiscal";

const emisor = {
  nombre: "Jose Bautista Gallego", nif: "00000000T", direccion: "Calle Ejemplo 1, 08320 El Masnou (Barcelona)",
  email: "jose@btsta.me", telefono: null, iban: "ES00 0000 0000 0000 0000 0000",
};
mkdirSync("muestras", { recursive: true });
const ue = calcularImportes({ tipo: "ue", iva_pct: 21, retencion_pct: 15 }, 3060);
writeFileSync("muestras/factura-ue.pdf", await generarFacturaPDF({
  numero: "00337", fecha: "2026-11-30", idioma: "en", emisor,
  cliente: { nombre: "Zapflow Oy", nif: "FI26899624", direccion: "Dirección de ejemplo, 00100 Helsinki", pais: "Finland" },
  concepto: "UX services for Zapflow platform (November 2026) + Cursor subscription", ...ue,
}));
const es = calcularImportes({ tipo: "nacional", iva_pct: 21, retencion_pct: 15 }, 1020);
writeFileSync("muestras/factura-nacional.pdf", await generarFacturaPDF({
  numero: "00338", fecha: "2026-11-30", idioma: "es", emisor,
  cliente: { nombre: "Volta Cultural SL", nif: "B23853039", direccion: "Dirección de ejemplo, Barcelona" },
  concepto: "Disseny i implementació de la plataforma web impulsa.", ...es,
}));
console.log("ok");
