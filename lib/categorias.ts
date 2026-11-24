// Categorías de gasto (contables, sin efecto fiscal): un solo sitio para sus etiquetas en español.

export const CATEGORIAS_GASTO = [
  "software_ia",
  "email",
  "publicidad",
  "hosting_dominios",
  "apis_datos",
  "formacion",
  "equipos",
  "comidas",
  "otros",
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export const ETIQUETA_CATEGORIA: Record<CategoriaGasto, string> = {
  software_ia: "Software e IA",
  email: "Email",
  publicidad: "Publicidad",
  hosting_dominios: "Hosting y dominios",
  apis_datos: "APIs y datos",
  formacion: "Formación",
  equipos: "Equipos",
  comidas: "Comidas",
  otros: "Otros",
};

/** Color fijo por categoría, para el gráfico apilado de Gastos y las barras de "Por categoría".
 * Aproximado a partir del lienzo (sin acceso a los valores exactos en esta sesión): si no coincide
 * con el dibujo, apúntalo para ajustarlo. */
export const COLOR_CATEGORIA: Record<CategoriaGasto, string> = {
  software_ia: "var(--color-brand-500)",
  apis_datos: "var(--color-brand-300)",
  hosting_dominios: "var(--color-blue-500)",
  email: "var(--color-blue-300)",
  publicidad: "var(--color-orange-500)",
  formacion: "var(--color-yellow-500)",
  equipos: "var(--color-gray-600)",
  comidas: "var(--color-green-500)",
  otros: "var(--color-gray-300)",
};
