"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@glinglo/vela-ds";

const OPCIONES = [
  { label: "Año", value: "anio" },
  { label: "1T", value: "1" },
  { label: "2T", value: "2" },
  { label: "3T", value: "3" },
  { label: "4T", value: "4" },
];

/** `SegmentedControl` del periodo (Año · 1T · 2T · 3T · 4T). Mantiene `?anio=` y cambia `?periodo=`. */
export function Periodo({ valor, anio, disponibles }: { valor: string; anio: number; disponibles: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const opciones = OPCIONES.filter((o) => o.value === "anio" || disponibles.includes(Number(o.value)));

  return (
    <SegmentedControl
      aria-label="Periodo"
      variant="filter"
      value={valor}
      options={opciones}
      onChange={(v) => {
        const params = new URLSearchParams(sp.toString());
        params.set("anio", String(anio));
        if (v === "anio") params.delete("periodo");
        else params.set("periodo", v);
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
