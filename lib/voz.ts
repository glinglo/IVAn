// Notas de voz → texto (la API de Claude no acepta audio).
import { env } from "./env";

const VOCABULARIO = "IVAn, Zapflow, Volta Cultural, factura, gasto, IVA, IRPF, trimestre, modelo 303, modelo 130, modelo 349, autónomo";

export async function transcribir(audio: Uint8Array, nombre = "voz.ogg"): Promise<string> {
  const key = env.openaiKey;
  if (!key) throw new Error("Para las notas de voz falta OPENAI_API_KEY");
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(audio)], { type: "audio/ogg" }), nombre);
  form.append("model", process.env.TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  form.append("language", "es");
  form.append("prompt", VOCABULARIO);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`No pude transcribir el audio (${res.status})`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
