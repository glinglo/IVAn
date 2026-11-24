-- Casillas clave del 303 tal como se presentaron (2023-2026), de los justificantes. Solo se
-- muestran en el panel; no entran en ningún cálculo de IVAn. Ejecutar a mano en el SQL Editor de
-- Supabase (no lo ejecuta IVAn). El importe guardado es la casilla 71 (el resultado presentado).

insert into presentaciones (modelo, anio, trimestre, casillas, importe)
values
  ('303', 2023, 1, '{"110": 459.04,  "78": 0,      "87": 459.04,  "71": -32.38}',  -32.38),
  ('303', 2023, 2, '{"110": 491.42,  "78": 0,      "87": 491.42,  "71": -56.44}',  -56.44),
  ('303', 2023, 3, '{"110": 547.86,  "78": 0,      "87": 547.86,  "71": -3.27}',   -3.27),
  ('303', 2023, 4, '{"110": 551.13,  "78": 0,      "87": 551.13,  "71": -26.10}',  -26.10),
  ('303', 2024, 1, '{"110": 577.23,  "78": 0,      "87": 577.23,  "71": -89.50}',  -89.50),
  ('303', 2024, 2, '{"110": 666.73,  "78": 462.21,  "87": 204.52,  "71": 0}',      0),
  ('303', 2024, 3, '{"110": 204.52,  "78": 204.52,  "87": 0,       "71": 471.87}', 471.87),
  ('303', 2024, 4, '{"110": 0,       "78": 0,       "87": 0,       "71": 644.97}', 644.97),
  ('303', 2025, 1, '{"110": 0,       "78": 0,       "87": 0,       "71": -26.10}', -26.10),
  ('303', 2025, 2, '{"110": 26.10,   "78": 0,       "87": 26.10,   "71": -274.60}', -274.60),
  ('303', 2025, 3, '{"110": 300.70,  "78": 0,       "87": 300.70,  "71": -376.67}', -376.67),
  ('303', 2025, 4, '{"110": 679.93,  "78": 0,       "87": 679.93,  "71": -75.60}',  -75.60),
  ('303', 2026, 1, '{"110": 755.53,  "78": 0,       "87": 755.53,  "71": -2.42}',   -2.42),
  ('303', 2026, 2, '{"110": 2.42,    "78": 0,       "87": 2.42,    "71": -0.42}',   -0.42),
  ('303', 2026, 3, '{"110": 2.84,    "78": 2.84,    "87": 0,       "71": 207.46}',  207.46)
on conflict (modelo, anio, trimestre) do update set casillas = excluded.casillas, importe = excluded.importe;

-- 130 de 2025, por trimestre (los únicos de los que Jose tiene el desglose a mano; 2023 y 2024
-- quedan sin el 130 por trimestre, solo con los ingresos acumulados de historico-ingresos.sql).
insert into presentaciones (modelo, anio, trimestre, importe)
values
  ('130', 2025, 1, 1728.18), ('130', 2025, 2, 2496.92), ('130', 2025, 3, 1534.39), ('130', 2025, 4, 1442.56)
on conflict (modelo, anio, trimestre) do update set importe = excluded.importe;

-- Comprobación: 15 filas de 303 con casillas.
select anio, trimestre, casillas from presentaciones where modelo = '303' and casillas is not null order by anio, trimestre;
