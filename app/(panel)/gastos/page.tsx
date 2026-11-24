import { Alert, Badge, Card, CardHeader, ListGroup, ListItem, PageHeader } from "@glinglo/vela-ds";
import { cargarLibro } from "@/lib/libro";
import { euros, eurosSinCentimos, fechaES, hoyMadrid, mesAnterior, nombreMes, pct, rangoTrimestre, trimestreDe } from "@/lib/fiscal";
import { nombreCorto } from "@/lib/texto";
import { COLOR_CATEGORIA, ETIQUETA_CATEGORIA, type CategoriaGasto } from "@/lib/categorias";
import { proveedoresQueFaltan, suscripciones, type GastoProveedor } from "@/lib/recordatorios";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { Periodo } from "@/components/Periodo";
import { BloqueResultados } from "@/components/BloqueResultados";
import { GraficoTipoIva } from "@/components/GraficoTipoIva";
import { GraficoMes } from "@/components/GraficoMes";
import { AvatarProveedor } from "@/components/AvatarProveedor";
import { VisorArchivo } from "@/components/VisorArchivo";
import { db } from "@/lib/db";

const CORTO_IVA: Record<string, string> = {
  "IVA soportado": "IVA",
  "ISP UE": "ISP UE",
  "ISP fuera UE": "ISP extra-UE",
  "Sin IVA deducible": "sin IVA",
};

