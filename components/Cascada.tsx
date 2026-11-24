"use client";

import { Waterfall } from "@glinglo/vela-ds";
import { eurosSinCentimos } from "@/lib/fiscal";
import type { FilaCascada } from "@/lib/inicio";

export function Cascada({ filas }: { filas: FilaCascada[] }) {
  const filasCon = (clave: "label" | "labelCorta") =>
    filas.map((f) => ({ label: f[clave], value: Math.abs(f.value), kind: f.kind }));

  return (
    <>
      <div className="hidden lg:block">
        <Waterfall aria-label="De lo facturado al rendimiento" rows={filasCon("label")} format={eurosSinCentimos} />
      </div>
      <div className="lg:hidden">
        <Waterfall aria-label="De lo facturado al rendimiento" rows={filasCon("labelCorta")} format={eurosSinCentimos} />
      </div>
    </>
  );
}
