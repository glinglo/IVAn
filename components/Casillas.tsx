import { euros } from "@/lib/fiscal";

/** [casilla, texto, importe, ¿resultado en negrita?] */
export type Linea = [string, string, number, boolean?];

export function Tabla({ lineas }: { lineas: Linea[] }) {
  return (
    <table className="tabla">
      <tbody>
        {lineas.map(([cas, txt, v, res]) => (
          <tr key={cas + txt} className={res ? "res" : v === 0 ? "cero" : ""}>
            <td className="cas">{cas}</td>
            <td>{txt}</td>
            <td>{euros(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
