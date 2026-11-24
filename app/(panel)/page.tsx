import { cookies } from "next/headers";
import { Badge, Card, CardHeader, PageHeader } from "@glinglo/vela-ds";
import { contextoPasos, cargarLibro, pygHasta, siguientesPasos } from "@/lib/libro";
import { cascada, clasificarAvisos, salud, seriesMensuales } from "@/lib/inicio";
import { euros, hoyMadrid, rangoTrimestre, trimestreDe } from "@/lib/fiscal";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { AvisosInicio } from "@/components/AvisosInicio";
import { PorHacerEscritorio } from "@/components/PorHacerEscritorio";
import { Periodo } from "@/components/Periodo";
import { Cascada } from "@/components/Cascada";
import { Barras } from "@/components/Barras";
import { BloqueResultados } from "@/components/BloqueResultados";

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
  const pAnio = pygHasta(libro, `${anio}-12-31`);
  const pasos = siguientesPasos(ctx);
  const { destacado, resto } = clasificarAvisos(pasos, hoy);

  const cookieStore = await cookies();
  const ocultaCookie = cookieStore.get("ivan_aviso_oculto")?.value;
  const ocultoHoy = !!destacado && ocultaCookie === `${destacado.clave}:${hoy}`;

  const disponibles = anioCerrado ? [1, 2, 3, 4] : Array.from({ length: tHoy }, (_, i) => i + 1);

  const subtituloPeriodo =
    periodo === null
      ? anioCerrado
        ? `Año ${anio} completo`
        : "Acumulado de enero a hoy"
      : `Acumulado de enero al ${rangoTrimestre(anio, periodo).hasta < hasta ? rangoTrimestre(anio, periodo).hasta.split("-").reverse().join("/") : hasta.split("-").reverse().join("/")}`;

  const serie = seriesMensuales(libro, hasta, hoy);
  const filasCascada = cascada(p);
  const indicadores = salud(libro, p);
  const margen = indicadores.find((i) => i.clave === "margen")!;
  const mesesTranscurridos = serie.length || 1;
  const porMes = Math.round(p.rendimientoNeto / mesesTranscurridos);

  const highlight = periodo === null ? undefined : [0, 1, 2].map((i) => (periodo - 1) * 3 + i).filter((i) => i < serie.length);

  const pasoPlazo = pasos.find((pa) => pa.clave === "plazo");
  const impuestosPista = !pasoPlazo || pasoPlazo.nivel === "info" ? "Todo presentado" : `${pasoPlazo.href?.match(/\/(\d)$/)?.[1]}T pendiente · ${pasoPlazo.detalle}`;
  const gastosPista = `${euros(pAnio.gastosFacturas).replace(/,\d\d €/, " €")} este año`;

  return (
    <>
      <PageHeader title="Hola, Jose" subtitle={`Tus resultados de ${anio}`} actions={<AccionesCabecera anio={anio} anioActual={anioActual} />} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="lg:hidden">
            <AvisosInicio destacado={destacado} resto={resto} ocultoHoy={ocultoHoy} hoy={hoy} />
          </div>

          <BloqueResultados>
            <Card className="p-4 lg:p-6 gap-5">
              <CardHeader
                title="Resultados"
                subtitle={subtituloPeriodo}
                actions={<div className="hidden lg:block"><Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} /></div>}
              />
              <div className="lg:hidden">
                <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} fullWidth />
              </div>

              <div className="h-px bg-separator" />

              <div className="flex flex-col lg:flex-row gap-5">
                <div className="flex flex-col gap-2 lg:basis-1/3">
                  <h3 className="text-eyebrow text-tertiary">Rendimiento neto</h3>
                  <div className="text-display">{euros(p.rendimientoNeto).replace(/,\d\d €/, " €")}</div>
                  <div className="text-caption">Antes del IRPF de la Renta</div>
                  {margen.valor !== null && (
                    <Badge type={margen.estado === "bien" ? "success" : "onhold"} className="self-start">
                      Margen {Math.round(margen.valor * 100)} %
                    </Badge>
                  )}
                  <p className="text-body">De cada 100 € que facturas, te quedan {Math.round((margen.valor ?? 0) * 100)} €.</p>
                  <div className="text-caption">≈ {euros(porMes).replace(/,\d\d €/, " €")} al mes de media</div>
                </div>

                <div className="hidden lg:block w-px bg-separator" />
                <div className="lg:hidden h-px bg-separator" />

                <div className="flex flex-col gap-2 lg:basis-2/3">
                  <h3 className="text-eyebrow text-tertiary">De lo facturado al rendimiento</h3>
                  <Cascada filas={filasCascada} />
                </div>
              </div>

              <div className="h-px bg-separator" />

              <Barras serie={serie} highlight={highlight} />
            </Card>
          </BloqueResultados>

          <div className="lg:hidden">
            <Card>
              <h2 className="text-eyebrow text-tertiary">Más detalle</h2>
              <ul className="flex flex-col gap-2">
                <li>
                  <a href={`/impuestos?anio=${anio}`} className="flex flex-col">
                    <span>Impuestos</span>
                    <span className="text-tertiary">{impuestosPista}</span>
                  </a>
                </li>
                <li>
                  <a href={`/gastos?anio=${anio}`} className="flex flex-col">
                    <span>En qué se van los gastos</span>
                    <span className="text-tertiary">{gastosPista}</span>
                  </a>
                </li>
              </ul>
            </Card>
          </div>
        </div>

        <aside aria-label="Por hacer y más detalle" className="hidden lg:flex lg:sticky lg:top-8 flex-col gap-4">
          <PorHacerEscritorio destacado={destacado} resto={resto} ocultoHoy={ocultoHoy} hoy={hoy} />

          <Card>
            <h2 className="text-eyebrow text-tertiary">Más detalle</h2>
            <ul className="flex flex-col gap-2">
              <li>
                <a href={`/impuestos?anio=${anio}`} className="flex flex-col">
                  <span>Impuestos</span>
                  <span className="text-tertiary">{impuestosPista}</span>
                </a>
              </li>
              <li>
                <a href={`/gastos?anio=${anio}`} className="flex flex-col">
                  <span>En qué se van los gastos</span>
                  <span className="text-tertiary">{gastosPista}</span>
                </a>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
