import { Bot, InlineKeyboard, InputFile, type Context } from "grammy";
import { env } from "./env";
import { db, descargarArchivo, getAjustes, getClientes, type Cliente, type Factura, type Gasto } from "./db";
import { euros, fechaES, hoyMadrid, round2, tipoClientePorPais } from "./fiscal";
import {
  aplicarCorreccion, buscarDuplicado, gastoPorMensaje, gastosDelTrimestre, getGasto,
  leerArchivo, registrarDesdeArchivo, setEstado, setMensaje,
} from "./gastos";
import {
  comprobarAntesDeEmitir, emitirFactura, facturaPorMensaje, getFactura, pdfPorNumero, prepararBorrador,
} from "./facturacion";
import { trimestreActual } from "./recordatorios";
import { esPropia, modoParalelo, pistasDePropia, prepararExterna, registrarExterna } from "./externas";
import { enviarCopia } from "./copia";
import { responder, type Acciones } from "./agente";
import { transcribir } from "./voz";
import { enlacePanel } from "./sesion";
import { exportarXlsx } from "./exportar";

const AYUDA = `Soy IVAn, tu gestor. Háblame normal, por escrito o con notas de voz:

🧾 «Factura a Zapflow 3.060 de noviembre» → te enseño el borrador y la emites con ✅. Te devuelvo el PDF.
📸 Mándame la foto o el PDF de un gasto → lo leo, lo clasifico y lo guardas con ✅.
📥 Si me mandas el PDF de una factura tuya hecha en Selfconta, la registro con su número.
✏️ Para corregir un borrador, respóndele a su mensaje («la base es 41», «es de Irlanda»).
📊 «¿Cómo va el trimestre?», «¿cuánto llevo facturado?», «¿qué tengo pendiente?»
✅ «Presentado el 303 del 4T, 0 €» → lo apunto.

Atajos: /panel (enlace al panel) · /exportar (Excel) · /pdf 00337 · /clientes · /ajustes

⏰ Te aviso de los plazos de los trimestrales y a fin de mes para facturar.`;

// ---------- Textos de vista previa ----------

function textoGasto(g: Gasto, duplicado: Gasto | null): string {
  const l: string[] = ["🧾 Gasto (borrador)"];
  l.push(`Proveedor: ${g.proveedor ?? "?"}${g.pais ? ` (${g.pais})` : ""}${g.nif ? ` · ${g.nif}` : ""}`);
  l.push(`Factura: ${g.numero_factura ?? "sin número"} · ${g.fecha ? fechaES(g.fecha) : "sin fecha"}`);
  if (g.concepto) l.push(`Concepto: ${g.concepto}`);
  let base = `Base: ${g.base !== null ? euros(g.base) : "?"}`;
  if (g.moneda !== "EUR" && g.importe_original !== null && g.tipo_cambio) {
    base += ` (${g.importe_original} ${g.moneda} a ${g.tipo_cambio} ${g.moneda}/EUR, BCE)`;
  }
  l.push(base);
  l.push(`IVA en la factura: ${euros(g.iva)}`);
  if (g.tipo === "IVA soportado") l.push("Tipo: IVA soportado (deducible)");
  else if (g.tipo && g.base !== null) {
    l.push(`Tipo: ${g.tipo} → en el 303 te autorrepercutes y deduces ${euros(round2(g.base * 0.21))} (neto 0)`);
  }
  const x = g.extraccion as { es_factura?: boolean; notas?: string | null } | null;
  if (x && x.es_factura === false) l.push("⚠️ Parece un ticket o recibo, no una factura: pide la factura completa.");
  if (g.a_mi_nombre === false) l.push("⚠️ No veo tu NIF en la factura. Ponlo en los datos de facturación del proveedor para las próximas.");
  if (duplicado) l.push(`⚠️ Ya tienes un gasto igual guardado (${duplicado.proveedor}, ${duplicado.numero_factura ?? duplicado.fecha}).`);
  if (x?.notas) l.push(`ℹ️ ${x.notas}`);
  l.push("", "Responde a este mensaje para corregir algo.");
  return l.join("\n");
}

const tecladoGasto = (id: string) =>
  new InlineKeyboard().text("✅ Guardar", `g:ok:${id}`).text("🗑 Descartar", `g:no:${id}`);

