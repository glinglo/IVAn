"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SidebarNav, SidebarNavItem, Button, TabBar, type TabBarItem } from "@glinglo/vela-ds";

const BOT_URL = "https://t.me/Ivanelgestorbot";

const icono = {
  inicio: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  ventas: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  gastos: "M4 6h16v12H4zM4 10h16M8 15h3",
  impuestos: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h4",
  bot: "M12 2a4 4 0 0 1 4 4v1h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1V6a4 4 0 0 1 4-4zM9 12v2M15 12v2",
};

function Svg({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function enlaces(path: string, sp: URLSearchParams, avisoImpuestos: boolean) {
  const anio = sp.get("anio");
  const q = (base: string) => (anio && base !== "/" ? `${base}?anio=${anio}` : anio ? `/?anio=${anio}` : base);
  return [
    { href: q("/"), label: "Inicio", icono: icono.inicio, activo: path === "/" },
    { href: q("/ventas"), label: "Ventas", icono: icono.ventas, activo: path.startsWith("/ventas") },
    { href: q("/gastos"), label: "Gastos", icono: icono.gastos, activo: path.startsWith("/gastos") },
    { href: q("/impuestos"), label: "Impuestos", icono: icono.impuestos, activo: path.startsWith("/impuestos"), dot: avisoImpuestos },
  ];
}

export function NavMovil({ avisoImpuestos }: { avisoImpuestos: boolean }) {
  const path = usePathname();
  const sp = useSearchParams();
  const items = enlaces(path, sp, avisoImpuestos);
  const [inicio, ventas, gastos, impuestos] = items;
  const tabItems: TabBarItem[] = [
    { label: inicio.label, icon: <Svg d={inicio.icono} />, href: inicio.href, active: inicio.activo },
    { label: ventas.label, icon: <Svg d={ventas.icono} />, href: ventas.href, active: ventas.activo },
    { label: gastos.label, icon: <Svg d={gastos.icono} />, href: gastos.href, active: gastos.activo },
    { label: impuestos.label, icon: <Svg d={impuestos.icono} />, href: impuestos.href, active: impuestos.activo, dot: impuestos.dot },
  ];
  return <TabBar items={tabItems} centerAction={{ label: "Abrir el bot", icon: <Svg d={icono.bot} />, href: BOT_URL }} className="lg:hidden" />;
}

export function NavEscritorio({ avisoImpuestos }: { avisoImpuestos: boolean }) {
  const path = usePathname();
  const sp = useSearchParams();
  const items = enlaces(path, sp, avisoImpuestos);
  return (
    <SidebarNav logo={<span style={{ fontWeight: 600, fontSize: 18 }}>IVAn</span>} className="hidden lg:flex">
      <div style={{ padding: "0 4px 12px" }}>
        <Button variant="primary" size="sm" onClick={() => (window.location.href = BOT_URL)}>
          Abrir el bot
        </Button>
      </div>
      {items.map((i) => (
        <SidebarNavItem key={i.href} icon={<Svg d={i.icono} />} active={i.activo} onClick={() => (window.location.href = i.href)}>
          {i.label}
          {i.dot && " •"}
        </SidebarNavItem>
      ))}
    </SidebarNav>
  );
}
