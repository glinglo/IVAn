import { cookies } from "next/headers";
import { Badge, Card, ListGroup, ListItem, PageHeader } from "@glinglo/vela-ds";
import { contextoPasos, cargarLibro, pygHasta, siguientesPasos } from "@/lib/libro";
import { cascada, clasificarAvisos, salud, seriesMensuales } from "@/lib/inicio";
import { euros, hoyMadrid, rangoTrimestre, trimestreDe } from "@/lib/fiscal";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { AvisosInicio } from "@/components/AvisosInicio";
import { Periodo } from "@/components/Periodo";
import { Cascada } from "@/components/Cascada";
import { Barras } from "@/components/Barras";

export default async function Inicio({ searchParams }: { searchParams: Promise<{ anio?: string; periodo?: string }> }) {
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const sp = await searchParams;
  const anio = Number(sp.anio ?? anioActual);
  const periodo = sp.periodo && ["1", "2", "3", "4"].includes(sp.periodo) ? Number(sp.periodo) : null;

  const ctx = await contextoPasos(hoy);
  const libro = anio === anioActual ? ctx.libro : await cargarLibro(anio);

  const anioCerrado = anio !== anioActual;
  const tHoy = trimestreDe(hoy).t;
  const trimestreEnCurso = periodo !== null && !anioCerrado && periodo === tHoy;
  const hasta =
    periodo === null
      ? anioCerrado
        ? `${anio}-12-31`
        : hoy
      : trimestreEnCurso
        ? hoy
        : anio === anioActual
          ? (rangoTrimestre(anio, periodo).hasta < hoy ? rangoTrimestre(anio, periodo).hasta : hoy)
          : rangoTrimestre(anio, periodo).hasta;

  const p = pygHasta(libro, hasta);
  const pasos = siguientesPasos(ctx);
  const { destacado, resto } = clasificarAvisos(pasos, hoy);

  const cookieStore = await cookies();
  const ocultaCookie = cookieStore.get("ivan_aviso_oculto")?.value;
  const ocultoHoy = !!destacado && ocultaCookie === `${destacado.clave}:${hoy}`;

  const disponibles = anioCerrado ? [1, 2, 3, 4] : Array.from({ length: tHoy }, (_, i) => i + 1);

  const subtitulo =
    periodo === null
      ? anioCerrado
        ? `Tus resultados de ${anio} (año cerrado)`
        : `Tus resultados de ${anio}, hasta hoy`
      : `Acumulado hasta el ${hasta.split("-").reverse().join("/")}`;

  const serie = seriesMensuales(libro, hasta, hoy);
  const filasCascada = cascada(p);
  const indicadores = salud(libro, p);
  const margen = indicadores.find((i) => i.clave === "margen")!;
  const mesesTranscurridos = serie.length || 1;
  const porMes = Math.round(p.rendimientoNeto / mesesTranscurridos);

  return (
    <>
      <PageHeader
        title="Hola, Jose"
        subtitle={subtitulo}
        actions={<AccionesCabecera anio={anio} anioActual={anioActual} />}
      />

      <div className="flex flex-col lg:gap-4 gap-4">
        <AvisosInicio destacado={destacado} resto={resto} ocultoHoy={ocultoHoy} hoy={hoy} />

        <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} />

        <div className="flex flex-wrap gap-4">
          <Card className="basis-full lg:basis-1/3 grow">
            <h2 className="text-eyebrow text-tertiary">Rendimiento neto</h2>
            <div className="text-display">{euros(p.rendimientoNeto).replace(/,\d\d €/, " €")}</div>
            {margen.valor !== null && (
              <Badge type={margen.estado === "bien" ? "success" : "onhold"}>Margen {Math.round(margen.valor * 100)} %</Badge>
            )}
            <div className="text-tertiary">≈ {euros(porMes).replace(/,\d\d €/, " €")} al mes</div>
          </Card>

          <Card className="basis-full lg:basis-[calc(2/3*100%-1rem)] grow">
            <h2 className="text-eyebrow text-tertiary">De lo facturado al rendimiento</h2>
            <Cascada filas={filasCascada} />
          </Card>
        </div>

        <div className="flex flex-wrap gap-4">
          <Card className="basis-full lg:basis-[calc(2/3*100%-1rem)] grow">
            <h2 className="text-eyebrow text-tertiary">Ingresos y gastos por mes</h2>
            <Barras serie={serie} />
            <p className="text-tertiary">El 5 % y la amortización se calculan sobre el año</p>
          </Card>

          <Card className="basis-full lg:basis-1/3 grow">
            <h2 className="text-eyebrow text-tertiary">Más detalle</h2>
            <ListGroup>
              <ListItem title="Impuestos" href={`/impuestos?anio=${anio}`} chevron />
              <ListItem title="En qué se van los gastos" href={`/gastos?anio=${anio}`} chevron />
            </ListGroup>
          </Card>
        </div>
      </div>
    </>
  );
}
