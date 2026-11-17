import Link from "next/link";
import { notFound } from "next/navigation";
import { cargarLibro, resumenTrimestre } from "@/lib/libro";
import { euros, fechaES, plazoTrimestral } from "@/lib/fiscal";

type Linea = [string, string, number, boolean?];

function Tabla({ lineas }: { lineas: Linea[] }) {
  return (
    <table className="tabla">
      <tbody>
        {lineas.map(([cas, txt, v, res]) => (
          <tr key={cas + txt} className={res ? "res" : v === 0 ? "cero" : ""}>
            <td className="cas">{cas}</td>
            <td>{txt}</td>
            <td>{euros(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Trimestre({ params }: { params: Promise<{ anio: string; t: string }> }) {
  const { anio: a, t: tt } = await params;
  const anio = Number(a);
  const t = Number(tt);
  if (!Number.isInteger(anio) || ![1, 2, 3, 4].includes(t)) notFound();
  const libro = await cargarLibro(anio);
  const { m303, m130, m349, presentado } = resumenTrimestre(libro, t);
  const plazo = plazoTrimestral(anio, t);
  const estado = (m: string) =>
    presentado(m) ? <span className="badge ok">presentado</span> : <span className="badge warn">pendiente</span>;

  return (
    <>
      <div className="cabecera">
        <h1>{t}T {anio}</h1>
        <span className="sub"><Link href={`/?anio=${anio}`}>‹ Inicio</Link></span>
      </div>
      <p className="nota">
        Plazo: del {fechaES(plazo.apertura)} al {fechaES(plazo.fin)} (domiciliación hasta aprox. el {fechaES(plazo.finDomiciliacion)}).
        Cuando lo presentes, díselo a IVAn: «presentado el 303 del {t}T, {euros(m303.c71)}».
      </p>

      <section className="card">
        <h2>Modelo 303 · IVA {estado("303")}</h2>
        <Tabla
          lineas={[
            ["07", "Base al 21 %", m303.c07],
            ["09", "Cuota al 21 %", m303.c09],
            ["10", "Base adquisiciones intracomunitarias", m303.c10],
            ["11", "Cuota adquisiciones intracomunitarias", m303.c11],
            ["12", "Base otras operaciones ISP", m303.c12],
            ["13", "Cuota otras operaciones ISP", m303.c13],
            ["27", "Total cuota devengada", m303.c27],
            ["28", "Base deducible operaciones interiores", m303.c28],
            ["29", "Cuota deducible operaciones interiores", m303.c29],
            ["36", "Base deducible adquisiciones intracom.", m303.c36],
            ["37", "Cuota deducible adquisiciones intracom.", m303.c37],
            ["45", "Total a deducir", m303.c45],
            ["46", "Resultado régimen general", m303.c46],
            ["59", "Entregas intracomunitarias de servicios", m303.c59],
            ["120", "Operaciones no sujetas (fuera UE)", m303.c120],
            ["110", "Cuotas a compensar de periodos anteriores", m303.c110],
            ["78", "Cuotas a compensar aplicadas", m303.c78],
            ["87", "Cuotas a compensar pendientes para periodos posteriores", m303.c87],
            ["71", m303.c71 >= 0 ? "Resultado: a ingresar" : "Resultado: a compensar", m303.c71, true],
          ]}
        />
      </section>

      <section className="card">
        <h2>Modelo 130 · IRPF {estado("130")}</h2>
        <Tabla
          lineas={[
            ["01", "Ingresos computables (acumulado)", m130.c01],
            ["02", "Gastos fiscalmente deducibles", m130.c02],
            ["03", "Rendimiento neto", m130.c03],
            ["04", "20 % del rendimiento neto", m130.c04],
            ["05", "Pagos fraccionados anteriores", m130.c05],
            ["06", "Retenciones e ingresos a cuenta", m130.c06],
            ["07", "Resultado", m130.c07],
            ["19", "A ingresar", m130.aIngresar, true],
          ]}
        />
        <p className="nota">
          Gastos [02] = facturas {euros(m130.pyg.gastosFacturas)} + cuota de autónomo {euros(m130.pyg.seguridadSocial)} +
          amortización {euros(m130.pyg.amortizaciones)} + difícil justificación {euros(m130.pyg.dificilJustificacion)}.
          {m130.t > 1 && !m130.usaPagosReales && " Los pagos anteriores [05] son los calculados aquí; si la gestoría presentó otros importes, díselo a IVAn."}
        </p>
      </section>

      <section className="card">
        <h2>Modelo 349 · operaciones UE {estado("349")}</h2>
        {m349.length === 0 ? (
          <p className="nota">Sin operaciones intracomunitarias este trimestre: no hay que presentarlo.</p>
        ) : (
          <table className="tabla">
            <tbody>
              {m349.map((l) => (
                <tr key={l.clave + l.nif + l.nombre}>
                  <td className="cas">{l.clave}</td>
                  <td>
                    {l.nombre}
                    <div className="nota">{l.numero ? `${l.pais ?? "¿país?"} · ${l.numero}` : "falta el VAT"}</div>
                  </td>
                  <td>{euros(l.base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
