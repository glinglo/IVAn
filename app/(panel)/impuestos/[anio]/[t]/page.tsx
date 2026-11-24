import { notFound } from "next/navigation";
import { Badge, Button, Card, CardHeader, CopyValue, ListGroup, ListItem, PageHeader } from "@glinglo/vela-ds";
import { cargarLibro, resumenTrimestre, sinDatos, type Casillas303 } from "@/lib/libro";
import { euros, fechaES, formatoSede, plazoTrimestral } from "@/lib/fiscal";
import { frase130, frase303 } from "@/lib/impuestos";
import { PestanasModelo } from "@/components/PestanasModelo";
import { db } from "@/lib/db";

const SEDE_URL = "https://sede.agenciatributaria.gob.es";

const PASOS: Record<string, string[]> = {
  "303": [
    "Entra en la Sede con Cl@ve o certificado.",
    "Modelo 303 → presentación del trimestre.",
    "Revisa que las casillas coincidan con las de aquí.",
    "Presenta y domicilia el pago (o paga con tarjeta/NRC).",
  ],
  "130": [
    "Entra en la Sede con Cl@ve o certificado.",
    "Modelo 130 → presentación del trimestre.",
    "Revisa ingresos, gastos y pagos fraccionados anteriores.",
    "Presenta y domicilia el pago.",
  ],
  "349": [
    "Entra en la Sede con Cl@ve o certificado.",
    "Modelo 349 → presentación del periodo (trimestral).",
    "Una línea por cliente o proveedor UE, con su VAT.",
    "Presenta (no lleva pago).",
  ],
};

