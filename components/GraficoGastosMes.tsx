"use client";

import { BarChart } from "@glinglo/vela-ds";
import { eurosSinCentimos } from "@/lib/fiscal";

export interface SerieCategoria {
  name: string;
  color: string;
}

export interface MesGastos {
  label: string;
  /** Un valor por categoría, en el mismo orden que `series`. */
  values: (number | null)[];
}

export function GraficoGastosMes({ meses, series }: { meses: MesGastos[]; series: SerieCategoria[] }) {
  return (
    <>
      <div className="hidden lg:block">
        <BarChart aria-label="Gastado por mes y categoría" data={meses} series={series} stacked legend showValues formatValue={eurosSinCentimos} />
      </div>
      <div className="lg:hidden">
        <BarChart aria-label="Gastado por mes y categoría" data={meses} series={series} stacked legend formatValue={eurosSinCentimos} />
      </div>
    </>
  );
}
