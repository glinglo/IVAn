import { Suspense } from "react";
import { exigirSesion } from "@/lib/auth";
import { contextoPasos, siguientesPasos } from "@/lib/libro";
import { hoyMadrid } from "@/lib/fiscal";
import { NavMovil, NavEscritorio } from "@/components/PanelNav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await exigirSesion();
  const ctx = await contextoPasos(hoyMadrid());
  const avisoImpuestos = siguientesPasos(ctx)[0]?.texto.startsWith("Presentar") ?? false;
  return (
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      <Suspense fallback={null}>
        <NavEscritorio avisoImpuestos={avisoImpuestos} />
      </Suspense>
      <main className="app" style={{ flex: 1 }}>{children}</main>
      <Suspense fallback={null}>
        <NavMovil avisoImpuestos={avisoImpuestos} />
      </Suspense>
    </div>
  );
}
