"use client";

import { BarChart } from "@glinglo/vela-ds";
import { eurosSinCentimos } from "@/lib/fiscal";

export interface MesVentas {
  label: string;
  valor: number;
  pendiente?: boolean;
}

export function GraficoVentasMes({ meses }: { meses: MesVentas[] }) {
  const data = meses.map((m) => ({ label: m.label, values: [m.valor], pending: m.pendiente }));
  const series = [{ name: "Facturado", color: "var(--color-chart-primary)" }];

  return (
    <>
      <div className="hidden lg:block">
        <BarChart aria-label="Facturado por mes" data={data} series={series} showValues formatValue={eurosSinCentimos} pendingLabel="sin facturar" />
      </div>
      <div className="lg:hidden">
        <BarChart aria-label="Facturado por mes" data={data} series={series} formatValue={eurosSinCentimos} pendingLabel="sin facturar" />
      </div>
    </>
  );
}
