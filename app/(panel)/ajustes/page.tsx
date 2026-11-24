import { PageHeader, ListGroup, ListItem, Badge, NoticeStrip } from "@glinglo/vela-ds";
import { getAjustes, getClientes, db } from "@/lib/db";
import { amortizacionDelAnio, type BienCalc } from "@/lib/calculo";
import { euros, fechaES, hoyMadrid } from "@/lib/fiscal";
import { modoParalelo, siguienteNumero } from "@/lib/externas";

const BOT_URL = "https://t.me/Ivanelgestorbot";

function ibanEnmascarado(iban: string): string {
  const limpio = iban.replace(/\s/g, "").toUpperCase();
  const pais = limpio.slice(0, 2);
  const ultimos4 = limpio.slice(-4);
  const totalGrupos = Math.ceil(limpio.length / 4);
  const grupos = [`${pais}••`];
  for (let i = 1; i < totalGrupos - 1; i++) grupos.push("••••");
  grupos.push(ultimos4);
  return grupos.join(" ");
}

const TIPO_TEXTO: Record<string, string> = {
  nacional: "Nacional · con IVA y retención",
  ue: "UE · sin IVA",
  fuera_ue: "Fuera de la UE · sin IVA",
};

export default async function Ajustes() {
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const [ajustes, clientes, bienesRes, cuotasRes] = await Promise.all([
    getAjustes(),
    getClientes(),
    db().from("bienes_inversion").select("descripcion, fecha_compra, base, pct_anual").order("fecha_compra"),
    db().from("cuotas_autonomo").select("mes", { count: "exact", head: true }).gte("mes", `${anioActual}-01-01`).lte("mes", `${anioActual}-12-31`),
  ]);
  if (bienesRes.error) throw bienesRes.error;
  if (cuotasRes.error) throw cuotasRes.error;
  const bienes = (bienesRes.data ?? []) as { descripcion: string; fecha_compra: string; base: number; pct_anual: number }[];
  const finAnio = `${anioActual}-12-31`;

  const quienEmite = modoParalelo(ajustes, hoy)
    ? `Selfconta, hasta el ${fechaES(ajustes.emitir_desde!)}; IVAn solo registra`
    : "IVAn";

  return (
    <>
      <PageHeader title="Configuración" />

      <ListGroup label="Tus datos">
        <ListItem title="Nombre" value={ajustes.nombre} />
        <ListItem title="NIF" value={ajustes.nif} />
        <ListItem title="Dirección" value={ajustes.direccion} />
        <ListItem title="Email" value={ajustes.email ?? "—"} />
        <ListItem title="Teléfono" value={ajustes.telefono ?? "—"} />
        <ListItem title="IBAN" value={ajustes.iban ? ibanEnmascarado(ajustes.iban) : "—"} />
      </ListGroup>

      <ListGroup label="Facturas">
        <ListItem title="Siguiente número" value={siguienteNumero(ajustes)} />
        <ListItem title="Quién emite" value={quienEmite} />
      </ListGroup>

      <ListGroup label="Cuota de autónomo">
        <ListItem title="Cuota mensual por defecto" value={euros(ajustes.cuota_autonomo_mensual)} />
        <ListItem title={`Meses registrados en ${anioActual}`} value={`${cuotasRes.count ?? 0} de 12`} />
      </ListGroup>

      <ListGroup label="Bienes que se amortizan">
        {bienes.length === 0 ? (
          <ListItem title="Sin bienes registrados" />
        ) : (
          bienes.map((b) => {
            const bienCalc: BienCalc = { fecha_compra: b.fecha_compra, base: b.base, pct_anual: b.pct_anual };
            return (
              <ListItem
                key={`${b.descripcion}-${b.fecha_compra}`}
                title={b.descripcion}
                description={`Comprado el ${fechaES(b.fecha_compra)} · base ${euros(b.base)} · ${b.pct_anual} % anual`}
                value={euros(amortizacionDelAnio([bienCalc], finAnio))}
              />
            );
          })
        )}
      </ListGroup>

      <ListGroup label="Clientes">
        {clientes.map((c) => (
          <ListItem
            key={c.id}
            title={c.nombre}
            description={`${c.pais} · ${TIPO_TEXTO[c.tipo] ?? c.tipo}`}
            badge={!c.direccion ? { label: "falta dirección", type: "onhold" } : undefined}
          />
        ))}
      </ListGroup>

      <NoticeStrip title="Para cambiar algo, díselo al bot" subtitle="/ajustes" href={BOT_URL} target="_blank" />
    </>
  );
}
