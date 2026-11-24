"use client";

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react";

const ResultadosContext = createContext<{ isPending: boolean; startTransition: TransitionStartFunction } | null>(null);

export function useResultadosTransition() {
  return useContext(ResultadosContext);
}

/** Envuelve el bloque «Resultados»: atenúa su contenido mientras `Periodo` cambia de página. */
export function BloqueResultados({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();

  return (
    <ResultadosContext.Provider value={{ isPending, startTransition }}>
      <div className={isPending ? "opacity-60" : undefined} aria-busy={isPending}>
        {children}
      </div>
    </ResultadosContext.Provider>
  );
}
