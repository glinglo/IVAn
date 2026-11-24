// Pequeñas funciones de texto para mostrar en el panel y en el bot.

const FORMAS_JURIDICAS = /(?:,|\s)+(PBC|Inc\.?|Ltd\.?|LLC|S\.?R\.?O\.?|Oy|S\.?L\.?U?\.?|S\.?A\.?|B\.?V\.?|GmbH|Corp\.?|PLC)\.?\s*$/i;

/** Quita la forma jurídica del final del nombre de un proveedor: "Anthropic, PBC" → "Anthropic".
 * Si el nombre acaba en un paréntesis, devuelve lo de dentro: "Anysphere, Inc. (Cursor)" → "Cursor". */
export function nombreCorto(proveedor: string): string {
  const t = proveedor.trim();
  const parentesis = /\(([^()]+)\)\s*$/.exec(t);
  if (parentesis) return parentesis[1].trim();
  const s = t.replace(FORMAS_JURIDICAS, "").trim();
  return s || t;
}

/** Iniciales para un `Avatar`: "Zapflow Oy" → "ZO", "Cursor" → "CU". */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase();
  return nombre.trim().slice(0, 2).toUpperCase();
}
