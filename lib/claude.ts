import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "./env";
import { CATEGORIAS_GASTO } from "./categorias";

let anthropic: Anthropic | null = null;
export const ai = () => (anthropic ??= new Anthropic());

/**
 * Llama a Claude pidiendo la respuesta con structured outputs (sin tool_choice: Claude Sonnet 5.5
 * no admite forzar una herramienta, solo `auto` o `none`) y valida el JSON resultante con zod.
 */
async function llamar<T>(opts: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  esquema: { descripcion: string; schema: Record<string, unknown> };
  validar: z.ZodType<T>;
}): Promise<T> {
  const res = await ai().messages.create({
    model: env.anthropicModel,
    max_tokens: 8000,
    system: opts.system,
    output_config: {
      effort: "low", // leer una factura no necesita pensar mucho, y así va más rápido
      format: { type: "json_schema", schema: { ...opts.esquema.schema, description: opts.esquema.descripcion } },
    },
    messages: [{ role: "user", content: opts.content }],
  });
  if (res.stop_reason === "max_tokens") throw new Error("La respuesta de Claude se ha cortado (factura demasiado larga)");
  const bloque = res.content.find((b) => b.type === "text");
  if (!bloque || bloque.type !== "text") throw new Error("Claude no devolvió datos");
  let json: unknown;
  try {
    json = JSON.parse(bloque.text);
  } catch {
    throw new Error("Claude no devolvió un JSON válido");
  }
  return opts.validar.parse(json);
}

// ---------- Gastos ----------

export const LineaIvaExtraida = z.object({
  tipo_pct: z.number(),
  base: z.number().nullable(),
  cuota: z.number().nullable(),
});
export type LineaIvaExtraida = z.infer<typeof LineaIvaExtraida>;

export const GastoExtraido = z.object({
  es_factura: z.boolean(),
  proveedor: z.string().nullable(),
  nif_proveedor: z.string().nullable(),
  pais: z.string().nullable(),
  numero_factura: z.string().nullable(),
  fecha: z.string().nullable(),
  concepto: z.string().nullable(),
  categoria: z.enum(["restauracion", "otro"]),
  categoria_gasto: z
    .enum(CATEGORIAS_GASTO)
    .nullable()
    .catch(null),
  moneda: z.string(),
  base: z.number().nullable(),
  iva: z.number(),
  total: z.number().nullable(),
  desglose_iva: z.array(LineaIvaExtraida),
  iva_espanol: z.boolean(),
  nif_destinatario: z.string().nullable(),
  notas: z.string().nullable(),
});
export type GastoExtraido = z.infer<typeof GastoExtraido>;

const esquemaGasto = {
  type: "object",
  properties: {
    es_factura: {
      type: "boolean",
      description: "true si es una factura (con número, emisor y destinatario); false si es un ticket, recibo o pedido",
    },
    proveedor: { type: ["string", "null"], description: "Razón social del emisor" },
    nif_proveedor: { type: ["string", "null"], description: "NIF/VAT/Tax ID del emisor tal cual aparece" },
    pais: {
      type: ["string", "null"],
      description: "País del EMISOR en ISO 3166-1 alfa-2 (ES, IE, NL, US…), por su dirección o el prefijo de su VAT",
    },
    numero_factura: { type: ["string", "null"] },
    fecha: { type: ["string", "null"], description: "Fecha de la factura, YYYY-MM-DD" },
    concepto: { type: ["string", "null"], description: "Qué se compra, en español, máximo 6 palabras" },
    categoria: {
      type: "string",
      enum: ["restauracion", "otro"],
      description: "'restauracion' si es un restaurante, bar u hostelería (un ticket de comida, cena, hotel con manutención…); 'otro' en cualquier otro caso",
    },
    categoria_gasto: {
      type: "string",
      enum: [...CATEGORIAS_GASTO],
      description: "Categoría del gasto según lo que se compra",
    },
    moneda: { type: "string", description: "ISO 4217 (EUR, USD…)" },
    base: { type: ["number", "null"], description: "Base imponible (sin impuestos) en la moneda de la factura" },
    iva: { type: "number", description: "Importe de IVA/VAT cobrado en la factura; 0 si no cobra" },
    total: { type: ["number", "null"] },
    desglose_iva: {
      type: "array",
      description:
        "Copia el cuadro de impuestos del documento, una línea por tipo. El % tal cual está impreso: nunca lo deduzcas " +
        "del producto ni de la fecha (el tipo de la luz, el gas, etc. ha cambiado varias veces en 2026 y solo vale lo que " +
        "pone la factura). Si solo aparece el total con IVA incluido y el %, deja base y cuota en null. Vacío si no hay cuadro de impuestos.",
      items: {
        type: "object",
        properties: {
          tipo_pct: { type: "number", description: "% de IVA tal cual aparece impreso" },
          base: { type: ["number", "null"] },
          cuota: { type: ["number", "null"] },
        },
        required: ["tipo_pct", "base", "cuota"],
        additionalProperties: false,
      },
    },
    iva_espanol: {
      type: "boolean",
      description: "true si el IVA es español (el emisor factura con NIF español o ES…); false si es VAT de otro país o un número OSS EU…",
    },
    nif_destinatario: { type: ["string", "null"], description: "NIF/VAT del cliente que figura en la factura, si aparece" },
    notas: { type: ["string", "null"], description: "Algo raro o dudoso, en una frase. null si nada" },
  },
  required: Object.keys(GastoExtraido.shape),
  additionalProperties: false,
};

