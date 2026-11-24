"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@glinglo/vela-ds";

const OPCIONES = [
  { label: "303", value: "303" },
  { label: "130", value: "130" },
  { label: "349", value: "349" },
];

/** `SegmentedControl` del modelo (303 · 130 · 349) en la cabecera de la tarjeta de un trimestre,
 * como el periodo de Inicio. Cambia `?m=` sin perder el resto de la query. */
export function PestanasModelo({ valor }: { valor: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const navegar = (v: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("m", v);
    router.push(`${pathname}?${params.toString()}`);
  };

  return <SegmentedControl aria-label="Modelo" variant="tabs" fullWidth={false} value={valor} options={OPCIONES} onChange={navegar} />;
}
