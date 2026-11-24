// Claude Sonnet 5.5 no admite forzar una herramienta (tool_choice: "tool" o "any"): el Claude
// simulado de las pruebas de integración tiene que rechazarlo igual que la API real, para que este
// error no pueda volver sin que fallen las pruebas. Ver docs/planes/2026-11-22-claude-sin-tool-choice.md.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import * as F from "../scripts/integracion/fakes";

let server: Server;

beforeAll(async () => {
  server = await F.arrancar();
});

afterAll(() => {
  server.close();
});

const llamar = (tool_choice: unknown) =>
  fetch(`http://localhost:${F.PUERTO}/anthropic/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 10, messages: [], tool_choice }),
  });

describe("Claude simulado: tool_choice forzado", () => {
  it('rechaza tool_choice: { type: "tool" } con un 400 igual que la API real', async () => {
    const res = await llamar({ type: "tool", name: "guardar_gasto" });
    expect(res.status).toBe(400);
    const cuerpo = await res.json();
    expect(cuerpo.error.message).toMatch(/tool_choice.*not supported for this model/);
  });

  it('rechaza tool_choice: { type: "any" } con un 400', async () => {
    const res = await llamar({ type: "any" });
    expect(res.status).toBe(400);
    const cuerpo = await res.json();
    expect(cuerpo.error.message).toMatch(/tool_choice.*not supported for this model/);
  });

  it("sin tool_choice no se rechaza (sigue al guion de Claude)", async () => {
    F.guionClaude.push(() => [{ type: "text", text: "ok" }]);
    const res = await llamar(undefined);
    expect(res.status).toBe(200);
  });
});
