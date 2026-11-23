"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SidebarNav, SidebarNavItem, SidebarNavUser, Badge, TabBar, type TabBarItem } from "@glinglo/vela-ds";
import { House, TrendingUp, Receipt, Landmark, Send, Download } from "lucide-react";
import { menuCuenta } from "./menuCuenta";

const BOT_URL = "https://t.me/Ivanelgestorbot";

function enlaces(path: string, sp: URLSearchParams) {
  const anio = sp.get("anio");
  const q = (base: string) => (anio && base !== "/" ? `${base}?anio=${anio}` : anio ? `/?anio=${anio}` : base);
  return [
    { href: q("/"), label: "Inicio", icon: House, activo: path === "/" },
    { href: q("/ventas"), label: "Ventas", icon: TrendingUp, activo: path.startsWith("/ventas") },
    { href: q("/gastos"), label: "Gastos", icon: Receipt, activo: path.startsWith("/gastos") },
    { href: q("/impuestos"), label: "Impuestos", icon: Landmark, activo: path.startsWith("/impuestos") },
  ];
}

export function NavMovil({ trimestreAviso }: { trimestreAviso?: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const items = enlaces(path, sp);
  const [inicio, ventas, gastos, impuestos] = items;
  const tabItems: TabBarItem[] = [
    { label: inicio.label, icon: <inicio.icon size={20} />, href: inicio.href, active: inicio.activo },
    { label: ventas.label, icon: <ventas.icon size={20} />, href: ventas.href, active: ventas.activo },
    { label: gastos.label, icon: <gastos.icon size={20} />, href: gastos.href, active: gastos.activo },
    { label: impuestos.label, icon: <impuestos.icon size={20} />, href: impuestos.href, active: impuestos.activo, dot: !!trimestreAviso },
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <TabBar
        items={tabItems}
        centerAction={{ label: "Abrir el bot", icon: <Send size={22} />, href: BOT_URL, target: "_blank" }}
        aria-label="Secciones (móvil)"
      />
    </div>
  );
}

export function NavEscritorio({
  trimestreAviso,
  barraContraida,
}: {
  trimestreAviso?: string;
  barraContraida: boolean;
}) {
  const path = usePathname();
  const sp = useSearchParams();
  const items = enlaces(path, sp);
  const anio = sp.get("anio") ?? String(new Date().getFullYear());

  function onCollapsedChange(collapsed: boolean) {
    document.cookie = `ivan_barra=${collapsed ? "contraida" : "expandida"}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
  }

  return (
    <SidebarNav
      logo={<span style={{ fontWeight: 600, fontSize: 18 }}>IVAn</span>}
      logoCollapsed={<span style={{ fontWeight: 600, fontSize: 18 }}>I</span>}
      collapsible
      defaultCollapsed={barraContraida}
      onCollapsedChange={onCollapsedChange}
      className="hidden lg:flex sticky top-0 h-dvh overflow-y-auto"
      aria-label="Secciones"
      footer={
        <>
          <SidebarNavItem icon={<Download size={16} />} href={`/api/exportar?anio=${anio}`}>
            Excel {anio}
          </SidebarNavItem>
          <SidebarNavUser name="Jose" initials="J" menu={menuCuenta} />
        </>
      }
    >
      <SidebarNavItem icon={<Send size={16} />} variant="primary" href={BOT_URL} target="_blank">
        Abrir el bot
      </SidebarNavItem>
      {items.map((i) => (
        <SidebarNavItem
          key={i.href}
          icon={<i.icon size={16} />}
          active={i.activo}
          href={i.href}
          badge={i.label === "Impuestos" && trimestreAviso ? <Badge type="onhold">{trimestreAviso}T</Badge> : undefined}
        >
          {i.label}
        </SidebarNavItem>
      ))}
    </SidebarNav>
  );
}
