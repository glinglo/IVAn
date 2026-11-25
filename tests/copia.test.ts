import { describe, expect, it } from "vitest";
import { TABLAS, titularDeCopiaAntigua } from "../lib/copia";

describe("copia de seguridad y titulares", () => {
  it("TABLAS empieza por titulares", () => {
    expect(TABLAS[0]).toBe("titulares");
  });

  it("una copia sin titulares crea el titular desde ajustes", () => {
    const copia = { tablas: { ajustes: [{ id: 1, nombre: "Jose Bautista Gallego", nif: "00000000T" }] } };
    expect(titularDeCopiaAntigua(copia)).toEqual({ nombre: "Jose Bautista Gallego", nif: "00000000T" });
  });

  it("una copia que ya trae titulares no crea nada", () => {
    const copia = {
      tablas: {
        titulares: [{ id: "a", nombre: "Jose Bautista Gallego", nif: "00000000T" }],
        ajustes: [{ id: 1, nombre: "Jose Bautista Gallego", nif: "00000000T" }],
      },
    };
    expect(titularDeCopiaAntigua(copia)).toBeNull();
  });

  it("una copia sin ajustes ni titulares no crea nada", () => {
    expect(titularDeCopiaAntigua({ tablas: {} })).toBeNull();
  });
});
