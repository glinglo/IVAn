import { Suspense } from "react";
import { exigirSesion } from "@/lib/auth";
import { contextoPasos, siguientesPasos } from "@/lib/libro";
import { hoyMadrid } from "@/lib/fiscal";
import { NavMovil, NavEscritorio } from "@/components/PanelNav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await exigirSesion();
  const ctx = await contextoPasos(hoyMadrid());
  const pasoPlazo = siguientesPasos(ctx).find((p) => p.clave === "plazo" && p.nivel !== "info");
  const trimestreAviso = pasoPlazo?.href?.match(/\/impuestos\/\d+\/(\d)$/)?.[1];
  return (
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      <Suspense fallback={null}>
        <NavEscritorio trimestreAviso={trimestreAviso} />
      </Suspense>
      <main className="app" style={{ flex: 1 }}>{children}</main>
      <Suspense fallback={null}>
        <NavMovil trimestreAviso={trimestreAviso} />
      </Suspense>
    </div>
  );
}
