-- Facturado acumulado de enero al fin del trimestre, de los 130 de años anteriores (para comparar).
alter table presentaciones add column if not exists ingresos_acumulados numeric(12,2);
comment on column presentaciones.ingresos_acumulados is
  'Facturado de enero al fin del trimestre (130). Para comparar con años anteriores.';
