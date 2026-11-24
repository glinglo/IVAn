import { Alert, Badge, Card, CardHeader, CardMetrics, ListGroup, ListItem, PageHeader } from "@glinglo/vela-ds";
import { cargarLibro } from "@/lib/libro";
import { euros, eurosSinCentimos, fechaES, hoyMadrid, nombreMes, trimestreDe } from "@/lib/fiscal";
import { nombreCorto } from "@/lib/texto";
import { COLOR_CATEGORIA, ETIQUETA_CATEGORIA, type CategoriaGasto } from "@/lib/categorias";
import { cambiosGastos, proveedoresQueFaltan, suscripciones, type GastoProveedor } from "@/lib/recordatorios";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { Periodo } from "@/components/Periodo";
import { BloqueResultados } from "@/components/BloqueResultados";
import { GraficoTipoIva } from "@/components/GraficoTipoIva";
import { GraficoGastosMes } from "@/components/GraficoGastosMes";
import { AvatarProveedor } from "@/components/AvatarProveedor";
import { db } from "@/lib/db";

const CORTO_IVA: Record<string, string> = {
  "IVA soportado": "IVA",
  "ISP UE": "ISP UE",
  "ISP fuera UE": "ISP extra-UE",
  "Sin IVA deducible": "sin IVA",
};

