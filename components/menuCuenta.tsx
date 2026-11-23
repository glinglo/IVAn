import type { MenuItem } from "@glinglo/vela-ds";
import { Settings, LogOut } from "lucide-react";

export const menuCuenta: MenuItem[] = [
  { label: "Configuración", icon: <Settings size={16} />, href: "/ajustes" },
  {
    label: "Cerrar sesión",
    icon: <LogOut size={16} />,
    variant: "danger",
    onSelect: () => {
      fetch("/salir", { method: "POST" }).then(() => {
        window.location.assign("/sin-acceso?salida=1");
      });
    },
  },
];
