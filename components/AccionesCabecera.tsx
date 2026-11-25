"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Dropdown } from "@glinglo/vela-ds";

export function AccionesCabecera({
  anio,
  anioActual,
  anios: aniosProp,
}: {
  anio?: number;
  anioActual?: number;
  /** Años del desplegable. Por defecto, los 3 últimos (`anioActual`, −1 y −2). Impuestos pasa su
   * propio rango, desde el primer año con algo en `presentaciones`. */
  anios?: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const anios = aniosProp ?? (anioActual !== undefined ? [anioActual, anioActual - 1, anioActual - 2] : []);

  if (anio === undefined || anioActual === undefined) return null;

  return (
    <Dropdown
      className="w-auto"
      value={String(anio)}
      options={anios.map((a) => ({ value: String(a), label: String(a) }))}
      onSelect={(o) => {
        const params = new URLSearchParams(sp.toString());
        params.set("anio", o.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
