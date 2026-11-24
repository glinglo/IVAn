"use client";

import { useState } from "react";
import { Badge, Button, NoticeCard, NoticeStrip, Sheet } from "@glinglo/vela-ds";
import { cuandoPaso, type Paso } from "@/lib/libro";
import { avisosVisibles } from "@/lib/inicio";

const BOT_URL = "https://t.me/Ivanelgestorbot";

const BADGE: Record<Paso["nivel"], { label: string; type: "destructive" | "onhold" } | null> = {
  urgente: { label: "Urgente", type: "destructive" },
  pendiente: { label: "Pendiente", type: "onhold" },
  info: null,
};

function badgePaso(p: Paso): { label: string; type: "destructive" | "onhold" } | null {
  const cuando = cuandoPaso(p);
  if (cuando) return { label: cuando, type: p.nivel === "urgente" ? "destructive" : "onhold" };
  return BADGE[p.nivel];
}

function escribirCookieOculta(clave: string, hoy: string) {
  document.cookie = `ivan_aviso_oculto=${clave}:${hoy}; max-age=${60 * 60 * 24}; path=/; SameSite=Lax`;
}

export function AvisosInicio({ destacado, resto, ocultoHoy, hoy }: { destacado: Paso | null; resto: Paso[]; ocultoHoy: boolean; hoy: string }) {
  const [oculto, setOculto] = useState(ocultoHoy);
  const [abierto, setAbierto] = useState(false);

  const { tarjeta, franja } = avisosVisibles({ destacado, resto, oculto });

  return (
    <>
      {tarjeta && (
        <NoticeCard
          variant={tarjeta.nivel === "urgente" ? "urgent" : tarjeta.clave === "facturar" || tarjeta.clave === "gastos" ? "pending" : "brand"}
          title={tarjeta.texto}
          description={tarjeta.detalle}
          action={
            tarjeta.href
              ? { label: "Ver", href: tarjeta.href }
              : { label: "Abrir el bot", href: BOT_URL, target: "_blank" }
          }
          onDismiss={() => {
            escribirCookieOculta(tarjeta.clave, hoy);
            setOculto(true);
          }}
        />
      )}

      {franja.length > 0 ? (
        <>
          <NoticeStrip
            count={franja.length}
            title={franja.length === 1 ? "1 cosa por hacer" : `${franja.length} cosas por hacer`}
            subtitle={`La próxima: ${franja[0].texto}`}
            onClick={() => setAbierto(true)}
          />
          <Sheet open={abierto} title="Por hacer" onClose={() => setAbierto(false)}>
          {franja.map((p, i) => {
            const badge = badgePaso(p);
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
      ) : (
        !tarjeta && <NoticeStrip title="Todo al día" />
      )}
    </>
  );
}
