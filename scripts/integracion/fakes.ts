// Servidor de pruebas: hace de Supabase (REST vía PostgREST + Storage en memoria),
// de la API de Telegram, de la API de Claude y de la de transcripción.
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";

export const JWT_SECRET = "secreto-de-pruebas-de-ivan-con-mas-de-32-caracteres";
export const PUERTO = 54321;
const POSTGREST = "http://localhost:3001";

function b64url(x: string | Buffer) {
  return Buffer.from(x).toString("base64url");
}
export function jwt(role: string) {
  const h = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64url(JSON.stringify({ role, iss: "ivan-pruebas", exp: Math.floor(Date.now() / 1000) + 86400 }));
  const s = createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}

// ---------- Estado observable desde las pruebas ----------

export interface LlamadaTelegram {
  metodo: string;
  params: Record<string, unknown>;
  archivo?: { nombre: string; bytes: Buffer };
}
export const telegram: LlamadaTelegram[] = [];
export const archivosTelegram = new Map<string, Buffer>(); // file_id → bytes
export const storage = new Map<string, { bytes: Buffer; tipo: string }>();

/** Respuestas guionizadas de Claude: cada llamada consume la siguiente. */
export type Guion = (peticion: any) => any;
export const guionClaude: Guion[] = [];
export const peticionesClaude: any[] = [];
export let transcripcion = "";
export function setTranscripcion(t: string) {
  transcripcion = t;
}

/** Para simular que Telegram falla al mandar el siguiente documento. */
export const fallos = { siguienteDocumento: false };

let siguienteMensaje = 1000;
export const nuevoIdMensaje = () => ++siguienteMensaje;

// ---------- Utilidades ----------

async function leer(req: http.IncomingMessage): Promise<Buffer> {
  const trozos: Buffer[] = [];
  for await (const t of req) trozos.push(t as Buffer);
  return Buffer.concat(trozos);
}
function json(res: http.ServerResponse, codigo: number, cuerpo: unknown) {
  res.writeHead(codigo, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}
/** Multipart a mano: undici no acepta el formato exacto que genera grammY. */
async function formData(req: http.IncomingMessage, cuerpo: Buffer) {
  const fd = new FormData();
  const boundary = /boundary=("?)([^";]+)\1/.exec(String(req.headers["content-type"]))?.[2];
  if (!boundary) return fd;
  const sep = Buffer.from(`--${boundary}`);
  let i = cuerpo.indexOf(sep);
  while (i !== -1) {
    const inicio = i + sep.length;
    const fin = cuerpo.indexOf(sep, inicio);
    if (fin === -1) break;
    const parte = cuerpo.subarray(inicio, fin);
    const corte = parte.indexOf("\r\n\r\n");
    if (corte !== -1) {
      const cab = parte.subarray(0, corte).toString();
      let datos = parte.subarray(corte + 4);
      if (datos.subarray(-2).toString() === "\r\n") datos = datos.subarray(0, -2);
      const nombre = /name="([^"]*)"/.exec(cab)?.[1] ?? "";
      const fichero = /filename=(?:"([^"]*)"|([^;\r\n]+))/.exec(cab)?.slice(1).find((x) => x !== undefined);
      const tipo = /content-type:\s*([^\r\n]+)/i.exec(cab)?.[1] ?? "application/octet-stream";
      if (fichero !== undefined) fd.append(nombre, new File([new Uint8Array(datos)], fichero, { type: tipo }));
      else fd.append(nombre, datos.toString());
    }
    i = fin;
  }
  return fd;
}

// ---------- Telegram ----------

async function telegramApi(req: http.IncomingMessage, res: http.ServerResponse, ruta: string) {
  // /tg/bot<token>/<metodo>  ·  /tg/file/bot<token>/<ruta>
  if (ruta.startsWith("/tg/file/")) {
    const fileId = ruta.split("/").pop()!;
    const b = archivosTelegram.get(fileId);
    if (!b) return json(res, 404, { ok: false });
    res.writeHead(200);
    return res.end(b);
  }
  const metodo = ruta.split("/").pop()!;
  const cuerpo = await leer(req);
  const tipo = req.headers["content-type"] ?? "";
  let params: Record<string, unknown> = {};
  let archivo: LlamadaTelegram["archivo"];
  if (tipo.includes("multipart/form-data")) {
    const fd = await formData(req, cuerpo);
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") {
        try {
          params[k] = JSON.parse(v);
        } catch {
          params[k] = v;
        }
      } else {
        archivo = { nombre: v.name, bytes: Buffer.from(await v.arrayBuffer()) };
      }
    }
    // grammY manda el documento como attach://<id>
    if (archivo) params.document = `archivo:${archivo.nombre}`;
  } else if (cuerpo.length) {
    params = JSON.parse(cuerpo.toString());
  }
  telegram.push({ metodo, params, archivo });
  const chat = { id: 42, type: "private" };
  const mensaje = () => ({ message_id: nuevoIdMensaje(), date: Math.floor(Date.now() / 1000), chat, text: params.text });
  switch (metodo) {
    case "getMe":
      return json(res, 200, { ok: true, result: { id: 1, is_bot: true, first_name: "IVAn", username: "IvanPruebasBot" } });
    case "sendDocument":
      if (fallos.siguienteDocumento) {
        fallos.siguienteDocumento = false;
        return json(res, 500, { ok: false, error_code: 500, description: "Internal Server Error (simulado)" });
      }
      return json(res, 200, { ok: true, result: mensaje() });
    case "sendMessage":
      return json(res, 200, { ok: true, result: mensaje() });
    case "editMessageText":
      return json(res, 200, { ok: true, result: { ...mensaje(), message_id: params.message_id } });
    case "getFile":
      return json(res, 200, { ok: true, result: { file_id: params.file_id, file_path: `docs/${params.file_id}` } });
    default:
      return json(res, 200, { ok: true, result: true });
  }
}

