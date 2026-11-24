// El «cerebro» de IVAn: recibe un mensaje (escrito o transcrito de voz), decide qué
// herramientas usar y contesta. No depende de Telegram: las acciones con efectos
// (enviar un borrador, un archivo) llegan como callbacks, para poder usar otro canal.

import type Anthropic from "@anthropic-ai/sdk";
import { ai } from "./claude";
import { db } from "./db";
import { env } from "./env";
import { hoyMadrid, rangoTrimestre, round2, trimestreDe } from "./fiscal";
import { cargarLibro, contextoPasos, pygHasta, resumenTrimestre, siguientesPasos } from "./libro";
import { modelo390 } from "./calculo";
import { prepararBorrador } from "./facturacion";
import { enlacePanel } from "./sesion";
import type { Cliente, Factura } from "./db";

export interface Acciones {
  enviarBorradorFactura: (f: Factura, c: Cliente) => Promise<void>;
  enviarExcel: (anio: number) => Promise<void>;
}

const MAX_PASOS = 6;

const SISTEMA = (hoy: string) => `Eres IVAn, el gestor de Jose Bautista, autónomo en estimación directa simplificada (IVA trimestral, IRPF con modelo 130). Hoy es ${hoy}.
Hablas como un colega que sabe de impuestos: en español, breve (2-5 frases), sin jerga salvo al dar casillas, sin emojis de más. Formato de importes: 1.234,56 €.

Reglas:
- No inventes cifras: para cualquier número usa las herramientas.
- Para hacer una factura usa siempre preparar_factura. Eso crea un BORRADOR que Jose emite con el botón ✅; nunca digas que está emitida.
- Los gastos se registran mandando la foto o el PDF de la factura; si te los describe, pídele el documento.
- Tú no presentas nada en Hacienda: Jose presenta en la Sede de la AEAT con Cl@ve y luego te lo dice (marcar_presentado).
- Clientes UE (Zapflow, Finlandia): sin IVA, inversión del sujeto pasivo, van al 349. Clientes españoles: 21 % de IVA y 15 % de retención.
- El 390 (resumen anual de IVA) es la suma de los cuatro 303 y se presenta con el del 4T: usa resumen_390.
- Si algo es una duda fiscal que no puedes resolver con seguridad, dilo y sugiere consultarlo.`;

const herramientas: Anthropic.Tool[] = [
  {
    name: "preparar_factura",
    description: "Crea un borrador de factura a partir de lo que pide Jose (cliente, importe, concepto, fecha) y se lo envía con botones para emitir.",
    input_schema: {
      type: "object",
      properties: { peticion: { type: "string", description: "La petición tal cual, p. ej. 'Zapflow 3060 noviembre'" } },
      required: ["peticion"],
    },
  },
  {
    name: "resumen",
    description: "Ventas, gastos, P&L y casillas de los modelos 303, 130 y 349 de un trimestre (por defecto el actual).",
    input_schema: {
      type: "object",
      properties: { anio: { type: "integer" }, trimestre: { type: "integer", minimum: 1, maximum: 4 } },
    },
  },
  {
    name: "resumen_390",
    description: "Casillas del modelo 390 (resumen anual de IVA) de un año. Se presenta con el 303 del 4T.",
    input_schema: { type: "object", properties: { anio: { type: "integer" } } },
  },
  {
    name: "listar",
    description: "Lista facturas emitidas o gastos de un año, opcionalmente de un trimestre o filtrando por texto (cliente, proveedor, concepto).",
    input_schema: {
      type: "object",
      properties: {
        que: { type: "string", enum: ["facturas", "gastos"] },
        anio: { type: "integer" },
        trimestre: { type: "integer", minimum: 1, maximum: 4 },
        texto: { type: "string" },
      },
      required: ["que"],
    },
  },
  {
    name: "siguientes_pasos",
    description: "Lo que Jose tiene pendiente: plazos de trimestrales, gastos sin confirmar, facturas del mes, datos que faltan.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "marcar_presentado",
    description: "Apunta que Jose ha presentado un modelo (303, 130, 349, 390 o 100) con su importe.",
    input_schema: {
      type: "object",
      properties: {
        modelo: { type: "string", enum: ["303", "130", "349", "390", "100"] },
        anio: { type: "integer" },
        trimestre: { type: "integer", minimum: 0, maximum: 4, description: "0 para modelos anuales" },
        importe: { type: "number", description: "Resultado presentado en euros (negativo si es a compensar o devolver)" },
      },
      required: ["modelo", "anio", "trimestre"],
    },
  },
  {
    name: "registrar_cuota",
    description: "Guarda el importe real del recibo de autónomo de un mes.",
    input_schema: {
      type: "object",
      properties: { mes: { type: "string", description: "YYYY-MM" }, importe: { type: "number" } },
      required: ["mes", "importe"],
    },
  },
  {
    name: "enlace_panel",
    description: "Genera el enlace de acceso al panel web (caduca en 15 minutos).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "exportar_excel",
    description: "Envía a Jose un Excel con ventas, gastos, trimestres y P&L de un año.",
    input_schema: { type: "object", properties: { anio: { type: "integer" } } },
  },
];

