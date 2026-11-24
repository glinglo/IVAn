import { PageHeader } from "@glinglo/vela-ds";
import { cargarLibro } from "@/lib/libro";
import { euros, fechaES, hoyMadrid, trimestreDe } from "@/lib/fiscal";
import { Chips, Fila } from "@/components/Filas";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { db } from "@/lib/db";

const corto: Record<string, string> = {
  "IVA soportado": "IVA",
  "ISP UE": "ISP UE",
  "ISP fuera UE": "ISP extra-UE",
  "Sin IVA deducible": "sin IVA",
};

export default async function Gastos({ searchParams }: { searchParams: Promise<{ anio?: string; t?: string }> }) {
  const sp = await searchParams;
  const anioActual = Number(hoyMadrid().slice(0, 4));
  const anio = Number(sp.anio ?? anioActual);
  const t = sp.t ? Number(sp.t) : null;
  const [libro, borr] = await Promise.all([
    cargarLibro(anio),
    db().from("gastos").select("id", { count: "exact", head: true }).eq("estado", "borrador"),
  ]);
  const gastos = libro.gastos.filter((g) => !t || trimestreDe(g.fecha).t === t);
  const base = gastos.reduce((s, g) => s + g.base, 0);
  const iva = gastos.reduce((s, g) => s + g.iva, 0);

  return (
    <>
      <PageHeader title="Gastos" subtitle={String(anio)} actions={<AccionesCabecera anio={anio} anioActual={anioActual} />} />
      <Chips base="/gastos" actual={t} anio={anio} />
      <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="kpi"><div className="etq">Gastado (base)</div><div className="valor">{euros(base)}</div></div>
        <div className="kpi"><div className="etq">IVA deducible</div><div className="valor">{euros(iva)}</div></div>
      </div>
      {(borr.count ?? 0) > 0 && (
        <div className="card nota">Tienes {borr.count} gasto(s) sin confirmar en el bot.</div>
      )}
      <section className="card">
        {gastos.length === 0 ? (
          <p className="nota">No hay gastos en este periodo. Mándale una foto o un PDF al bot.</p>
        ) : (
          <div className="filas">
            {gastos.map((g) => (
              <Fila
                key={g.id}
                tit={g.proveedor ?? "?"}
                det={
                  <>
                    {fechaES(g.fecha)} · {g.concepto ?? ""}{" "}
                    <span className="badge">
                      {corto[g.tipo] ?? g.tipo}
                      {(g.desglose ?? []).length > 0 && ` · ${g.desglose!.map((d) => `${d.pct} %`).join(" + ")}`}
                    </span>
                  </>
                }
                imp={g.base + g.iva}
                href={g.archivo_path ? `/api/archivo?path=${encodeURIComponent(g.archivo_path)}` : null}
              />
            ))}
          </div>
        )}
      </section>
      <p className="nota">ISP: el proveedor no cobra IVA y te lo autorrepercutes y deduces en el 303 (neto 0). Las cuotas de autónomo y la amortización del Mac se suman en el P&L de Inicio.</p>
    </>
  );
}
