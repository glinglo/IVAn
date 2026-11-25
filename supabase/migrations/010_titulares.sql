-- Titular de los datos. Hoy solo hay uno (Jose); prepara IVAn para tener varios.
create table if not exists titulares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nif text not null unique,
  telegram_user_id bigint unique,
  created_at timestamptz not null default now()
);
alter table titulares enable row level security;

-- El titular sale de ajustes si ya existe (base en marcha). En una base nueva, el seed lo crea.
insert into titulares (nombre, nif)
select nombre, nif from ajustes where id = 1
on conflict (nif) do nothing;

-- Mientras haya un solo titular, las filas nuevas se marcan solas con él.
-- Con 0 o con 2 o más titulares, falla: así nadie mezcla datos sin decir de quién son.
create or replace function titular_unico() returns uuid
language plpgsql stable as $$
declare
  n int;
  v uuid;
begin
  select count(*) into n from titulares;
  if n <> 1 then
    raise exception 'Hay % titulares: indica titular_id', n;
  end if;
  select id into v from titulares limit 1;
  return v;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ajustes', 'clientes', 'facturas', 'gastos', 'cuotas_autonomo',
    'bienes_inversion', 'presentaciones', 'mensajes', 'recordatorios_enviados'
  ] loop
    execute format('alter table %I add column if not exists titular_id uuid references titulares(id)', t);
    execute format('update %I set titular_id = titular_unico() where titular_id is null and exists (select 1 from %I)', t, t);
    execute format('alter table %I alter column titular_id set default titular_unico()', t);
    execute format('alter table %I alter column titular_id set not null', t);
  end loop;
end $$;

create index if not exists facturas_titular_idx on facturas (titular_id);
create index if not exists gastos_titular_idx on gastos (titular_id);
create index if not exists presentaciones_titular_idx on presentaciones (titular_id);
