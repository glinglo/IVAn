"use client";

import { BarChart } from "@glinglo/vela-ds";
import { eurosSinCentimos } from "@/lib/fiscal";

export interface MesGrafico {
  label: string;
  valor: number;
  /** Mes en curso sin cerrar: contorno discontinuo y el valor como estimación («≈ 3.060 €»). */
  pendiente?: boolean;
}

export function GraficoMes({ meses, serie, ariaLabel }: { meses: MesGrafico[]; serie: string; ariaLabel: string }) {
  const data = meses.map((m) => ({ label: m.label, values: [m.valor], pending: m.pendiente }));
  const series = [{ name: serie, color: "var(--color-chart-primary)" }];
  const valorPendiente = meses.find((m) => m.pendiente)?.valor;
  const formatValue = (v: number) => (v === valorPendiente ? `≈ ${eurosSinCentimos(v)}` : eurosSinCentimos(v));

  return (
    <>
      <div className="hidden lg:block">
        <BarChart aria-label={ariaLabel} data={data} series={series} showValues formatValue={formatValue} pendingLabel="sin cerrar" />
      </div>
      <div className="lg:hidden">
        <BarChart aria-label={ariaLabel} data={data} series={series} formatValue={formatValue} pendingLabel="sin cerrar" />
      </div>
    </>
  );
}
