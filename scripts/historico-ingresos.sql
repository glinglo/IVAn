-- Ingresos acumulados (de enero al fin del trimestre, del 130) de años anteriores, para la
-- comparativa anual de Ventas. Ejecutar a mano en el SQL Editor de Supabase (no lo ejecuta IVAn).
-- En 2025 se quita el Kit Digital (2.000 €, desde el 2T): no es facturación.

insert into presentaciones (modelo, anio, trimestre, ingresos_acumulados)
values
  ('130', 2023, 1, 15710.31), ('130', 2023, 2, 35562.01), ('130', 2023, 3, 45551.59), ('130', 2023, 4, 57619.45),
  ('130', 2024, 1, 11244.44), ('130', 2024, 2, 30831.06), ('130', 2024, 3, 41399.05), ('130', 2024, 4, 53734.05),
  ('130', 2025, 1,  9831.16), ('130', 2025, 2, 24291.49), ('130', 2025, 3, 35803.55), ('130', 2025, 4, 44263.55)
on conflict (modelo, anio, trimestre) do update set ingresos_acumulados = excluded.ingresos_acumulados;

-- Unificación de Cursor: hoy está como "Anysphere", "Anysphere, Inc. (Cursor)" y "Cursor".
update gastos set proveedor = 'Anysphere, Inc. (Cursor)'
  where proveedor ilike '%anysphere%' or proveedor ilike 'cursor%';

-- Comprobación: debe dar 12 filas, todas con ingresos_acumulados.
select anio, trimestre, ingresos_acumulados from presentaciones where modelo = '130' order by anio, trimestre;
