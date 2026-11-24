// Prueba de integración: conversaciones simuladas con IVAn contra Postgres + PostgREST reales.
// Telegram, Claude, la transcripción y el tipo de cambio están simulados (fakes.ts).
//
//   1. ./reset-db.sh   2. ./arrancar.sh   3. npx tsx scripts/integracion/conversaciones.ts
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import * as F from "./fakes";

const JOSE = 12345;
const ZAPFLOW = "11111111-1111-4111-8111-111111111111";

Object.assign(process.env, {
  TELEGRAM_BOT_TOKEN: "123:prueba",
  TELEGRAM_ALLOWED_USER_ID: String(JOSE),
  TELEGRAM_WEBHOOK_SECRET: "secreto-webhook",
  TELEGRAM_API_ROOT: `http://localhost:${F.PUERTO}/tg`,
  SUPABASE_URL: `http://localhost:${F.PUERTO}`,
  SUPABASE_SERVICE_ROLE_KEY: F.jwt("service_role"),
  ANTHROPIC_API_KEY: "sk-prueba",
  ANTHROPIC_BASE_URL: `http://localhost:${F.PUERTO}/anthropic`,
  OPENAI_API_KEY: "sk-prueba",
  OPENAI_BASE_URL: `http://localhost:${F.PUERTO}/openai`,
  PANEL_SECRET: "secreto-panel-de-pruebas",
  APP_URL: "http://localhost:3000",
  CRON_SECRET: "secreto-cron",
});

// Tipo de cambio del BCE simulado: 1 EUR = 1,16 USD
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).includes("frankfurter")) return Response.json({ rates: { USD: 1.16 } });
  return fetchReal(url, init);
}) as typeof fetch;

// ---------- Ayudantes ----------

let updateId = 1;
const chat = { id: 42, type: "private" as const, first_name: "Jose" };
const yo = { id: JOSE, is_bot: false, first_name: "Jose" };
const ahora = () => Math.floor(Date.now() / 1000);

const usar = (name: string, input: unknown) => ({ type: "tool_use", id: `tu_${Math.random().toString(36).slice(2)}`, name, input });
const texto = (t: string) => ({ type: "text", text: t });

/** Claude Sonnet 5.5 no admite tool_choice: las respuestas "forzadas" llegan por structured
 * outputs (output_config.format, json_schema), como JSON en un bloque de texto. */
function forzada(nombre: string, input: unknown): F.Guion {
  return (p) => {
    assert.equal(p.output_config?.format?.type, "json_schema", `${nombre} debía pedirse con structured outputs`);
    assert.ok(!p.tool_choice, `${nombre} no debe forzar una herramienta`);
    return [texto(JSON.stringify(input))];
  };
}
function agente(...bloques: any[]): F.Guion {
  return (p) => {
    assert.ok(!p.tool_choice, "la llamada del agente no fuerza herramienta");
    return bloques;
  };
}

const errores: string[] = [];
let ok = 0;
async function caso(nombre: string, fn: () => Promise<void>) {
  F.telegram.length = 0;
  F.guionClaude.length = 0;
  try {
    await fn();
    assert.equal(F.guionClaude.length, 0, `quedan ${F.guionClaude.length} respuestas de Claude sin usar`);
    ok++;
    console.log(`✓ ${nombre}`);
  } catch (e) {
    errores.push(`${nombre}: ${e instanceof Error ? e.message : String(e)}`);
    console.log(`✗ ${nombre}\n    ${e instanceof Error ? e.message : String(e)}`);
    for (const t of F.telegram) console.log(`    · ${t.metodo} ${JSON.stringify(t.params).slice(0, 300)}`);
  }
}

/** euros() (lib/fiscal.ts) pone un espacio de no separación antes del €: esta ayuda construye un
 * regex a partir de un texto literal que acepta tanto ese \u00a0 como un espacio normal. */
function reEuros(literal: string): RegExp {
  const escapado = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ €/g, "[ \\u00a0]€");
  return new RegExp(escapado);
}

const enviados = (metodo = "sendMessage") => F.telegram.filter((t) => t.metodo === metodo);
const ultimoTexto = () => String(enviados().at(-1)?.params.text ?? "");

