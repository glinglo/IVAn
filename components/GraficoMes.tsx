"use client";

import { useEffect, useState } from "react";
import { BarChart } from "@glinglo/vela-ds";
import { eurosSinCentimos } from "@/lib/fiscal";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface MesGrafico {
  /** YYYY-MM, para la etiqueta corta del eje y el nombre completo de la fila de detalle. */
  mes: string;
  /** `null` = sin datos todavía (el mes en curso sin gastos, por ejemplo): no se pinta barra. */
  valor: number | null;
  /** Mes en curso sin cerrar: contorno discontinuo. Nunca se decide por el valor (puede coincidir
   * con el de otro mes ya cerrado), siempre por esta marca. */
  pendiente?: boolean;
}

const ETIQUETAS_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function GraficoMes({ meses, serie, ariaLabel }: { meses: MesGrafico[]; serie: string; ariaLabel: string }) {
  const ultimoConDatos = meses.reduce((acc, m, i) => (m.valor ? i : acc), meses.length - 1);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setSeleccionado(ultimoConDatos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = meses.map((m) => ({ label: ETIQUETAS_MES[Number(m.mes.slice(5, 7)) - 1], values: [m.valor], pending: m.pendiente }));
  const series = [{ name: serie, color: "var(--color-chart-primary)" }];
  const mes = seleccionado !== null ? meses[seleccionado] : undefined;

  return (
    <>
      <BarChart
        aria-label={ariaLabel}
        data={data}
        series={series}
        formatValue={eurosSinCentimos}
        pendingLabel="sin cerrar"
        selectedIndex={seleccionado ?? undefined}
        onSelect={setSeleccionado}
      />

      {mes && (
        <p className="lg:hidden text-body">
          {NOMBRES_MES[Number(mes.mes.slice(5, 7)) - 1]} · {mes.valor === null ? "sin cerrar" : `${mes.pendiente ? "≈ " : ""}${eurosSinCentimos(mes.valor)}`}
        </p>
      )}

      <p className="text-caption text-tertiary">
        <span className="lg:hidden">Toca un mes para ver su cifra.</span>
        <span className="hidden lg:inline">Pasa el ratón por un mes para ver su cifra.</span>
      </p>
    </>
  );
}