const ETIQUETAS_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const FONDO_CAMBIO: Record<"sube" | "baja" | "sin_factura", string> = {
  sube: "bg-yellow-100",
  baja: "bg-green-100",
  sin_factura: "bg-gray-100",
};
const TEXTO_CAMBIO: Record<"sube" | "baja" | "sin_factura", string> = {
  sube: "Sube",
  baja: "Baja",
  sin_factura: "Sin factura",
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

  // Para "Faltan este mes", "Tus suscripciones" y "Lo que ha cambiado": siempre relativos a hoy, no
  // al periodo ni al año de la página. Desde octubre del año pasado, de sobra para los 4 meses que
  // necesita la recurrencia aunque hoy sea enero o febrero.
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

  const subtituloPeriodo = periodo === null ? `Gastos de ${anio}` : `${periodo}T de ${anio}`;

  // % de lo que facturas en el mismo periodo.
  const facturadoPeriodo = libro.facturas
    .filter((f) => !periodo || trimestreDe(f.fecha).t === periodo)
    .reduce((s, f) => s + f.base, 0);
  const totalGastosPeriodo = gastosDelPeriodo.reduce((s, g) => s + g.base + g.iva, 0);
  const pctSobreFacturado = facturadoPeriodo > 0 ? Math.round((totalGastosPeriodo / facturadoPeriodo) * 100) : null;

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
  const pctSinDeducir = Math.round((sinDeducir / totalTipos) * 100);
  const conDeducible = totalTipos - sinDeducir;

  // Faltan este mes (desde el día 28).
  const faltanEsteMes = Number(hoy.slice(8)) >= 28 ? proveedoresQueFaltan(gastosParaRecurrencia, hoy).faltan : [];

  // Tus suscripciones y lo que ha cambiado (siempre los últimos meses, no el periodo de la página).
  const { activas, sinFacturaDesde } = suscripciones(gastosParaRecurrencia, hoy);
  const totalMes = activas.reduce((s, a) => s + a.costeMes, 0);
  const cambios = cambiosGastos(gastosParaRecurrencia, hoy);

  // Gráfico por mes y categoría: los meses del periodo (año = de enero al mes en curso; trimestre = sus 3 meses).
  const mesHoy = Number(hoy.slice(5, 7));
  const [mesIni, mesFin] = periodo === null ? [1, anioCerrado ? 12 : mesHoy] : [(periodo - 1) * 3 + 1, periodo * 3];
  const mesesGrafico = Array.from({ length: mesFin - mesIni + 1 }, (_, i) => {
    const mes = `${anio}-${String(mesIni + i).padStart(2, "0")}`;
    const delMes = libro.gastos.filter((g) => g.fecha.startsWith(mes));
    const porCat = new Map<CategoriaGasto, number>();
    for (const g of delMes) {
      const c = (g.categoria ?? "otros") as CategoriaGasto;
      porCat.set(c, (porCat.get(c) ?? 0) + g.base + g.iva);
    }
    return { label: ETIQUETAS_MES[mesIni + i - 1], values: (Object.keys(ETIQUETA_CATEGORIA) as CategoriaGasto[]).map((c) => porCat.get(c) ?? 0) };
  });
  const seriesCategorias = (Object.keys(ETIQUETA_CATEGORIA) as CategoriaGasto[]).map((c) => ({
    name: ETIQUETA_CATEGORIA[c],
    color: COLOR_CATEGORIA[c],
  }));

  // Meses del periodo, de más reciente a más antiguo (lista).
  const meses = [...new Set(gastos.map((g) => g.fecha.slice(0, 7)))].sort().reverse();

  const seccionCambios = cambios.length > 0 && (
    <div className="flex flex-col gap-3">
      <h2 className="text-eyebrow text-tertiary">Lo que ha cambiado</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cambios.map((c) => (
          <CardMetrics key={c.nombre} className={FONDO_CAMBIO[c.tipo]} title={nombreCorto(c.nombre)} value={TEXTO_CAMBIO[c.tipo]} />
        ))}
      </div>
    </div>
  );

  const seccionLista =
    gastos.length === 0 ? (
      <p className="text-tertiary">No hay gastos en este periodo. Mándale una foto o un PDF al bot.</p>
    ) : (
      <div className="flex flex-col gap-4">
        {meses.map((mes) => {
          const delMes = gastos.filter((g) => g.fecha.startsWith(mes));
          const totalMesLista = delMes.reduce((s, g) => s + g.base + g.iva, 0);
          return (
            <ListGroup key={mes} label={nombreMes(`${mes}-01`)} aside={eurosSinCentimos(totalMesLista)}>
              {delMes.map((g) => (
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
                  href={g.archivo_path ? `/api/archivo?path=${encodeURIComponent(g.archivo_path)}` : undefined}
                  badge={{ label: CORTO_IVA[g.tipo] ?? g.tipo, type: "secondary" }}
                />
              ))}
            </ListGroup>
          );
        })}
      </div>
    );

  const seccionSuscripciones = (
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
                <span className="flex-1">{nombreCorto(a.nombre)}</span>
                <span>{eurosSinCentimos(a.costeMes)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-tertiary">Ninguna detectada todavía.</p>
      )}
      {sinFacturaDesde.length > 0 && (
        <>
          <div className="h-px bg-separator" />
          <h3 className="text-eyebrow text-tertiary">Sin factura desde…</h3>
          <ul className="flex flex-col gap-1">
            {sinFacturaDesde.map((s) => (
              <li key={s.nombre} className="flex items-center justify-between text-body">
                <span>{nombreCorto(s.nombre)}</span>
                <span className="text-tertiary">{nombreMes(`${s.mes}-01`)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );

  const seccionCategorias = categorias.length > 0 && (
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
                <div className="h-full rounded-full" style={{ width: `${Math.round((importe / totalCategorias) * 100)}%`, backgroundColor: COLOR_CATEGORIA[c] }} />
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );

  const seccionIva = (
    <Card className="gap-3">
      <h2 className="text-eyebrow text-tertiary">¿Por qué casi no hay IVA que deducir?</h2>
      <GraficoTipoIva
        parts={[
          { value: conDeducible, color: "var(--color-chart-primary)", label: "Con IVA deducible" },
          { value: sinDeducir, color: "var(--color-gray-200)", label: "Sin IVA deducible" },
        ]}
      />
      <p className="text-body">
        El {pctSinDeducir}&nbsp;% de lo que gastas viene de fuera de España o no lleva tu NIF: no tiene IVA que deducir.
      </p>
    </Card>
  );

  return (
    <>
      <PageHeader title="Gastos" actions={<AccionesCabecera anio={anio} anioActual={anioActual} />} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
        <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1 flex flex-col gap-6">
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

              <div className="flex flex-col gap-2">
                <div className="text-display">{euros(base)}</div>
                <div className="text-caption text-tertiary">
                  {gastos.length === 1 ? "1 gasto" : `${gastos.length} gastos`} · {euros(iva)} de IVA deducible
                </div>
                {pctSobreFacturado !== null && (
                  <div className="flex items-center gap-2">
                    <Badge type={pctSobreFacturado <= 20 ? "success" : "onhold"}>{pctSobreFacturado} % de lo que facturas</Badge>
                    {pctSobreFacturado <= 20 && <Badge type="secondary">Por debajo del 20 %: sano</Badge>}
                  </div>
                )}
              </div>

              <div className="h-px bg-separator" />

              <GraficoGastosMes meses={mesesGrafico} series={seriesCategorias} />
            </Card>
          </BloqueResultados>

          {(borr.count ?? 0) > 0 && (
            <Alert variant="help">
              {borr.count === 1 ? "1 gasto sin confirmar en el bot." : `${borr.count} gastos sin confirmar en el bot.`}
            </Alert>
          )}
        </div>

        <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 flex flex-col gap-4">{seccionSuscripciones}</div>

        <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">{seccionCambios}</div>

        <div className="order-4 lg:order-none lg:col-start-2 lg:row-start-2 flex flex-col gap-4">{seccionCategorias}</div>

        <div className="order-5 lg:order-none lg:col-start-1 lg:row-start-3">{seccionLista}</div>

        <div className="order-6 lg:order-none lg:col-start-2 lg:row-start-3 flex flex-col gap-4">{seccionIva}</div>

        {faltanEsteMes.length > 0 && (
          <div className="order-7 lg:col-start-1 lg:row-start-4">
            <ListGroup label="Faltan este mes">
              {faltanEsteMes.map((nombre) => (
                <ListItem key={nombre} title={nombreCorto(nombre)} description="Suele llegar cada mes" />
              ))}
            </ListGroup>
          </div>
        )}

        <p className="order-8 lg:col-start-1 lg:row-start-5 text-caption text-tertiary">
          ISP: el proveedor no cobra IVA y te lo autorrepercutes y deduces en el 303 (neto 0). Las cuotas de autónomo y la
          amortización se suman en el P&L de Inicio.
        </p>
      </div>
    </>
  );
}