/** Espera a que PostgREST vuelva a responder tras un reset de la base (se desconecta y se reconecta solo). */
async function esperarPostgrest(db: () => { from: Function }, maxMs = 60_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    const { error } = await db().from("ajustes").select("id").limit(1);
    if (!error) {
      console.log(`    (PostgREST ha vuelto en ${Date.now() - inicio} ms)`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`PostgREST no ha vuelto en ${maxMs} ms: mira ${process.env.TMPDIR ?? "/tmp"}/postgrest.log`);
}

async function main() {
  const srv = await F.arrancar();
  const { getBot, manejarActualizacion } = await import("@/lib/bot");
  const { db } = await import("@/lib/db");
  const bot = await getBot();

  const mensaje = async (text: string, extra: Record<string, unknown> = {}) => {
    const message_id = F.nuevoIdMensaje();
    const entities = text.startsWith("/") ? [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] : undefined;
    await manejarActualizacion(bot, { update_id: updateId++, message: { message_id, date: ahora(), chat, from: yo, text, entities, ...extra } } as any);
    return message_id;
  };
  const pulsar = async (data: string, message_id: number) =>
    manejarActualizacion(bot, {
      update_id: updateId++,
      callback_query: { id: String(updateId), from: yo, chat_instance: "1", data, message: { message_id, date: ahora(), chat, text: "" } },
    } as any);
  const responderA = (message_id: number, text: string) =>
    mensaje(text, { reply_to_message: { message_id, date: ahora(), chat, text: "" } });
  const ultimoConBotones = () => {
    const m = enviados().filter((t) => t.params.reply_markup).at(-1);
    assert.ok(m, "no hay mensaje con botones");
    return m;
  };
  // El fake numera los mensajes enviados; recuperamos el id del borrador desde la base de datos.
  const idMensajeFactura = async (id: string) =>
    Number((await db().from("facturas").select("telegram_message_id").eq("id", id).single()).data!.telegram_message_id);
  const idMensajeGasto = async (id: string) =>
    Number((await db().from("gastos").select("telegram_message_id").eq("id", id).single()).data!.telegram_message_id);
  const borradores = async () => (await db().from("facturas").select("*").eq("estado", "borrador")).data!;
  const ajustes = async () => (await db().from("ajustes").select("*").single()).data!;

  // ===== Acceso =====

  await caso("Un desconocido no recibe respuesta", async () => {
    await manejarActualizacion(bot, { update_id: updateId++, message: { message_id: 1, date: ahora(), chat, from: { ...yo, id: 999 }, text: "hola" } } as any);
    assert.equal(F.telegram.length, 0);
  });

  await caso("/start explica qué hace", async () => {
    await mensaje("/start");
    assert.match(ultimoTexto(), /Soy IVAn/);
  });

  await caso("El webhook rechaza peticiones sin el secreto", async () => {
    const { POST } = await import("@/app/api/telegram/route");
    const r = await POST(new Request("http://x/api/telegram", { method: "POST", body: "{}" }));
    assert.equal(r.status, 401);
  });

  // ===== Consultas con los datos de 2026 =====

  let resumenTool: any;
  await caso("«¿Cómo va el trimestre?» usa el resumen del 4T", async () => {
    F.guionClaude.push(
      agente(usar("resumen", {})),
      (p) => {
        const r = p.messages.at(-1).content[0];
        resumenTool = JSON.parse(r.content);
        return [texto("Vas bien.")];
      },
    );
    await mensaje("¿cómo va el trimestre?");
    assert.equal(resumenTool.trimestre, 4);
    assert.equal(ultimoTexto(), "Vas bien.");
  });

  await caso("El resumen del 3T da las cifras de la hoja (303 = 207,46 · 130 = 1.141,50)", async () => {
    let r: any;
    F.guionClaude.push(agente(usar("resumen", { anio: 2026, trimestre: 3 })), (p) => {
      r = JSON.parse(p.messages.at(-1).content[0].content);
      return [texto("ok")];
    });
    await mensaje("¿y el 3T?");
    assert.equal(r.m303.resultado, 207.46);
    assert.equal(r.m130.a_ingresar, 1141.5);
  });

  await caso("«¿Y el 390?» da las casillas del resumen anual y cuadra con los 303", async () => {
    let r: any;
    F.guionClaude.push(agente(usar("resumen_390", { anio: 2026 })), (p) => {
      r = JSON.parse(p.messages.at(-1).content[0].content);
      return [texto("ok")];
    });
    await mensaje("¿cómo queda el 390?");
    assert.equal(r.casillas.c86, 207.46);
    assert.equal(r.casillas.c108, 29460);
    assert.equal(r.casillas.cuadra, true);
    assert.equal(r.provisional, true);
    assert.match(r.enlace_panel, /\/acceso\?t=.+&ir=%2Fimpuestos%2F2026%2F390$/);
    // historial para el caso siguiente
    F.guionClaude.push((p) => [texto("ok")]);
    await mensaje("¿cómo va el trimestre?");
  });

  await caso("La segunda consulta lleva el historial de la primera", async () => {
    let p: any;
    F.guionClaude.push((x) => {
      p = x;
      return [texto("ok")];
    });
    await mensaje("gracias");
    const textos = p.messages.map((m: any) => (typeof m.content === "string" ? m.content : "[bloques]"));
    assert.ok(textos.includes("¿cómo va el trimestre?"), `historial: ${JSON.stringify(textos)}`);
    assert.equal(p.messages[0].role, "user");
  });

  // ===== Factura =====

  const peticionNoviembre = {
    cliente_id: ZAPFLOW,
    base: 3060,
    concepto: "UX services for Zapflow platform (November 2026) + Cursor subscription",
    fecha: "2026-11-17",
    duda: null,
  };

  let facturaId = "";
  await caso("«Factura a Zapflow 3.060» prepara un borrador ISP sin IVA ni retención", async () => {
    F.guionClaude.push(
      agente(usar("preparar_factura", { peticion: "Zapflow 3060 de noviembre" })),
      forzada("preparar_factura", peticionNoviembre),
      agente(texto("Te he dejado el borrador.")),
    );
    await mensaje("Iván, factura a Zapflow 3060 de noviembre");
    const [b] = await borradores();
    assert.ok(b, "no hay borrador en la base de datos");
    facturaId = b.id;
    assert.equal(Number(b.iva), 0);
    assert.equal(Number(b.retencion), 0);
    assert.equal(Number(b.total), 3060);
    assert.match(String(b.mencion), /sujeto pasivo/i);
    const m = ultimoConBotones();
    assert.match(String(m.params.text), /se emitirá como 00337/);
    assert.match(String(m.params.text), /Falta la dirección de Zapflow/);
  });

  await caso("Sin dirección del cliente no deja emitir", async () => {
    await pulsar(`f:ok:${facturaId}`, await idMensajeFactura(facturaId));
    assert.match(ultimoTexto(), /No la he emitido/);
    assert.equal((await ajustes()).ultimo_numero, 336, "no debe gastar número");
  });

  await caso("/cliente añade la dirección", async () => {
    await mensaje("/cliente Zapflow direccion: Testikatu 1, 00100 Helsinki, Finland");
    assert.match(ultimoTexto(), /dirección actualizado|direccion actualizado/);
  });

  await caso("Responder al borrador lo corrige (base 3.020)", async () => {
    const antes = await idMensajeFactura(facturaId);
    F.guionClaude.push((p) => {
      assert.match(JSON.stringify(p.messages), /Borrador actual/);
      assert.equal(p.output_config?.format?.type, "json_schema");
      return [texto(JSON.stringify({ ...peticionNoviembre, base: 3020 }))];
    });
    await responderA(antes, "la base es 3.020");
    const bs = await borradores();
    assert.equal(bs.length, 1, "debe seguir habiendo un solo borrador");
    assert.equal(Number(bs[0].total), 3020);
    assert.ok(F.telegram.some((t) => t.metodo === "editMessageReplyMarkup" && t.params.message_id === antes), "quita los botones del mensaje viejo");
    assert.doesNotMatch(String(ultimoConBotones().params.text), /Falta la dirección/);
  });

  await caso("✅ emite la 00337 y devuelve el PDF", async () => {
    await pulsar(`f:ok:${facturaId}`, await idMensajeFactura(facturaId));
    const f = (await db().from("facturas").select("*").eq("id", facturaId).single()).data!;
    assert.equal(f.numero, "00337");
    assert.equal(f.estado, "emitida");
    const doc = enviados("sendDocument").at(-1);
    assert.ok(doc?.archivo, "no se envió el PDF");
    assert.equal(doc.archivo.bytes.subarray(0, 4).toString(), "%PDF");
    assert.ok(F.storage.has(`documentos/${f.pdf_path}`) || [...F.storage.keys()].some((k) => k.endsWith("00337.pdf")), "el PDF no se guardó");
  });

  await caso("Pulsar ✅ otra vez no hace nada", async () => {
    await pulsar(`f:ok:${facturaId}`, await idMensajeFactura(facturaId));
    assert.equal((await ajustes()).ultimo_numero, 337);
    assert.ok(F.telegram.some((t) => t.metodo === "answerCallbackQuery" && /Ya estaba/.test(String(t.params.text))));
  });

  await caso("Dos ✅ a la vez emiten una sola factura", async () => {
    F.guionClaude.push(forzada("preparar_factura", { ...peticionNoviembre, base: 100, concepto: "Prueba" }));
    await mensaje("/factura Zapflow 100 prueba");
    const [b] = await borradores();
    const msg = await idMensajeFactura(b.id);
    await Promise.all([pulsar(`f:ok:${b.id}`, msg), pulsar(`f:ok:${b.id}`, msg)]);
    assert.equal((await ajustes()).ultimo_numero, 338);
    const emitidas = (await db().from("facturas").select("numero").eq("id", b.id)).data!;
    assert.equal(emitidas[0].numero, "00338");
  });

  await caso("Si falla el envío del PDF, dice que SÍ está emitida", async () => {
    F.guionClaude.push(forzada("preparar_factura", { ...peticionNoviembre, base: 10, concepto: "Prueba envío" }));
    await mensaje("/factura Zapflow 10");
    const [b] = await borradores();
    F.fallos.siguienteDocumento = true;
    await pulsar(`f:ok:${b.id}`, await idMensajeFactura(b.id));
    assert.match(ultimoTexto(), /00339 está emitida.*\/pdf 00339/s);
    assert.doesNotMatch(F.telegram.map((t) => String(t.params.text)).join("\n"), /No la he emitido/);
  });

  await caso("Una factura emitida no se puede borrar ni cambiar", async () => {
    const del = await db().from("facturas").delete().eq("numero", "00338");
    assert.ok(del.error, "debería fallar el borrado");
    const upd = await db().from("facturas").update({ base: 1 }).eq("numero", "00338");
    assert.ok(upd.error, "debería fallar el cambio");
  });

  await caso("❌ cancela el borrador sin gastar número", async () => {
    F.guionClaude.push(forzada("preparar_factura", { ...peticionNoviembre, base: 50, concepto: "Otra" }));
    await mensaje("/factura Zapflow 50");
    const [b] = await borradores();
    await pulsar(`f:no:${b.id}`, await idMensajeFactura(b.id));
    assert.equal((await borradores()).length, 0);
    assert.equal((await ajustes()).ultimo_numero, 339);
  });

  await caso("Si Claude no entiende la factura, pregunta", async () => {
    F.guionClaude.push(forzada("preparar_factura", { cliente_id: null, base: null, concepto: null, fecha: null, duda: "¿A qué cliente?" }));
    await mensaje("/factura 300");
    assert.match(ultimoTexto(), /¿A qué cliente\?/);
  });

  await caso("/pdf 00337 reenvía el PDF y /pdf 99999 avisa", async () => {
    await mensaje("/pdf 00337");
    assert.equal(enviados("sendDocument").at(-1)?.archivo?.bytes.subarray(0, 4).toString(), "%PDF");
    await mensaje("/pdf 99999");
    assert.match(ultimoTexto(), /No encuentro/);
  });

  await caso("Si el agente falla sin que nadie lo capture, bot.catch avisa y el registro no lleva el token", async () => {
    // El SDK reintenta los 500 (2 veces por defecto): un fallo en cada intento.
    const fallo = () => {
      throw new Error("fallo simulado del agente");
    };
    F.guionClaude.push(fallo, fallo, fallo);
    const logs: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => logs.push(args);
    try {
      await mensaje("¿cómo va el trimestre?");
    } finally {
      console.error = original;
    }
    assert.match(ultimoTexto(), /⛔ Algo ha fallado/);
    const registrado = JSON.stringify(logs);
    assert.ok(!registrado.includes(String(process.env.TELEGRAM_BOT_TOKEN)), "el registro no debe llevar el token del bot");
  });

  // ===== Gastos =====

  const cursor = {
    es_factura: true, proveedor: "Anysphere, Inc. (Cursor)", nif_proveedor: "US123", pais: "US", numero_factura: "CUR-0042",
    fecha: "2026-11-02", concepto: "suscripción Cursor", categoria: "otro" as const, categoria_gasto: "software_ia" as const, moneda: "USD", base: 20, iva: 0, total: 20,
    desglose_iva: [], iva_espanol: false, nif_destinatario: "00000000T", notas: null,
  };
  let gastoId = "";
  await caso("Foto de un gasto en USD: lo convierte al cambio del BCE y lo clasifica ISP fuera UE", async () => {
    F.archivosTelegram.set("foto1", Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    F.guionClaude.push(forzada("guardar_gasto", cursor));
    await mensaje("", { text: undefined, photo: [{ file_id: "foto1", file_unique_id: "u1", width: 800, height: 600 }] });
    const g = (await db().from("gastos").select("*").eq("estado", "borrador")).data![0];
    assert.ok(g, "no hay gasto en borrador");
    gastoId = g.id;
    assert.equal(Number(g.base), 17.24); // 20 / 1,16
    assert.equal(g.tipo, "ISP fuera UE");
    assert.equal(g.a_mi_nombre, true);
    assert.ok(F.storage.size >= 1);
    const m = ultimoConBotones();
    assert.match(String(m.params.text), /autorrepercutes y deduces/);
    assert.ok(F.telegram.some((t) => t.metodo === "deleteMessage"), "borra el «Leyendo la factura…»");
  });

  await caso("Responder al gasto lo corrige", async () => {
    F.guionClaude.push(forzada("guardar_gasto", { ...cursor, base: 40, total: 40 }));
    await responderA(await idMensajeGasto(gastoId), "eran 40 dólares");
    const g = (await db().from("gastos").select("*").eq("id", gastoId).single()).data!;
    assert.equal(Number(g.base), 34.48);
  });

  await caso("✅ guarda el gasto", async () => {
    await pulsar(`g:ok:${gastoId}`, await idMensajeGasto(gastoId));
    const g = (await db().from("gastos").select("estado").eq("id", gastoId).single()).data!;
    assert.equal(g.estado, "confirmado");
  });

  await caso("PDF de un gasto repetido avisa del duplicado y se puede descartar", async () => {
    F.archivosTelegram.set("pdf1", Buffer.from("%PDF-1.4 prueba"));
    F.guionClaude.push(
      forzada("guardar_gasto", {
        es_factura: true, proveedor: "Framer B.V.", nif_proveedor: "NL853695386B01", pais: "NL", numero_factura: "97A706DA-1920528",
        fecha: "2026-01-14", concepto: "web hosting", categoria: "otro", categoria_gasto: "hosting_dominios", moneda: "EUR", base: 180, iva: 0, total: 180,
        desglose_iva: [], iva_espanol: false, nif_destinatario: null, notas: null,
      }),
    );
    await mensaje("", { text: undefined, document: { file_id: "pdf1", file_unique_id: "u2", mime_type: "application/pdf", file_name: "framer.pdf" } });
    const m = ultimoConBotones();
    assert.match(String(m.params.text), /Ya tienes un gasto igual/);
    assert.match(String(m.params.text), /No veo tu NIF/);
    const g = (await db().from("gastos").select("id").eq("estado", "borrador")).data![0];
    await pulsar(`g:no:${g.id}`, await idMensajeGasto(g.id));
    assert.equal((await db().from("gastos").select("estado").eq("id", g.id).single()).data!.estado, "descartado");
  });

  await caso('Si Claude falla al leer un gasto, "Leyendo la factura…" pasa a avisar del error', async () => {
    F.archivosTelegram.set("foto-rota", Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    const antesGastos = (await db().from("gastos").select("id")).data!.length;
    // Sin guion en F.guionClaude: el Claude simulado responde 500 "Guion de Claude agotado".
    await mensaje("", { text: undefined, photo: [{ file_id: "foto-rota", file_unique_id: "ur3", width: 800, height: 600 }] });
    assert.ok(F.telegram.some((t) => t.metodo === "sendMessage" && t.params.text === "Leyendo la factura…"));
    const editado = F.telegram.filter((t) => t.metodo === "editMessageText").at(-1);
    assert.ok(editado, "el mensaje de espera se edita, no se queda así para siempre");
    assert.match(String(editado!.params.text), /⚠️ No he podido leer la factura/);
    const despuesGastos = (await db().from("gastos").select("id")).data!.length;
    assert.equal(despuesGastos, antesGastos, "no se guarda ningún gasto a medias");
  });

  await caso("Un archivo que no es PDF ni imagen se rechaza", async () => {
    await mensaje("", { text: undefined, document: { file_id: "x", file_unique_id: "u3", mime_type: "application/zip", file_name: "a.zip" } });
    assert.match(ultimoTexto(), /PDF o una imagen/);
  });

  // ===== IVA de los gastos: restaurantes y el tipo que pone la factura =====

  const restauranteMixto = {
    es_factura: true, proveedor: "Restaurante Can Jep", nif_proveedor: "B12345678", pais: "ES", numero_factura: "R-991",
    fecha: "2026-11-17", concepto: "comida de trabajo", categoria: "restauracion" as const, categoria_gasto: "comidas" as const, moneda: "EUR", base: 50, iva: 6.1, total: 56.1,
    desglose_iva: [
      { tipo_pct: 10, base: 40, cuota: 4 },
      { tipo_pct: 21, base: 10, cuota: 2.1 },
    ],
    iva_espanol: true, nif_destinatario: "00000000T", notas: null,
  };
  let gastoRestauranteId = "";
  await caso("Foto de un restaurante: dos líneas de IVA y los tres botones, sin ✅ Guardar", async () => {
    F.archivosTelegram.set("foto-rest", Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    F.guionClaude.push(forzada("guardar_gasto", restauranteMixto));
    await mensaje("", { text: undefined, photo: [{ file_id: "foto-rest", file_unique_id: "ur1", width: 800, height: 600 }] });
    const g = (await db().from("gastos").select("*").eq("estado", "borrador").eq("numero_factura", "R-991")).data![0];
    gastoRestauranteId = g.id;
    const m = ultimoConBotones();
    assert.match(String(m.params.text), reEuros("IVA 10 % sobre 40,00 € = 4,00 €"));
    assert.match(String(m.params.text), reEuros("IVA 21 % sobre 10,00 € = 2,10 €"));
    assert.match(JSON.stringify(m.params.reply_markup), /g:uso:manutencion/);
    assert.match(JSON.stringify(m.params.reply_markup), /g:uso:cliente/);
    assert.match(JSON.stringify(m.params.reply_markup), /g:uso:personal/);
    assert.doesNotMatch(JSON.stringify(m.params.reply_markup), /g:ok:/);
  });

  await caso('Pulsar «🤝 Invité a un cliente»: aparece ✅ Guardar y dice cuánto queda del 1 %', async () => {
    await pulsar(`g:uso:cliente:${gastoRestauranteId}`, await idMensajeGasto(gastoRestauranteId));
    const m = F.telegram.filter((t) => t.metodo === "editMessageText").at(-1)!;
    assert.match(JSON.stringify(m.params.reply_markup), /g:ok:/);
    assert.match(String(m.params.text), /1 %/);
    const g = (await db().from("gastos").select("*").eq("id", gastoRestauranteId).single()).data!;
    assert.equal(g.uso, "atencion_cliente");
    assert.equal(Number(g.base), 56.1);
    assert.equal(Number(g.iva), 0);
    await pulsar(`g:ok:${gastoRestauranteId}`, await idMensajeGasto(gastoRestauranteId));
  });

  let gastoCorreccionId = "";
  await caso("Foto de otro restaurante, y responder «la bebida también es al 10 %» corrige el desglose", async () => {
    F.archivosTelegram.set("foto-rest2", Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    F.guionClaude.push(forzada("guardar_gasto", { ...restauranteMixto, numero_factura: "R-992" }));
    await mensaje("", { text: undefined, photo: [{ file_id: "foto-rest2", file_unique_id: "ur2", width: 800, height: 600 }] });
    const g = (await db().from("gastos").select("*").eq("estado", "borrador").eq("numero_factura", "R-992")).data![0];
    gastoCorreccionId = g.id;
    F.guionClaude.push(
      forzada("guardar_gasto", {
        ...restauranteMixto, numero_factura: "R-992", base: 50, iva: 5, total: 55,
        desglose_iva: [{ tipo_pct: 10, base: 50, cuota: 5 }],
      }),
    );
    await responderA(await idMensajeGasto(gastoCorreccionId), "la bebida también es al 10 %");
    const corregido = (await db().from("gastos").select("*").eq("id", gastoCorreccionId).single()).data!;
    assert.equal(Number(corregido.iva), 5);
    assert.deepEqual(corregido.desglose, [{ pct: 10, base: 50, cuota: 5 }]);
    // Se descarta para no dejar un borrador suelto que afecte a los casos siguientes.
    await pulsar(`g:no:${gastoCorreccionId}`, await idMensajeGasto(gastoCorreccionId));
  });

  await caso("PDF de Paddle con IVA: no deducible, IVA de otro país", async () => {
    F.archivosTelegram.set("pdf-paddle", Buffer.from("%PDF-1.4 paddle"));
    F.guionClaude.push(
      forzada("guardar_gasto", {
        es_factura: true, proveedor: "Paddle.com Market Ltd", nif_proveedor: "EU372017215", pais: "GB", numero_factura: "PD-1",
        fecha: "2026-11-10", concepto: "suscripción SaaS", categoria: "otro", categoria_gasto: "software_ia", moneda: "EUR", base: 12.18, iva: 2.56, total: 14.74,
        desglose_iva: [{ tipo_pct: 21, base: 12.18, cuota: 2.56 }], iva_espanol: false, nif_destinatario: "00000000T", notas: null,
      }),
    );
    await mensaje("", { text: undefined, document: { file_id: "pdf-paddle", file_unique_id: "upd", mime_type: "application/pdf", file_name: "paddle.pdf" } });
    const m = ultimoConBotones();
    assert.match(String(m.params.text), /no deducible/i);
    assert.match(String(m.params.text), /IVA de otro país/i);
    const g = (await db().from("gastos").select("*").eq("numero_factura", "PD-1").single()).data!;
    assert.equal(g.tipo, "Sin IVA deducible");
    assert.equal(Number(g.base), 14.74);
    assert.equal(Number(g.iva), 0);
    await pulsar(`g:ok:${g.id}`, await idMensajeGasto(g.id));
  });

  // ===== Voz =====

  await caso("Nota de voz: transcribe y se la pasa al agente", async () => {
    F.archivosTelegram.set("voz1", Buffer.from("OggS"));
    F.setTranscripcion("¿cuánto llevo facturado este año?");
    let r: any;
    F.guionClaude.push(agente(usar("listar", { que: "facturas", anio: 2026 })), (p) => {
      r = JSON.parse(p.messages.at(-1).content[0].content);
      return [texto("Llevas X.")];
    });
    await mensaje("", { text: undefined, voice: { file_id: "voz1", file_unique_id: "u4", duration: 3 } });
    assert.ok(F.telegram.some((t) => String(t.params.text).includes("🎙️")));
    assert.equal(r.n, 14); // 11 de la gestoría + 00337, 00338 y 00339
    assert.equal(r.total_base, 29460 + 3020 + 100 + 10);
  });

  // ===== Presentaciones, cuota, panel, Excel =====

  await caso("«Presentado el 303 del 3T» lo apunta", async () => {
    F.guionClaude.push(agente(usar("marcar_presentado", { modelo: "303", anio: 2026, trimestre: 3, importe: 207.46 })), agente(texto("Apuntado.")));
    await mensaje("presentado el 303 del 3T, 207,46");
    const p = (await db().from("presentaciones").select("*").eq("modelo", "303").eq("trimestre", 3).single()).data!;
    assert.equal(Number(p.importe), 207.46);
  });

  await caso("Registrar la cuota de autónomo de noviembre", async () => {
    F.guionClaude.push(agente(usar("registrar_cuota", { mes: "2026-11", importe: 452.37 })), agente(texto("Hecho.")));
    await mensaje("la cuota de noviembre ha sido 452,37");
    const c = (await db().from("cuotas_autonomo").select("*").eq("mes", "2026-11-01").single()).data!;
    assert.equal(Number(c.importe), 452.37);
  });

  await caso("/panel da un enlace firmado", async () => {
    await mensaje("/panel");
    assert.match(ultimoTexto(), /http:\/\/localhost:3000\/acceso\?t=/);
  });

  await caso("/exportar manda el Excel del año", async () => {
    await mensaje("/exportar");
    const d = enviados("sendDocument").at(-1);
    assert.equal(d?.archivo?.nombre, "IVAn-2026.xlsx");
    assert.equal(d!.archivo!.bytes.subarray(0, 2).toString(), "PK");
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(d!.archivo!.bytes as any);
    const h = wb.getWorksheet("390");
    assert.ok(h, "falta la hoja 390");
    const fila108 = h!.getRows(2, h!.rowCount - 1)!.find((r) => r.getCell(1).value === "108");
    assert.ok(fila108, "falta la casilla 108");
  });

  await caso("/ajustes enseña los datos y el último número", async () => {
    await mensaje("/ajustes");
    assert.match(ultimoTexto(), /Última factura: 00339/);
  });

  // ===== Avisos =====

  await caso("Cron: rechaza sin el secreto", async () => {
    const { GET } = await import("@/app/api/cron/recordatorios/route");
    const r = await GET(new Request("http://x/api/cron/recordatorios"));
    assert.equal(r.status, 401);
  });

  await caso("Avisos: 10 días antes del 4T y fin de mes, sin repetir", async () => {
    const { ejecutarRecordatorios } = await import("@/lib/cron");
    const textos: string[] = [];
    const enviar = async (t: string) => void textos.push(t);
    const a1 = await ejecutarRecordatorios(enviar, "2027-01-22");
    const a2 = await ejecutarRecordatorios(enviar, "2027-01-22");
    assert.ok(a1.length >= 1, "debería avisar del 4T");
    assert.equal(a2.length, 0, "no repite el aviso el mismo día");
    assert.match(textos.join("\n"), /4T/);
    console.log("    aviso 22/01/2027:", JSON.stringify(textos[0]).slice(0, 400));
    // Si el día 28 no corrió el aviso, sale el 30
    const fin = await ejecutarRecordatorios(enviar, "2026-11-30");
    assert.deepEqual(fin.map((a) => a.clave), ["facturar-2026-11"]);
    assert.equal((await ejecutarRecordatorios(enviar, "2026-11-30")).length, 0);
  });

  await caso("Un borrador abandonado no cuenta en los cálculos", async () => {
    F.guionClaude.push(forzada("preparar_factura", { ...peticionNoviembre, base: 999, concepto: "abandonado" }));
    await mensaje("/factura Zapflow 999");
    let r: any;
    F.guionClaude.push(agente(usar("listar", { que: "facturas", anio: 2026 })), (p) => {
      r = JSON.parse(p.messages.at(-1).content[0].content);
      return [texto("ok")];
    });
    await mensaje("lista mis facturas");
    assert.equal(r.n, 14);
  });


  // ===== Fase 2: modo paralelo con Selfconta =====

  await caso("/ajustes emitir_desde activa el modo paralelo", async () => {
    await mensaje("/ajustes emitir_desde: 2099-01-01");
    assert.match(ultimoTexto(), /Modo paralelo hasta el 01\/01\/2099/);
    await mensaje("/ajustes");
    assert.match(ultimoTexto(), /Modo paralelo: hasta el 01\/01\/2099/);
  });

  await caso("En modo paralelo IVAn no emite (ni el bot ni la base de datos)", async () => {
    await db().from("facturas").delete().eq("estado", "borrador");
    F.guionClaude.push(forzada("preparar_factura", { ...peticionNoviembre, base: 77, concepto: "paralelo" }));
    await mensaje("/factura Zapflow 77");
    assert.match(String(ultimoConBotones().params.text), /⛔ Modo paralelo hasta el 01\/01\/2099/);
    const [b] = await borradores();
    await pulsar(`f:ok:${b.id}`, await idMensajeFactura(b.id));
    assert.match(ultimoTexto(), /No la he emitido/);
    const rpc = await db().rpc("emitir_factura", { p_factura_id: b.id });
    assert.match(String(rpc.error?.message), /Modo paralelo/);
    assert.equal((await ajustes()).ultimo_numero, 339);
    await db().from("facturas").delete().eq("id", b.id);
  });

  const pdfSelfconta = (fileId: string) => {
    F.archivosTelegram.set(fileId, Buffer.from(`%PDF-1.4 selfconta ${fileId}`));
    return { text: undefined, document: { file_id: fileId, file_unique_id: fileId, mime_type: "application/pdf", file_name: `${fileId}.pdf` } };
  };
  const leidaComoPropia = forzada("guardar_gasto", {
    es_factura: true, proveedor: "Persona de Prueba", nif_proveedor: "ES00000000T", pais: "ES", numero_factura: "00340",
    fecha: "2026-11-16", concepto: "servicios UX", categoria: "otro", categoria_gasto: "otros", moneda: "EUR", base: 3060, iva: 0, total: 3060,
    desglose_iva: [], iva_espanol: true, nif_destinatario: "FI26899624", notas: null,
  });
  const emitida = (extra: Record<string, unknown> = {}) =>
    forzada("registrar_factura_emitida", {
      numero: "340", fecha: "2026-11-16", cliente_nombre: "Zapflow Oy", cliente_nif: "FI 26899624",
      concepto: "UX services for Zapflow platform (November 2026) + Cursor subscription",
      base: 3060, iva_pct: 0, iva: 0, retencion_pct: 0, retencion: 0, total: 3060, ...extra,
    });

  let externaId = "";
  await caso("El PDF de una factura propia de Selfconta se prepara para registrar, no como gasto", async () => {
    const gastosAntes = (await db().from("gastos").select("id")).data!.length;
    F.guionClaude.push(leidaComoPropia, emitida());
    await mensaje("", pdfSelfconta("sc340"));
    const m = ultimoConBotones();
    assert.match(String(m.params.text), /📥 Factura tuya hecha fuera de IVAn · 00340/);
    assert.match(JSON.stringify(m.params.reply_markup), /x:ok:/);
    assert.equal((await db().from("gastos").select("id")).data!.length, gastosAntes, "no debe crear un gasto");
    const b = (await db().from("facturas").select("*").eq("origen", "externa").eq("estado", "borrador").single()).data!;
    externaId = b.id;
    assert.equal(b.numero, null);
    assert.equal(b.numero_externo, "00340");
    assert.ok([...F.storage.keys()].some((k) => k.includes("facturas/2026/externas/00340-")), "guarda el PDF original");
    assert.ok(F.telegram.some((t) => t.metodo === "deleteMessage"));
  });

  await caso("Responder a una factura de Selfconta explica que se registra tal cual", async () => {
    await responderA(await idMensajeFactura(externaId), "la base es 3000");
    assert.match(ultimoTexto(), /se registran tal cual/);
  });

  await caso("✅ Registrar la apunta con su número y mueve el contador", async () => {
    await pulsar(`x:ok:${externaId}`, await idMensajeFactura(externaId));
    const f = (await db().from("facturas").select("*").eq("id", externaId).single()).data!;
    assert.equal(f.numero, "00340");
    assert.equal(f.estado, "emitida");
    assert.equal(f.origen, "externa");
    assert.equal((await ajustes()).ultimo_numero, 340);
    assert.ok(F.telegram.some((t) => t.metodo === "editMessageText" && /00340 registrada/.test(String(t.params.text))));
    await mensaje("/pdf 00340");
    assert.match(enviados("sendDocument").at(-1)!.archivo!.bytes.toString(), /selfconta sc340/, "devuelve el PDF original");
  });

  await caso("La misma factura otra vez: ya está en el libro", async () => {
    F.guionClaude.push(leidaComoPropia, emitida());
    await mensaje("", pdfSelfconta("sc340b"));
    assert.match(ultimoTexto(), /La 00340 ya está en el libro/);
  });

  await caso("Saltarse un número avisa y no deja registrar", async () => {
    F.guionClaude.push(leidaComoPropia, emitida({ numero: "00342" }));
    await mensaje("", pdfSelfconta("sc342"));
    assert.match(String(ultimoConBotones().params.text), /Toca la 00341 y esta es la 00342/);
    const b = (await db().from("facturas").select("id").eq("numero_externo", "00342").single()).data!;
    await pulsar(`x:ok:${b.id}`, await idMensajeFactura(b.id));
    assert.match(ultimoTexto(), /No la he registrado:\nToca registrar la 00341 \(la última es la 00340\)/);
    assert.equal((await ajustes()).ultimo_numero, 340);
    await pulsar(`x:no:${b.id}`, await idMensajeFactura(b.id));
    assert.equal((await db().from("facturas").select("id").eq("id", b.id)).data!.length, 0);
  });

  await caso("Volta sin retención: avisa de que los importes no son los esperados", async () => {
    F.guionClaude.push(
      leidaComoPropia,
      emitida({ numero: "00341", cliente_nombre: "Volta Cultural SL", cliente_nif: "B23853039", concepto: "Disseny web", base: 500, iva_pct: 21, iva: 105, total: 605 }),
    );
    await mensaje("", pdfSelfconta("sc341"));
    const m = ultimoConBotones();
    assert.match(String(m.params.text), /esperaba IVA 21 % y retención 15 %/);
    const b = (await db().from("facturas").select("id").eq("numero_externo", "00341").single()).data!;
    await pulsar(`x:ok:${b.id}`, await idMensajeFactura(b.id));
    assert.equal((await ajustes()).ultimo_numero, 341);
  });

  await caso("Cliente desconocido: pide darlo de alta", async () => {
    F.guionClaude.push(leidaComoPropia, emitida({ numero: "00342", cliente_nombre: "Nuevo Cliente GmbH", cliente_nif: "DE123456789" }));
    await mensaje("", pdfSelfconta("sc342b"));
    assert.match(ultimoTexto(), /No tengo a Nuevo Cliente GmbH \(DE123456789\)\. Añádelo con \/cliente_nuevo/);
  });

  const nifMalLeido = (fileId: string) => {
    F.guionClaude.push(
      forzada("guardar_gasto", {
        es_factura: true, proveedor: "Persona de Prueba", nif_proveedor: "ES00000008T", pais: "ES", numero_factura: "00342",
        fecha: "2026-11-16", concepto: "servicios UX", categoria: "otro", categoria_gasto: "otros", moneda: "EUR", base: 3060, iva: 0, total: 3060,
        desglose_iva: [], iva_espanol: true, nif_destinatario: "FI26899624", notas: null,
      }),
    );
    return pdfSelfconta(fileId);
  };

  await caso('NIF mal leído: pregunta y, con "Es mía", la prepara como venta', async () => {
    await mensaje("", nifMalLeido("sc342mal"));
    const m = ultimoConBotones();
    assert.match(String(m.params.text), /¿Esta factura es tuya o es un gasto\?/);
    assert.match(String(m.params.text), /el emisor se llama como tú/);
    assert.match(String(m.params.text), /el número 00342 es el siguiente de tu serie/);
    assert.match(String(m.params.text), /el cliente es Zapflow Oy, uno de los tuyos/);
    assert.match(JSON.stringify(m.params.reply_markup), /p:venta:/);
    assert.match(JSON.stringify(m.params.reply_markup), /p:gasto:/);
    const g = (await db().from("gastos").select("*").eq("estado", "borrador").single()).data!;
    assert.equal((await db().from("facturas").select("id").eq("numero_externo", "00342")).data!.length, 0);

    const msgId = F.nuevoIdMensaje();
    F.guionClaude.push(emitida({ numero: "342" }));
    await pulsar(`p:venta:${g.id}`, msgId);
    assert.ok(F.telegram.some((t) => t.metodo === "editMessageText" && /📥 Factura tuya hecha fuera de IVAn · 00342/.test(String(t.params.text))));
    assert.equal((await db().from("gastos").select("estado").eq("id", g.id).single()).data!.estado, "descartado");
    const f = (await db().from("facturas").select("*").eq("numero_externo", "00342").single()).data!;

    await pulsar(`x:no:${f.id}`, await idMensajeFactura(f.id));
    assert.equal((await db().from("facturas").select("id").eq("id", f.id)).data!.length, 0, "deja de estar pendiente");
    assert.equal((await ajustes()).ultimo_numero, 341);
  });

  await caso('NIF mal leído: con "Es un gasto" sigue como gasto', async () => {
    await mensaje("", nifMalLeido("sc342mal2"));
    const g = (await db().from("gastos").select("*").eq("estado", "borrador").single()).data!;

    const msgId = F.nuevoIdMensaje();
    await pulsar(`p:gasto:${g.id}`, msgId);
    const edicion = F.telegram.filter((t) => t.metodo === "editMessageText").at(-1)!;
    assert.match(String(edicion.params.text), /🧾 Gasto \(borrador\)/);
    assert.match(JSON.stringify(edicion.params.reply_markup), /g:ok:/);

    F.guionClaude.push(
      forzada("guardar_gasto", {
        es_factura: true, proveedor: "Persona de Prueba", nif_proveedor: "ES00000008T", pais: "ES", numero_factura: "00342",
        fecha: "2026-11-16", concepto: "servicios UX", categoria: "otro", categoria_gasto: "otros", moneda: "EUR", base: 3000, iva: 0, total: 3000,
        desglose_iva: [], iva_espanol: true, nif_destinatario: "FI26899624", notas: null,
      }),
    );
    await responderA(msgId, "la base es 3000");
    const corregido = (await db().from("gastos").select("*").eq("id", g.id).single()).data!;
    assert.equal(Number(corregido.base), 3000);

    await pulsar(`g:no:${g.id}`, await idMensajeGasto(g.id));
    assert.equal((await db().from("gastos").select("estado").eq("id", g.id).single()).data!.estado, "descartado");
  });

  await caso("Las facturas registradas cuentan en el trimestre", async () => {
    let r: any;
    F.guionClaude.push(agente(usar("listar", { que: "facturas", anio: 2026, trimestre: 4 })), (p) => {
      r = JSON.parse(p.messages.at(-1).content[0].content);
      return [texto("ok")];
    });
    await mensaje("facturas del 4T");
    const numeros = r.facturas.map((f: any) => f.numero);
    assert.ok(numeros.includes("00340") && numeros.includes("00341"), JSON.stringify(numeros));
  });

  await caso("Aviso de fin de mes en modo paralelo: hacerla en Selfconta, con gastos y borradores", async () => {
    const { ejecutarRecordatorios } = await import("@/lib/cron");
    // Un borrador suelto para comprobar que el aviso también avisa de los gastos sin confirmar.
    await db().from("gastos").insert({ proveedor: "Prueba suelta", base: 1, iva: 0, tipo: "IVA soportado", estado: "borrador" });
    const textos: string[] = [];
    await ejecutarRecordatorios(async (t) => void textos.push(t), "2026-12-28");
    const t = textos.join("\n");
    assert.match(t, /Fin de diciembre/);
    assert.match(t, /1\. Factura: hazla en Selfconta y mándame el PDF\. \(En modo normal: «\/factura Zapflow 3060»\.\)/);
    assert.match(t, /2\. Gastos: mándame todas las facturas de gasto de diciembre/);
    assert.match(t, /⚠️ Tienes \d+ gasto\(s\) sin confirmar en el chat\./);
  });

  // ===== Fase 2: copia de seguridad =====

  let copiaJson: any;
  await caso("Copia semanal: la primera sale, y no se repite hasta 7 días después", async () => {
    const { copiaSiToca } = await import("@/lib/copia");
    const enviadas: { nombre: string; bytes: Uint8Array; texto: string }[] = [];
    const enviar = async (bytes: Uint8Array, nombre: string, texto: string) => void enviadas.push({ bytes, nombre, texto });
    assert.ok(await copiaSiToca(enviar, "2026-11-23"));
    assert.equal(await copiaSiToca(enviar, "2026-11-23"), null);
    assert.equal(await copiaSiToca(enviar, "2026-11-29"), null);
    assert.ok(await copiaSiToca(enviar, "2026-11-30"));
    assert.equal(enviadas.length, 2);
    assert.equal(enviadas[0].nombre.slice(0, 12), "IVAn-copia-2");
    copiaJson = JSON.parse(gunzipSync(enviadas[1].bytes).toString());
    assert.equal(copiaJson.tablas.facturas.filter((f: any) => f.estado === "emitida").length, 16);
    assert.match(enviadas[1].texto, /16 facturas/);
  });

  await caso("/copia la manda al momento por Telegram", async () => {
    await mensaje("/copia");
    const d = enviados("sendDocument").at(-1);
    assert.match(String(d?.archivo?.nombre), /^IVAn-copia-\d{4}-\d{2}-\d{2}\.json\.gz$/);
    assert.match(String(d?.params.caption), /Copia de seguridad/);
  });

  await caso("La copia se restaura en una base vacía y queda igual", async () => {
    const { crearCopia, restaurarCopia, TABLAS } = await import("@/lib/copia");
    const { copia } = await crearCopia();
    execSync(`${import.meta.dirname}/reset-db.sh --vacia`, { stdio: "ignore" });
    await esperarPostgrest(db);
    await restaurarCopia(copia);
    for (const t of TABLAS) {
      const { data } = await db().from(t).select("*");
      assert.equal(data!.length, copia.tablas[t].length, `filas de ${t}`);
    }
    assert.equal((await ajustes()).ultimo_numero, 341);
    const sum = (xs: any[]) => xs.reduce((s, x) => s + Number(x.base ?? 0), 0).toFixed(2);
    assert.equal(sum((await db().from("gastos").select("base")).data!), sum(copia.tablas.gastos));
    const del = await db().from("facturas").delete().eq("numero", "00340");
    assert.ok(del.error, "las emitidas siguen protegidas tras restaurar");
  });

  await caso("Al quitar el modo paralelo IVAn sigue la numeración (00342)", async () => {
    await mensaje("/ajustes emitir_desde: ninguno");
    assert.match(ultimoTexto(), /las emite IVAn/);
    F.guionClaude.push(forzada("preparar_factura", { ...peticionNoviembre, base: 3060 }));
    await mensaje("/factura Zapflow 3060");
    const b = (await db().from("facturas").select("*").eq("estado", "borrador").eq("origen", "ivan")).data!.at(-1)!;
    await pulsar(`f:ok:${b.id}`, await idMensajeFactura(b.id));
    assert.equal((await db().from("facturas").select("numero").eq("id", b.id).single()).data!.numero, "00342");
  });

  srv.close();
  console.log(`\n${ok} bien · ${errores.length} mal`);
  if (errores.length) {
    console.log(errores.map((e) => `- ${e}`).join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
