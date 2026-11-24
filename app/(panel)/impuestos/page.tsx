import { Badge, Button, Card, ListGroup, ListItem, NoticeCard, PageHeader } from "@glinglo/vela-ds";
import {
  cargarAniosConPresentaciones,
  cargarLibro,
  cargarPagadoPorAnio,
  cargarPresentaciones303,
  resumenTrimestre,
  sinDatos,
} from "@/lib/libro";
import { diasEntre, euros, eurosSinCentimos, fechaES, hoyMadrid, plazoAbierto, plazoTrimestral, trimestreDe } from "@/lib/fiscal";
import { frase130, frase303, saldoIvaCompensar } from "@/lib/impuestos";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { GraficoPagos } from "@/components/GraficoPagos";

const ETIQUETAS_T = ["1T", "2T", "3T", "4T"];

export default async function Impuestos({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const anios = await cargarAniosConPresentaciones(anioActual);
  const anio = Number((await searchParams).anio ?? anioActual);
  const libro = await cargarLibro(anio);
  const esAnioActual = anio === anioActual;
  const anioCerrado = !esAnioActual;
  const tHoy = trimestreDe(hoy).t;
  const tActual = esAnioActual ? tHoy : 4;

  if (sinDatos(libro)) {
    const trimestres = [1, 2, 3, 4]
      .map((t) => ({
        t,
        p303: libro.presentaciones.find((p) => p.modelo === "303" && p.trimestre === t) ?? null,
        p130: libro.presentaciones.find((p) => p.modelo === "130" && p.trimestre === t) ?? null,
      }))
      .filter((x) => x.p303 || x.p130);
    const pagadoAnio = round2Total(
      trimestres.reduce((s, x) => s + (x.p130?.importe ?? 0) + Math.max(0, x.p303?.importe ?? 0), 0),
    );

    return (
      <>
        <PageHeader title="Impuestos" subtitle={String(anio)} actions={<AccionesCabecera anio={anio} anioActual={anioActual} anios={anios} />} />
        <div className="flex flex-col gap-6">
          {trimestres.length === 0 ? (
            <p className="text-tertiary">No hay nada presentado de {anio}.</p>
          ) : (
            <ListGroup label="Presentados">
              {trimestres.map(({ t, p303, p130 }) => (
                <ListItem
                  key={t}
                  title={ETIQUETAS_T[t - 1]}
                  description={p303?.fecha ? fechaES(p303.fecha) : p130?.fecha ? fechaES(p130.fecha) : undefined}
                  value={
                    [
                      p303 ? textoResultado303(p303.importe ?? 0) : null,
                      p130 ? `IRPF ${euros(p130.importe ?? 0)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                />
              ))}
            </ListGroup>
          )}
          <Card className="gap-1">
            <h2 className="text-eyebrow text-tertiary">Pagado en {anio}</h2>
            <div className="text-title">{euros(pagadoAnio)}</div>
          </Card>
          <p className="text-caption text-tertiary">
            Presentado por la gestoría. IVAn no tiene las facturas de este año, así que solo muestra lo presentado.
          </p>
        </div>
      </>
    );
  }

  const trimestres = [1, 2, 3, 4].map((t) => ({ t, ...resumenTrimestre(libro, t) })).filter((x) => x.t <= tActual);

  // Próximo trimestre a preparar (solo tiene sentido en el año en curso).
  let proximo: { t: number; dias: number; abierto: boolean } | null = null;
  if (esAnioActual) {
    const abierto = plazoAbierto(hoy);
    if (abierto && abierto.anio === anio) {
      proximo = { t: abierto.t, dias: diasEntre(hoy, abierto.fin), abierto: true };
    } else if (tHoy <= 4) {
      proximo = { t: tHoy, dias: diasEntre(hoy, plazoTrimestral(anio, tHoy).apertura), abierto: false };
    }
  }

  // Presentados: ¿algún 130 presentado difiere del cálculo de IVAn? (la cuota de autónomo).
  let algunDifiere = false;
  for (const x of trimestres) {
    const p130 = libro.presentaciones.find((p) => p.modelo === "130" && p.trimestre === x.t);
    if (p130?.importe !== null && p130?.importe !== undefined && Math.abs(p130.importe - x.m130.aIngresar) > 0.01) algunDifiere = true;
  }

  // Aviso del saldo de IVA a compensar (todos los años, no solo este).
  const presentaciones303 = await cargarPresentaciones303();
  const saldo = esAnioActual ? saldoIvaCompensar(presentaciones303) : null;

  // Pagado en el año (calculado por IVAn) y gráfico por trimestre.
  const irpfPorT = trimestres.map((x) => x.m130.aIngresar);
  const ivaPorT = trimestres.map((x) => Math.max(0, x.m303.c71));
  const irpfAnio = round2Total(irpfPorT.reduce((s, v) => s + v, 0));
  const ivaAnio = round2Total(ivaPorT.reduce((s, v) => s + v, 0));
  const graficoPagos = trimestres.map((x, i) => ({
    label: ETIQUETAS_T[x.t - 1],
    irpf: irpfPorT[i],
    iva: ivaPorT[i],
    pendiente: esAnioActual && x.t === tHoy,
  }));

  // Lo pagado cada año (de lo presentado, no de lo calculado).
  const pagadoPorAnio = await cargarPagadoPorAnio();
  const maxPagado = Math.max(...pagadoPorAnio.map((x) => x.total), 1);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Impuestos" subtitle={String(anio)} actions={<AccionesCabecera anio={anio} anioActual={anioActual} anios={anios} />} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-start-1">
          {proximo && (
            <NoticeCard
              variant={proximo.abierto && proximo.dias <= 10 ? "urgent" : "brand"}
              eyebrow={proximo.abierto ? (proximo.dias <= 1 ? "Queda 1 día" : `Quedan ${proximo.dias} días`) : `Próximo · en ${proximo.dias} días`}
              title={`${ETIQUETAS_T[proximo.t - 1]} de ${anio}`}
              description={
                <>
                  Plazo: del {fechaES(plazoTrimestral(anio, proximo.t).apertura)} al {fechaES(plazoTrimestral(anio, proximo.t).fin)} (domiciliación
                  hasta aprox. el {fechaES(plazoTrimestral(anio, proximo.t).finDomiciliacion)}).
                  <br />
                  303: {euros(resumenTrimestre(libro, proximo.t).m303.c71)} · {frase303(resumenTrimestre(libro, proximo.t).m303.c71)}
                  <br />
                  130: {euros(resumenTrimestre(libro, proximo.t).m130.c07)} · {frase130(resumenTrimestre(libro, proximo.t).m130.c07, proximo.t)}
                  {proximo.t === 4 && (
                    <>
                      <br />
                      También 349 y 390.
                    </>
                  )}
                </>
              }
              action={{ label: `Preparar el ${ETIQUETAS_T[proximo.t - 1]}`, href: `/impuestos/${anio}/${proximo.t}` }}
            />
          )}

          <Card className="gap-3">
            <h2 className="text-eyebrow text-tertiary">Presentados en {anio}</h2>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-body">
                <thead>
                  <tr className="text-caption text-tertiary text-left">
                    <th className="font-normal py-2">Trimestre</th>
                    <th className="font-normal py-2">Presentado</th>
                    <th className="font-normal py-2">303</th>
                    <th className="font-normal py-2">130</th>
                  </tr>
                </thead>
                <tbody>
                  {trimestres.map((x) => {
                    const p303 = libro.presentaciones.find((p) => p.modelo === "303" && p.trimestre === x.t);
                    const p130 = libro.presentaciones.find((p) => p.modelo === "130" && p.trimestre === x.t);
                    return (
                      <tr key={x.t} className="border-t border-separator">
                        <td className="py-2">
                          <a href={`/impuestos/${anio}/${x.t}`} className="text-link-secondary">
                            {ETIQUETAS_T[x.t - 1]}
                          </a>
                        </td>
                        <td className="py-2">{p303?.fecha ? fechaES(p303.fecha) : p130?.fecha ? fechaES(p130.fecha) : "—"}</td>
                        <td className="py-2">
                          <Badge type={x.m303.c71 > 0 ? "secondary" : x.m303.c71 < 0 ? "onhold" : "success"}>
                            {x.m303.c71 > 0 ? "Ingresado" : x.m303.c71 < 0 ? "A compensar" : "Resultado cero"}
                          </Badge>
                        </td>
                        <td className="py-2">{x.presentado("130") ? <Badge type="success">Presentado</Badge> : <Badge type="onhold">Provisional</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="lg:hidden flex flex-col gap-3">
              {trimestres.map((x) => (
                <li key={x.t}>
                  <a href={`/impuestos/${anio}/${x.t}`} className="flex items-center justify-between gap-3">
                    <span>{ETIQUETAS_T[x.t - 1]}</span>
                    <span className="text-caption text-tertiary">
                      303 {euros(x.m303.c71)} · 130 {euros(x.m130.c07)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            {algunDifiere && (
              <p className="text-caption text-tertiary">
                El 130 de la gestoría no incluía tu cuota de autónomo como gasto; por eso IVAn calcula otra cifra.
              </p>
            )}
          </Card>
        </div>

        <aside aria-label="Saldo de IVA, pagos del año y resumen anual" className="flex flex-col gap-4 lg:col-start-2">
          {saldo && (
            <Card className="gap-2 bg-yellow-100">
              <h3 className="text-eyebrow text-tertiary">A revisar en el cierre</h3>
              <div className="text-title">{euros(saldo.falta)} de IVA a tu favor</div>
              <p className="text-body">
                La gestoría no los arrastró en el 303 del {ETIQUETAS_T[saldo.trimestre - 1]} de {saldo.anio}. Decidimos en enero si
                se compensan en el 4T o pides la devolución.
              </p>
            </Card>
          )}

          <Card className="gap-3">
            <h3 className="text-eyebrow text-tertiary">Pagado en {anio}</h3>
            <div className="text-title">{euros(irpfAnio + ivaAnio)}</div>
            <p className="text-caption text-tertiary">
              IRPF a cuenta {euros(irpfAnio)} · IVA {euros(ivaAnio)}
            </p>
            <GraficoPagos trimestres={graficoPagos} />
          </Card>

          {pagadoPorAnio.length > 1 && (
            <Card className="gap-3">
              <h3 className="text-eyebrow text-tertiary">Lo pagado cada año</h3>
              <ul className="flex flex-col gap-2">
                {pagadoPorAnio.map((x) => (
                  <li key={x.anio} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-body">
                      <span className={x.anio === anio ? "text-brand-700 font-semibold" : undefined}>
                        {x.anio}
                        {x.anio === anioActual ? ` · hasta ${ETIQUETAS_T[tActual - 1]}` : ""}
                      </span>
                      <span>{eurosSinCentimos(x.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${x.anio === anio ? "bg-brand-500" : "bg-gray-300"}`}
                        style={{ width: `${Math.round((x.total / maxPagado) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="gap-3">
            <h3 className="text-eyebrow text-tertiary">Resumen anual</h3>
            <ul className="flex flex-col gap-2">
              {(anioCerrado || tActual === 4) && (
                <li>
                  <a href={`/impuestos/${anio}/390`} className="flex items-center justify-between text-body">
                    <span>Modelo 390</span>
                    <span className="text-link-secondary">Ver ›</span>
                  </a>
                </li>
              )}
              <li>
                <a href={`/impuestos/${anio}/${tActual}?m=349`} className="flex items-center justify-between text-body">
                  <span>Modelo 349 · {ETIQUETAS_T[tActual - 1]}</span>
                  <span className="text-link-secondary">Ver ›</span>
                </a>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function textoResultado303(c71: number): string {
  if (c71 > 0) return `IVA ${euros(c71)} ingresado`;
  if (c71 < 0) return `IVA ${euros(-c71)} a compensar`;
  return "IVA resultado cero";
}

function round2Total(n: number): number {
  return Math.round(n * 100) / 100;
}
