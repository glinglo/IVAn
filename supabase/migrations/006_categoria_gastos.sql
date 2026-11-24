-- Categoría del gasto (contable, sin efecto fiscal): la pone el bot al leer la factura.
alter table gastos add column if not exists categoria text;
do $$ begin
  alter table gastos add constraint gastos_categoria_check
    check (categoria in ('software_ia','email','publicidad','hosting_dominios','apis_datos','formacion','equipos','comidas','otros'));
exception when duplicate_object then null; end $$;
create index if not exists gastos_categoria_idx on gastos (categoria);
