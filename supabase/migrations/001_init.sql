-- Gestor: libro de facturas emitidas y gastos de un autónomo (estimación directa simplificada)

create extension if not exists pgcrypto;

-- Datos del emisor (una sola fila)
create table if not exists ajustes (
  id int primary key default 1 check (id = 1),
  nombre text not null,
  nif text not null,
  direccion text not null,
  email text,
  telefono text,
  iban text,
  serie text not null default '',
  ultimo_numero int not null default 0,
  digitos_numero int not null default 5,
  cuota_autonomo_mensual numeric(10,2) not null default 0,  -- se usa para los meses sin recibo registrado
  iva_compensar_inicial numeric(10,2) not null default 0     -- IVA a compensar que venga del año anterior
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pais text not null,                       -- ISO 3166-1 alfa-2 (ES, FI, US…)
  nif text,                                 -- NIF español o VAT/Tax ID
  direccion text,
  email text,
  tipo text not null check (tipo in ('nacional', 'ue', 'fuera_ue')),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  iva_pct numeric(5,2) not null default 21,
  retencion_pct numeric(5,2) not null default 15,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  numero text unique,                       -- null mientras es borrador
  fecha date not null,
  cliente_id uuid not null references clientes(id),
  concepto text not null,
  base numeric(12,2) not null,
  iva_pct numeric(5,2) not null default 0,
  iva numeric(12,2) not null default 0,
  retencion_pct numeric(5,2) not null default 0,
  retencion numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  tipo text not null check (tipo in ('nacional', 'ue', 'fuera_ue')),
  mencion text,                             -- texto legal (ISP, no sujeta…)
  estado text not null default 'borrador' check (estado in ('borrador', 'emitida', 'anulada')),
  pdf_path text,
  telegram_message_id bigint,
  created_at timestamptz not null default now(),
  emitida_at timestamptz
);

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date,
  proveedor text,
  pais text,
  nif text,
  numero_factura text,
  concepto text,
  -- IVA soportado: deducible (casillas 28/29) · ISP UE: 10/11 y 36/37 · ISP fuera UE: 12/13 y 28/29
  -- Sin IVA deducible: el IVA cobrado (p. ej. de otro país) va como más gasto y no entra en el 303
  tipo text check (tipo in ('IVA soportado', 'ISP UE', 'ISP fuera UE', 'Sin IVA deducible')),
  base numeric(12,2),                       -- en euros
  iva numeric(12,2) not null default 0,     -- IVA soportado deducible (euros)
  moneda text not null default 'EUR',
  importe_original numeric(12,2),           -- base en la moneda original si no es EUR
  tipo_cambio numeric(12,6),                -- BCE, unidades de moneda por 1 EUR
  a_mi_nombre boolean,                      -- la factura lleva mi NIF
  archivo_path text,
  estado text not null default 'borrador' check (estado in ('borrador', 'confirmado', 'descartado')),
  telegram_message_id bigint,
  extraccion jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gastos_fecha_idx on gastos (fecha);
create index if not exists gastos_msg_idx on gastos (telegram_message_id);
create index if not exists facturas_fecha_idx on facturas (fecha);
create index if not exists facturas_msg_idx on facturas (telegram_message_id);

-- Recibos de autónomo (RETA). Si un mes no tiene fila se usa ajustes.cuota_autonomo_mensual.
create table if not exists cuotas_autonomo (
  mes date primary key check (extract(day from mes) = 1),
  importe numeric(10,2) not null
);

-- Bienes de inversión (> 300 €) que se amortizan, p. ej. el ordenador
create table if not exists bienes_inversion (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null,
  fecha_compra date not null,
  fecha_aproximada boolean not null default false,
  base numeric(12,2) not null,              -- precio sin IVA
  pct_anual numeric(5,2) not null           -- tabla simplificada: equipos informáticos 26 %
);

-- Declaraciones presentadas (para saber qué falta y usar el importe real del 130)
create table if not exists presentaciones (
  id uuid primary key default gen_random_uuid(),
  modelo text not null check (modelo in ('303', '130', '349', '390', '100')),
  anio int not null,
  trimestre int not null default 0 check (trimestre between 0 and 4), -- 0 = anual
  importe numeric(12,2),                    -- resultado presentado (null si no se sabe)
  fecha date,
  notas text,
  unique (modelo, anio, trimestre)
);

-- Últimos mensajes con IVAn, para que entienda «¿y el trimestre anterior?»
create table if not exists mensajes (
  id bigint generated always as identity primary key,
  rol text not null check (rol in ('user', 'assistant')),
  texto text not null,
  created_at timestamptz not null default now()
);

create table if not exists recordatorios_enviados (
  clave text primary key,
  enviado_at timestamptz not null default now()
);

-- Numeración correlativa sin huecos: se reserva el número en la misma transacción que emite.
create or replace function emitir_factura(p_factura_id uuid)
returns text
language plpgsql
as $$
declare
  v_num int;
  v_numero text;
  v_estado text;
begin
  select estado into v_estado from facturas where id = p_factura_id for update;
  if v_estado is null then raise exception 'Factura no encontrada'; end if;
  if v_estado <> 'borrador' then raise exception 'La factura ya está %', v_estado; end if;

  update ajustes set ultimo_numero = ultimo_numero + 1 where id = 1
    returning ultimo_numero into v_num;
  if v_num is null then raise exception 'Faltan tus datos en la tabla ajustes'; end if;
  select serie || lpad(v_num::text, digitos_numero, '0') into v_numero from ajustes where id = 1;

  update facturas
     set numero = v_numero, estado = 'emitida', emitida_at = now()
   where id = p_factura_id;
  return v_numero;
end;
$$;

-- Una factura emitida no se toca: los cambios van por factura rectificativa.
create or replace function bloquear_factura_emitida()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'emitida' and (
       new.numero is distinct from old.numero or new.fecha is distinct from old.fecha or
       new.cliente_id is distinct from old.cliente_id or new.base is distinct from old.base or
       new.iva is distinct from old.iva or new.retencion is distinct from old.retencion or
       new.total is distinct from old.total or new.concepto is distinct from old.concepto) then
    raise exception 'Una factura emitida no se puede modificar; emite una rectificativa';
  end if;
  return new;
end;
$$;

drop trigger if exists facturas_inmutables on facturas;
create trigger facturas_inmutables before update on facturas
  for each row execute function bloquear_factura_emitida();

create or replace function no_borrar_emitidas()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'emitida' then
    raise exception 'Una factura emitida no se puede borrar';
  end if;
  return old;
end;
$$;

drop trigger if exists facturas_no_borrar on facturas;
create trigger facturas_no_borrar before delete on facturas
  for each row execute function no_borrar_emitidas();

-- Solo el servidor (service role) accede: RLS activado sin políticas.
alter table ajustes enable row level security;
alter table clientes enable row level security;
alter table facturas enable row level security;
alter table gastos enable row level security;
alter table cuotas_autonomo enable row level security;
alter table bienes_inversion enable row level security;
alter table presentaciones enable row level security;
alter table recordatorios_enviados enable row level security;
alter table mensajes enable row level security;
