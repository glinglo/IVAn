"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Dropdown, Menu, AvatarButton, Avatar } from "@glinglo/vela-ds";
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
          className="w-auto"
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
          <AvatarButton size="md" aria-label="Menú de cuenta" className="lg:hidden">
            <Avatar initials="J" size="md" />
          </AvatarButton>
        }
        items={menuCuenta}
        placement="bottom-end"
        aria-label="Cuenta"
      />
    </div>
  );
}
