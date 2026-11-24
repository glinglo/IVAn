"use client";

import { BarChart } from "@glinglo/vela-ds";
import type { MesSerie } from "@/lib/inicio";

const ETIQUETAS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function Barras({ serie }: { serie: MesSerie[] }) {
  return (
    <BarChart
      aria-label="Ingresos y gastos por mes"
      series={[
        { name: "Ingresos", color: "var(--color-chart-primary)" },
        { name: "Gastos", color: "var(--color-chart-muted)" },
      ]}
      data={serie.map((m) => ({
        label: ETIQUETAS[Number(m.mes.slice(5, 7)) - 1],
        values: [m.ingresos, m.gastos + m.cuota],
        pending: m.pendiente,
      }))}
    />
  );
}
