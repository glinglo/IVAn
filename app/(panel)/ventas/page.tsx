import { Badge, Button, Card, CardHeader, Meter, NoticeStrip, PageHeader, StackedBar } from "@glinglo/vela-ds";
import { cargarHistoricoIngresos, cargarLibro, comparativaAnual, dependencia, proximaFactura, type FacturaLista } from "@/lib/libro";
import { euros, eurosSinCentimos, fechaES, hoyMadrid, nombreMes, pct, rangoTrimestre, trimestreDe } from "@/lib/fiscal";
import { modoParalelo } from "@/lib/externas";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { Periodo } from "@/components/Periodo";
import { BloqueResultados } from "@/components/BloqueResultados";
import { GraficoMes } from "@/components/GraficoMes";
import { AvatarProveedor } from "@/components/AvatarProveedor";

const BOT_URL = "https://t.me/Ivanelgestorbot";
const FACTURAS_RECIENTES = 6;

const TIPO_BADGE: Record<FacturaLista["tipo"], string> = {
  nacional: "Nacional",
  ue: "UE · sin IVA",
  fuera_ue: "Fuera UE",
};

const ETIQUETAS_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const capitaliza = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Ventas({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; periodo?: string; todo?: string }>;
}) {
  const sp = await searchParams;
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = Number(sp.anio ?? anioActual);
  const periodo = sp.periodo && ["1", "2", "3", "4"].includes(sp.periodo) ? Number(sp.periodo) : null;
  const todo = sp.todo === "1";

  const anioCerrado = anio !== anioActual;
  const tHoy = trimestreDe(hoy).t;
  const disponibles = anioCerrado ? [1, 2, 3, 4] : Array.from({ length: tHoy }, (_, i) => i + 1);
  const trimestreEnCurso = periodo !== null && !anioCerrado && periodo === tHoy;

  const [libro, historico] = await Promise.all([cargarLibro(anio), cargarHistoricoIngresos()]);
  const facturas = libro.facturas.filter((f) => !periodo || trimestreDe(f.fecha).t === periodo);
  const base = facturas.reduce((s, f) => s + f.base, 0);

  const subtituloPeriodo =
    periodo === null
      ? anioCerrado
        ? `Año ${anio} completo`
        : "Acumulado de enero a hoy"
      : `${periodo}T · de ${nombreMes(rangoTrimestre(anio, periodo).desde)} a ${trimestreEnCurso ? "hoy" : nombreMes(rangoTrimestre(anio, periodo).hasta)}`;

  // Gráfico por mes y media mensual: los meses del periodo (año = de enero al mes en curso; trimestre = sus 3 meses).
  const mesHoy = Number(hoy.slice(5, 7));
  const [mesIni, mesFin] = periodo === null ? [1, anioCerrado ? 12 : mesHoy] : [(periodo - 1) * 3 + 1, periodo * 3];
  const mesActualIso = hoy.slice(0, 7);

  // Modo paralelo y próxima factura (siempre del año en curso, no cambia con el periodo).
  const paralelo = modoParalelo(libro.ajustes, hoy);
  const libroActual = anio === anioActual ? libro : await cargarLibro(anioActual);
  const proxima = proximaFactura(libroActual, hoy, paralelo);

  const mesesConFactura = new Set(facturas.map((f) => f.fecha.slice(0, 7)));
  const mesesIso = Array.from({ length: mesFin - mesIni + 1 }, (_, i) => `${anio}-${String(mesIni + i).padStart(2, "0")}`);
  const mesesTranscurridos = mesesIso.filter((mes) => mesesConFactura.has(mes) || mes !== mesActualIso).length;
  const porMes = Math.round(base / Math.max(mesesTranscurridos, 1));

  const mesesGrafico = mesesIso.map((mes, i) => {
    const esActual = mes === mesActualIso && anio === anioActual;
    let valor = libro.facturas.filter((f) => f.fecha.startsWith(mes)).reduce((s, f) => s + f.base, 0);
    if (esActual && proxima) valor += proxima.importeEstimado;
    return { label: ETIQUETAS_MES[mesIni + i - 1], valor, pendiente: esActual };
  });

  // Comparativa anual: solo tiene sentido con "Año" (siempre el año en curso).
  const comparativa = periodo === null ? comparativaAnual(libro, historico, hoy) : null;

  // Dependencia de un cliente: siempre el año completo.
  const dep = dependencia(libro);

  // Clientes del periodo.
  const porCliente = new Map<string, { base: number; f: FacturaLista }>();
  for (const f of facturas) {
    const e = porCliente.get(f.cliente) ?? { base: 0, f };
    e.base += f.base;
    porCliente.set(f.cliente, e);
  }
  const clientes = [...porCliente.entries()].sort((a, b) => b[1].base - a[1].base);
  const coloresCliente = ["var(--color-chart-primary)", "var(--color-chart-muted)", "var(--color-gray-300)", "var(--color-gray-200)"];

  // Facturas: las más recientes del periodo.
  const facturasMostradas = todo ? facturas : facturas.slice(0, FACTURAS_RECIENTES);
  const hayMas = !todo && facturas.length > FACTURAS_RECIENTES;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Ventas" subtitle={`Lo que has facturado en ${anio}`} actions={<AccionesCabecera anio={anio} anioActual={anioActual} />} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
        <div className="flex flex-col gap-6">
          <BloqueResultados>
            <Card className="p-4 lg:p-6 gap-5">
              <CardHeader
                title="Facturado"
                subtitle={subtituloPeriodo}
                actions={<div className="hidden lg:block"><Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} /></div>}
              />
              <div className="lg:hidden">
                <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} fullWidth />
              </div>

              <div className="h-px bg-separator" />

              <div className="flex flex-col gap-2">
                <div className="text-display">{euros(base)}</div>
                <div className="text-caption text-tertiary">
                  {facturas.length === 1 ? "1 factura" : `${facturas.length} facturas`} · ≈ {eurosSinCentimos(porMes)} al mes de media
                </div>
                {periodo === null && comparativa && comparativa.pctFrenteAnterior !== null && (
                  <Badge type={comparativa.pctFrenteAnterior >= 0 ? "success" : "onhold"} className="self-start">
                    {pct(Math.abs(comparativa.pctFrenteAnterior))} {comparativa.pctFrenteAnterior >= 0 ? "más" : "menos"} que en {anio - 1} de enero a{" "}
                    {nombreMes(rangoTrimestre(anio, comparativa.tCerrado).hasta)}
                  </Badge>
                )}
              </div>

              <div className="h-px bg-separator" />

              <GraficoMes meses={mesesGrafico} serie="Facturado" ariaLabel="Facturado por mes" />
            </Card>
          </BloqueResultados>

          {facturas.length === 0 ? (
            <p className="text-tertiary">No hay facturas en este periodo.</p>
          ) : (
            <Card className="gap-3">
              <h2 className="text-eyebrow text-tertiary">Facturas</h2>

              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-body">
                  <thead>
                    <tr className="text-caption text-tertiary text-left">
                      <th className="font-normal py-2">Nº</th>
                      <th className="font-normal py-2">Fecha</th>
                      <th className="font-normal py-2">Cliente</th>
                      <th className="font-normal py-2">Tipo</th>
                      <th className="font-normal py-2 text-right">Base</th>
                      <th className="font-normal py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasMostradas.map((f) => (
                      <tr key={f.id} className="border-t border-separator">
                        <td className="py-2">
                          {f.pdf_path ? (
                            <a href={`/api/archivo?path=${encodeURIComponent(f.pdf_path)}`} className="text-link-secondary">
                              {f.numero}
                            </a>
                          ) : (
                            f.numero
                          )}
                        </td>
                        <td className="py-2">{fechaES(f.fecha)}</td>
                        <td className="py-2">{f.cliente}</td>
                        <td className="py-2">
                          <Badge type="secondary">{TIPO_BADGE[f.tipo]}</Badge>
                        </td>
                        <td className="py-2 text-right">{euros(f.base)}</td>
                        <td className="py-2 text-right">{euros(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="lg:hidden flex flex-col gap-3">
                {facturasMostradas.map((f) => (
                  <li key={f.id}>
                    <a
                      href={f.pdf_path ? `/api/archivo?path=${encodeURIComponent(f.pdf_path)}` : undefined}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col">
                        <span>
                          {f.numero} · {f.cliente}
                        </span>
                        <span className="text-caption text-tertiary">
                          {fechaES(f.fecha)} · {TIPO_BADGE[f.tipo]}
                        </span>
                      </div>
                      <span>{euros(f.total)}</span>
                    </a>
                  </li>
                ))}
              </ul>

              {hayMas && (
                <a href={`?anio=${anio}${periodo ? `&periodo=${periodo}` : ""}&todo=1`} className="text-link-secondary">
                  Ver las {facturas.length}
                </a>
              )}
            </Card>
          )}
        </div>

        <aside aria-label="Próxima factura, dependencia y clientes" className="flex flex-col gap-4">
          {proxima && (
            <Card className="gap-3 bg-brand-100">
              <h3 className="text-eyebrow text-tertiary">Próxima factura · en {proxima.diasHastaFinMes} días</h3>
              <div className="text-title">
                {capitaliza(nombreMes(`${proxima.mes}-01`))} · {proxima.cliente}
              </div>
              <p className="text-body">≈ {eurosSinCentimos(proxima.importeEstimado)}, como el mes pasado.</p>
              <p className="text-caption text-tertiary">{proxima.texto}</p>
              <Button href={BOT_URL} target="_blank" variant="primary" size="sm" className="self-start">
                Abrir el bot
              </Button>
            </Card>
          )}

          {dep && (
            <Card className="gap-3">
              <h3 className="text-eyebrow text-tertiary">Dependencia de un cliente</h3>
              <div className="flex items-center gap-2">
                <div className="text-display">{pct(dep.pct * 100)}</div>
                {dep.riesgo && <Badge type="onhold">Riesgo</Badge>}
              </div>
              <p className="text-body">de lo que facturas es de {dep.cliente}</p>
              <Meter
                aria-label={`${pct(dep.pct * 100)} de la facturación es de ${dep.cliente}`}
                value={dep.pct}
                threshold={0.7}
                thresholdLabel={pct(70)}
                tone={dep.riesgo ? "warning" : "success"}
              />
              {dep.riesgo && (
                <p className="text-caption text-tertiary">
                  Si {dep.cliente} se va, se va casi todo. A partir del {pct(70)} lo marcamos como riesgo.
                </p>
              )}
            </Card>
          )}

          {clientes.length > 0 && (
            <Card className="gap-4">
              <h2 className="text-eyebrow text-tertiary">Clientes</h2>
              <StackedBar
                aria-label="Reparto de la base facturada por cliente"
                parts={clientes.map(([nombre, c], i) => ({
                  value: c.base,
                  color: coloresCliente[i % coloresCliente.length],
                  label: nombre,
                }))}
              />
              <ul className="flex flex-col gap-3">
                {clientes.map(([nombre, c]) => {
                  const detalleTipo = c.f.tipo === "nacional" ? `${pct(c.f.iva_pct)} · −${pct(c.f.retencion_pct)}` : TIPO_BADGE[c.f.tipo];
                  return (
                    <li key={nombre} className="flex items-center gap-3">
                      <AvatarProveedor nombre={nombre} size="sm" />
                      <div className="flex flex-col flex-1">
                        <span>{nombre}</span>
                        <span className="text-caption text-tertiary">
                          {c.f.pais_cliente} · {detalleTipo} · {pct((c.base / (base || 1)) * 100)}
                        </span>
                      </div>
                      <span>{euros(c.base)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {comparativa && comparativa.anios.length > 1 && (
            <Card className="gap-3">
              <h3 className="text-eyebrow text-tertiary">De enero a {nombreMes(rangoTrimestre(anio, comparativa.tCerrado).hasta)}, cada año</h3>
              <ul className="flex flex-col gap-2">
                {comparativa.anios.map(({ anio: a, valor }) => {
                  const max = Math.max(...comparativa.anios.map((x) => x.valor)) || 1;
                  return (
                    <li key={a} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-body">
                        <span className={a === anio ? "text-brand-700 font-semibold" : undefined}>{a}</span>
                        <span>{eurosSinCentimos(valor)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${a === anio ? "bg-brand-500" : "bg-gray-300"}`}
                          style={{ width: `${Math.round((valor / max) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-caption text-tertiary">De tus 130 presentados (2025 sin el Kit Digital).</p>
            </Card>
          )}
        </aside>

        <div className="lg:col-start-1">
          <NoticeStrip title="Para facturar o corregir una factura, díselo al bot" href={BOT_URL} target="_blank" />
        </div>
      </div>
    </div>
  );
}
