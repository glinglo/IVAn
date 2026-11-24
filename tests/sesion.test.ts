import { describe, expect, it } from "vitest";
import { rutaSegura } from "../lib/sesion";

describe("enlace al panel", () => {
  it("solo redirige a rutas del propio panel", () => {
    expect(rutaSegura("/anual/2026")).toBe("/anual/2026");
    expect(rutaSegura("/trimestre/2026/4")).toBe("/trimestre/2026/4");
    expect(rutaSegura(null)).toBe("/");
    expect(rutaSegura("//evil.com")).toBe("/");
    expect(rutaSegura("https://evil.com")).toBe("/");
    expect(rutaSegura("/\\evil.com")).toBe("/");
    expect(rutaSegura("/a?x=//b")).toBe("/");
  });
});