const sistemaGasto = (nif: string) =>
  `Lees facturas de gasto de un autónomo español (NIF ${nif}) para su libro de gastos. ` +
  `Extrae los datos exactamente como aparecen; no inventes. Si la factura muestra solo el total con IVA, ` +
  `calcula base = total - iva. Si cobra "VAT" de otro país o IVA español, ponlo en iva. ` +
  `Si es una suscripción en USD u otra moneda, deja los importes en esa moneda. ` +
  `Si el EMISOR es el propio autónomo (NIF ${nif}), es una factura que ha emitido él: pon su NIF en nif_proveedor. ` +
  `Para corregir un gasto de restaurante, "dormí fuera" o "fue en Lisboa/el extranjero" cambia el límite de manutención; ` +
  `"era con un cliente" o "invité a un cliente" es una atención a clientes, no manutención propia: dilo en notas si el usuario lo menciona al corregir.`;

export async function extraerGasto(
  archivo: { bytes: Uint8Array; mime: string },
  nifPropio: string,
): Promise<GastoExtraido> {
  const data = Buffer.from(archivo.bytes).toString("base64");
  const bloque: Anthropic.ContentBlockParam =
    archivo.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: archivo.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data,
          },
        };
  return llamar({
    system: sistemaGasto(nifPropio),
    content: [bloque, { type: "text", text: "Extrae los datos de esta factura." }],
    esquema: { descripcion: "Datos de la factura de gasto", schema: esquemaGasto },
    validar: GastoExtraido,
  });
}

export async function corregirGasto(actual: GastoExtraido, correccion: string, nifPropio: string) {
  return llamar({
    system: sistemaGasto(nifPropio),
    content: [
      {
        type: "text",
        text:
          `Datos actuales del gasto:\n${JSON.stringify(actual, null, 2)}\n\n` +
          `El usuario corrige: "${correccion}"\n\nDevuelve todos los datos con la corrección aplicada.`,
      },
    ],
    esquema: { descripcion: "Datos corregidos", schema: esquemaGasto },
    validar: GastoExtraido,
  });
}

// ---------- Facturas emitidas en otro programa (modo paralelo) ----------

export const FacturaEmitidaExtraida = z.object({
  numero: z.string().nullable(),
  fecha: z.string().nullable(),
  cliente_nombre: z.string().nullable(),
  cliente_nif: z.string().nullable(),
  concepto: z.string().nullable(),
  base: z.number().nullable(),
  iva_pct: z.number(),
  iva: z.number(),
  retencion_pct: z.number(),
  retencion: z.number(),
  total: z.number().nullable(),
});
export type FacturaEmitidaExtraida = z.infer<typeof FacturaEmitidaExtraida>;

