import { describe, expect, it } from "vitest";
import { nombreCorto } from "../lib/texto";

describe("nombreCorto", () => {
  it("quita la forma jurídica del final", () => {
    expect(nombreCorto("Anthropic, PBC")).toBe("Anthropic");
    expect(nombreCorto("Cursor Inc.")).toBe("Cursor");
    expect(nombreCorto("Replit, Inc.")).toBe("Replit");
    expect(nombreCorto("Framer B.V.")).toBe("Framer");
    expect(nombreCorto("Empresa SL")).toBe("Empresa");
  });

  it("deja igual un nombre sin forma jurídica", () => {
    expect(nombreCorto("Fly.io")).toBe("Fly.io");
    expect(nombreCorto("Cloudflare")).toBe("Cloudflare");
  });
});
