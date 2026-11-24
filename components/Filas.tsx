import { euros } from "@/lib/fiscal";

export function Fila({ tit, det, imp, clase, href }: { tit: React.ReactNode; det?: React.ReactNode; imp: number | string; clase?: string; href?: string | null }) {
  const contenido = (
    <>
      <div className="izq">
        <div className="tit">{tit}</div>
        {det ? <div className="det">{det}</div> : null}
      </div>
      <div className="imp">{typeof imp === "number" ? euros(imp) : imp}</div>
    </>
  );
  return href ? (
    <a className={`fila ${clase ?? ""}`} href={href} target="_blank" rel="noreferrer">
      {contenido}
    </a>
  ) : (
    <div className={`fila ${clase ?? ""}`}>{contenido}</div>
  );
}

export function Chips({ base, actual, anio }: { base: string; actual: number | null; anio: number }) {
  const ops: [string, number | null][] = [["Todo", null], ["1T", 1], ["2T", 2], ["3T", 3], ["4T", 4]];
  return (
    <div className="chips">
      {ops.map(([label, t]) => (
        <a key={label} href={`${base}?anio=${anio}${t ? `&t=${t}` : ""}`} className={`chip ${actual === t ? "activo" : ""}`}>
          {label}
        </a>
      ))}
    </div>
  );
}
