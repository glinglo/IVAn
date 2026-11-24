import { Alert, Badge, Card, ListGroup, ListItem, PageHeader } from "@glinglo/vela-ds";
import { cargarLibro } from "@/lib/libro";
import { euros, eurosSinCentimos, fechaES, hoyMadrid, mesAnterior, nombreMes, trimestreDe } from "@/lib/fiscal";
import { nombreCorto } from "@/lib/texto";
import { ETIQUETA_CATEGORIA, type CategoriaGasto } from "@/lib/categorias";
import { proveedoresQueFaltan } from "@/lib/recordatorios";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { Periodo } from "@/components/Periodo";
import { GraficoTipoIva } from "@/components/GraficoTipoIva";
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

  const desdeRecordatorios = `${mesAnterior(mesAnterior(mesAnterior(hoy.slice(0, 7))))}-01`;
  const [libro, borr, gastosRecientes] = await Promise.all([
    cargarLibro(anio),
    db().from("gastos").select("id", { count: "exact", head: true }).eq("estado", "borrador"),
    db().from("gastos").select("proveedor, nif, fecha, estado").gte("fecha", desdeRecordatorios).neq("estado", "descartado"),
  ]);

  const gastosDelPeriodo = libro.gastos.filter((g) => !periodo || trimestreDe(g.fecha).t === periodo);
  const gastos = categoriaFiltro ? gastosDelPeriodo.filter((g) => g.categoria === categoriaFiltro) : gastosDelPeriodo;
  const base = gastos.reduce((s, g) => s + g.base, 0);
  const iva = gastos.reduce((s, g) => s + g.iva, 0);

  const subtituloPeriodo = periodo === null ? `Gastos de ${anio}` : `${periodo}T de ${anio}`;

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

  // Por qué casi no hay IVA deducible: reparto por tipo de IVA.
  const porTipo = new Map<string, number>();
  for (const g of gastosDelPeriodo) porTipo.set(g.tipo, (porTipo.get(g.tipo) ?? 0) + g.base + g.iva);
  const totalTipos = [...porTipo.values()].reduce((s, v) => s + v, 0) || 1;
  const sinDeducir = (porTipo.get("ISP UE") ?? 0) + (porTipo.get("ISP fuera UE") ?? 0) + (porTipo.get("Sin IVA deducible") ?? 0);
  const pctSinDeducir = Math.round((sinDeducir / totalTipos) * 100);
  const coloresTipo: Record<string, string> = {
    "IVA soportado": "var(--color-chart-primary)",
    "ISP UE": "var(--color-chart-muted)",
    "ISP fuera UE": "var(--color-gray-300)",
    "Sin IVA deducible": "var(--color-gray-200)",
  };

  // Faltan este mes (desde el día 28).
  const faltanEsteMes =
    Number(hoy.slice(8)) >= 28 ? proveedoresQueFaltan(gastosRecientes.data ?? [], hoy).faltan : [];

  // Meses del periodo, de más reciente a más antiguo.
  const meses = [...new Set(gastos.map((g) => g.fecha.slice(0, 7)))].sort().reverse();

  return (
    <>
      <PageHeader title="Gastos" subtitle={subtituloPeriodo} actions={<AccionesCabecera anio={anio} anioActual={anioActual} />} />

      <div className="flex flex-col gap-6">
        <div className="hidden lg:block">
          <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} />
        </div>
        <div className="lg:hidden">
          <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} fullWidth />
        </div>

        <Card className="gap-2">
          <div className="text-display">{euros(base)}</div>
          <div className="text-caption text-tertiary">
            {gastos.length === 1 ? "1 gasto" : `${gastos.length} gastos`} · {euros(iva)} de IVA deducible
          </div>
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
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.round((importe / totalCategorias) * 100)}%` }}
                      />
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}

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
            const baseMes = delMes.reduce((s, g) => s + g.base + g.iva, 0);
            return (
              <ListGroup key={mes} label={nombreMes(`${mes}-01`)} aside={eurosSinCentimos(baseMes)}>
                {delMes.map((g) => (
                  <ListItem
                    key={g.id}
                    title={nombreCorto(g.proveedor ?? "?")}
                    description={`${fechaES(g.fecha)} · ${g.categoria ? ETIQUETA_CATEGORIA[g.categoria] : "Sin categoría"}`}
                    value={euros(g.base + g.iva)}
                    href={g.archivo_path ? `/api/archivo?path=${encodeURIComponent(g.archivo_path)}` : undefined}
                    badge={{ label: CORTO_IVA[g.tipo] ?? g.tipo, type: "secondary" }}
                  />
                ))}
              </ListGroup>
            );
          })
        )}

        <Card className="gap-3">
          <h2 className="text-eyebrow text-tertiary">Por qué casi no hay IVA deducible</h2>
          <GraficoTipoIva
            parts={[...porTipo.entries()].map(([tipo, v]) => ({
              value: v,
              color: coloresTipo[tipo] ?? "var(--color-gray-200)",
              label: CORTO_IVA[tipo] ?? tipo,
            }))}
          />
          <p className="text-body">
            El {pctSinDeducir}&nbsp;% de tus gastos no tiene IVA deducible: son compras a proveedores de fuera de España (ISP) o
            sin tu NIF en la factura.
          </p>
        </Card>

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
    </>
  );
}
