"use client";

import { BarChart } from "@glinglo/vela-ds";
import { eurosSinCentimos } from "@/lib/fiscal";

export interface TrimestrePagado {
  label: string;
  irpf: number;
  iva: number;
  pendiente?: boolean;
}

/** `BarChart` apilado (IRPF + IVA ingresado) por trimestre, el trimestre en curso `pending`. */
export function GraficoPagos({ trimestres }: { trimestres: TrimestrePagado[] }) {
  const data = trimestres.map((t) => ({ label: t.label, values: [t.irpf, t.iva], pending: t.pendiente }));
  const series = [
    { name: "IRPF a cuenta", color: "var(--color-chart-primary)" },
    { name: "IVA", color: "var(--color-chart-muted)" },
  ];

  return <BarChart aria-label="Pagado por trimestre" data={data} series={series} stacked legend formatValue={eurosSinCentimos} pendingLabel="sin cerrar" />;
}
