// El registro de Vercel nunca debe llevar el token del bot. grammY mete ctx.api (y, dentro, el
// token) en cualquier BotError; erroSeguro() es lo único que debe llegar a console.error().
// Ver docs/planes/2026-11-22-claude-sin-tool-choice.md.
import { describe, expect, it } from "vitest";
import { BotError } from "grammy";
import { erroSeguro } from "../lib/bot";

const TOKEN = "123456:AAAA-token-secreto-de-prueba";

describe("erroSeguro", () => {
  it("de un BotError solo saca el nombre y el mensaje del error original, nunca el ctx", () => {
    const ctxFalso = { api: { token: TOKEN }, update: {} } as any;
    const err = new BotError(new Error("fallo leyendo la factura"), ctxFalso);
    const seguro = erroSeguro(err.error);
    expect(JSON.stringify(seguro)).not.toContain(TOKEN);
    expect(seguro.message).toBe("fallo leyendo la factura");
  });

  it("si el error de la API lleva algo dentro (p. ej. Anthropic), se conserva sin el resto", () => {
    const e = Object.assign(new Error("400 invalid_request_error"), { error: { type: "invalid_request_error", message: "tool_choice no soportado" } });
    const seguro = erroSeguro(e);
    expect(seguro.error).toEqual({ type: "invalid_request_error", message: "tool_choice no soportado" });
    expect(JSON.stringify(seguro)).not.toContain(TOKEN);
  });

  it("con cualquier valor no Error, no revienta y no cuela nada raro", () => {
    expect(erroSeguro("algo raro")).toEqual({ name: "Error", message: "algo raro" });
  });
});
