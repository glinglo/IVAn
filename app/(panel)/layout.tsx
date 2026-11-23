import { Suspense } from "react";
import { cookies } from "next/headers";
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
  const cookieStore = await cookies();
  const barraContraida = cookieStore.get("ivan_barra")?.value === "contraida";
  return (
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      <Suspense fallback={null}>
        <NavEscritorio trimestreAviso={trimestreAviso} barraContraida={barraContraida} />
      </Suspense>
      <main className="app lg:pb-10 pb-[calc(96px+env(safe-area-inset-bottom))]" style={{ flex: 1 }}>
        {children}
      </main>
      <Suspense fallback={null}>
        <NavMovil trimestreAviso={trimestreAviso} />
      </Suspense>
    </div>
  );
}
