// Lee el libro de la base de datos y lo prepara para el cálculo, el panel y el bot.

import { db, getAjustes, nums, type Ajustes } from "./db";
import { modelo130, modelo303, modelo349, pyg, type DatosCalc, type FacturaCalc, type GastoCalc } from "./calculo";
import { diasEntre, hoyMadrid, mesAnterior, nombreMes, plazoTrimestral, rangoTrimestre, round2, sumarDias, trimestreDe, type Plazo } from "./fiscal";
import { modoParalelo } from "./externas";
import type { CategoriaGasto } from "./categorias";

export interface FacturaLista {
  id: string;
  numero: string;
  fecha: string;
  cliente: string;
  nif_cliente: string | null;
  pais_cliente: string;
  concepto: string;
  base: number;
  iva_pct: number;
  iva: number;
  retencion_pct: number;
  retencion: number;
  total: number;
  tipo: FacturaCalc["tipo"];
  origen: "ivan" | "externa";
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
  categoria: CategoriaGasto | null;
}

export interface Casillas303 {
  "110"?: number;
  "78"?: number;
  "87"?: number;
  "71"?: number;
}

export interface Presentacion {
  modelo: string;
  anio: number;
  trimestre: number;
  importe: number | null;
  fecha: string | null;
  /** Casillas clave tal como se presentaron (solo el 303): 110, 78, 87 y 71. Solo se muestran; no
   * entran en ningún cálculo. */
  casillas: Casillas303 | null;
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
      .select("id, numero, fecha, concepto, base, iva_pct, iva, retencion_pct, retencion, total, tipo, origen, pdf_path, clientes(nombre, nif, pais)")
      .eq("estado", "emitida")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false }),
    db()
      .from("gastos")
      .select("id, fecha, proveedor, pais, nif, numero_factura, concepto, tipo, base, iva, desglose, uso, manutencion_limite, archivo_path, categoria")
      .eq("estado", "confirmado")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false }),
    db().from("cuotas_autonomo").select("mes, importe").gte("mes", desde).lte("mes", hasta),
    db().from("bienes_inversion").select("fecha_compra, fecha_aproximada, base, pct_anual, subvencion"),
    db().from("presentaciones").select("modelo, anio, trimestre, importe, fecha").eq("anio", anio),
  ]);
  for (const r of [f, g, c, p]) if (r.error) throw r.error;
  // Si falta la columna subvencion (migración 009 sin aplicar), vuelve a pedir sin ella: que no
  // rompa todo el panel por un dato que de momento solo usa un bien.
  let bienesData: { fecha_compra: string; fecha_aproximada: boolean; base: number; pct_anual: number; subvencion?: number }[] | null = b.data;
  if (b.error) {
    const retry = await db().from("bienes_inversion").select("fecha_compra, fecha_aproximada, base, pct_anual");
    if (retry.error) throw retry.error;
    bienesData = retry.data;
  }

  type FilaFactura = Omit<FacturaLista, "cliente" | "nif_cliente" | "pais_cliente"> & {
    clientes: { nombre: string; nif: string | null; pais: string } | null;
  };
  const facturas: FacturaLista[] = ((f.data ?? []) as unknown as FilaFactura[]).map(({ clientes, ...x }) => ({
    ...nums(x, ["base", "iva_pct", "iva", "retencion_pct", "retencion", "total"]),
    cliente: clientes?.nombre ?? "?",
    nif_cliente: clientes?.nif ?? null,
    pais_cliente: clientes?.pais ?? "?",
  }));
  const gastos = ((g.data ?? []) as GastoLista[]).map((x) => nums(x, ["base", "iva", "manutencion_limite"]));
  const cuotas = new Map((c.data ?? []).map((r) => [String(r.mes).slice(0, 7), Number(r.importe)]));
  const bienes = (bienesData ?? []).map((x) => ({
    fecha_compra: x.fecha_compra as string,
    base: Number(x.base),
    pct_anual: Number(x.pct_anual),
    subvencion: Number(x.subvencion ?? 0),
    aproximada: Boolean(x.fecha_aproximada),
  }));
  const presentaciones = ((p.data ?? []) as Presentacion[]).map((x) => ({
    ...x,
    importe: x.importe === null ? null : Number(x.importe),
    // casillas no se pide aquí (cargarLibro es la consulta compartida de todas las páginas): la
    // pide cargarPresentaciones303() por separado, para no tumbar todo el panel si la migración 008
    // (presentaciones.casillas) no está aplicada.
    casillas: null,
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

export interface IrpfACuenta {
  /** 130 de los trimestres ya presentados. */
  pagado130: number;
  /** Retenciones de las facturas del periodo. */
  retenciones: number;
  /** 130 estimado de los trimestres del periodo que aún no se han presentado (0 si sale a 0 o negativo). */
  porPagar: number;
  /** pagado130 + retenciones + porPagar: lo que se resta al rendimiento neto para «Te queda». */
  total: number;
}

/**
 * IRPF a cuenta del periodo: lo ya pagado (130 presentados + retenciones de las facturas) y lo que
 * falta por pagar (130 estimado de los trimestres del periodo sin presentar todavía). `periodo` es
 * un trimestre (1-4) o `null` para el año completo hasta el último trimestre que toca ese año (todos
 * si está cerrado, hasta el actual si no).
 */
export function irpfACuenta(libro: Libro, presentaciones: Presentacion[], anio: number, periodo: number | null, hoy: string): IrpfACuenta {
  const anioHoy = Number(hoy.slice(0, 4));
  const tHoy = trimestreDe(hoy).t;
  const ultimoTrimestreDelAnio = anio === anioHoy ? tHoy : 4;
  const trimestres = periodo === null ? Array.from({ length: ultimoTrimestreDelAnio }, (_, i) => i + 1) : [periodo];

  let pagado130 = 0;
  let porPagar = 0;
  for (const t of trimestres) {
    const p = presentaciones.find((x) => x.modelo === "130" && x.anio === anio && x.trimestre === t);
    if (p?.importe !== null && p?.importe !== undefined) {
      pagado130 = round2(pagado130 + p.importe);
    } else {
      const estimado = modelo130(libro.datos, anio, t).aIngresar;
      if (estimado > 0) porPagar = round2(porPagar + estimado);
    }
  }

  const { desde, hasta } = periodo === null ? { desde: `${anio}-01-01`, hasta: `${anio}-12-31` } : rangoTrimestre(anio, periodo);
  const retenciones = round2(libro.facturas.filter((f) => f.fecha >= desde && f.fecha <= hasta).reduce((s, f) => s + f.retencion, 0));

  return { pagado130, retenciones, porPagar, total: round2(pagado130 + retenciones + porPagar) };
}

/** Año sin facturas ni gastos en IVAn (presentado por la gestoría, pero sin datos para recalcular). */
export function sinDatos(libro: Libro): boolean {
  return libro.facturas.length === 0 && libro.gastos.length === 0;
}

/** `anioActual` hasta `anioMin`, el más reciente primero: [2026, 2025, 2024, 2023]. */
export function rangoAniosDesde(anioMin: number, anioActual: number): number[] {
  return Array.from({ length: anioActual - anioMin + 1 }, (_, i) => anioActual - i);
}

/** Del primer año con algo en `presentaciones` hasta el actual, el más reciente primero. Para el
 * selector de año de Impuestos (los de Ventas/Gastos/Inicio solo ofrecen años con facturas o gastos). */
export async function cargarAniosConPresentaciones(anioActual: number): Promise<number[]> {
  const r = await db().from("presentaciones").select("anio");
  if (r.error) throw r.error;
  const anios = (r.data ?? []).map((x) => x.anio as number);
  const anioMin = anios.length ? Math.min(...anios, anioActual) : anioActual;
  return rangoAniosDesde(anioMin, anioActual);
}

/** Los 303 presentados de todos los años, con sus casillas (para `saldoIvaCompensar`). */
export async function cargarPresentaciones303(): Promise<Presentacion[]> {
  const r = await db().from("presentaciones").select("modelo, anio, trimestre, importe, fecha, casillas").eq("modelo", "303").not("casillas", "is", null);
  // Si la migración 008 (presentaciones.casillas) no está aplicada, esta consulta falla: sin saldo
  // que avisar en vez de tumbar /impuestos entero.
  if (r.error) return [];
  return (r.data ?? []) as Presentacion[];
}

export interface PagadoAnio {
  anio: number;
  total: number;
}

/** 130 [19] + 303 positivos presentados de cada año, para «Lo pagado cada año» de Impuestos. Tal
 * cual se presentó (no lo que calcula IVAn): el año en curso solo lleva lo ya presentado. */
export async function cargarPagadoPorAnio(): Promise<PagadoAnio[]> {
  const r = await db().from("presentaciones").select("modelo, anio, importe").in("modelo", ["130", "303"]);
  if (r.error) throw r.error;
  const porAnio = new Map<number, number>();
  for (const x of r.data ?? []) {
    if (x.importe === null) continue;
    const importe = Number(x.importe);
    if (x.modelo === "130" || importe > 0) porAnio.set(x.anio, (porAnio.get(x.anio) ?? 0) + importe);
  }
  return [...porAnio.entries()].map(([anio, total]) => ({ anio, total: Math.round(total * 100) / 100 })).sort((a, b) => a.anio - b.anio);
}

// ---------- Ventas: comparativa, próxima factura y dependencia ----------

export interface HistoricoIngreso {
  anio: number;
  trimestre: number;
  ingresos_acumulados: number;
}

export async function cargarHistoricoIngresos(): Promise<HistoricoIngreso[]> {
  const r = await db().from("presentaciones").select("anio, trimestre, ingresos_acumulados").eq("modelo", "130").not("ingresos_acumulados", "is", null);
  if (r.error) throw r.error;
  return (r.data ?? []).map((x) => ({ anio: x.anio as number, trimestre: x.trimestre as number, ingresos_acumulados: Number(x.ingresos_acumulados) }));
}

export interface ComparativaAnual {
  tCerrado: number;
  anios: { anio: number; valor: number }[];
  pctFrenteAnterior: number | null;
}

/** Compara de enero al fin del último trimestre cerrado del año en curso (hasta 4 años, el actual
 * y los anteriores de `historico`). `null` si el año no tiene ningún trimestre cerrado todavía. */
export function comparativaAnual(libro: Libro, historico: HistoricoIngreso[], hoy: string): ComparativaAnual | null {
  const { anio, t } = trimestreDe(hoy);
  if (anio !== libro.anio) return null;
  const tCerrado = t - 1;
  if (tCerrado < 1) return null;

  const valorActual = libro.facturas
    .filter((f) => trimestreDe(f.fecha).t <= tCerrado)
    .reduce((s, f) => s + f.base, 0);

  const anteriores = historico
    .filter((h) => h.anio < anio && h.trimestre === tCerrado)
    .sort((a, b) => b.anio - a.anio)
    .slice(0, 3)
    .map((h) => ({ anio: h.anio, valor: h.ingresos_acumulados }));

  const anios = [...anteriores, { anio, valor: valorActual }].sort((a, b) => a.anio - b.anio);
  const anterior = anteriores.find((h) => h.anio === anio - 1);
  const pctFrenteAnterior = anterior ? Math.round(((valorActual - anterior.valor) / anterior.valor) * 100) : null;
  return { tCerrado, anios, pctFrenteAnterior };
}

export interface ProximaFactura {
  mes: string;
  cliente: string;
  importeEstimado: number;
  diasHastaFinMes: number;
  texto: string;
}

/** Cliente facturado el mes pasado y sin factura este mes: el importe estimado es lo que se le
 * facturó el mes pasado. */
export function proximaFactura(libro: Libro, hoy: string, paralelo: boolean): ProximaFactura | null {
  const mesActual = hoy.slice(0, 7);
  const mesPasado = mesAnterior(mesActual);
  const facturadoMesActual = new Set(libro.facturas.filter((f) => f.fecha.startsWith(mesActual)).map((f) => f.cliente));
  const delMesPasado = libro.facturas.find((f) => f.fecha.startsWith(mesPasado) && !facturadoMesActual.has(f.cliente));
  if (!delMesPasado) return null;

  const [y, m] = mesActual.split("-").map(Number);
  const primerDiaSiguiente = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const finMes = sumarDias(primerDiaSiguiente, -1);

  return {
    mes: mesActual,
    cliente: delMesPasado.cliente,
    importeEstimado: delMesPasado.total,
    diasHastaFinMes: diasEntre(hoy, finMes),
    texto: paralelo ? "La emite Selfconta: mándale el PDF al bot" : `Díselo al bot: «factura a ${delMesPasado.cliente} por …»`,
  };
}

export interface Dependencia {
  cliente: string;
  pct: number;
  riesgo: boolean;
}

/** Cliente principal del año y su parte de lo facturado (base). Riesgo si es ≥ 70 %. */
export function dependencia(libro: Libro): Dependencia | null {
  if (!libro.facturas.length) return null;
  const porCliente = new Map<string, number>();
  for (const f of libro.facturas) porCliente.set(f.cliente, (porCliente.get(f.cliente) ?? 0) + f.base);
  const total = [...porCliente.values()].reduce((s, v) => s + v, 0) || 1;
  const [cliente, valor] = [...porCliente.entries()].sort((a, b) => b[1] - a[1])[0];
  return { cliente, pct: valor / total, riesgo: valor / total >= 0.7 };
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
  if (p.dias === undefined) return p.clave === "facturar" ? "Este mes" : null;
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
