import Link from "next/link";
import { PageHeader } from "@glinglo/vela-ds";
import { cargarLibro, resumenTrimestre } from "@/lib/libro";
import { euros, hoyMadrid, trimestreDe } from "@/lib/fiscal";
import { AnioDropdown } from "@/components/AnioDropdown";

export default async function Impuestos({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const hoy = hoyMadrid();
  const anioActual = Number(hoy.slice(0, 4));
  const anio = Number((await searchParams).anio ?? anioActual);
  const libro = await cargarLibro(anio);
  const tActual = anio === anioActual ? trimestreDe(hoy).t : 4;
  const trimestres = [1, 2, 3, 4].map((t) => ({ t, ...resumenTrimestre(libro, t) }));

  return (
    <>
      <PageHeader title="Impuestos" subtitle={String(anio)} actions={<AnioDropdown anio={anio} anioActual={anioActual} />} />
      <section className="card">
        <h2>Trimestres</h2>
        <div className="filas">
          {trimestres
            .filter((x) => x.t <= tActual)
            .map((x) => {
              const hecho = x.presentado("303") && x.presentado("130");
              return (
                <Link key={x.t} href={`/impuestos/${anio}/${x.t}`} className="fila">
                  <div className="izq">
                    <div className="tit">
                      {x.t}T {hecho ? <span className="badge ok">presentado</span> : x.t === tActual && anio === anioActual ? <span className="badge">en curso</span> : <span className="badge warn">pendiente</span>}
                    </div>
                    <div className="det">
                      IVA {euros(x.m303.c71)} · IRPF {euros(x.m130.aIngresar)}
                    </div>
                  </div>
                  <div className="imp">›</div>
                </Link>
              );
            })}
        </div>
      </section>
      <Link href={`/impuestos/${anio}/390`} className="boton">Resumen anual · 390</Link>
    </>
  );
}
