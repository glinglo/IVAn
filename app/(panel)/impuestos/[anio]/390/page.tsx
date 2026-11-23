import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@glinglo/vela-ds";
import { cargarLibro } from "@/lib/libro";
import { modelo390 } from "@/lib/calculo";
import { euros, fechaES, hoyMadrid, plazoTrimestral } from "@/lib/fiscal";
import { Tabla, type Linea } from "@/components/Casillas";

export default async function Anual({
  params,
  searchParams,
}: {
  params: Promise<{ anio: string }>;
  searchParams: Promise<{ ultimo?: string }>;
}) {
  const { anio: a } = await params;
  const { ultimo: u } = await searchParams;
  const anio = Number(a);
  if (!Number.isInteger(anio)) notFound();
  const ultimo = u === "devolver" ? "devolver" : "compensar";
  const libro = await cargarLibro(anio);
  const plazo = plazoTrimestral(anio, 4);
  const provisional = hoyMadrid() <= `${anio}-12-31`;
  const presentado = libro.presentaciones.some((p) => p.modelo === "390" && p.anio === anio);

  let m: ReturnType<typeof modelo390>;
  try {
    m = modelo390(libro.datos, anio, ultimo);
  } catch (e) {
    return (
      <>
        <PageHeader title={`390 · ${anio}`} back={{ label: "4T", href: `/impuestos/${anio}/4` }} />
        <section className="card">
          <p>⛔ {e instanceof Error ? e.message : String(e)}</p>
        </section>
      </>
    );
  }
  const t4 = m.trimestres[3];
  const sinCero = (ls: Linea[]) => ls.filter(([, , v, res]) => v !== 0 || res);

  return (
    <>
      <PageHeader title={`390 · ${anio}`} back={{ label: "4T", href: `/impuestos/${anio}/4` }} />
      <p className="nota">
        Resumen anual de IVA. Plazo: hasta el {fechaES(plazo.fin)}, junto al 303 del 4T. Es la suma de tus cuatro 303
        del año, así que no sale nada nuevo a pagar. Cuando lo presentes, díselo a IVAn: «presentado el 390».
        {provisional ? " Provisional: el año no ha terminado y las cifras cambian con cada factura y gasto." : ""}
        {presentado ? " Ya consta como presentado." : ""}
      </p>
      {!m.cuadra ? (
        <section className="card">
          <p>
            ⚠️ El resultado anual ({euros(m.c86)}) no coincide con lo que dicen los 303 ({euros(m.c95 - m.c97 - m.c98 - m.c662)}). Revisa
            los trimestres antes de presentarlo.
          </p>
        </section>
      ) : null}

      <section className="card">
        <h2>Datos estadísticos</h2>
        <table className="tabla">
          <tbody>
            <tr><td className="cas">Clave</td><td>A05 · Resto de actividades profesionales</td><td></td></tr>
            <tr><td className="cas">IAE</td><td>El epígrafe de tu alta censal</td><td></td></tr>
            <tr><td className="cas">347</td><td>Sin marcar: ningún cliente ni proveedor español pasa de 3.005,06 €</td><td></td></tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>IVA devengado</h2>
        <Tabla
          lineas={[
            ["05", "Régimen ordinario al 21 %: base", m.c05],
            ["06", "Régimen ordinario al 21 %: cuota", m.c06],
            ["551", "Adquisiciones intracomunitarias de servicios al 21 %: base", m.c551],
            ["552", "Adquisiciones intracomunitarias de servicios al 21 %: cuota", m.c552],
            ["27", "Otros supuestos de inversión del sujeto pasivo: base", m.c27],
            ["28", "Otros supuestos de inversión del sujeto pasivo: cuota", m.c28],
            ["33", "Total bases IVA", m.c33],
            ["34", "Total cuotas IVA", m.c34],
            ["47", "Total cuotas IVA y recargo de equivalencia", m.c47, true],
          ]}
        />
      </section>

      <section className="card">
        <h2>IVA deducible</h2>
        <Tabla
          lineas={sinCero([
            ["190", "Operaciones interiores corrientes al 4 %: base", m.c190],
            ["191", "Operaciones interiores corrientes al 4 %: cuota", m.c191],
            ["603", "Operaciones interiores corrientes al 10 %: base", m.c603],
            ["604", "Operaciones interiores corrientes al 10 %: cuota", m.c604],
            ["605", "Operaciones interiores corrientes al 21 %: base", m.c605, false],
            ["606", "Operaciones interiores corrientes al 21 %: cuota", m.c606, false],
            ["48", "Total operaciones interiores corrientes: base", m.c48, false],
            ["49", "Total operaciones interiores corrientes: cuota", m.c49, false],
            ["637", "Adquisiciones intracomunitarias de servicios al 21 %: base", m.c637, false],
            ["638", "Adquisiciones intracomunitarias de servicios al 21 %: cuota", m.c638, false],
            ["597", "Total adquisiciones intracomunitarias de servicios: base", m.c597, false],
            ["598", "Total adquisiciones intracomunitarias de servicios: cuota", m.c598, false],
            ["64", "Suma de deducciones", m.c64, true],
            ["65", "Resultado régimen general (47 − 64)", m.c65, true],
          ])}
        />
        <p className="nota">
          En 605/606 van juntos el IVA español al 21 % y los servicios de fuera de la UE con inversión del sujeto pasivo, igual que en
          las casillas 28/29 del 303.
        </p>
      </section>

      <section className="card">
        <h2>Resultado de la liquidación</h2>
        <Tabla
          lineas={[
            ["84", "Suma de resultados", m.c84],
            ["85", "Compensación de cuotas del ejercicio anterior", m.c85],
            ["86", "Resultado de la liquidación", m.c86, true],
          ]}
        />
      </section>

      <section className="card">
        <h2>Resultado de las liquidaciones (tus cuatro 303)</h2>
        <Tabla
          lineas={[
            ["95", "Total resultados a ingresar en las autoliquidaciones del ejercicio", m.c95],
            ["97", "Último periodo: a compensar", m.c97],
            ["98", "Último periodo: a devolver", m.c98],
            ["662", "Cuotas pendientes de compensación generadas en el ejercicio", m.c662],
          ]}
        />
        {t4.c71 < 0 ? (
          <p className="nota">
            El 303 del 4T sale a tu favor ({euros(-t4.c71)}). En el 4T puedes pedir que te lo devuelvan o dejarlo para compensar en
            2027; el 390 tiene que decir lo mismo que marques en el 303.{" "}
            {ultimo === "compensar" ? (
              <Link href={`/impuestos/${anio}/390?ultimo=devolver`}>Ver con devolución ›</Link>
            ) : (
              <Link href={`/impuestos/${anio}/390`}>Ver con compensación ›</Link>
            )}
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2>Volumen de operaciones</h2>
        <Tabla
          lineas={[
            ["99", "Operaciones en régimen general", m.c99],
            ["103", "Entregas intracomunitarias de bienes y servicios", m.c103],
            ["110", "Operaciones no sujetas por reglas de localización", m.c110],
            ["108", "Total volumen de operaciones", m.c108, true],
          ]}
        />
      </section>
    </>
  );
}
