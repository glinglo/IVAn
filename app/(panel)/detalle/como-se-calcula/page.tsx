import { Card, PageHeader } from "@glinglo/vela-ds";
import { cargarLibro, irpfACuenta, pygHasta } from "@/lib/libro";
import { pygTrimestre } from "@/lib/inicio";
import { amortizacionDelAnioPorBien, type BienCalc } from "@/lib/calculo";
import { eurosSinCentimos, hoyMadrid, nombreMes, plazoTrimestral, rangoTrimestre, round2, sumarDias, trimestreDe } from "@/lib/fiscal";
import { AccionesCabecera } from "@/components/AccionesCabecera";
import { Periodo } from "@/components/Periodo";
import { db } from "@/lib/db";

export default async function ComoSeCalcula({ searchParams }: { searchParams: Promise<{ anio?: string; periodo?: string }> }) {
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const sp = await searchParams;
  const anio = Number(sp.anio ?? anioActual);
  const periodo = sp.periodo && ["1", "2", "3", "4"].includes(sp.periodo) ? Number(sp.periodo) : null;

  const [libro, bienesRes] = await Promise.all([
    cargarLibro(anio),
    db().from("bienes_inversion").select("descripcion, fecha_compra, base, pct_anual").order("fecha_compra"),
  ]);
  if (bienesRes.error) throw bienesRes.error;
  const bienes = (bienesRes.data ?? []) as { descripcion: string; fecha_compra: string; base: number; pct_anual: number }[];

  const anioCerrado = anio !== anioActual;
  const tHoy = trimestreDe(hoy).t;
  const trimestreEnCurso = periodo !== null && !anioCerrado && periodo === tHoy;
  const disponibles = anioCerrado ? [1, 2, 3, 4] : Array.from({ length: tHoy }, (_, i) => i + 1);
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
  const desde = periodo === null ? `${anio}-01-01` : rangoTrimestre(anio, periodo).desde;

  const p = periodo === null ? pygHasta(libro, hasta) : pygTrimestre(libro, anio, periodo, hasta);

  const irpf = irpfACuenta(libro, libro.presentaciones, anio, periodo, hoy);
  const teQueda = round2(p.rendimientoNeto - irpf.total);
  const tPendiente = irpf.porPagar > 0 ? (periodo ?? (anio === anioActual ? tHoy : 4)) : null;

  // Amortización bien a bien: para el año, amortizacionDelAnioPorBien; para un trimestre, la misma
  // diferencia de acumulados que usa pygTrimestre, pero por bien.
  const amortizacionesPorBien =
    periodo === null
      ? amortizacionDelAnioPorBien(bienes, hasta)
      : bienes.map((b) => {
          const bienCalc: BienCalc = { fecha_compra: b.fecha_compra, base: b.base, pct_anual: b.pct_anual };
          const desdeAnio = amortizacionDelAnioPorBien([bienCalc], hasta)[0];
          const antesDelPeriodo = amortizacionDelAnioPorBien([bienCalc], sumarDias(desde, -1))[0];
          return round2(desdeAnio - antesDelPeriodo);
        });

  const subtituloPeriodo =
    periodo === null
      ? anioCerrado
        ? `Año ${anio} completo`
        : "Acumulado de enero a hoy"
      : `${periodo}T · de ${nombreMes(rangoTrimestre(anio, periodo).desde)} a ${trimestreEnCurso ? "hoy" : nombreMes(rangoTrimestre(anio, periodo).hasta)}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Cómo se calcula"
        subtitle={subtituloPeriodo}
        back={{ label: "Inicio", href: "/" }}
        actions={<AccionesCabecera anio={anio} anioActual={anioActual} />}
      />

      <Card className="p-4 lg:p-6 gap-4">
        <div className="hidden lg:block">
          <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} />
        </div>
        <div className="lg:hidden">
          <Periodo valor={periodo === null ? "anio" : String(periodo)} anio={anio} disponibles={disponibles} fullWidth />
        </div>

        <div className="h-px bg-separator" />

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-body">
            <span>Facturado (sin IVA)</span>
            <span>{eurosSinCentimos(p.ingresos)}</span>
          </div>
          <p className="text-caption text-tertiary">Suma de las bases de tus facturas. El IVA que cobras no es tuyo.</p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-body">
            <span>Gastos con factura</span>
            <span>-{eurosSinCentimos(p.gastosFacturas)}</span>
          </div>
          <p className="text-caption text-tertiary">Bases de los gastos confirmados. El IVA deducible no cuenta como gasto; el no deducible, sí.</p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-body">
            <span>Cuota de autónomo</span>
            <span>-{eurosSinCentimos(p.seguridadSocial)}</span>
          </div>
          <p className="text-caption text-tertiary">Recibos reales, y si falta un mes, la cuota por defecto de Ajustes.</p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-body">
            <span>Amortización</span>
            <span>-{eurosSinCentimos(p.amortizaciones)}</span>
          </div>
          {bienes.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {bienes.map((b, i) => (
                <li key={`${b.descripcion}-${b.fecha_compra}`} className="flex items-center justify-between text-caption text-tertiary">
                  <span>
                    {b.descripcion} · base {eurosSinCentimos(b.base)} · {b.pct_anual} % anual
                  </span>
                  <span>-{eurosSinCentimos(amortizacionesPorBien[i])}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-body">
            <span>Difícil justificación (5 %)</span>
            <span>-{eurosSinCentimos(p.dificilJustificacion)}</span>
          </div>
          <p className="text-caption text-tertiary">El 5 % de la diferencia, con un máximo de 2.000 € al año.</p>
        </div>

        <div className="h-px bg-separator" />

        <div className="flex items-center justify-between text-body font-semibold">
          <span>Rendimiento neto</span>
          <span>{eurosSinCentimos(p.rendimientoNeto)}</span>
        </div>
        <p className="text-caption text-tertiary">La base del 130 y de la Renta.</p>

        <div className="h-px bg-separator" />

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

        <div className="h-px bg-separator" />

        <p className="text-caption text-tertiary">
          El IVA no entra en ninguna de estas cifras: lo que cobras de IVA se lo pasas a Hacienda en el 303.
        </p>
      </Card>
    </div>
  );
}
