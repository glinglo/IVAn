"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@glinglo/vela-ds";

const TODAS = [
  { label: "303", value: "303" },
  { label: "130", value: "130" },
  { label: "349", value: "349" },
];

/** `SegmentedControl` del modelo (303 · 130 · 349, o solo 303 · 130 en un año sin datos: no hay
 * 349 que mostrar) en la cabecera de la tarjeta de un trimestre, como el periodo de Inicio. Cambia
 * `?m=` sin perder el resto de la query. */
export function PestanasModelo({ valor, modelos }: { valor: string; modelos?: ("303" | "130" | "349")[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const navegar = (v: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("m", v);
    router.push(`${pathname}?${params.toString()}`);
  };

  const opciones = modelos ? TODAS.filter((o) => modelos.includes(o.value as "303" | "130" | "349")) : TODAS;
  return <SegmentedControl aria-label="Modelo" variant="tabs" fullWidth={false} value={valor} options={opciones} onChange={navegar} />;
}
