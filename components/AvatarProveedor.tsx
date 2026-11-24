"use client";

import { Avatar, toneFor, type AvatarProps } from "@glinglo/vela-ds";
import { iniciales, nombreCorto } from "@/lib/texto";

/** `Avatar` con tono estable a partir del nombre: `toneFor` es de cliente (vive en el mismo módulo
 * que `Avatar`), así que no se puede llamar desde una página de servidor. */
export function AvatarProveedor({ nombre, size }: { nombre: string; size?: AvatarProps["size"] }) {
  const corto = nombreCorto(nombre);
  return <Avatar initials={iniciales(corto)} tone={toneFor(nombre)} size={size} />;
}