function textoPregunta(g: Gasto, pistas: ReturnType<typeof pistasDePropia>): string {
  const l: string[] = ["🤔 ¿Esta factura es tuya o es un gasto?"];
  const nif = g.nif ? `NIF ${g.nif}` : "(sin NIF)";
  l.push(`El emisor que leo es «${g.proveedor ?? "?"}» (${nif}), que no es tu NIF, pero:`);
  for (const p of pistas) l.push(`· ${p.texto}`);
  return l.join("\n");
}

const tecladoPregunta = (id: string) =>
  new InlineKeyboard().text("📥 Es mía (venta)", `p:venta:${id}`).text("🧾 Es un gasto", `p:gasto:${id}`);

const MIME_POR_EXT: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

async function textoFactura(f: Factura, c: Cliente): Promise<string> {
  const { bloqueos, avisos, ajustes } = await comprobarAntesDeEmitir(f);
  const siguiente = `${ajustes.serie}${String(ajustes.ultimo_numero + 1).padStart(ajustes.digitos_numero, "0")}`;
  const l: string[] = [`📄 Factura (borrador) · se emitirá como ${siguiente}`];
  l.push(`Cliente: ${c.nombre} (${c.pais})`);
  l.push(`Fecha: ${fechaES(f.fecha)}`);
  l.push(`Concepto: ${f.concepto}`);
  let imp = `Base ${euros(f.base)} · IVA ${f.iva_pct}% ${euros(f.iva)}`;
  if (f.retencion > 0) imp += ` · Retención ${f.retencion_pct}% -${euros(f.retencion)}`;
  l.push(imp, `TOTAL ${euros(f.total)}`);
  if (f.mencion) l.push(`Mención: ${f.mencion}`);
  for (const b of bloqueos) l.push(`⛔ ${b}`);
  for (const a of avisos) l.push(`⚠️ ${a}`);
  l.push("", "Responde a este mensaje para cambiar algo (importe, concepto, fecha…).");
  return l.join("\n");
}

const tecladoFactura = (id: string) =>
  new InlineKeyboard().text("✅ Emitir", `f:ok:${id}`).text("❌ Cancelar", `f:no:${id}`);

function textoExterna(f: Factura, c: Cliente, avisos: string[]): string {
  const l: string[] = [`📥 Factura tuya hecha fuera de IVAn · ${f.numero_externo}`];
  l.push(`Cliente: ${c.nombre} (${c.pais})`);
  l.push(`Fecha: ${fechaES(f.fecha)}`);
  l.push(`Concepto: ${f.concepto}`);
  let imp = `Base ${euros(f.base)} · IVA ${f.iva_pct}% ${euros(f.iva)}`;
  if (f.retencion > 0) imp += ` · Retención ${f.retencion_pct}% -${euros(f.retencion)}`;
  l.push(imp, `TOTAL ${euros(f.total)}`);
  for (const a of avisos) l.push(`⚠️ ${a}`);
  l.push("", "La apunto en tu libro con su número, sin generar otra. Si algo está mal, descártala y corrígela en Selfconta.");
  return l.join("\n");
}

const tecladoExterna = (id: string) =>
  new InlineKeyboard().text("✅ Registrar", `x:ok:${id}`).text("🗑 Descartar", `x:no:${id}`);

// ---------- Utilidades ----------

