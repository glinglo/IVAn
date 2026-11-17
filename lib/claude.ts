import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "./env";

let anthropic: Anthropic | null = null;
export const ai = () => (anthropic ??= new Anthropic());

/** Llama a Claude obligándole a responder con una herramienta y valida el resultado. */
async function llamar<T>(opts: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  tool: { name: string; description: string; schema: Record<string, unknown> };
  validar: z.ZodType<T>;
}): Promise<T> {
  const res = await ai().messages.create({
    model: env.anthropicModel,
    max_tokens: 1500,
    system: opts.system,
    tools: [
      {
        name: opts.tool.name,
        description: opts.tool.description,
        input_schema: opts.tool.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: [{ role: "user", content: opts.content }],
  });
  const uso = res.content.find((b) => b.type === "tool_use");
  if (!uso || uso.type !== "tool_use") throw new Error("Claude no devolvió datos");
  return opts.validar.parse(uso.input);
}

// ---------- Gastos ----------

export const GastoExtraido = z.object({
  es_factura: z.boolean(),
  proveedor: z.string().nullable(),
  nif_proveedor: z.string().nullable(),
  pais: z.string().nullable(),
  numero_factura: z.string().nullable(),
  fecha: z.string().nullable(),
  concepto: z.string().nullable(),
  moneda: z.string(),
  base: z.number().nullable(),
  iva: z.number(),
  total: z.number().nullable(),
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
    moneda: { type: "string", description: "ISO 4217 (EUR, USD…)" },
    base: { type: ["number", "null"], description: "Base imponible (sin impuestos) en la moneda de la factura" },
    iva: { type: "number", description: "Importe de IVA/VAT cobrado en la factura; 0 si no cobra" },
    total: { type: ["number", "null"] },
    nif_destinatario: { type: ["string", "null"], description: "NIF/VAT del cliente que figura en la factura, si aparece" },
    notas: { type: ["string", "null"], description: "Algo raro o dudoso, en una frase. null si nada" },
  },
  required: Object.keys(GastoExtraido.shape),
};

const sistemaGasto = (nif: string) =>
  `Lees facturas de gasto de un autónomo español (NIF ${nif}) para su libro de gastos. ` +
  `Extrae los datos exactamente como aparecen; no inventes. Si la factura muestra solo el total con IVA, ` +
  `calcula base = total - iva. Si cobra "VAT" de otro país o IVA español, ponlo en iva. ` +
  `Si es una suscripción en USD u otra moneda, deja los importes en esa moneda.`;

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
    tool: { name: "guardar_gasto", description: "Datos de la factura de gasto", schema: esquemaGasto },
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
    tool: { name: "guardar_gasto", description: "Datos corregidos", schema: esquemaGasto },
    validar: GastoExtraido,
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
    tool: {
      name: "preparar_factura",
      description: "Datos de la factura a emitir",
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
      },
    },
    validar: PeticionFactura,
  });
}
