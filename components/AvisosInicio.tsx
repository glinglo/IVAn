"use client";

import { useState } from "react";
import { Badge, Button, NoticeCard, NoticeStrip, Sheet } from "@glinglo/vela-ds";
import type { Paso } from "@/lib/libro";

const BOT_URL = "https://t.me/Ivanelgestorbot";

const BADGE: Record<Paso["nivel"], { label: string; type: "destructive" | "onhold" } | null> = {
  urgente: { label: "Urgente", type: "destructive" },
  pendiente: { label: "Pendiente", type: "onhold" },
  info: null,
};

function escribirCookieOculta(clave: string, hoy: string) {
  document.cookie = `ivan_aviso_oculto=${clave}:${hoy}; max-age=${60 * 60 * 24}; path=/; SameSite=Lax`;
}

export function AvisosInicio({ destacado, resto, ocultoHoy, hoy }: { destacado: Paso | null; resto: Paso[]; ocultoHoy: boolean; hoy: string }) {
  const [oculto, setOculto] = useState(ocultoHoy);
  const [abierto, setAbierto] = useState(false);

  if (destacado && !oculto) {
    const variante = destacado.nivel === "urgente" ? "urgent" : destacado.clave === "facturar" || destacado.clave === "gastos" ? "pending" : "brand";
    return (
      <NoticeCard
        variant={variante}
        title={destacado.texto}
        description={destacado.detalle}
        action={{ label: destacado.href ? "Ver" : "Abrir el bot", href: destacado.href ?? BOT_URL }}
        onDismiss={() => {
          escribirCookieOculta(destacado.clave, hoy);
          setOculto(true);
        }}
      />
    );
  }

  if (resto.length > 0) {
    return (
      <>
        <NoticeStrip
          count={resto.length}
          title={resto.length === 1 ? "1 cosa por hacer" : `${resto.length} cosas por hacer`}
          subtitle={`La próxima: ${resto[0].texto}`}
          onClick={() => setAbierto(true)}
        />
        <Sheet open={abierto} title="Por hacer" onClose={() => setAbierto(false)}>
          {resto.map((p, i) => {
            const badge = BADGE[p.nivel];
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 0" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{p.texto}</span>
                    {badge && <Badge type={badge.type}>{badge.label}</Badge>}
                  </div>
                  {p.detalle && <div className="text-tertiary">{p.detalle}</div>}
                </div>
                <Button variant="secondary" size="sm" href={p.href ?? BOT_URL} target={p.href ? undefined : "_blank"}>
                  {p.href ? "Ver" : "Abrir el bot"}
                </Button>
              </div>
            );
          })}
        </Sheet>
      </>
    );
  }

  return <p className="text-tertiary">Todo al día</p>;
}