export default async function Gastos({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; periodo?: string; categoria?: string }>;
}) {
  const sp = await searchParams;
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = Number(sp.anio ?? anioActual);
  const periodo = sp.periodo && ["1", "2", "3", "4"].includes(sp.periodo) ? Number(sp.periodo) : null;
  const categoriaFiltro = (sp.categoria as CategoriaGasto | undefined) ?? null;

  const anioCerrado = anio !== anioActual;
  const tHoy = trimestreDe(hoy).t;
  const disponibles = anioCerrado ? [1, 2, 3, 4] : Array.from({ length: tHoy }, (_, i) => i + 1);
  const trimestreEnCurso = periodo !== null && !anioCerrado && periodo === tHoy;

  // Para "Faltan este mes" y "Tus suscripciones": siempre relativos a hoy, no al periodo ni al año
  // de la página. Desde octubre del año pasado, de sobra para los 4 meses que necesita la
  // recurrencia aunque hoy sea enero o febrero.
  const desdeRecientes = `${anioActual - 1}-10-01`;
  const [libro, borr, gastosRecientes] = await Promise.all([
    cargarLibro(anio),
    db().from("gastos").select("id", { count: "exact", head: true }).eq("estado", "borrador"),
    db().from("gastos").select("proveedor, nif, fecha, estado, base, iva").gte("fecha", desdeRecientes).neq("estado", "descartado"),
  ]);
  const gastosParaRecurrencia: GastoProveedor[] = (gastosRecientes.data ?? []).map((g) => ({
    proveedor: g.proveedor,
    nif: g.nif,
    fecha: g.fecha,
    estado: g.estado,
    importe: Number(g.base) + Number(g.iva),
  }));

  const gastosDelPeriodo = libro.gastos.filter((g) => !periodo || trimestreDe(g.fecha).t === periodo);
  const gastos = categoriaFiltro ? gastosDelPeriodo.filter((g) => g.categoria === categoriaFiltro) : gastosDelPeriodo;
  const base = gastos.reduce((s, g) => s + g.base, 0);
  const iva = gastos.reduce((s, g) => s + g.iva, 0);

  const subtituloPeriodo =
    periodo === null
      ? anioCerrado
        ? `Año ${anio} completo`
        : "Acumulado de enero a hoy"
      : `${periodo}T · de ${nombreMes(rangoTrimestre(anio, periodo).desde)} a ${trimestreEnCurso ? "hoy" : nombreMes(rangoTrimestre(anio, periodo).hasta)}`;

  // % sobre la base facturada en el mismo periodo (misma base que la cifra grande de Gastos).
  const facturadoBasePeriodo = libro.facturas
    .filter((f) => !periodo || trimestreDe(f.fecha).t === periodo)
    .reduce((s, f) => s + f.base, 0);
  const pctSobreFacturado = facturadoBasePeriodo > 0 ? (base / facturadoBasePeriodo) * 100 : null;

  // Por categoría (sobre el periodo, sin el filtro de categoría).
  const porCategoria = new Map<CategoriaGasto, number>();
  for (const g of gastosDelPeriodo) {
    const c = (g.categoria ?? "otros") as CategoriaGasto;
    porCategoria.set(c, (porCategoria.get(c) ?? 0) + g.base + g.iva);
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  const totalCategorias = categorias.reduce((s, [, v]) => s + v, 0) || 1;

  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    params.set("anio", String(anio));
    if (periodo) params.set("periodo", String(periodo));
    for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
    return `?${params.toString()}`;
  };

  // Por qué casi no hay IVA deducible: con/sin IVA deducible.
  const porTipo = new Map<string, number>();
  for (const g of gastosDelPeriodo) porTipo.set(g.tipo, (porTipo.get(g.tipo) ?? 0) + g.base + g.iva);
  const totalTipos = [...porTipo.values()].reduce((s, v) => s + v, 0) || 1;
  const sinDeducir = (porTipo.get("ISP UE") ?? 0) + (porTipo.get("ISP fuera UE") ?? 0) + (porTipo.get("Sin IVA deducible") ?? 0);
  const pctSinDeducir = (sinDeducir / totalTipos) * 100;
  const conDeducible = totalTipos - sinDeducir;

  // Faltan este mes (desde el día 28).
  const faltanEsteMes = Number(hoy.slice(8)) >= 28 ? proveedoresQueFaltan(gastosParaRecurrencia, hoy).faltan : [];

  // Tus suscripciones (siempre los últimos meses, no el periodo de la página).
  const { activas, sinFacturaUltimoMes } = suscripciones(gastosParaRecurrencia, hoy);
  const totalMes = activas.reduce((s, a) => s + a.costeMes, 0);
  const ultimoMesCerrado = mesAnterior(hoy.slice(0, 7));

  // Gráfico por mes: el total por mes (una sola serie), los meses del periodo.
  const mesHoy = Number(hoy.slice(5, 7));
  const [mesIni, mesFin] = periodo === null ? [1, anioCerrado ? 12 : mesHoy] : [(periodo - 1) * 3 + 1, periodo * 3];
  const mesActualIso = hoy.slice(0, 7);
  const mesesGrafico = Array.from({ length: mesFin - mesIni + 1 }, (_, i) => {
    const mes = `${anio}-${String(mesIni + i).padStart(2, "0")}`;
    const esActual = mes === mesActualIso && anio === anioActual;
    const valor = libro.gastos.filter((g) => g.fecha.startsWith(mes)).reduce((s, g) => s + g.base + g.iva, 0);
    return { mes, valor: esActual && !valor ? null : valor, pendiente: esActual };
  });

  // Meses del periodo, de más reciente a más antiguo (lista).
  const meses = [...new Set(gastos.map((g) => g.fecha.slice(0, 7)))].sort().reverse();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Gastos" subtitle={`En qué se va el dinero en ${anio}`} actions={<AccionesCabecera anio={anio} anioActual={anioActual} />} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="lg:col-start-1 lg:row-start-1">
          <BloqueResultados>
            <Card className="p-4 lg:p-6 gap-5">
              <CardHeader
                title="Gastado"
                subtitle={subtituloPeriodo}
                actions={<div className="hidden lg:block"><Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} /></div>}
              />
              <div className="lg:hidden">
                <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} fullWidth />
              </div>

              <div className="h-px bg-separator" />

              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-2">
                  <div className="text-display">{euros(base)}</div>
                  <div className="text-caption text-tertiary">
                    {gastos.length === 1 ? "1 gasto" : `${gastos.length} gastos`} · {euros(iva)} de IVA deducible
                  </div>
                </div>
                {pctSobreFacturado !== null && (
                  <div className="flex flex-col items-end gap-2">
                    <Badge type={pctSobreFacturado <= 20 ? "success" : "onhold"}>{pct(pctSobreFacturado, 1)} de lo que facturas</Badge>
                    {pctSobreFacturado <= 20 && <Badge type="secondary">Por debajo del {pct(20)}: sano</Badge>}
                  </div>
                )}
              </div>

              <div className="h-px bg-separator" />

              <GraficoMes meses={mesesGrafico} serie="Gastado" ariaLabel="Gastado por mes" />
            </Card>
          </BloqueResultados>
        </div>

        <aside
          aria-label="Suscripciones, categorías e IVA"
          className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start"
        >
          <Card className="gap-3">
            <h2 className="text-eyebrow text-tertiary">Tus suscripciones</h2>
            {activas.length > 0 ? (
              <>
                <div className="flex flex-col gap-1">
                  <div className="text-title">≈ {eurosSinCentimos(totalMes)} al mes</div>
                  <div className="text-caption text-tertiary">
                    {activas.length === 1 ? "1 suscripción activa" : `${activas.length} suscripciones activas`} · ≈ {eurosSinCentimos(totalMes * 12)} al año
                  </div>
                </div>
                <ul className="flex flex-col gap-3">
                  {activas.map((a) => (
                    <li key={a.nombre} className="flex items-center gap-3">
                      <AvatarProveedor nombre={a.nombre} size="sm" />
                      <div className="flex flex-col flex-1">
                        <span>{nombreCorto(a.nombre)}</span>
                        {a.cambio && (
                          <span className="text-caption text-tertiary">
                            {a.cambio.tipo === "sube" ? "↑" : "↓"} antes {eurosSinCentimos(a.cambio.antes)}
                          </span>
                        )}
                      </div>
                      <span>{eurosSinCentimos(a.costeMes)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-tertiary">Ninguna detectada todavía.</p>
            )}
            {sinFacturaUltimoMes.length > 0 && (
              <>
                <div className="h-px bg-separator" />
                <ul className="flex flex-col gap-1">
                  {sinFacturaUltimoMes.map((s) => (
                    <li key={s.nombre} className="text-body text-tertiary">
                      {nombreCorto(s.nombre)} · sin factura en {nombreMes(`${ultimoMesCerrado}-01`)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {categorias.length > 0 && (
            <Card className="gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-eyebrow text-tertiary">Por categoría</h2>
                {categoriaFiltro && (
                  <a href={qs({})}>
                    <Badge type="secondary" closable>
                      {ETIQUETA_CATEGORIA[categoriaFiltro]}
                    </Badge>
                  </a>
                )}
              </div>
              <ul className="flex flex-col gap-2">
                {categorias.map(([c, importe]) => (
                  <li key={c}>
                    <a href={qs({ categoria: categoriaFiltro === c ? undefined : c })} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-body">
                        <span>{ETIQUETA_CATEGORIA[c]}</span>
                        <span>{eurosSinCentimos(importe)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round((importe / totalCategorias) * 100)}%`, backgroundColor: COLOR_CATEGORIA[c] }}
                        />
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="gap-3">
            <h2 className="text-eyebrow text-tertiary">¿Por qué casi no hay IVA que deducir?</h2>
            <GraficoTipoIva
              parts={[
                { value: conDeducible, color: "var(--color-chart-primary)", label: "Con IVA deducible" },
                { value: sinDeducir, color: "var(--color-gray-200)", label: "Sin IVA deducible" },
              ]}
            />
            <p className="text-body">El {pct(pctSinDeducir)} de lo que gastas viene de fuera de España o no lleva tu NIF: no tiene IVA que deducir.</p>
          </Card>
        </aside>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
          {(borr.count ?? 0) > 0 && (
            <Alert variant="help">
              {borr.count === 1 ? "1 gasto sin confirmar en el bot." : `${borr.count} gastos sin confirmar en el bot.`}
            </Alert>
          )}

          {gastos.length === 0 ? (
            <p className="text-tertiary">No hay gastos en este periodo. Mándale una foto o un PDF al bot.</p>
          ) : (
            meses.map((mes) => {
              const delMes = gastos.filter((g) => g.fecha.startsWith(mes));
              const totalMesLista = delMes.reduce((s, g) => s + g.base + g.iva, 0);
              return (
                <ListGroup key={mes} label={nombreMes(`${mes}-01`)} aside={eurosSinCentimos(totalMesLista)}>
                  {delMes.map((g) => {
                    const fila = (
                      <ListItem
                        key={g.id}
                        title={
                          <span className="flex items-center gap-2">
                            <AvatarProveedor nombre={g.proveedor ?? "?"} size="sm" />
                            {nombreCorto(g.proveedor ?? "?")}
                          </span>
                        }
                        description={`${fechaES(g.fecha)} · ${g.categoria ? ETIQUETA_CATEGORIA[g.categoria] : "Sin categoría"}`}
                        value={euros(g.base + g.iva)}
                        badge={{ label: CORTO_IVA[g.tipo] ?? g.tipo, type: "secondary" }}
                      />
                    );
                    return g.archivo_path ? (
                      <VisorArchivo key={g.id} path={g.archivo_path} titulo={nombreCorto(g.proveedor ?? "?")} fecha={fechaES(g.fecha)} importe={euros(g.base + g.iva)}>
                        {fila}
                      </VisorArchivo>
                    ) : (
                      fila
                    );
                  })}
                </ListGroup>
              );
            })
          )}

          {faltanEsteMes.length > 0 && (
            <ListGroup label="Faltan este mes">
              {faltanEsteMes.map((nombre) => (
                <ListItem key={nombre} title={nombreCorto(nombre)} description="Suele llegar cada mes" />
              ))}
            </ListGroup>
          )}

          <p className="text-caption text-tertiary">
            ISP: el proveedor no cobra IVA y te lo autorrepercutes y deduces en el 303 (neto 0). Las cuotas de autónomo y la
            amortización se suman en el P&L de Inicio.
          </p>
        </div>
      </div>
    </div>
  );
}
