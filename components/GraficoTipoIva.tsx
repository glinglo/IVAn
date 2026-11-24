"use client";

import { StackedBar } from "@glinglo/vela-ds";
import { eurosSinCentimos } from "@/lib/fiscal";

export function GraficoTipoIva({ parts }: { parts: { value: number; color: string; label: string }[] }) {
  return <StackedBar aria-label="Reparto de los gastos por tipo de IVA" legend format={eurosSinCentimos} parts={parts} />;
}
