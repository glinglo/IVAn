"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@glinglo/vela-ds";
import { useResultadosTransition } from "./BloqueResultados";

const OPCIONES = [
  { label: "Año", value: "anio" },
  { label: "1T", value: "1" },
  { label: "2T", value: "2" },
  { label: "3T", value: "3" },
  { label: "4T", value: "4" },
];

/** `SegmentedControl` del periodo (Año · 1T · 2T · 3T · 4T). Mantiene `?anio=` y cambia `?periodo=`.
 * Los trimestres futuros salen desactivados, no ocultos. */
export function Periodo({ valor, anio, disponibles, fullWidth }: { valor: string; anio: number; disponibles: number[]; fullWidth?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const transicion = useResultadosTransition();

  const opciones = OPCIONES.map((o) => ({ ...o, disabled: o.value !== "anio" && !disponibles.includes(Number(o.value)) }));

  const navegar = (v: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("anio", String(anio));
    if (v === "anio") params.delete("periodo");
    else params.set("periodo", v);
    const ruta = `${pathname}?${params.toString()}`;
    if (transicion) transicion.startTransition(() => router.push(ruta));
    else router.push(ruta);
  };

  return (
    <SegmentedControl aria-label="Periodo" variant="contrast" fullWidth={fullWidth ?? false} value={valor} options={opciones} onChange={navegar} />
  );
}
