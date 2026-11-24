"use client";

import { useState } from "react";
import { NoticeCard } from "@glinglo/vela-ds";
import { cuandoPaso, type Paso } from "@/lib/libro";

const BOT_URL = "https://t.me/Ivanelgestorbot";
const VARIANTE_NIVEL = { urgente: "urgent", pendiente: "pending", info: "brand" } as const;
const NIVEL_LABEL = { urgente: "Urgente", pendiente: "Pendiente", info: "Info" } as const;

function escribirCookieOculta(clave: string, hoy: string) {
  document.cookie = `ivan_aviso_oculto=${clave}:${hoy}; max-age=${60 * 60 * 24}; path=/; SameSite=Lax`;
}

/** «Por hacer» en tarjetas, solo en escritorio: la primera tarea grande (con X para ocultarla) y el resto compactas. */
export function PorHacerEscritorio({ destacado, resto, ocultoHoy, hoy }: { destacado: Paso | null; resto: Paso[]; ocultoHoy: boolean; hoy: string }) {
  const [oculto, setOculto] = useState(ocultoHoy);
  const tareas = destacado ? [destacado, ...resto] : resto;
  const mostrarGrande = !!destacado && !oculto;

  if (tareas.length === 0) {
    // NoticeCard size="sm" exige `href`; sin tarea a la que enlazar, se queda en texto.
    return <p className="text-tertiary">Todo al día</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {tareas.map((paso, i) => {
        const variant = VARIANTE_NIVEL[paso.nivel];
        const accion = paso.href ? { label: "Ver", href: paso.href } : { label: "Abrir el bot", href: BOT_URL, target: "_blank" };
        if (i === 0 && mostrarGrande) {
          return (
            <NoticeCard
              key={paso.clave}
              variant={variant}
              eyebrow={`Por hacer · 1 de ${tareas.length} · ${NIVEL_LABEL[paso.nivel]}`}
              title={paso.texto}
              description={paso.detalle}
              action={accion}
              onDismiss={() => {
                escribirCookieOculta(paso.clave, hoy);
                setOculto(true);
              }}
            />
          );
        }
        const cuando = cuandoPaso(paso) ?? NIVEL_LABEL[paso.nivel];
        return (
          <NoticeCard
            key={paso.clave}
            size="sm"
            variant={variant}
            eyebrow={`${i + 1} de ${tareas.length} · ${cuando}`}
            title={paso.texto}
            description={paso.detalle}
            href={accion.href}
            target={accion.target}
          />
        );
      })}
    </div>
  );
}
