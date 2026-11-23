"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Dropdown } from "@glinglo/vela-ds";

export function AnioDropdown({ anio, anioActual }: { anio: number; anioActual: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const anios = [anioActual, anioActual - 1, anioActual - 2];

  return (
    <Dropdown
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