/** Lee una factura que el autónomo ha emitido con otro programa (p. ej. Selfconta). */
export async function extraerFacturaEmitida(archivo: { bytes: Uint8Array; mime: string }, nifPropio: string) {
  const data = Buffer.from(archivo.bytes).toString("base64");
  const bloque: Anthropic.ContentBlockParam =
    archivo.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: archivo.mime as "image/jpeg" | "image/png" | "image/webp", data } };
  return llamar({
    system:
      `Lees facturas EMITIDAS por un autónomo español (NIF ${nifPropio}) con otro programa, para registrarlas en su libro. ` +
      "Extrae los datos exactamente como aparecen; no inventes ni recalcules. Importes en euros.",
    content: [bloque, { type: "text", text: "Extrae los datos de esta factura emitida." }],
    esquema: {
      descripcion: "Datos de la factura emitida",
      schema: {
        type: "object",
        properties: {
          numero: { type: ["string", "null"], description: "Número de factura tal cual (p. ej. 00337)" },
          fecha: { type: ["string", "null"], description: "Fecha de expedición, YYYY-MM-DD" },
          cliente_nombre: { type: ["string", "null"] },
          cliente_nif: { type: ["string", "null"], description: "NIF/VAT del cliente tal cual aparece" },
          concepto: { type: ["string", "null"], description: "Concepto tal cual aparece (si hay varias líneas, únelas)" },
          base: { type: ["number", "null"], description: "Base imponible" },
          iva_pct: { type: "number", description: "Tipo de IVA en %; 0 si no lleva" },
          iva: { type: "number", description: "Cuota de IVA; 0 si no lleva" },
          retencion_pct: { type: "number", description: "Retención de IRPF en %; 0 si no lleva" },
          retencion: { type: "number", description: "Importe retenido (positivo); 0 si no lleva" },
          total: { type: ["number", "null"], description: "Total a pagar" },
        },
        required: Object.keys(FacturaEmitidaExtraida.shape),
        additionalProperties: false,
      },
    },
    validar: FacturaEmitidaExtraida,
  });
}

// ---------- Facturas emitidas ----------

export const PeticionFactura = z.object({
  cliente_id: z.string().nullable(),
  base: z.number().nullable(),
  concepto: z.string().nullable(),
  fecha: z.string().nullable(),
  duda: z.string().nullable(),
});
export type PeticionFactura = z.infer<typeof PeticionFactura>;

export async function interpretarFactura(opts: {
  texto: string;
  hoy: string;
  clientes: { id: string; nombre: string; idioma: string; ultimos_conceptos: string[] }[];
  borradorActual?: object;
}): Promise<PeticionFactura> {
  return llamar({
    system:
      "Preparas facturas de un autónomo español a partir de lo que escribe en Telegram. " +
      "Elige el cliente de la lista (por id). Escribe el concepto en el idioma del cliente y, si sus " +
      "facturas anteriores siguen un patrón (p. ej. 'UX services for X platform (October 2026) + Cursor subscription'), " +
      "síguelo actualizando el mes. El importe que da el usuario es la BASE imponible salvo que diga otra cosa. " +
      "Si no queda claro el cliente o el importe, déjalos en null y explica la duda.",
    content: [
      {
        type: "text",
        text:
          `Hoy es ${opts.hoy}.\nClientes:\n${JSON.stringify(opts.clientes, null, 2)}\n\n` +
          (opts.borradorActual
            ? `Borrador actual:\n${JSON.stringify(opts.borradorActual, null, 2)}\nCambio pedido: "${opts.texto}"`
            : `Petición: "${opts.texto}"`),
      },
    ],
    esquema: {
      descripcion: "Datos de la factura a emitir",
      schema: {
        type: "object",
        properties: {
          cliente_id: { type: ["string", "null"] },
          base: { type: ["number", "null"], description: "Base imponible en euros" },
          concepto: { type: ["string", "null"] },
          fecha: { type: ["string", "null"], description: "YYYY-MM-DD; null = hoy" },
          duda: { type: ["string", "null"], description: "Qué falta o no está claro; null si nada" },
        },
        required: ["cliente_id", "base", "concepto", "fecha", "duda"],
        additionalProperties: false,
      },
    },
    validar: PeticionFactura,
  });
}
