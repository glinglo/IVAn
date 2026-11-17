import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, verificarToken } from "./sesion";

export async function haySesion(): Promise<boolean> {
  const c = await cookies();
  return verificarToken(c.get(COOKIE)?.value, "sesion");
}

/** Para páginas: manda a /sin-acceso si no hay sesión. */
export async function exigirSesion() {
  if (!(await haySesion())) redirect("/sin-acceso");
}
