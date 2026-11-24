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
