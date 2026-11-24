// Pequeñas funciones de texto para mostrar en el panel y en el bot.

const FORMAS_JURIDICAS = /(?:,|\s)+(PBC|Inc\.?|Ltd\.?|LLC|S\.?R\.?O\.?|Oy|S\.?L\.?U?\.?|S\.?A\.?|B\.?V\.?|GmbH|Corp\.?|PLC)\.?\s*$/i;

/** Quita la forma jurídica del final del nombre de un proveedor: "Anthropic, PBC" → "Anthropic". */
export function nombreCorto(proveedor: string): string {
  const s = proveedor.trim().replace(FORMAS_JURIDICAS, "").trim();
  return s || proveedor.trim();
}
