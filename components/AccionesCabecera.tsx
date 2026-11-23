"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Dropdown, Menu } from "@glinglo/vela-ds";
import { menuCuenta } from "./menuCuenta";

export function AccionesCabecera({ anio, anioActual }: { anio?: number; anioActual?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const anios = anioActual !== undefined ? [anioActual, anioActual - 1, anioActual - 2] : [];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {anio !== undefined && anioActual !== undefined && (
        <Dropdown
          value={String(anio)}
          options={anios.map((a) => ({ value: String(a), label: String(a) }))}
          onSelect={(o) => {
            const params = new URLSearchParams(sp.toString());
            params.set("anio", o.value);
            router.push(`${pathname}?${params.toString()}`);
          }}
        />
      )}
      <Menu
        trigger={
          <button
            type="button"
            aria-label="Menú de cuenta"
            className="lg:hidden"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--color-brand-100)",
              color: "var(--color-brand-800)",
              fontWeight: 500,
              border: "none",
            }}
          >
            J
          </button>
        }
        items={menuCuenta}
        placement="bottom-end"
        aria-label="Cuenta"
      />
    </div>
  );
}
