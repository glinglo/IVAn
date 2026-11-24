"use client";

import { cloneElement, isValidElement, useState, type ReactElement } from "react";
import { Sheet } from "@glinglo/vela-ds";

/** PDF o foto por extensión de su ruta en el storage. */
export const mimeDeArchivo = (path: string): "pdf" | "imagen" => (/\.pdf$/i.test(path) ? "pdf" : "imagen");

/**
 * Abre el archivo de una factura o un gasto: en escritorio, en un `Sheet` lateral con un visor
 * dentro; en móvil, en otra pestaña (los visores de PDF en `iframe` van mal en iOS). `children` es
 * la fila ya pintada por la página (datos, sin funciones); aquí se le añade el `onClick` que abre
 * uno u otro, porque esa función no puede cruzar de la página de servidor a este componente.
 */
export function VisorArchivo({
  path,
  titulo,
  fecha,
  importe,
  children,
}: {
  path: string | null;
  titulo: string;
  fecha: string;
  importe: string;
  children: ReactElement;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!path || !isValidElement(children)) return children;

  const url = `/api/archivo?path=${encodeURIComponent(path)}`;
  const abrir = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setAbierto(true);
    else window.open(url, "_blank");
  };

  return (
    <>
      {cloneElement(children, { onClick: abrir } as Record<string, unknown>)}
      <Sheet open={abierto} onClose={() => setAbierto(false)} title={titulo} closeLabel="Cerrar" side="right" size="lg">
        <div className="flex flex-col gap-3 h-full">
          <p className="text-caption text-tertiary">
            {fecha} · {importe}
          </p>
          <div className="flex-1 min-h-0">
            {mimeDeArchivo(path) === "imagen" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={titulo} className="w-full h-auto rounded-md" />
            ) : (
              <iframe src={url} title={titulo} className="w-full h-full min-h-[70vh] rounded-md border border-separator" />
            )}
          </div>
          <div className="flex gap-4">
            <a href={url} target="_blank" rel="noreferrer" className="text-link-secondary">
              Abrir en otra pestaña
            </a>
            <a href={url} download className="text-link-secondary">
              Descargar
            </a>
          </div>
        </div>
      </Sheet>
    </>
  );
}
