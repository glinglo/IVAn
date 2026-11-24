"use client";

import { Waterfall } from "@glinglo/vela-ds";
import { euros } from "@/lib/fiscal";
import type { FilaCascada } from "@/lib/inicio";

const formato = (n: number) => euros(n).replace(/,\d\d €/, " €");

export function Cascada({ filas }: { filas: FilaCascada[] }) {
  return (
    <Waterfall
      aria-label="De lo facturado al rendimiento"
      rows={filas.map((f) => ({ label: f.label, value: Math.abs(f.value), kind: f.kind }))}
      format={formato}
    />
  );
}
