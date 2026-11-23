import { PageHeader } from "@glinglo/vela-ds";
import { cargarLibro } from "@/lib/libro";
import { euros, fechaES, hoyMadrid, trimestreDe } from "@/lib/fiscal";
import { Chips, Fila } from "@/components/Filas";
import { AnioDropdown } from "@/components/AnioDropdown";

export default async function Ventas({ searchParams }: { searchParams: Promise<{ anio?: string; t?: string }> }) {
  const sp = await searchParams;
  const anioActual = Number(hoyMadrid().slice(0, 4));
  const anio = Number(sp.anio ?? anioActual);
  const t = sp.t ? Number(sp.t) : null;
  const libro = await cargarLibro(anio);
  const facturas = libro.facturas.filter((f) => !t || trimestreDe(f.fecha).t === t);
  const base = facturas.reduce((s, f) => s + f.base, 0);
  const total = facturas.reduce((s, f) => s + f.total, 0);

  return (
    <>
      <PageHeader title="Ventas" subtitle={String(anio)} actions={<AnioDropdown anio={anio} anioActual={anioActual} />} />
      <Chips base="/ventas" actual={t} anio={anio} />
      <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="kpi"><div className="etq">Facturado (base)</div><div className="valor">{euros(base)}</div></div>
        <div className="kpi"><div className="etq">Facturas</div><div className="valor">{facturas.length}</div></div>
      </div>
      <section className="card">
        {facturas.length === 0 ? (
          <p className="nota">No hay facturas en este periodo.</p>
        ) : (
          <div className="filas">
            {facturas.map((f) => (
              <Fila
                key={f.id}
                tit={<>{f.numero} · {f.cliente}</>}
                det={<>{fechaES(f.fecha)} · {f.concepto}{f.pdf_path ? "" : " · sin PDF"}</>}
                imp={f.total}
                href={f.pdf_path ? `/api/archivo?path=${encodeURIComponent(f.pdf_path)}` : null}
              />
            ))}
          </div>
        )}
      </section>
      {facturas.length > 0 && <p className="nota">Total cobrado con IVA y retenciones: {euros(total)}. Las facturas emitidas no se pueden modificar; para corregir una, pide al bot una rectificativa.</p>}
    </>
  );
}