type Entrada = Record<string, unknown>;

async function ejecutar(nombre: string, e: Entrada, acciones: Acciones): Promise<unknown> {
  const hoy = hoyMadrid();
  const anioHoy = Number(hoy.slice(0, 4));
  switch (nombre) {
    case "preparar_factura": {
      const r = await prepararBorrador(String(e.peticion ?? ""));
      if (!r.ok) return { ok: false, duda: r.duda };
      await acciones.enviarBorradorFactura(r.factura, r.cliente);
      return { ok: true, borrador_enviado: true, cliente: r.cliente.nombre, total: r.factura.total };
    }
    case "resumen": {
      const anio = Number(e.anio ?? anioHoy);
      const t = Number(e.trimestre ?? (anio === anioHoy ? trimestreDe(hoy).t : 4));
      const libro = await cargarLibro(anio);
      const { m303, m130, m349, presentado } = resumenTrimestre(libro, t);
      const hasta = anio === anioHoy && t === trimestreDe(hoy).t ? hoy : rangoTrimestre(anio, t).hasta;
      return {
        anio,
        trimestre: t,
        pyg_acumulado: pygHasta(libro, hasta),
        m303: { resultado: m303.c71, devengado: m303.c27, deducible: m303.c45, base_21_casilla_07: m303.c07, cuota_21_casilla_09: m303.c09, servicios_ue: m303.c59, presentado: presentado("303") },
        m130: { a_ingresar: m130.aIngresar, rendimiento_neto: m130.c03, pagos_anteriores: m130.c05, retenciones: m130.c06, presentado: presentado("130") },
        m349: { lineas: m349, presentado: presentado("349") },
      };
    }
    case "listar": {
      const anio = Number(e.anio ?? anioHoy);
      const libro = await cargarLibro(anio);
      const t = e.trimestre ? Number(e.trimestre) : null;
      const txt = e.texto ? String(e.texto).toLowerCase() : null;
      if (e.que === "facturas") {
        const xs = libro.facturas.filter(
          (f) => (!t || trimestreDe(f.fecha).t === t) && (!txt || `${f.cliente} ${f.concepto} ${f.numero}`.toLowerCase().includes(txt)),
        );
        return { total_base: round2(xs.reduce((s, f) => s + f.base, 0)), n: xs.length, facturas: xs.slice(0, 30).map(({ numero, fecha, cliente, concepto, base, total }) => ({ numero, fecha, cliente, concepto, base, total })) };
      }
      const xs = libro.gastos.filter(
        (g) => (!t || trimestreDe(g.fecha).t === t) && (!txt || `${g.proveedor} ${g.concepto}`.toLowerCase().includes(txt)),
      );
      return { total_base: round2(xs.reduce((s, g) => s + g.base, 0)), n: xs.length, gastos: xs.slice(0, 30).map(({ fecha, proveedor, concepto, tipo, base, iva }) => ({ fecha, proveedor, concepto, tipo, base, iva })) };
    }
    case "resumen_390": {
      const anio = Number(e.anio ?? (trimestreDe(hoy).t === 1 ? anioHoy - 1 : anioHoy));
      const libro = await cargarLibro(anio);
      const m = modelo390(libro.datos, anio);
      const { trimestres: _t, ...casillas } = m;
      return {
        anio,
        provisional: hoy <= `${anio}-12-31`,
        enlace_panel: enlacePanel(`/impuestos/${anio}/390`),
        casillas,
      };
    }
    case "siguientes_pasos":
      return siguientesPasos(await contextoPasos(hoy)).map(({ texto, detalle, nivel }) => ({ texto, detalle, nivel }));
    case "marcar_presentado": {
      const fila = {
        modelo: String(e.modelo),
        anio: Number(e.anio),
        trimestre: Number(e.trimestre),
        importe: e.importe === undefined ? null : Number(e.importe),
        fecha: hoy,
      };
      const { error } = await db().from("presentaciones").upsert(fila, { onConflict: "modelo,anio,trimestre" });
      if (error) throw error;
      return { ok: true, ...fila };
    }
    case "registrar_cuota": {
      const mes = String(e.mes);
      if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, error: "mes debe ser YYYY-MM" };
      const { error } = await db().from("cuotas_autonomo").upsert({ mes: `${mes}-01`, importe: Number(e.importe) });
      if (error) throw error;
      return { ok: true };
    }
    case "enlace_panel":
      return { enlace: enlacePanel(), caduca_en_minutos: 15 };
    case "exportar_excel": {
      const anio = Number(e.anio ?? anioHoy);
      await acciones.enviarExcel(anio);
      return { ok: true, enviado: `IVAn-${anio}.xlsx` };
    }
    default:
      return { error: `herramienta desconocida: ${nombre}` };
  }
}

