// Lee el libro de la base de datos y lo prepara para el cálculo, el panel y el bot.

import { db, getAjustes, nums, type Ajustes } from "./db";
import { modelo130, modelo303, modelo349, pyg, type DatosCalc, type FacturaCalc, type GastoCalc } from "./calculo";
import { diasEntre, hoyMadrid, nombreMes, plazoTrimestral, trimestreDe, type Plazo } from "./fiscal";
import { modoParalelo } from "./externas";

export interface FacturaLista {
  id: string;
  numero: string;
  fecha: string;
  cliente: string;
  nif_cliente: string | null;
  concepto: string;
  base: number;
  iva_pct: number;
  iva: number;
  retencion: number;
  total: number;
  tipo: FacturaCalc["tipo"];
  pdf_path: string | null;
}

export interface GastoLista {
  id: string;
  fecha: string;
  proveedor: string | null;
  pais: string | null;
  nif: string | null;
  numero_factura: string | null;
  concepto: string | null;
  tipo: GastoCalc["tipo"];
  base: number;
  iva: number;
  desglose: GastoCalc["desglose"];
  uso: GastoCalc["uso"];
  manutencion_limite: number | null;
  archivo_path: string | null;
}

export interface Presentacion {
  modelo: string;
  anio: number;
  trimestre: number;
  importe: number | null;
  fecha: string | null;
}

export interface Libro {
  anio: number;
  ajustes: Ajustes;
  facturas: FacturaLista[];
  gastos: GastoLista[];
  presentaciones: Presentacion[];
  datos: DatosCalc;
  bienesAproximados: number;
  cuotasRegistradas: number;
}

export async function cargarLibro(anio: number): Promise<Libro> {
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const [ajustes, f, g, c, b, p] = await Promise.all([
    getAjustes(),
    db()
      .from("facturas")
      .select("id, numero, fecha, concepto, base, iva_pct, iva, retencion, total, tipo, pdf_path, clientes(nombre, nif)")
      .eq("estado", "emitida")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false }),
    db()
      .from("gastos")
      .select("id, fecha, proveedor, pais, nif, numero_factura, concepto, tipo, base, iva, desglose, uso, manutencion_limite, archivo_path")
      .eq("estado", "confirmado")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false }),
    db().from("cuotas_autonomo").select("mes, importe").gte("mes", desde).lte("mes", hasta),
    db().from("bienes_inversion").select("fecha_compra, fecha_aproximada, base, pct_anual"),
    db().from("presentaciones").select("modelo, anio, trimestre, importe, fecha").eq("anio", anio),
  ]);
  for (const r of [f, g, c, b, p]) if (r.error) throw r.error;

  type FilaFactura = Omit<FacturaLista, "cliente" | "nif_cliente"> & { clientes: { nombre: string; nif: string | null } | null };
  const facturas: FacturaLista[] = ((f.data ?? []) as unknown as FilaFactura[]).map(({ clientes, ...x }) => ({
    ...nums(x, ["base", "iva_pct", "iva", "retencion", "total"]),
    cliente: clientes?.nombre ?? "?",
    nif_cliente: clientes?.nif ?? null,
  }));
  const gastos = ((g.data ?? []) as GastoLista[]).map((x) => nums(x, ["base", "iva", "manutencion_limite"]));
  const cuotas = new Map((c.data ?? []).map((r) => [String(r.mes).slice(0, 7), Number(r.importe)]));
  const bienes = (b.data ?? []).map((x) => ({
    fecha_compra: x.fecha_compra as string,
    base: Number(x.base),
    pct_anual: Number(x.pct_anual),
    aproximada: Boolean(x.fecha_aproximada),
  }));
  const presentaciones = ((p.data ?? []) as Presentacion[]).map((x) => ({
    ...x,
    importe: x.importe === null ? null : Number(x.importe),
  }));
  const cuotaDefecto = Number(ajustes.cuota_autonomo_mensual ?? 0);

  const datos: DatosCalc = {
    facturas,
    gastos,
    cuotaMes: (mes) => cuotas.get(mes) ?? cuotaDefecto,
    bienes,
    pagado130: (a, t) => presentaciones.find((x) => x.modelo === "130" && x.anio === a && x.trimestre === t)?.importe ?? null,
    ivaCompensarInicial: Number(ajustes.iva_compensar_inicial ?? 0),
  };
  return {
    anio,
    ajustes,
    facturas,
    gastos,
    presentaciones,
    datos,
    bienesAproximados: bienes.filter((x) => x.aproximada).length,
    cuotasRegistradas: cuotas.size,
  };
}

