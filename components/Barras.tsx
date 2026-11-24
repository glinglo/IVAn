"use client";

import { useState } from "react";
import { BarChart, Tooltip } from "@glinglo/vela-ds";
import { euros } from "@/lib/fiscal";
import type { MesSerie } from "@/lib/inicio";

const ETIQUETAS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const formato = (n: number) => euros(n).replace(/,\d\d €/, " €");
const capitaliza = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Barras({ serie, highlight }: { serie: MesSerie[]; highlight?: number[] }) {
  const ultimoConDatos = serie.reduce((acc, m, i) => (m.ingresos || m.gastos ? i : acc), serie.length - 1);
  const [seleccionado, setSeleccionado] = useState(ultimoConDatos);

  const mes = serie[seleccionado];
  const mesPendiente = serie.find((m) => m.pendiente);

  return (
    <>
      <div className="flex items-center gap-2">
        <h3 className="text-eyebrow text-tertiary">Ingresos y gastos por mes</h3>
        <Tooltip content="Gastos = facturas + cuota. El 5 % y la amortización se calculan sobre el año.">
          <button type="button" aria-label="Cómo se calcula" className="text-tertiary">
            ⓘ
          </button>
        </Tooltip>
      </div>

      <BarChart
        aria-label="Ingresos y gastos por mes"
        series={[
          { name: "Ingresos", color: "var(--color-chart-primary)" },
          { name: "Gastos y cuota", color: "var(--color-chart-muted)" },
        ]}
        legend
        data={serie.map((m) => ({
          label: ETIQUETAS[Number(m.mes.slice(5, 7)) - 1],
          values: [m.ingresos, m.gastos + m.cuota],
          pending: m.pendiente,
        }))}
        formatValue={formato}
        pendingLabel="sin facturar"
        highlight={highlight}
        selectedIndex={seleccionado}
        onSelect={setSeleccionado}
      />

      {mes && (
        <p className="lg:hidden text-body">
          {capitaliza(NOMBRES_MES[Number(mes.mes.slice(5, 7)) - 1])} · Ingresos {formato(mes.ingresos)} · Gastos {formato(mes.gastos + mes.cuota)}
        </p>
      )}

      <p className="text-caption">
        {mesPendiente && `${capitaliza(NOMBRES_MES[Number(mesPendiente.mes.slice(5, 7)) - 1])} aún sin facturar. `}
        <span className="lg:hidden">Toca un mes para ver sus cifras.</span>
        <span className="hidden lg:inline">Pasa el ratón por un mes para ver sus cifras.</span>
      </p>
    </>
  );
}
