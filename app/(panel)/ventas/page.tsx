import { Card, ListGroup, ListItem, NoticeStrip, PageHeader, StackedBar } from "@glinglo/vela-ds";
import { cargarLibro, type FacturaLista } from "@/lib/libro";
import { euros, eurosSinCentimos, fechaES, hoyMadrid, mesAnterior, nombreMes, trimestreDe } from "@/lib/fiscal";
import { modoParalelo } from "@/lib/externas";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { Periodo } from "@/components/Periodo";

const BOT_URL = "https://t.me/Ivanelgestorbot";
const MESES_RECIENTES = 3;

const TIPO_BADGE: Record<FacturaLista["tipo"], string> = {
  nacional: "Nacional",
  ue: "UE · sin IVA",
  fuera_ue: "Fuera UE",
};

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

  const libro = await cargarLibro(anio);
  const facturas = libro.facturas.filter((f) => !periodo || trimestreDe(f.fecha).t === periodo);
  const base = facturas.reduce((s, f) => s + f.base, 0);

  const subtituloPeriodo = periodo === null ? `Ventas de ${anio}` : `${periodo}T de ${anio}`;

  // Clientes del periodo.
  const porCliente = new Map<string, { base: number; total: number; f: FacturaLista }>();
  for (const f of facturas) {
    const e = porCliente.get(f.cliente) ?? { base: 0, total: 0, f };
    e.base += f.base;
    e.total += f.total;
    porCliente.set(f.cliente, e);
  }
  const clientes = [...porCliente.entries()].sort((a, b) => b[1].base - a[1].base);
  const coloresCliente = ["var(--color-chart-primary)", "var(--color-chart-muted)", "var(--color-gray-300)", "var(--color-gray-200)"];

  // Meses del periodo, de más reciente a más antiguo.
  const mesesDelPeriodo = [...new Set(facturas.map((f) => f.fecha.slice(0, 7)))].sort().reverse();
  const mesesMostrados = todo ? mesesDelPeriodo : mesesDelPeriodo.slice(0, MESES_RECIENTES);
  const hayMas = !todo && mesesDelPeriodo.length > MESES_RECIENTES;

  // Modo paralelo: cliente facturado el mes pasado sin factura este mes.
  const mesActual = hoy.slice(0, 7);
  const mesPasado = mesAnterior(mesActual);
  let pendienteParalelo: { cliente: string } | null = null;
  if (modoParalelo(libro.ajustes, hoy)) {
    const facturadoMesActual = new Set(libro.facturas.filter((f) => f.fecha.startsWith(mesActual)).map((f) => f.cliente));
    const delMesPasado = libro.facturas.find((f) => f.fecha.startsWith(mesPasado) && !facturadoMesActual.has(f.cliente));
    if (delMesPasado) pendienteParalelo = { cliente: delMesPasado.cliente };
  }

  return (
    <>
      <PageHeader title="Ventas" subtitle={subtituloPeriodo} actions={<AccionesCabecera anio={anio} anioActual={anioActual} />} />

      <div className="flex flex-col gap-6">
        <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} />

        <Card className="gap-2">
          <div className="text-display">{euros(base)}</div>
          <div className="text-caption text-tertiary">
            {facturas.length === 1 ? "1 factura" : `${facturas.length} facturas`} · base imponible
          </div>
        </Card>

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
            <ul className="flex flex-col gap-2">
              {clientes.map(([nombre, c]) => {
                const tipo = c.f.tipo;
                const detalleTipo =
                  tipo === "nacional" ? `${c.f.iva_pct} % · −${c.f.retencion_pct} %` : TIPO_BADGE[tipo];
                return (
                  <li key={nombre}>
                    <ListItem
                      title={nombre}
                      description={`${Math.round((c.base / (base || 1)) * 100)} % · ${detalleTipo}`}
                      value={euros(c.base)}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {pendienteParalelo && (
          <ListGroup label="Pendiente">
            <ListItem
              title={`Factura de ${nombreMes(mesPasado + "-01")} · ${pendienteParalelo.cliente}`}
              description="Aún no registrada en el libro"
              badge={{ label: "Pendiente", type: "onhold" }}
            />
          </ListGroup>
        )}

        {facturas.length === 0 ? (
          <p className="text-tertiary">No hay facturas en este periodo.</p>
        ) : (
          mesesMostrados.map((mes) => {
            const delMes = facturas.filter((f) => f.fecha.startsWith(mes));
            const baseMes = delMes.reduce((s, f) => s + f.base, 0);
            return (
              <ListGroup key={mes} label={nombreMes(`${mes}-01`)} aside={eurosSinCentimos(baseMes)}>
                {delMes.map((f) => (
                  <ListItem
                    key={f.id}
                    title={`${f.numero} · ${f.cliente}`}
                    description={`${fechaES(f.fecha)} · ${f.concepto}`}
                    value={euros(f.total)}
                    href={f.pdf_path ? `/api/archivo?path=${encodeURIComponent(f.pdf_path)}` : undefined}
                    badge={
                      f.origen === "externa"
                        ? { label: "Selfconta", type: "secondary" }
                        : !f.pdf_path
                          ? { label: "sin PDF", type: "secondary" }
                          : undefined
                    }
                  />
                ))}
              </ListGroup>
            );
          })
        )}

        {hayMas && (
          <a href={`?anio=${anio}${periodo ? `&periodo=${periodo}` : ""}&todo=1`} className="text-link-secondary">
            Ver {nombreMes(`${mesesDelPeriodo[mesesDelPeriodo.length - 1]}-01`)} a {nombreMes(`${mesesDelPeriodo[MESES_RECIENTES]}-01`)}
          </a>
        )}

        <NoticeStrip title="Para facturar o corregir una factura, díselo al bot" href={BOT_URL} target="_blank" />
      </div>
    </>
  );
}
