import { cookies } from "next/headers";
import { Badge, Card, CardHeader, ListItem, PageHeader, Tooltip } from "@glinglo/vela-ds";
import { contextoPasos, cargarLibro, irpfACuenta, pygHasta, siguientesPasos } from "@/lib/libro";
import { cascada, clasificarAvisos, pygTrimestre, salud, seriesMensuales } from "@/lib/inicio";
import { eurosSinCentimos, hoyMadrid, nombreMes, plazoTrimestral, rangoTrimestre, round2, trimestreDe } from "@/lib/fiscal";
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
  const pResultados = periodo === null ? p : pygTrimestre(libro, anio, periodo, hasta);
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
      : `${periodo}T · de ${nombreMes(rangoTrimestre(anio, periodo).desde)} a ${trimestreEnCurso ? "hoy" : nombreMes(rangoTrimestre(anio, periodo).hasta)}`;

  const serie = seriesMensuales(libro, hasta, hoy);
  const filasCascada = cascada(pResultados);
  const indicadores = salud(libro, pResultados);
  const margen = indicadores.find((i) => i.clave === "margen")!;
  const mesesTranscurridos =
    periodo === null
      ? serie.length || 1
      : new Date(pResultados.hasta).getUTCMonth() - new Date(pResultados.desde).getUTCMonth() + 1;
  const porMes = Math.round(pResultados.rendimientoNeto / mesesTranscurridos);

  const serieBarras = periodo === null ? serie : serie.slice((periodo - 1) * 3, periodo * 3);

  const dd = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
  const pasoPlazo = pasos.find((pa) => pa.clave === "plazo");
  const matchPlazo = pasoPlazo?.href?.match(/\/impuestos\/(\d+)\/(\d)$/);
  let impuestosPista = "Todo presentado";
  if (pasoPlazo && matchPlazo) {
    const plazo = plazoTrimestral(Number(matchPlazo[1]), Number(matchPlazo[2]));
    const rango = `del ${dd(plazo.apertura)} al ${dd(plazo.fin)}`;
    impuestosPista = pasoPlazo.nivel === "info" ? `Próximo: ${matchPlazo[2]}T, ${rango}` : `${matchPlazo[2]}T pendiente · ${rango}`;
  }
  const gastosPista = `${eurosSinCentimos(pAnio.gastosFacturas)} este año`;
  const numTareas = (destacado ? 1 : 0) + resto.length;

  const irpf = irpfACuenta(libro, libro.presentaciones, anio, periodo, hoy);
  const teQueda = round2(pResultados.rendimientoNeto - irpf.total);
  const tPendiente = irpf.porPagar > 0 ? (periodo ?? (anio === anioActual ? tHoy : 4)) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="relative z-20">
        <PageHeader title="Hola, Jose" subtitle={`Tus resultados de ${anio}`} actions={<AccionesCabecera anio={anio} anioActual={anioActual} />} />
      </div>

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
                  <div className="flex items-center gap-2">
                    <h3 className="text-eyebrow text-tertiary">Rendimiento neto</h3>
                    <Tooltip content="Antes del IRPF de la Renta: es la base sobre la que se calcula lo que pagas en la Renta.">
                      <button type="button" aria-label="Qué es el rendimiento neto" className="text-tertiary">
                        ⓘ
                      </button>
                    </Tooltip>
                  </div>
                  <div className="text-display">{eurosSinCentimos(pResultados.rendimientoNeto)}</div>
                  <div className="text-caption">≈ {eurosSinCentimos(porMes)} al mes de media</div>
                  {margen.valor !== null && (
                    <Badge type={margen.estado === "bien" ? "success" : "onhold"} className="self-start">
                      Margen {Math.round(margen.valor * 100)} %
                    </Badge>
                  )}
                  <p className="text-body">De cada 100&nbsp;€ que facturas, te quedan {Math.round((margen.valor ?? 0) * 100)}&nbsp;€ antes del IRPF.</p>
                </div>

                <div className="hidden lg:block w-px bg-separator" />
                <div className="lg:hidden h-px bg-separator" />

                <div className="flex flex-col gap-2 lg:basis-2/3">
                  <h3 className="text-eyebrow text-tertiary">De lo facturado al rendimiento</h3>
                  <Cascada filas={filasCascada} />
                  {pResultados.subvenciones > 0 && (
                    <p className="text-caption text-tertiary">
                      Incluye {eurosSinCentimos(pResultados.subvenciones)} de la subvención del Mac (Kit Digital), ya en el rendimiento neto.
                    </p>
                  )}

                  <div className="h-px bg-separator my-1" />

                  <div className="flex items-center justify-between text-body">
                    <span>IRPF a cuenta</span>
                    <span>-{eurosSinCentimos(irpf.total)}</span>
                  </div>
                  {tPendiente !== null && (
                    <p className="text-caption text-tertiary">
                      {eurosSinCentimos(irpf.pagado130 + irpf.retenciones)} pagados + ≈ {eurosSinCentimos(irpf.porPagar)} del {tPendiente}T (se paga en{" "}
                      {nombreMes(plazoTrimestral(anio, tPendiente).apertura)})
                    </p>
                  )}
                  <div className="flex items-center justify-between text-body font-semibold">
                    <span>Te queda</span>
                    <span>≈ {eurosSinCentimos(teQueda)}</span>
                  </div>
                </div>
              </div>

              <p className="text-caption text-tertiary">
                El IVA no cuenta: no es tuyo. La Renta ajusta el IRPF: puede salir a pagar o a devolver.{" "}
                <a href={`/detalle/como-se-calcula${periodo ? `?anio=${anio}&periodo=${periodo}` : `?anio=${anio}`}`} className="text-link-secondary">
                  Cómo se calcula ›
                </a>
              </p>

              <div className="h-px bg-separator" />

              <Barras serie={serieBarras} />
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
                <li>
                  <a href={`/detalle/como-se-calcula?anio=${anio}`} className="flex flex-col">
                    <span>Cómo se calcula</span>
                    <span className="text-tertiary">De lo facturado a lo que te queda</span>
                  </a>
                </li>
              </ul>
            </Card>
          </div>
        </div>

        <aside aria-label="Por hacer y más detalle" className="hidden lg:flex lg:sticky lg:top-8 flex-col gap-4">
          <Card className="p-5 gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-eyebrow text-tertiary">Por hacer</h2>
              {numTareas > 0 && <Badge type="tertiary">{numTareas}</Badge>}
            </div>
            <PorHacerEscritorio destacado={destacado} resto={resto} ocultoHoy={ocultoHoy} hoy={hoy} />

            <div className="h-px bg-separator" />

            <h2 className="text-eyebrow text-tertiary">Más detalle</h2>
            {/* -mt-3 compensa el py-3 interno de ListItem (fijo en Vela, sin className propio): así el
                hueco hasta la primera fila queda igual que el de "Por hacer" a su primera tarea. */}
            <ul className="flex flex-col gap-2 -mt-3">
              <li>
                <ListItem title="Impuestos" description={impuestosPista} href={`/impuestos?anio=${anio}`} chevron />
              </li>
              <li>
                <ListItem title="En qué se van los gastos" description={gastosPista} href={`/gastos?anio=${anio}`} chevron />
              </li>
              <li>
                <ListItem title="Cómo se calcula" description="De lo facturado a lo que te queda" href={`/detalle/como-se-calcula?anio=${anio}`} chevron />
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