async function descargar(ctx: Context, fileId: string): Promise<Uint8Array> {
  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) throw new Error("Telegram no me da el archivo (¿más de 20 MB?)");
  const res = await fetch(`${env.telegramApiRoot}/file/bot${env.telegramToken}/${file.file_path}`);
  if (!res.ok) throw new Error(`No pude descargar el archivo (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

function buscarCliente(clientes: Cliente[], nombre: string): Cliente | undefined {
  const n = nombre.trim().toLowerCase();
  return clientes.find((c) => c.nombre.toLowerCase() === n) ?? clientes.find((c) => c.nombre.toLowerCase().includes(n));
}

async function enviarBorradorFactura(ctx: Context, f: Factura, c: Cliente) {
  const msg = await ctx.reply(await textoFactura(f, c), { reply_markup: tecladoFactura(f.id) });
  await setMensaje("facturas", f.id, msg.message_id);
}

function acciones(ctx: Context): Acciones {
  return {
    enviarBorradorFactura: (f, c) => enviarBorradorFactura(ctx, f, c),
    enviarExcel: async (anio) => {
      const bytes = await exportarXlsx(anio);
      await ctx.replyWithDocument(new InputFile(Buffer.from(bytes), `IVAn-${anio}.xlsx`));
    },
  };
}

/** Texto libre (escrito o transcrito): corrección de un borrador si responde a uno; si no, al agente. */
async function procesarTexto(ctx: Context, texto: string, respondeA?: number) {
  if (respondeA) {
    const g = await gastoPorMensaje(respondeA);
    if (g) {
      const nuevo = await aplicarCorreccion(g, texto);
      const dup = await buscarDuplicado(nuevo);
      const msg = await ctx.reply(textoGasto(nuevo, dup), { reply_markup: tecladoGasto(nuevo.id) });
      await setMensaje("gastos", nuevo.id, msg.message_id);
      await ctx.api.editMessageReplyMarkup(ctx.chat!.id, respondeA).catch(() => {});
      return;
    }
    const f = await facturaPorMensaje(respondeA);
    if (f?.origen === "externa") {
      await ctx.reply("Las facturas hechas en Selfconta se registran tal cual. Si algo está mal, descártala, corrígela allí y mándame el PDF nuevo.");
      return;
    }
    if (f) {
      const r = await prepararBorrador(texto, f);
      if (!r.ok) {
        await ctx.reply(`🤔 ${r.duda}`);
        return;
      }
      await enviarBorradorFactura(ctx, r.factura, r.cliente);
      await ctx.api.editMessageReplyMarkup(ctx.chat!.id, respondeA).catch(() => {});
      return;
    }
  }
  await ctx.replyWithChatAction("typing").catch(() => {});
  const respuesta = await responder(texto, acciones(ctx));
  await ctx.reply(respuesta);
}

// ---------- Bot ----------

let bot: Bot | null = null;
let iniciado: Promise<void> | null = null;

export async function getBot(): Promise<Bot> {
  if (!bot) {
    bot = crearBot();
    iniciado = bot.init();
  }
  await iniciado;
  return bot;
}

function crearBot(): Bot {
  const b = new Bot(env.telegramToken, { client: { apiRoot: env.telegramApiRoot } });

  // Solo tú.
  b.use(async (ctx, next) => {
    if (ctx.from?.id !== env.allowedUserId) return;
    await next();
  });

  b.command(["start", "ayuda", "help"], (ctx) => ctx.reply(AYUDA));

  // --- Gastos ---
  const procesarArchivo = async (ctx: Context, fileId: string, mime: string, ext: string) => {
    const espera = await ctx.reply("Leyendo la factura…");
    const bytes = await descargar(ctx, fileId);
    const leido = await leerArchivo({ bytes, mime, ext });
    if (esPropia(leido.extraido.nif_proveedor, leido.nifPropio)) {
      // Factura emitida por Jose en otro programa: se registra en ventas, no es un gasto.
      const r = await prepararExterna({ bytes, mime, ext });
      await ctx.api.deleteMessage(espera.chat.id, espera.message_id).catch(() => {});
      if (!r.ok) return ctx.reply(`🤔 ${r.duda}`);
      const msg = await ctx.reply(textoExterna(r.factura, r.cliente, r.avisos), { reply_markup: tecladoExterna(r.factura.id) });
      await setMensaje("facturas", r.factura.id, msg.message_id);
      return;
    }
    const g = await registrarDesdeArchivo(leido);
    await ctx.api.deleteMessage(espera.chat.id, espera.message_id).catch(() => {});
    const [ajustes, clientes] = await Promise.all([getAjustes(), getClientes()]);
    const pistas = pistasDePropia(
      { proveedor: g.proveedor, numero_factura: g.numero_factura, nif_destinatario: leido.extraido.nif_destinatario },
      ajustes,
      clientes,
    );
    if (pistas.length) {
      // No se usa setMensaje: responder a esta pregunta no debe corregir el gasto.
      await ctx.reply(textoPregunta(g, pistas), { reply_markup: tecladoPregunta(g.id) });
      return;
    }
    const dup = await buscarDuplicado(g);
    const msg = await ctx.reply(textoGasto(g, dup), { reply_markup: tecladoGasto(g.id) });
    await setMensaje("gastos", g.id, msg.message_id);
  };

  b.on("message:photo", async (ctx) => {
    const foto = ctx.message.photo.at(-1)!;
    await procesarArchivo(ctx, foto.file_id, "image/jpeg", "jpg");
  });

  b.on("message:document", async (ctx) => {
    const d = ctx.message.document;
    const mime = d.mime_type ?? "";
    const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!ok.includes(mime)) return ctx.reply("Mándame un PDF o una imagen (JPG/PNG).");
    const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1];
    await procesarArchivo(ctx, d.file_id, mime, ext);
  });

  b.callbackQuery(/^g:(ok|no):(.+)$/, async (ctx) => {
    const [, accion, id] = ctx.match!;
    const g = await getGasto(id);
    if (!g || g.estado !== "borrador") return ctx.answerCallbackQuery("Ya estaba resuelto");
    if (accion === "ok") {
      if (!g.fecha || g.base === null || !g.tipo) {
        return ctx.answerCallbackQuery({ text: "Falta la fecha o la base: corrígelo respondiendo al mensaje", show_alert: true });
      }
      await setEstado(id, "confirmado");
      await ctx.answerCallbackQuery("Guardado");
      await ctx.editMessageText(`✅ Guardado: ${g.proveedor} · ${euros(g.base)} · ${fechaES(g.fecha)} · ${g.tipo}`);
    } else {
      await setEstado(id, "descartado");
      await ctx.answerCallbackQuery("Descartado");
      await ctx.editMessageText(`🗑 Descartado: ${g.proveedor ?? "gasto"}`);
    }
  });

  b.callbackQuery(/^p:(venta|gasto):(.+)$/, async (ctx) => {
    const [, accion, id] = ctx.match!;
    const g = await getGasto(id);
    if (!g || g.estado !== "borrador") return ctx.answerCallbackQuery("Ya estaba resuelta");
    if (accion === "gasto") {
      const dup = await buscarDuplicado(g);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(textoGasto(g, dup), { reply_markup: tecladoGasto(g.id) });
      await setMensaje("gastos", g.id, ctx.callbackQuery.message!.message_id);
      return;
    }
    // Contestamos ya: leer el PDF con Claude puede tardar más que los ~15 s que da Telegram para responder la pulsación.
    await ctx.answerCallbackQuery("Leyendo la factura…").catch(() => {});
    if (!g.archivo_path) {
      return ctx.editMessageText("⛔ No encuentro el archivo original: vuelve a mandármelo.");
    }
    try {
      const bytes = await descargarArchivo(g.archivo_path);
      const ext = g.archivo_path.split(".").pop() ?? "pdf";
      const mime = MIME_POR_EXT[ext] ?? "application/pdf";
      const r = await prepararExterna({ bytes, mime, ext });
      await setEstado(id, "descartado");
      if (!r.ok) {
        await ctx.editMessageText(`🤔 ${r.duda}`);
        return;
      }
      await ctx.editMessageText(textoExterna(r.factura, r.cliente, r.avisos), { reply_markup: tecladoExterna(r.factura.id) });
      await setMensaje("facturas", r.factura.id, ctx.callbackQuery.message!.message_id);
    } catch (e) {
      await ctx.reply(`⛔ No pude prepararla como factura:\n${e instanceof Error ? e.message : String(e)}\nVuelve a pulsar «Es mía».`);
    }
  });

  b.command("gastos", async (ctx) => {
    const q = trimestreActual(hoyMadrid());
    const gastos = await gastosDelTrimestre(q.desde, q.hasta);
    if (!gastos.length) return ctx.reply(`Aún no hay gastos en el ${q.t}T ${q.anio}.`);
    const total = gastos.reduce((s, g) => s + (g.base ?? 0), 0);
    const lineas = gastos.map((g) => `${fechaES(g.fecha!)} · ${g.proveedor} · ${euros(g.base ?? 0)} · ${g.tipo}`);
    await ctx.reply(`Gastos del ${q.t}T ${q.anio} (${gastos.length}, base ${euros(total)}):\n\n${lineas.join("\n")}`);
  });

  // --- Facturas ---
  b.command("factura", async (ctx) => {
    const texto = ctx.match?.trim();
    if (!texto) return ctx.reply("Dime a quién y cuánto, por ejemplo: /factura Zapflow 3060");
    const r = await prepararBorrador(texto);
    if (!r.ok) return ctx.reply(`🤔 ${r.duda}`);
    await enviarBorradorFactura(ctx, r.factura, r.cliente);
  });

  b.command("panel", (ctx) => ctx.reply(`Tu panel (el enlace caduca en 15 minutos):\n${enlacePanel()}`));

  b.command("exportar", async (ctx) => {
    const anio = Number(ctx.match?.trim() || hoyMadrid().slice(0, 4));
    await acciones(ctx).enviarExcel(anio);
  });

  b.callbackQuery(/^f:(ok|no):(.+)$/, async (ctx) => {
    const [, accion, id] = ctx.match!;
    const f = await getFactura(id);
    if (!f || f.estado !== "borrador") return ctx.answerCallbackQuery("Ya estaba resuelta");
    if (accion === "no") {
      await db().from("facturas").delete().eq("id", id).eq("estado", "borrador");
      await ctx.answerCallbackQuery("Cancelada");
      return ctx.editMessageText("❌ Borrador cancelado.");
    }
    let emitida: { numero: string; pdf: Uint8Array };
    try {
      emitida = await emitirFactura(id);
    } catch (e) {
      await ctx.answerCallbackQuery({ text: "No se pudo emitir", show_alert: false });
      await ctx.reply(`⛔ No la he emitido:\n${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    // A partir de aquí la factura YA está emitida: un fallo al avisar no puede decir lo contrario.
    const { numero, pdf } = emitida;
    await ctx.answerCallbackQuery(`Emitida ${numero}`).catch(() => {});
    await ctx.editMessageText(`✅ Factura ${numero} emitida · ${euros(f.total)}`).catch(() => {});
    try {
      await ctx.replyWithDocument(new InputFile(Buffer.from(pdf), `Factura-${numero}.pdf`));
    } catch {
      await ctx.reply(`✅ La factura ${numero} está emitida, pero no he podido mandarte el PDF. Pídemelo con /pdf ${numero}`);
    }
  });

  b.callbackQuery(/^x:(ok|no):(.+)$/, async (ctx) => {
    const [, accion, id] = ctx.match!;
    const f = await getFactura(id);
    if (!f || f.estado !== "borrador" || f.origen !== "externa") return ctx.answerCallbackQuery("Ya estaba resuelta");
    if (accion === "no") {
      await db().from("facturas").delete().eq("id", id).eq("estado", "borrador");
      await ctx.answerCallbackQuery("Descartada");
      return ctx.editMessageText(`🗑 Descartada: ${f.numero_externo}`);
    }
    try {
      const numero = await registrarExterna(id);
      await ctx.answerCallbackQuery(`Registrada ${numero}`);
      await ctx.editMessageText(`✅ ${numero} registrada en tu libro · ${euros(f.total)} (emitida en Selfconta)`);
    } catch (e) {
      await ctx.answerCallbackQuery({ text: "No se pudo registrar" });
      await ctx.reply(`⛔ No la he registrado:\n${e instanceof Error ? e.message : String(e)}`);
    }
  });

  b.command("copia", async (ctx) => {
    await ctx.replyWithChatAction("upload_document").catch(() => {});
    await enviarCopia((bytes, nombre, texto) => ctx.replyWithDocument(new InputFile(Buffer.from(bytes), nombre), { caption: texto }));
  });

  b.command("pdf", async (ctx) => {
    const numero = ctx.match?.trim();
    if (!numero) return ctx.reply("Dime el número: /pdf 00337");
    const r = await pdfPorNumero(numero);
    if (!r) return ctx.reply(`No encuentro la factura ${numero}.`);
    await ctx.replyWithDocument(new InputFile(Buffer.from(r.pdf), `Factura-${numero}.pdf`));
  });

  // --- Clientes y ajustes ---
  b.command("clientes", async (ctx) => {
    const cs = await getClientes();
    if (!cs.length) return ctx.reply("No hay clientes todavía.");
    await ctx.reply(
      cs.map((c) => `• ${c.nombre} (${c.pais}, ${c.tipo}) · ${c.nif ?? "sin NIF"} · ${c.direccion ?? "⚠️ sin dirección"}`).join("\n"),
    );
  });

  b.command("cliente", async (ctx) => {
    const m = (ctx.match ?? "").match(/^(.+?)\s+(direccion|dirección|nif|email|idioma|pais|país)\s*:\s*(.+)$/i);
    if (!m) return ctx.reply("Formato: /cliente Zapflow direccion: Calle 1, 00100 Helsinki");
    const [, nombre, campoRaw, valorRaw] = m;
    const cliente = buscarCliente(await getClientes(), nombre);
    if (!cliente) return ctx.reply(`No encuentro el cliente "${nombre}".`);
    const campo = campoRaw.toLowerCase().replace("ó", "o").replace("í", "i");
    const valor = valorRaw.trim();
    const cambio: Record<string, unknown> = { [campo]: valor };
    if (campo === "idioma" && !["es", "en"].includes(valor)) return ctx.reply("El idioma es es o en.");
    if (campo === "pais") {
      cambio.pais = valor.toUpperCase();
      cambio.tipo = tipoClientePorPais(valor);
    }
    const { error } = await db().from("clientes").update(cambio).eq("id", cliente.id);
    if (error) throw error;
    await ctx.reply(`✅ ${cliente.nombre}: ${campo} actualizado.`);
  });

  b.command("cliente_nuevo", async (ctx) => {
    const partes = (ctx.match ?? "").split("|").map((s) => s.trim());
    if (partes.length < 2 || !partes[0] || !/^[A-Za-z]{2}$/.test(partes[1])) {
      return ctx.reply("Formato: /cliente_nuevo Nombre | FI | VAT | Dirección | en");
    }
    const [nombre, pais, nif, direccion, idioma] = partes;
    const { error } = await db().from("clientes").insert({
      nombre,
      pais: pais.toUpperCase(),
      nif: nif || null,
      direccion: direccion || null,
      idioma: idioma === "en" ? "en" : pais.toUpperCase() === "ES" ? "es" : "en",
      tipo: tipoClientePorPais(pais),
    });
    if (error) throw error;
    await ctx.reply(`✅ Cliente ${nombre} añadido (${tipoClientePorPais(pais)}).`);
  });

  b.command("ajustes", async (ctx) => {
    const m = (ctx.match ?? "").match(/^(iban|email|telefono|teléfono|direccion|dirección|emitir_desde)\s*:\s*(.+)$/i);
    if (!m) {
      const a = await getAjustes();
      const emision = modoParalelo(a)
        ? `Modo paralelo: hasta el ${fechaES(a.emitir_desde!)} las facturas se hacen en Selfconta y aquí se registran.`
        : "Las facturas las emite IVAn.";
      return ctx.reply(
        `${a.nombre} · ${a.nif}\n${a.direccion}\n${a.email ?? ""} ${a.telefono ?? ""}\nIBAN: ${a.iban ?? "⚠️ sin IBAN"}\n` +
          `Última factura: ${a.serie}${String(a.ultimo_numero).padStart(a.digitos_numero, "0")}\n${emision}\n\n` +
          "Para cambiar: /ajustes iban: ES00 0000 ... · /ajustes emitir_desde: 2027-01-01 (o «ninguno»)",
      );
    }
    if (m[1].toLowerCase() === "emitir_desde") {
      const v = m[2].trim().toLowerCase();
      const fecha = v === "ninguno" || v === "ya" ? null : v;
      if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return ctx.reply("Formato: /ajustes emitir_desde: 2027-01-01 (o «ninguno»)");
      const { error } = await db().from("ajustes").update({ emitir_desde: fecha }).eq("id", 1);
      if (error) throw error;
      return ctx.reply(fecha ? `✅ Modo paralelo hasta el ${fechaES(fecha)}.` : "✅ Desde ahora las facturas las emite IVAn.");
    }
    const campo = m[1].toLowerCase().replace("é", "e").replace("ó", "o");
    const valor = campo === "iban" ? m[2].replace(/\s+/g, " ").trim().toUpperCase() : m[2].trim();
    const { error } = await db().from("ajustes").update({ [campo]: valor }).eq("id", 1);
    if (error) throw error;
    await ctx.reply(`✅ ${campo} actualizado.`);
  });

  // --- Voz ---
  b.on(["message:voice", "message:audio"], async (ctx) => {
    const audio = ctx.message.voice ?? ctx.message.audio!;
    await ctx.replyWithChatAction("typing").catch(() => {});
    const bytes = await descargar(ctx, audio.file_id);
    const texto = await transcribir(bytes);
    if (!texto) return ctx.reply("No te he entendido, ¿me lo repites?");
    await ctx.reply(`🎙️ «${texto}»`);
    await procesarTexto(ctx, texto, ctx.message.reply_to_message?.message_id);
  });

  // --- Texto libre ---
  b.on("message:text", async (ctx) => {
    await procesarTexto(ctx, ctx.message.text, ctx.message.reply_to_message?.message_id);
  });

  b.catch(async (err) => {
    console.error(err.error);
    const msg = err.error instanceof Error ? err.error.message : String(err.error);
    await err.ctx.reply(`⛔ Algo ha fallado: ${msg}`).catch(() => {});
  });

  return b;
}
