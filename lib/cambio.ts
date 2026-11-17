// Tipo de cambio del Banco Central Europeo (vía Frankfurter, que publica los del BCE).
// Devuelve unidades de `moneda` por 1 EUR en la fecha dada (o el último día hábil anterior).

const FUENTES = [
  (fecha: string, moneda: string) => `https://api.frankfurter.dev/v1/${fecha}?base=EUR&symbols=${moneda}`,
  (fecha: string, moneda: string) => `https://api.frankfurter.app/${fecha}?from=EUR&to=${moneda}`,
];

export async function tipoCambioBCE(fecha: string, moneda: string): Promise<number> {
  const m = moneda.toUpperCase();
  let ultimoError: unknown;
  for (const url of FUENTES) {
    try {
      const res = await fetch(url(fecha, m), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { rates?: Record<string, number> };
      const rate = json.rates?.[m];
      if (typeof rate === "number" && rate > 0) return rate;
      throw new Error("sin tipo");
    } catch (e) {
      ultimoError = e;
    }
  }
  throw new Error(`No pude obtener el cambio EUR/${m} del ${fecha}: ${String(ultimoError)}`);
}