export function resumenTrimestre(libro: Libro, t: number) {
  return {
    m303: modelo303(libro.datos, libro.anio, t),
    m130: modelo130(libro.datos, libro.anio, t),
    m349: modelo349(libro.datos, libro.anio, t),
    presentado: (modelo: string) =>
      libro.presentaciones.some((p) => p.modelo === modelo && p.anio === libro.anio && p.trimestre === t),
  };
}

export function pygHasta(libro: Libro, hasta: string) {
  return pyg(libro.datos, hasta);
}

// ---------- Siguientes pasos ----------

export interface Paso {
  nivel: "urgente" | "pendiente" | "info";
  clave: "plazo" | "gastos" | "facturar" | "iban" | "direccion" | "mac" | "cuota" | "verifactu";
  texto: string;
  detalle?: string;
  href?: string;
  /** Días hasta el inicio del plazo (sin abrir) o hasta el final (abierto). */
  dias?: number;
  /** Si `dias` cuenta hasta el final de un plazo ya abierto, en vez de hasta su apertura. */
  abierto?: boolean;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Queda 1 día" / "Quedan N días" / "Último día", o "En 1 día" / "En N días" si el plazo no ha abierto. */
export function cuandoPaso(p: Paso): string | null {
  if (p.dias === undefined) return null;
  if (p.dias === 0) return "Último día";
  if (p.abierto) return p.dias === 1 ? "Queda 1 día" : `Quedan ${p.dias} días`;
  return p.dias === 1 ? "En 1 día" : `En ${p.dias} días`;
}

/** "Quedan N días (hasta el …)" / "Queda 1 día (…)" / "Último día (…)". */
function detalleDiasRestantes(dias: number, fin: string): string {
  const hasta = `(hasta el ${fin.split("-").reverse().join("/")})`;
  if (dias === 0) return `Último día ${hasta}`;
  return dias === 1 ? `Queda 1 día ${hasta}` : `Quedan ${dias} días ${hasta}`;
}

export interface ContextoPasos {
  hoy: string;
  libro: Libro;
  /** El libro del año anterior, para el 4T que se presenta en enero */
  libroAnterior?: Libro | null;
  gastosPorConfirmar: number;
  clientesSinDireccion: string[];
}

/** Lista de cosas por hacer, de más a menos urgente. Pura salvo por los datos que recibe. */
export function siguientesPasos(c: ContextoPasos): Paso[] {
  const pasos: Paso[] = [];
  const { anio, t } = trimestreDe(c.hoy);

  // Próximo plazo: el trimestre anterior si su plazo sigue abierto, si no el actual.
  const candidatos: { plazo: Plazo; libro: Libro | null | undefined }[] = [
    t === 1 ? { plazo: plazoTrimestral(anio - 1, 4), libro: c.libroAnterior } : { plazo: plazoTrimestral(anio, t - 1), libro: c.libro },
    { plazo: plazoTrimestral(anio, t), libro: c.libro },
  ];
  for (const { plazo, libro } of candidatos) {
    if (c.hoy > plazo.fin) continue;
    const modelos = plazo.t === 4 ? ["303", "130", "349", "390"] : ["303", "130", "349"];
    const faltan = libro
      ? modelos.filter(
          (m) => !libro.presentaciones.some((p) => p.modelo === m && p.anio === plazo.anio && p.trimestre === (m === "390" ? 0 : plazo.t)),
        )
      : modelos;
    if (!faltan.length) continue;
    const quedan = diasEntre(c.hoy, plazo.fin);
    const abierto = c.hoy >= plazo.apertura;
    const diasHastaApertura = diasEntre(c.hoy, plazo.apertura);
    pasos.push({
      nivel: abierto && quedan <= 10 ? "urgente" : abierto ? "pendiente" : "info",
      clave: "plazo",
      texto: abierto ? `Presentar ${faltan.join(", ")} del ${plazo.t}T ${plazo.anio}` : `Presentar el ${plazo.t}T de ${plazo.anio}`,
      detalle: abierto ? detalleDiasRestantes(quedan, plazo.fin) : `Del ${ddmm(plazo.apertura)} al ${ddmm(plazo.fin)}`,
      href: `/impuestos/${plazo.anio}/${plazo.t}`,
      dias: abierto ? quedan : diasHastaApertura,
      abierto,
    });
    break;
  }

  if (c.gastosPorConfirmar > 0) {
    const texto = c.gastosPorConfirmar === 1 ? "1 gasto sin confirmar" : `${c.gastosPorConfirmar} gastos sin confirmar`;
    pasos.push({ nivel: "pendiente", clave: "gastos", texto, detalle: "Confírmalos en el bot" });
  }

  // Facturación del mes: clientes facturados el mes pasado que aún no tienen factura este mes.
  const mes = c.hoy.slice(0, 7);
  const [y, m] = mes.split("-").map(Number);
  const mesPasado = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const todas = [...c.libro.facturas, ...(c.libroAnterior?.facturas ?? [])];
  const pasado = new Set(todas.filter((f) => f.fecha.startsWith(mesPasado)).map((f) => f.cliente));
  const actual = new Set(todas.filter((f) => f.fecha.startsWith(mes)).map((f) => f.cliente));
  const sinFacturar = [...pasado].filter((x) => !actual.has(x));
  if (sinFacturar.length) {
    const nivel = Number(c.hoy.slice(8)) >= 25 ? "pendiente" : "info";
    if (modoParalelo(c.libro.ajustes, c.hoy)) {
      pasos.push({
        nivel,
        clave: "facturar",
        texto: `Registrar la factura de ${nombreMes(c.hoy)} de ${sinFacturar.join(", ")}`,
        detalle: "La emite Selfconta: mándale el PDF al bot",
      });
    } else {
      pasos.push({
        nivel,
        clave: "facturar",
        texto: `Facturar este mes a ${sinFacturar.join(", ")}`,
        detalle: "En el bot: «factura a … por …»",
      });
    }
  }

  if (!c.libro.ajustes.iban) pasos.push({ nivel: "pendiente", clave: "iban", texto: "Falta tu IBAN para las facturas" });
  for (const n of c.clientesSinDireccion) pasos.push({ nivel: "pendiente", clave: "direccion", texto: `Falta la dirección fiscal de ${n}` });
  if (c.libro.bienesAproximados) pasos.push({ nivel: "info", clave: "mac", texto: "Confirmar la fecha de compra del Mac" });
  if (!c.libro.cuotasRegistradas) {
    pasos.push({ nivel: "info", clave: "cuota", texto: "Cuota de autónomo estimada", detalle: "Pásame los recibos para usar los importes reales" });
  }
  if (c.hoy >= "2027-04-01" && c.hoy < "2027-07-01") {
    pasos.push({ nivel: "pendiente", clave: "verifactu", texto: "Verifactu obligatorio el 1 de julio de 2027", detalle: "Adaptar la emisión de facturas" });
  }
  const orden = { urgente: 0, pendiente: 1, info: 2 } as const;
  return pasos.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

export async function contextoPasos(hoy = hoyMadrid()): Promise<ContextoPasos> {
  const anio = Number(hoy.slice(0, 4));
  const [libro, libroAnterior, borr, cli] = await Promise.all([
    cargarLibro(anio),
    trimestreDe(hoy).t === 1 ? cargarLibro(anio - 1).catch(() => null) : Promise.resolve(null),
    db().from("gastos").select("id", { count: "exact", head: true }).eq("estado", "borrador"),
    db().from("clientes").select("nombre").eq("activo", true).is("direccion", null),
  ]);
  return {
    hoy,
    libro,
    libroAnterior,
    gastosPorConfirmar: borr.count ?? 0,
    clientesSinDireccion: (cli.data ?? []).map((x) => x.nombre as string),
  };
}
