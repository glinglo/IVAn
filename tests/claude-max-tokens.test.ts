// Si la respuesta de Claude se corta por max_tokens, el error tiene que decirlo (y no decir
// simplemente "no devolvió un JSON válido", que confunde). Ver
// docs/planes/2026-11-23-retoques-tras-la-puesta-en-marcha.md.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";

let server: http.Server;
let puerto: number;
let respuesta: { stop_reason: string; content: unknown[] };

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = "sk-prueba";
  server = http.createServer(async (req, res) => {
    const trozos: Buffer[] = [];
    for await (const t of req) trozos.push(t as Buffer);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_prueba",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: respuesta.content,
        stop_reason: respuesta.stop_reason,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    );
  });
  await new Promise<void>((ok) => server.listen(0, () => ok()));
  puerto = (server.address() as { port: number }).port;
  process.env.ANTHROPIC_BASE_URL = `http://localhost:${puerto}`;
});

afterAll(() => {
  server.close();
});

describe("llamar(): respuesta cortada por max_tokens", () => {
  it('con stop_reason "max_tokens", el error dice que la respuesta se ha cortado', async () => {
    const { extraerGasto } = await import("../lib/claude");
    respuesta = { stop_reason: "max_tokens", content: [{ type: "text", text: '{"es_factura":tr' }] };
    await expect(extraerGasto({ bytes: new Uint8Array([1]), mime: "image/png" }, "00000000A")).rejects.toThrow(
      /se ha cortado \(factura demasiado larga\)/,
    );
  });

  it("con end_turn y JSON completo, no da ese error", async () => {
    const { extraerGasto } = await import("../lib/claude");
    respuesta = {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            es_factura: false, proveedor: null, nif_proveedor: null, pais: null, numero_factura: null,
            fecha: null, concepto: null, categoria: "otro", categoria_gasto: "otros", moneda: "EUR", base: null, iva: 0, total: null,
            desglose_iva: [], iva_espanol: false, nif_destinatario: null, notas: null,
          }),
        },
      ],
    };
    const r = await extraerGasto({ bytes: new Uint8Array([1]), mime: "image/png" }, "00000000A");
    expect(r.es_factura).toBe(false);
  });

  it("categoria_gasto ausente o fuera del enum: el gasto se lee igual, con categoria_gasto a null", async () => {
    const { extraerGasto } = await import("../lib/claude");
    respuesta = {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            es_factura: false, proveedor: null, nif_proveedor: null, pais: null, numero_factura: null,
            fecha: null, concepto: null, categoria: "otro", categoria_gasto: "no_existe", moneda: "EUR", base: null, iva: 0, total: null,
            desglose_iva: [], iva_espanol: false, nif_destinatario: null, notas: null,
          }),
        },
      ],
    };
    const r = await extraerGasto({ bytes: new Uint8Array([1]), mime: "image/png" }, "00000000A");
    expect(r.es_factura).toBe(false);
    expect(r.categoria_gasto).toBeNull();
  });
});
