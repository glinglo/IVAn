import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@glinglo/vela-ds";
import { exigirSesion } from "@/lib/auth";
import { contextoPasos, siguientesPasos } from "@/lib/libro";
import { hoyMadrid } from "@/lib/fiscal";
import { getAjustes } from "@/lib/db";
import { CabeceraMovil, NavEscritorio } from "@/components/PanelNav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await exigirSesion();
  const [ctx, ajustes] = await Promise.all([contextoPasos(hoyMadrid()), getAjustes()]);
  const pasoPlazo = siguientesPasos(ctx).find((p) => p.clave === "plazo" && p.nivel !== "info");
  const trimestreAviso = pasoPlazo?.href?.match(/\/impuestos\/\d+\/(\d)$/)?.[1];
  const cookieStore = await cookies();
  const barraContraida = cookieStore.get("ivan_barra")?.value === "contraida";
  return (
    <AppShell
      sidebar={
        <Suspense fallback={null}>
          <NavEscritorio trimestreAviso={trimestreAviso} barraContraida={barraContraida} />
        </Suspense>
      }
      mainClassName="max-w-[560px] mx-auto px-4 pt-4 pb-8 lg:max-w-7xl"
    >
      <Suspense fallback={null}>
        <CabeceraMovil trimestreAviso={trimestreAviso} nombre={ajustes.nombre} />
      </Suspense>
      {children}
    </AppShell>
  );
}
