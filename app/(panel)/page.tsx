import Link from "next/link";
import { PageHeader } from "@glinglo/vela-ds";
import { contextoPasos, cargarLibro, pygHasta, resumenTrimestre, siguientesPasos } from "@/lib/libro";
import { euros, hoyMadrid, trimestreDe } from "@/lib/fiscal";
import { Fila } from "@/components/Filas";
import { AccionesCabecera } from "@/components/AccionesCabecera";

export default async function Inicio({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = Number((await searchParams).anio ?? anioActual);
  const ctx = await contextoPasos(hoy);
  const libro = anio === anioActual ? ctx.libro : await cargarLibro(anio);
  const hasta = anio === anioActual ? hoy : `${anio}-12-31`;
  const p = pygHasta(libro, hasta);
  const pasos = siguientesPasos(ctx);
  const tActual = anio === anioActual ? trimestreDe(hoy).t : 4;
  const trimestres = [1, 2, 3, 4].map((t) => ({ t, ...resumenTrimestre(libro, t) }));
  const gastosTotales = p.gastosFacturas + p.seguridadSocial + p.amortizaciones;

  return (
    <>
      <PageHeader
        title="Hola, Jose"
        subtitle={anio === anioActual ? `Tus resultados de ${anio}, hasta hoy` : `Tus resultados de ${anio} (año cerrado)`}
        actions={<AccionesCabecera anio={anio} anioActual={anioActual} />}
      />

      <div className="kpis">
        <div className="kpi">
          <div className="etq">Ventas</div>
          <div className="valor">{euros(p.ingresos).replace(",00 €", " €")}</div>
        </div>
        <div className="kpi">
          <div className="etq">Gastos</div>
          <div className="valor">{euros(gastosTotales).replace(/,\d\d €/, " €")}</div>
        </div>
        <div className="kpi">
          <div className="etq">Beneficio</div>
          <div className="valor">{euros(p.rendimientoNeto).replace(/,\d\d €/, " €")}</div>
        </div>
      </div>

      {pasos.length > 0 && (
        <section className="card">
          <h2>Siguientes pasos</h2>
          {pasos.map((x, i) => (
            <div key={i} className={`paso ${x.nivel}`}>
              <span className="punto" />
              <div>
                <div>{x.href ? <Link href={x.href}>{x.texto}</Link> : x.texto}</div>
                {x.detalle && <div className="det">{x.detalle}</div>}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Pérdidas y ganancias</h2>
        <div className="filas">
          <Fila tit="Ingresos" imp={p.ingresos} />
          <Fila tit="Gastos con factura" imp={-p.gastosFacturas} clase="sangria" />
          <Fila tit="Cuota de autónomo" imp={-p.seguridadSocial} clase="sangria" />
          <Fila tit="Amortizaciones" imp={-p.amortizaciones} clase="sangria" />
          <Fila tit="Gastos de difícil justificación (5 %)" imp={-p.dificilJustificacion} clase="sangria" />
          <Fila tit="Rendimiento neto" imp={p.rendimientoNeto} clase="total" />
        </div>
      </section>

      <section className="card">
        <h2>Trimestres</h2>
        <div className="filas">
          {trimestres
            .filter((x) => x.t <= tActual)
            .map((x) => {
              const hecho = x.presentado("303") && x.presentado("130");
              return (
                <Link key={x.t} href={`/impuestos/${anio}/${x.t}`} className="fila">
                  <div className="izq">
                    <div className="tit">
                      {x.t}T {hecho ? <span className="badge ok">presentado</span> : x.t === tActual && anio === anioActual ? <span className="badge">en curso</span> : <span className="badge warn">pendiente</span>}
                    </div>
                    <div className="det">
                      IVA {euros(x.m303.c71)} · IRPF {euros(x.m130.aIngresar)}
                    </div>
                  </div>
                  <div className="imp">›</div>
                </Link>
              );
            })}
        </div>
      </section>

      <a className="boton" href={`/api/exportar?anio=${anio}`}>Descargar Excel {anio}</a>
    </>
  );
}
