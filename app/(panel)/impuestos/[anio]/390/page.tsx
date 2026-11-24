import { notFound } from "next/navigation";
import { Alert, Badge, Card, CopyValue, PageHeader } from "@glinglo/vela-ds";
import { cargarLibro, sinDatos } from "@/lib/libro";
import { modelo390 } from "@/lib/calculo";
import { euros, fechaES, formatoSede, hoyMadrid, plazoTrimestral } from "@/lib/fiscal";

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

  if (sinDatos(libro)) {
    return (
      <>
        <PageHeader title={`390 · ${anio}`} back={{ label: "Impuestos", href: `/impuestos?anio=${anio}` }} />
        <Card>
          <p className="text-body">
            IVAn no tiene las facturas de {anio}, así que no puede calcular el 390. Si la gestoría lo presentó, la hoja de la
            gestoría tiene el detalle.
          </p>
        </Card>
      </>
    );
  }

  let m: ReturnType<typeof modelo390>;
  try {
    m = modelo390(libro.datos, anio, ultimo);
  } catch (e) {
    return (
      <>
        <PageHeader title={`390 · ${anio}`} back={{ label: "4T", href: `/impuestos/${anio}/4` }} />
        <Alert variant="warning">{e instanceof Error ? e.message : String(e)}</Alert>
      </>
    );
  }
  const t4 = m.trimestres[3];

  const casillas = (lineas: [string, string, number][]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {lineas.map(([cas, nombre, v]) => (
        <CopyValue key={cas} code={`[${cas}]`} label={nombre} display={euros(v)} copyText={formatoSede(v)} className={v === 0 ? "opacity-60" : undefined} />
      ))}
    </div>
  );
  const sinCero = (lineas: [string, string, number][]) => lineas.filter(([, , v]) => v !== 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`390 · ${anio}`}
        subtitle={`Resumen anual de IVA · plazo hasta el ${fechaES(plazo.fin)}`}
        back={{ label: "4T", href: `/impuestos/${anio}/4` }}
      />

      <p className="text-body">
        Es la suma de tus cuatro 303 del año, así que no sale nada nuevo a pagar. Cuando lo presentes, díselo al bot:
        «presentado el 390».
        {presentado ? " Ya consta como presentado." : provisional ? " Provisional: el año no ha terminado y las cifras cambian con cada factura y gasto." : ""}
      </p>

      {!m.cuadra && (
        <Alert variant="warning">
          El resultado anual ({euros(m.c86)}) no coincide con lo que dicen los 303 ({euros(m.c95 - m.c97 - m.c98 - m.c662)}). Revisa
          los trimestres antes de presentarlo.
        </Alert>
      )}

      <Card className="gap-3">
        <h2 className="text-eyebrow text-tertiary">IVA devengado</h2>
        {casillas([
          ["05", "Régimen ordinario al 21 %: base", m.c05],
          ["06", "Régimen ordinario al 21 %: cuota", m.c06],
          ["551", "Adquisiciones intracomunitarias de servicios al 21 %: base", m.c551],
          ["552", "Adquisiciones intracomunitarias de servicios al 21 %: cuota", m.c552],
          ["27", "Otros supuestos de ISP: base", m.c27],
          ["28", "Otros supuestos de ISP: cuota", m.c28],
          ["33", "Total bases IVA", m.c33],
          ["34", "Total cuotas IVA", m.c34],
          ["47", "Total cuotas IVA y recargo de equivalencia", m.c47],
        ])}
      </Card>

      <Card className="gap-3">
        <h2 className="text-eyebrow text-tertiary">IVA deducible</h2>
        {casillas(
          sinCero([
            ["190", "Operaciones interiores corrientes al 4 %: base", m.c190],
            ["191", "Operaciones interiores corrientes al 4 %: cuota", m.c191],
            ["603", "Operaciones interiores corrientes al 10 %: base", m.c603],
            ["604", "Operaciones interiores corrientes al 10 %: cuota", m.c604],
            ["605", "Operaciones interiores corrientes al 21 %: base", m.c605],
            ["606", "Operaciones interiores corrientes al 21 %: cuota", m.c606],
            ["48", "Total operaciones interiores corrientes: base", m.c48],
            ["49", "Total operaciones interiores corrientes: cuota", m.c49],
            ["637", "Adquisiciones intracomunitarias de servicios: base", m.c637],
            ["638", "Adquisiciones intracomunitarias de servicios: cuota", m.c638],
            ["597", "Total adquisiciones intracomunitarias: base", m.c597],
            ["598", "Total adquisiciones intracomunitarias: cuota", m.c598],
            ["64", "Suma de deducciones", m.c64],
            ["65", "Resultado régimen general (47 − 64)", m.c65],
          ]),
        )}
        <p className="text-caption text-tertiary">
          En 605/606 van juntos el IVA español al 21 % y los servicios de fuera de la UE con inversión del sujeto pasivo, igual
          que en las casillas 28/29 del 303.
        </p>
      </Card>

      <Card className="gap-3">
        <h2 className="text-eyebrow text-tertiary">Resultado de la liquidación</h2>
        {casillas([
          ["84", "Suma de resultados", m.c84],
          ["85", "Compensación de cuotas del ejercicio anterior", m.c85],
          ["86", "Resultado de la liquidación", m.c86],
        ])}
      </Card>

      <Card className="gap-3">
        <h2 className="text-eyebrow text-tertiary">Resultado de las liquidaciones (tus cuatro 303)</h2>
        {casillas([
          ["95", "Total resultados a ingresar en las autoliquidaciones del ejercicio", m.c95],
          ["97", "Último periodo: a compensar", m.c97],
          ["98", "Último periodo: a devolver", m.c98],
          ["662", "Cuotas pendientes de compensación generadas en el ejercicio", m.c662],
        ])}
        {t4.c71 < 0 && (
          <p className="text-body">
            El 303 del 4T sale a tu favor ({euros(-t4.c71)}). Puedes pedir que te lo devuelvan o dejarlo para compensar el año
            que viene; el 390 tiene que decir lo mismo que marques en el 303.{" "}
            {ultimo === "compensar" ? (
              <a href={`/impuestos/${anio}/390?ultimo=devolver`} className="text-link-secondary">
                Ver con devolución ›
              </a>
            ) : (
              <a href={`/impuestos/${anio}/390`} className="text-link-secondary">
                Ver con compensación ›
              </a>
            )}
          </p>
        )}
      </Card>

      <Card className="gap-3">
        <h2 className="text-eyebrow text-tertiary">Volumen de operaciones</h2>
        {casillas([
          ["99", "Operaciones en régimen general", m.c99],
          ["103", "Entregas intracomunitarias de bienes y servicios", m.c103],
          ["110", "Operaciones no sujetas por reglas de localización", m.c110],
          ["108", "Total volumen de operaciones", m.c108],
        ])}
      </Card>

      <Card className="gap-2">
        <h2 className="text-eyebrow text-tertiary">Datos estadísticos</h2>
        <div className="flex items-center justify-between text-body">
          <span>Clave</span>
          <span>A05 · Resto de actividades profesionales</span>
        </div>
        <div className="flex items-center justify-between text-body">
          <span>IAE</span>
          <span>El epígrafe de tu alta censal</span>
        </div>
        <div className="flex items-center justify-between text-body">
          <span>347</span>
          <Badge type="secondary">Sin marcar</Badge>
        </div>
      </Card>
    </div>
  );
}