async function historial(): Promise<Anthropic.MessageParam[]> {
  const desde = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data } = await db()
    .from("mensajes")
    .select("rol, texto")
    .gte("created_at", desde)
    .order("id", { ascending: false })
    .limit(10);
  const xs = (data ?? []).reverse() as { rol: "user" | "assistant"; texto: string }[];
  // La conversación tiene que empezar por el usuario y alternar.
  const out: Anthropic.MessageParam[] = [];
  for (const m of xs) {
    if (!out.length && m.rol !== "user") continue;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.role === m.rol) ultimo.content += `\n${m.texto}`;
    else out.push({ role: m.rol, content: m.texto });
  }
  if (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
}

async function guardar(rol: "user" | "assistant", texto: string) {
  await db().from("mensajes").insert({ rol, texto: texto.slice(0, 4000) });
}

/** Responde a un mensaje de Jose. Devuelve el texto de la respuesta. */
export async function responder(texto: string, acciones: Acciones): Promise<string> {
  const mensajes: Anthropic.MessageParam[] = [...(await historial()), { role: "user", content: texto }];
  await guardar("user", texto);
  for (let paso = 0; paso < MAX_PASOS; paso++) {
    const res = await ai().messages.create({
      model: env.anthropicModel,
      max_tokens: 1200,
      system: SISTEMA(hoyMadrid()),
      tools: herramientas,
      messages: mensajes,
    });
    mensajes.push({ role: "assistant", content: res.content });
    const usos = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !usos.length) {
      const final = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const respuesta = final || "Hecho.";
      await guardar("assistant", respuesta);
      return respuesta;
    }
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const u of usos) {
      try {
        const r = await ejecutar(u.name, u.input as Entrada, acciones);
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r) });
      } catch (err) {
        resultados.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: err instanceof Error ? err.message : String(err) });
      }
    }
    mensajes.push({ role: "user", content: resultados });
  }
  const aviso = "Me he liado con esto, ¿me lo dices de otra forma?";
  await guardar("assistant", aviso);
  return aviso;
}