export default async function Trimestre({
  params,
  searchParams,
}: {
  params: Promise<{ anio: string; t: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { anio: a, t: tt } = await params;
  const anio = Number(a);
  const t = Number(tt);
  if (!Number.isInteger(anio) || ![1, 2, 3, 4].includes(t)) notFound();
  const m = (await searchParams).m;
  const modelo = m === "130" || m === "349" ? m : "303";

  const libro = await cargarLibro(anio);
  const plazo = plazoTrimestral(anio, t);

  const datos = !sinDatos(libro);
  const p303 = libro.presentaciones.find((x) => x.modelo === "303" && x.trimestre === t) ?? null;
  const p130 = libro.presentaciones.find((x) => x.modelo === "130" && x.trimestre === t) ?? null;

  if (!datos && !p303 && !p130) {
    return (
      <>
        <PageHeader title={`${t}T de ${anio}`} back={{ label: "Impuestos", href: `/impuestos?anio=${anio}` }} />
        <Card>
          <p className="text-body">No hay datos de este trimestre.</p>
        </Card>
      </>
    );
  }

  // Modelo seleccionado: en un año sin datos no hay 349 que mostrar.
  const modeloFinal = !datos && modelo === "349" ? "303" : modelo;

  const p = datos ? (libro.presentaciones.find((x) => x.modelo === modeloFinal && x.trimestre === t) ?? null) : modeloFinal === "303" ? p303 : p130;
  const { m303, m130, m349, presentado } = datos ? resumenTrimestre(libro, t) : { m303: null, m130: null, m349: [], presentado: () => false };
  const presentadoEste = datos ? presentado(modeloFinal) : true;

  // Casillas tal como se presentaron (solo el 303): consulta aparte, para que si falta la migración
  // 008 (presentaciones.casillas) solo se resienta esta página, no todo el panel.
  let casillasPresentadas: Casillas303 | null = null;
  if (modeloFinal === "303" && (datos ? presentadoEste : true)) {
    const r = await db().from("presentaciones").select("casillas").eq("modelo", "303").eq("anio", anio).eq("trimestre", t).maybeSingle();
    if (!r.error) casillasPresentadas = (r.data?.casillas as Casillas303 | null) ?? null;
  }

  const badgeEstado = presentadoEste
    ? { label: p?.fecha ? `Presentado el ${fechaES(p.fecha)}` : "Presentado", type: "success" as const }
    : { label: "Provisional", type: "onhold" as const };

  const titulo303 = "Modelo 303 · IVA";
  const titulo130 = "Modelo 130 · IRPF";
  const titulo349 = "Modelo 349 · UE";
  const titulo = modeloFinal === "303" ? titulo303 : modeloFinal === "130" ? titulo130 : titulo349;

  let aIngresarGrande: number | null = null;
  let casillaGrande = "";
  let fraseGrande = "";
  if (modeloFinal === "303") {
    aIngresarGrande = datos ? m303!.c71 : (p303?.importe ?? 0);
    casillaGrande = "71";
    fraseGrande = datos ? frase303(aIngresarGrande) : "";
  } else if (modeloFinal === "130") {
    aIngresarGrande = datos ? m130!.c07 : (p130?.importe ?? 0);
    casillaGrande = "19";
    fraseGrande = datos ? frase130(aIngresarGrande, t) : "";
  }

  const difierePresentado =
    datos && presentadoEste && p?.importe !== null && p?.importe !== undefined && Math.abs(p.importe - (aIngresarGrande ?? 0)) > 0.01;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t}T de ${anio}`}
        subtitle={
          datos
            ? `Plazo: del ${fechaES(plazo.apertura)} al ${fechaES(plazo.fin)} (domiciliación hasta aprox. el ${fechaES(plazo.finDomiciliacion)})`
            : p?.fecha
              ? `Presentado el ${fechaES(p.fecha)}`
              : undefined
        }
        back={{ label: "Impuestos", href: `/impuestos?anio=${anio}` }}
      />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
        <Card className="p-4 lg:p-6 gap-5 lg:col-start-1">
          <CardHeader
            title={titulo}
            subtitle={`${t}T de ${anio}`}
            actions={<PestanasModelo valor={modeloFinal} modelos={datos ? undefined : ["303", "130"]} />}
          />

          <div className="h-px bg-separator" />

          {modeloFinal !== "349" ? (
            <>
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-2">
                  <div className="text-caption text-tertiary">A ingresar · casilla [{casillaGrande}]</div>
                  <div className="text-display">{euros(aIngresarGrande ?? 0)}</div>
                  {fraseGrande && <p className="text-body">{fraseGrande}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge type={badgeEstado.type}>{badgeEstado.label}</Badge>
                  {datos && modeloFinal === "130" && <Badge type="secondary">Cuota de autónomo incluida</Badge>}
                </div>
              </div>

              {difierePresentado && (
                <p className="text-body">
                  Presentado {euros(p!.importe!)} · IVAn calcula {euros(aIngresarGrande ?? 0)}.
                  {modeloFinal === "130" && " El 130 de la gestoría no incluía tu cuota de autónomo como gasto; por eso IVAn calcula otra cifra."}
                </p>
              )}

              <div className="h-px bg-separator" />

              {!datos ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modeloFinal === "303" && casillasPresentadas
                    ? (
                        [
                          ["110", "Cuotas a compensar de periodos anteriores", casillasPresentadas["110"] ?? 0],
                          ["78", "Cuotas a compensar aplicadas", casillasPresentadas["78"] ?? 0],
                          ["87", "Cuotas a compensar pendientes", casillasPresentadas["87"] ?? 0],
                          ["71", "Resultado", casillasPresentadas["71"] ?? aIngresarGrande ?? 0],
                        ] as [string, string, number][]
                      ).map(([cas, nombre, v]) => (
                        <CopyValue key={cas} code={`[${cas}]`} label={nombre} display={euros(v)} copyText={formatoSede(v)} className={v === 0 ? "opacity-60" : undefined} />
                      ))
                    : (
                        [[modeloFinal === "303" ? "71" : "19", "Resultado presentado", aIngresarGrande ?? 0]] as [string, string, number][]
                      ).map(([cas, nombre, v]) => (
                        <CopyValue key={cas} code={`[${cas}]`} label={nombre} display={euros(v)} copyText={formatoSede(v)} className={v === 0 ? "opacity-60" : undefined} />
                      ))}
                </div>
              ) : modeloFinal === "303" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(
                    [
                      ["07", "Base al 21 %", m303!.c07],
                      ["09", "Cuota al 21 %", m303!.c09],
                      ["10", "Base adquisiciones intracomunitarias", m303!.c10],
                      ["11", "Cuota adquisiciones intracomunitarias", m303!.c11],
                      ["12", "Base otras operaciones ISP", m303!.c12],
                      ["13", "Cuota otras operaciones ISP", m303!.c13],
                      ["27", "Total cuota devengada", m303!.c27],
                      ["28", "Base deducible operaciones interiores", m303!.c28],
                      ["29", "Cuota deducible operaciones interiores", m303!.c29],
                      ["36", "Base deducible adquisiciones intracom.", m303!.c36],
                      ["37", "Cuota deducible adquisiciones intracom.", m303!.c37],
                      ["45", "Total a deducir", m303!.c45],
                      ["46", "Resultado régimen general", m303!.c46],
                      ["59", "Entregas intracomunitarias de servicios", m303!.c59],
                      ["120", "Operaciones no sujetas (fuera UE)", m303!.c120],
                      ["110", "Cuotas a compensar de periodos anteriores", casillasPresentadas?.["110"] ?? m303!.c110],
                      ["78", "Cuotas a compensar aplicadas", casillasPresentadas?.["78"] ?? m303!.c78],
                      ["87", "Cuotas a compensar pendientes", casillasPresentadas?.["87"] ?? m303!.c87],
                    ] as [string, string, number][]
                  ).map(([cas, nombre, v]) => (
                    <CopyValue key={cas} code={`[${cas}]`} label={nombre} display={euros(v)} copyText={formatoSede(v)} className={v === 0 ? "opacity-60" : undefined} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(
                    [
                      ["01", "Ingresos computables (acumulado)", m130!.c01],
                      ["02", "Gastos fiscalmente deducibles", m130!.c02],
                      ["03", "Rendimiento neto", m130!.c03],
                      ["04", "20 % del rendimiento neto", m130!.c04],
                      ["05", "Pagos fraccionados anteriores", m130!.c05],
                      ["06", "Retenciones e ingresos a cuenta", m130!.c06],
                      ["07", "Resultado", m130!.c07],
                    ] as [string, string, number][]
                  ).map(([cas, nombre, v]) => (
                    <CopyValue key={cas} code={`[${cas}]`} label={nombre} display={euros(v)} copyText={formatoSede(v)} className={v === 0 ? "opacity-60" : undefined} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-body">
                  {m349.length === 0 ? "Sin operaciones intracomunitarias este trimestre: no hay que presentarlo." : `${m349.length} operador${m349.length === 1 ? "" : "es"}`}
                </p>
                <Badge type={badgeEstado.type}>{badgeEstado.label}</Badge>
              </div>
              {m349.length > 0 && (
                <ListGroup label="Operaciones">
                  {m349.map((l) => (
                    <ListItem
                      key={l.clave + l.nif + l.nombre}
                      title={l.nombre}
                      description={l.numero ? `${l.clave === "S" ? "Venta" : "Compra"} · ${l.pais ?? "¿país?"} · ${l.numero}` : "falta el VAT"}
                      value={euros(l.base)}
                    />
                  ))}
                </ListGroup>
              )}
            </>
          )}
        </Card>

        {datos ? (
          <aside aria-label="Plazo, cómo presentarlo y los demás modelos" className="flex flex-col gap-4 lg:col-start-2">
            <Card className="gap-3 bg-brand-100">
              <h3 className="text-eyebrow text-tertiary">Plazo</h3>
              <p className="text-body">
                Del {fechaES(plazo.apertura)} al {fechaES(plazo.fin)}. Domiciliación hasta aprox. el {fechaES(plazo.finDomiciliacion)}.
              </p>
              <p className="text-caption text-tertiary">
                Cuando lo presentes, díselo al bot: «presentado el {modeloFinal} del {t}T, {euros(aIngresarGrande ?? 0)}».
              </p>
            </Card>

            <Card className="gap-3">
              <h3 className="text-eyebrow text-tertiary">Cómo presentarlo</h3>
              <ol className="flex flex-col gap-2 text-body list-decimal list-inside">
                {PASOS[modeloFinal].map((paso) => (
                  <li key={paso}>{paso}</li>
                ))}
              </ol>
              <Button href={SEDE_URL} target="_blank" variant="secondary" size="sm" className="self-start">
                Abrir la Sede
              </Button>
            </Card>

            <Card className="gap-3">
              <h3 className="text-eyebrow text-tertiary">Este trimestre también</h3>
              <ul className="flex flex-col gap-2">
                {(["303", "130", "349"] as const)
                  .filter((x) => x !== modeloFinal)
                  .map((x) => {
                    const otroPresentado = presentado(x);
                    return (
                      <li key={x}>
                        <a href={`?m=${x}`} className="flex items-center justify-between text-body">
                          <span>{x === "303" ? titulo303 : x === "130" ? titulo130 : titulo349}</span>
                          <Badge type={otroPresentado ? "success" : "onhold"}>{otroPresentado ? "Presentado" : "Provisional"}</Badge>
                        </a>
                      </li>
                    );
                  })}
                {t === 4 && (
                  <li>
                    <a href={`/impuestos/${anio}/390`} className="flex items-center justify-between text-body">
                      <span>Modelo 390 · resumen anual</span>
                      <span className="text-link-secondary">Ver ›</span>
                    </a>
                  </li>
                )}
              </ul>
            </Card>
          </aside>
        ) : (
          <aside aria-label="Sobre estos datos" className="lg:col-start-2">
            <p className="text-caption text-tertiary">
              Presentado por la gestoría. IVAn no tiene las facturas de este año, así que solo muestra lo presentado.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
