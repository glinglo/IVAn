import { Badge, Card, ListGroup, ListItem, NoticeCard, PageHeader } from "@glinglo/vela-ds";
import {
  cargarAniosConPresentaciones,
  cargarLibro,
  cargarPagadoPorAnio,
  cargarPresentaciones303,
  resumenTrimestre,
  sinDatos,
} from "@/lib/libro";
import { diasEntre, euros, eurosSinCentimos, fechaES, fechaLarga, hoyMadrid, plazoAbierto, plazoTrimestral, trimestreDe } from "@/lib/fiscal";
import { resultado130Mostrado, saldoIvaCompensar } from "@/lib/impuestos";
import { AccionesCabecera } from "@/components/AccionesCabecera";

const ETIQUETAS_T = ["1T", "2T", "3T", "4T"];

interface FilaTrimestre {
  t: number;
  fecha: string | null;
  c71: number | null;
  importe130: number | null;
  pendiente: boolean; // no presentado todavía: el importe es el que calcula IVAn, no lo real
}

export default async function Impuestos({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const anios = await cargarAniosConPresentaciones(anioActual);
  const anio = Number((await searchParams).anio ?? anioActual);
  const libro = await cargarLibro(anio);
  const esAnioActual = anio === anioActual;
  const tHoy = trimestreDe(hoy).t;
  const tActual = esAnioActual ? tHoy : 4;
  const datos = !sinDatos(libro);

  let filas: FilaTrimestre[];
  let irpfAnio: number;
  let ivaAnio: number;
  let proximo: { t: number; dias: number; abierto: boolean } | null = null;
  let saldo: ReturnType<typeof saldoIvaCompensar> = null;
  let algunDifiere = false;

  if (datos) {
    const trimestres = [1, 2, 3, 4].map((t) => ({ t, ...resumenTrimestre(libro, t) })).filter((x) => x.t <= tActual);
    // Si el trimestre ya está presentado, manda lo presentado (lo que de verdad se pagó); el
    // cálculo de IVAn solo se usa para los que faltan por presentar.
    filas = trimestres.map((x) => {
      const p303 = libro.presentaciones.find((p) => p.modelo === "303" && p.trimestre === x.t);
      const p130 = libro.presentaciones.find((p) => p.modelo === "130" && p.trimestre === x.t);
      if (p130?.importe !== null && p130?.importe !== undefined && Math.abs(p130.importe - x.m130.aIngresar) > 0.01) algunDifiere = true;
      // El 130 no sale a devolver: aunque lo presentado (o calculado) sea negativo, lo ingresado es
      // 0,00 € (se recupera en la Renta, no aquí). Nunca se suma ni se enseña en negativo.
      return {
        t: x.t,
        fecha: p303?.fecha ?? p130?.fecha ?? null,
        c71: p303?.importe ?? x.m303.c71,
        importe130: resultado130Mostrado(p130?.importe ?? x.m130.aIngresar).aIngresar,
        pendiente: p303?.importe === null || p303?.importe === undefined,
      };
    });
    irpfAnio = round2Total(filas.reduce((s, x) => s + (x.importe130 ?? 0), 0));
    ivaAnio = round2Total(filas.reduce((s, x) => s + Math.max(0, x.c71 ?? 0), 0));
    if (esAnioActual) {
      const presentaciones303 = await cargarPresentaciones303();
      saldo = saldoIvaCompensar(presentaciones303);
      const abierto = plazoAbierto(hoy);
      if (abierto && abierto.anio === anio) proximo = { t: abierto.t, dias: diasEntre(hoy, abierto.fin), abierto: true };
      else if (tHoy <= 4) proximo = { t: tHoy, dias: diasEntre(hoy, plazoTrimestral(anio, tHoy).apertura), abierto: false };
    }
  } else {
    filas = [1, 2, 3, 4]
      .map((t) => {
        const p303 = libro.presentaciones.find((p) => p.modelo === "303" && p.trimestre === t) ?? null;
        const p130 = libro.presentaciones.find((p) => p.modelo === "130" && p.trimestre === t) ?? null;
        if (!p303 && !p130) return null;
        return {
          t,
          fecha: p303?.fecha ?? p130?.fecha ?? null,
          c71: p303?.importe ?? null,
          importe130: p130?.importe !== null && p130?.importe !== undefined ? resultado130Mostrado(p130.importe).aIngresar : null,
          pendiente: false,
        };
      })
      .filter((x): x is FilaTrimestre => x !== null);
    irpfAnio = round2Total(filas.reduce((s, x) => s + (x.importe130 ?? 0), 0));
    ivaAnio = round2Total(filas.reduce((s, x) => s + Math.max(0, x.c71 ?? 0), 0));
  }

  const pagadoPorAnio = await cargarPagadoPorAnio();
  const otrosAnios = pagadoPorAnio.filter((x) => x.anio !== anio);
  const maxOtrosAnios = Math.max(...otrosAnios.map((x) => x.total), 1);
  const resultado130Proximo = proximo ? resultado130Mostrado(resumenTrimestre(libro, proximo.t).m130.c07) : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Impuestos"
        subtitle="Lo que te toca presentar y lo que ya has pagado"
        actions={<AccionesCabecera anio={anio} anioActual={anioActual} anios={anios} />}
      />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-start-1">
          {proximo && (
            <NoticeCard
              variant={proximo.abierto && proximo.dias <= 10 ? "urgent" : "brand"}
              eyebrow={proximo.abierto ? (proximo.dias <= 1 ? "Queda 1 día" : `Quedan ${proximo.dias} días`) : `Próximo · en ${proximo.dias} días`}
              title={`${ETIQUETAS_T[proximo.t - 1]} de ${anio}`}
              description={
                <>
                  Del {fechaLarga(plazoTrimestral(anio, proximo.t).apertura)} al {fechaLarga(plazoTrimestral(anio, proximo.t).fin, true)}.
                  <div className="flex items-center gap-6 mt-2">
                    <div>
                      <div className="text-caption text-tertiary">303 · IVA</div>
                      <div className="text-title">{euros(resumenTrimestre(libro, proximo.t).m303.c71)}</div>
                    </div>
                    <div>
                      <div className="text-caption text-tertiary">130 · IRPF</div>
                      <div className="text-title">{euros(resultado130Proximo!.aIngresar)}</div>
                    </div>
                  </div>
                </>
              }
              action={{ label: `Preparar el ${ETIQUETAS_T[proximo.t - 1]}`, href: `/impuestos/${anio}/${proximo.t}` }}
            />
          )}

          <Card className="gap-3">
            <h2 className="text-eyebrow text-tertiary">Presentados en {anio}</h2>

            {filas.length === 0 ? (
              <p className="text-tertiary">No hay nada presentado de {anio}.</p>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-body">
                    <thead>
                      <tr className="text-caption text-tertiary text-left">
                        <th className="font-normal py-2">Trimestre</th>
                        <th className="font-normal py-2">Presentado</th>
                        <th className="font-normal py-2 text-right">303 · IVA</th>
                        <th className="font-normal py-2 text-right">130 · IRPF</th>
                        <th className="font-normal py-2 w-6" />
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((x) => {
                        const href = `/impuestos/${anio}/${x.t}`;
                        const colorImporte = x.pendiente ? "text-tertiary" : undefined;
                        return (
                          <tr key={x.t} className="border-t border-separator">
                            <td className="py-2">
                              <a href={href} className="block text-link-secondary">
                                {ETIQUETAS_T[x.t - 1]}
                              </a>
                            </td>
                            <td className="py-2">
                              <a href={href} className="block">
                                {x.fecha ? fechaES(x.fecha) : <Badge type="onhold">Pendiente</Badge>}
                              </a>
                            </td>
                            <td className="py-2 text-right">
                              <a href={href} className={`block ${colorImporte ?? ""}`}>
                                {x.c71 !== null ? euros(x.c71) : "—"}
                                {x.c71 !== null && x.c71 < 0 && <span className="block text-caption text-tertiary">a compensar</span>}
                              </a>
                            </td>
                            <td className="py-2 text-right">
                              <a href={href} className={`block ${colorImporte ?? ""}`}>
                                {x.importe130 !== null ? euros(x.importe130) : "—"}
                              </a>
                            </td>
                            <td className="py-2 text-tertiary">
                              <a href={href} className="block">
                                ›
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden">
                  <ListGroup>
                    {filas.map((x) => (
                      <ListItem
                        key={x.t}
                        href={`/impuestos/${anio}/${x.t}`}
                        chevron
                        title={ETIQUETAS_T[x.t - 1]}
                        description={x.fecha ? `Presentado el ${fechaES(x.fecha)}` : undefined}
                        badge={!x.fecha ? { label: "Pendiente", type: "onhold" } : undefined}
                        value={
                          <div className={`flex flex-col items-end gap-0.5 text-caption ${x.pendiente ? "text-tertiary" : ""}`}>
                            <span>303 {x.c71 !== null ? euros(x.c71) : "—"}</span>
                            <span>130 {x.importe130 !== null ? euros(x.importe130) : "—"}</span>
                          </div>
                        }
                      />
                    ))}
                  </ListGroup>
                </div>

                {algunDifiere && (
                  <p className="text-caption text-tertiary">
                    El 130 de la gestoría no incluía tu cuota de autónomo como gasto; por eso IVAn calcula otra cifra.
                  </p>
                )}
                {!datos && (
                  <p className="text-caption text-tertiary">
                    Presentado por la gestoría. IVAn no tiene las facturas de este año, así que solo muestra lo presentado.
                  </p>
                )}
              </>
            )}
          </Card>
        </div>

        <aside aria-label="Saldo de IVA y pagos del año" className="flex flex-col gap-4 lg:col-start-2">
          {saldo && (
            <Card className="gap-2 bg-yellow-100">
              <h3 className="text-eyebrow text-tertiary">A revisar en el cierre</h3>
              <div className="text-title">{euros(saldo.falta)} de IVA a tu favor</div>
              <p className="text-body">
                No se arrastraron en el 303 del {ETIQUETAS_T[saldo.trimestre - 1]}. Lo decidimos en el cierre de enero.
              </p>
            </Card>
          )}

          <Card className="gap-3">
            <h3 className="text-eyebrow text-tertiary">Pagado en {anio}</h3>
            <div className="text-title">{euros(irpfAnio + ivaAnio)}</div>
            <p className="text-caption text-tertiary">
              IRPF a cuenta {euros(irpfAnio)} · IVA {euros(ivaAnio)}
            </p>

            {otrosAnios.length > 0 && (
              <>
                <div className="h-px bg-separator" />
                <h4 className="text-eyebrow text-tertiary">Otros años</h4>
                <ul className="flex flex-col gap-2">
                  {otrosAnios.map((x) => (
                    <li key={x.anio} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-body">
                        <span>
                          {x.anio}
                          {x.anio === anioActual ? ` · hasta ${ETIQUETAS_T[tHoy - 1]}` : ""}
                        </span>
                        <span>{eurosSinCentimos(x.total)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gray-300" style={{ width: `${Math.round((x.total / maxOtrosAnios) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function round2Total(n: number): number {
  return Math.round(n * 100) / 100;
}
