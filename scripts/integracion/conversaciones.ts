// Prueba de integración: conversaciones simuladas con IVAn contra Postgres + PostgREST reales.
// Telegram, Claude, la transcripción y el tipo de cambio están simulados (fakes.ts).
//
//   1. ./reset-db.sh   2. ./arrancar.sh   3. npx tsx scripts/integracion/conversaciones.ts
import assert from "node:assert/strict";
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

function forzada(nombre: string, input: unknown): F.Guion {
  return (p) => {
    assert.equal(p.tool_choice?.name, nombre, `Claude debía llamarse con ${nombre}`);
    return [usar(nombre, input)];
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

const enviados = (metodo = "sendMessage") => F.telegram.filter((t) => t.metodo === metodo);
const ultimoTexto = () => String(enviados().at(-1)?.params.text ?? "");

async function main() {
  const srv = await F.arrancar();
  const { getBot } = await import("@/lib/bot");
  const { db } = await import("@/lib/db");
  const bot = await getBot();

  const mensaje = async (text: string, extra: Record<string, unknown> = {}) => {
    const message_id = F.nuevoIdMensaje();
    const entities = text.startsWith("/") ? [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] : undefined;
    await bot.handleUpdate({ update_id: updateId++, message: { message_id, date: ahora(), chat, from: yo, text, entities, ...extra } } as any);
    return message_id;
  };
  const pulsar = async (data: string, message_id: number) =>
    bot.handleUpdate({
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
    await bot.handleUpdate({ update_id: updateId++, message: { message_id: 1, date: ahora(), chat, from: { ...yo, id: 999 }, text: "hola" } } as any);
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
      return [usar("preparar_factura", { ...peticionNoviembre, base: 3020 })];
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

  // ===== Gastos =====

  const cursor = {
    es_factura: true, proveedor: "Anysphere, Inc. (Cursor)", nif_proveedor: "US123", pais: "US", numero_factura: "CUR-0042",
    fecha: "2026-11-02", concepto: "suscripción Cursor", moneda: "USD", base: 20, iva: 0, total: 20,
    nif_destinatario: "00000000T", notas: null,
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
        fecha: "2026-01-14", concepto: "web hosting", moneda: "EUR", base: 180, iva: 0, total: 180, nif_destinatario: null, notas: null,
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

  await caso("Un archivo que no es PDF ni imagen se rechaza", async () => {
    await mensaje("", { text: undefined, document: { file_id: "x", file_unique_id: "u3", mime_type: "application/zip", file_name: "a.zip" } });
    assert.match(ultimoTexto(), /PDF o una imagen/);
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
