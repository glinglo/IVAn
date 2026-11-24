-- Casillas clave tal como se presentaron: para el 303, 110, 78, 87 y 71. Solo se muestran; no
-- entran en ningún cálculo de IVAn.
alter table presentaciones add column if not exists casillas jsonb;
comment on column presentaciones.casillas is
  'Casillas clave tal como se presentaron (303: 110, 78, 87, 71). Solo para mostrar, no entra en ningún cálculo.';