// ---------- Storage ----------

async function storageApi(req: http.IncomingMessage, res: http.ServerResponse, ruta: string) {
  let r = ruta.replace("/storage/v1/object/", "");
  if (r.startsWith("sign/")) {
    const path = r.replace("sign/", "");
    return json(res, 200, { signedURL: `/object/sign/${path}?token=prueba` });
  }
  r = r.replace(/^authenticated\//, "").replace(/^public\//, "");
  const clave = decodeURIComponent(r.split("?")[0]);
  if (req.method === "POST" || req.method === "PUT") {
    const cuerpo = await leer(req);
    const tipo = req.headers["content-type"] ?? "application/octet-stream";
    if (tipo.includes("multipart/form-data")) {
      const fd = await formData(req, cuerpo);
      const f = [...fd.values()].find((v) => typeof v !== "string") as File;
      storage.set(clave, { bytes: Buffer.from(await f.arrayBuffer()), tipo: f.type });
    } else {
      storage.set(clave, { bytes: cuerpo, tipo });
    }
    return json(res, 200, { Key: clave, Id: randomUUID() });
  }
  const o = storage.get(clave);
  if (!o) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
  res.writeHead(200, { "content-type": o.tipo });
  res.end(o.bytes);
}

// ---------- Claude ----------

async function claudeApi(req: http.IncomingMessage, res: http.ServerResponse) {
  const peticion = JSON.parse((await leer(req)).toString());
  peticionesClaude.push(peticion);
  const paso = guionClaude.shift();
  if (!paso) return json(res, 500, { type: "error", error: { type: "api_error", message: "Guion de Claude agotado" } });
  const r = paso(peticion);
  const content = Array.isArray(r) ? r : r.content;
  const usaHerramienta = content.some((b: any) => b.type === "tool_use");
  json(res, 200, {
    id: `msg_${randomUUID()}`,
    type: "message",
    role: "assistant",
    model: peticion.model,
    content,
    stop_reason: usaHerramienta ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  });
}

// ---------- Servidor ----------

export function arrancar(): Promise<http.Server> {
  const srv = http.createServer(async (req, res) => {
    const ruta = req.url ?? "/";
    try {
      if (ruta.startsWith("/rest/v1/")) {
        const cuerpo = req.method === "GET" || req.method === "HEAD" ? undefined : await leer(req);
        const cabeceras = { ...req.headers } as Record<string, string>;
        delete cabeceras.host;
        delete cabeceras["content-length"];
        const r = await fetch(POSTGREST + ruta.replace("/rest/v1", ""), { method: req.method, headers: cabeceras, body: cuerpo ? new Uint8Array(cuerpo) : undefined });
        const out: Record<string, string> = {};
        r.headers.forEach((v, k) => {
          if (!["content-encoding", "transfer-encoding", "content-length"].includes(k)) out[k] = v;
        });
        res.writeHead(r.status, out);
        return res.end(Buffer.from(await r.arrayBuffer()));
      }
      if (ruta.startsWith("/storage/v1/")) return await storageApi(req, res, ruta);
      if (ruta.startsWith("/tg/")) return await telegramApi(req, res, ruta);
      if (ruta.startsWith("/anthropic/v1/messages")) return await claudeApi(req, res);
      if (ruta.startsWith("/openai/audio/transcriptions")) {
        await leer(req);
        return json(res, 200, { text: transcripcion });
      }
      json(res, 404, { error: `ruta no simulada: ${req.method} ${ruta}` });
    } catch (e) {
      console.error("fakes", ruta, e);
      json(res, 500, { error: String(e) });
    }
  });
  return new Promise((ok) => srv.listen(PUERTO, () => ok(srv)));
}
