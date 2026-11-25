"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SidebarNav, SidebarNavItem, SidebarNavUser, Badge, Button, Sheet } from "@glinglo/vela-ds";
import { House, TrendingUp, Receipt, Landmark, Send, Download, Menu as MenuIcon } from "lucide-react";
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

export function CabeceraMovil({ trimestreAviso, nombre }: { trimestreAviso?: string; nombre?: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const items = enlaces(path, sp);
  const anio = sp.get("anio") ?? String(new Date().getFullYear());
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    setAbierto(false);
  }, [path]);

  return (
    <header className="lg:hidden sticky top-0 z-30 -mx-4 -mt-4 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      <span style={{ fontWeight: 600, fontSize: 18 }}>IVAn</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <a
          href={BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir el bot"
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: "#F5EFFF",
            color: "#5D4E7F",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Send size={20} />
        </a>
        <button
          type="button"
          aria-label={trimestreAviso ? "Abrir el menú (hay un aviso en Impuestos)" : "Abrir el menú"}
          onClick={() => setAbierto(true)}
          style={{
            position: "relative",
            width: 44,
            height: 44,
            border: 0,
            borderRadius: 8,
            background: "transparent",
            color: "#1E293B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          <MenuIcon size={22} />
          {trimestreAviso && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 9,
                right: 9,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#EAB308",
                boxShadow: "0 0 0 2px #FFFFFF",
              }}
            />
          )}
        </button>
      </div>

      <Sheet open={abierto} title="IVAn" onClose={() => setAbierto(false)} side="right" closeLabel="Cerrar el menú">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "100%" }}>
          <Button variant="primary" href={BOT_URL} target="_blank" startIcon={<Send size={18} />}>
            Abrir el bot
          </Button>

          <nav aria-label="Secciones" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((i) => (
              <a
                key={i.href}
                href={i.href}
                aria-current={i.activo ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 44,
                  padding: "0 12px",
                  borderRadius: 8,
                  background: i.activo ? "#F5EFFF" : "transparent",
                  color: i.activo ? "#5D4E7F" : "#1E293B",
                  fontWeight: 500,
                }}
              >
                <i.icon size={20} color={i.activo ? "#5D4E7F" : "#94A3B8"} />
                <span style={{ flex: 1 }}>{i.label}</span>
                {i.label === "Impuestos" && trimestreAviso && <Badge type="onhold">{trimestreAviso}T</Badge>}
              </a>
            ))}
          </nav>

          <div style={{ height: 1, background: "#E2E8F0" }} />

          <a
            href={`/api/exportar?anio=${anio}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: 44,
              padding: "0 12px",
              borderRadius: 8,
              color: "#1E293B",
              fontWeight: 500,
            }}
          >
            <Download size={20} color="#94A3B8" />
            Excel {anio}
          </a>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid #E2E8F0", paddingTop: 12 }}>
            {nombre && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px 12px" }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: "#F5EFFF",
                    color: "#5D4E7F",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "center",
                    lineHeight: "36px",
                  }}
                >
                  {nombre.charAt(0).toUpperCase()}
                </span>
                <span style={{ fontWeight: 600 }}>{nombre}</span>
              </div>
            )}
            {menuCuenta.map((item) =>
              item.href ? (
                <a
                  key={item.label}
                  href={item.href}
                  style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "0 12px", borderRadius: 8, color: "#1E293B", fontWeight: 500 }}
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onSelect}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 44,
                    padding: "0 12px",
                    border: 0,
                    borderRadius: 8,
                    background: "transparent",
                    color: item.variant === "danger" ? "#B91C1C" : "#1E293B",
                    fontWeight: 500,
                    textAlign: "left",
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              )
            )}
          </div>
        </div>
      </Sheet>
    </header>
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
      aria-label="Secciones"
      action={{ label: "Abrir el bot", icon: <Send size={16} />, href: BOT_URL, target: "_blank" }}
      footer={
        <>
          <SidebarNavItem icon={<Download size={16} />} href={`/api/exportar?anio=${anio}`}>
            Excel {anio}
          </SidebarNavItem>
          <SidebarNavUser name="Jose" initials="J" menu={menuCuenta} />
        </>
      }
    >
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
