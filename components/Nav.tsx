"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icono = {
  inicio: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  ventas: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  gastos: "M4 6h16v12H4zM4 10h16M8 15h3",
};

export function Nav() {
  const path = usePathname();
  const items = [
    { href: "/", label: "Inicio", d: icono.inicio, activo: path === "/" || path.startsWith("/trimestre") },
    { href: "/ventas", label: "Ventas", d: icono.ventas, activo: path.startsWith("/ventas") },
    { href: "/gastos", label: "Gastos", d: icono.gastos, activo: path.startsWith("/gastos") },
  ];
  return (
    <nav className="nav">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.activo ? "activo" : ""}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
            <path d={i.d} />
          </svg>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
