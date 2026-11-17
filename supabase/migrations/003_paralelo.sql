-- Modo paralelo con otro programa de facturación (Selfconta) y registro de sus facturas.

-- Hasta esta fecha las facturas se emiten fuera e IVAn solo las registra. null = IVAn emite.
alter table ajustes add column if not exists emitir_desde date;

-- 'ivan' = emitida por IVAn · 'externa' = emitida en otro programa y registrada aquí con su número
alter table facturas add column if not exists origen text not null default 'ivan';
do $$ begin
  alter table facturas add constraint facturas_origen_check check (origen in ('ivan', 'externa'));
exception when duplicate_object then null; end $$;
-- Número que trae el PDF de la factura externa mientras está pendiente de registrar
alter table facturas add column if not exists numero_externo text;

-- La emisión de IVAn queda bloqueada en modo paralelo (también aquí, por si algo se salta el bot).
create or replace function emitir_factura(p_factura_id uuid)
returns text
language plpgsql
as $$
declare
  v_num int;
  v_numero text;
  v_estado text;
  v_origen text;
  v_desde date;
begin
  select emitir_desde into v_desde from ajustes where id = 1;
  if v_desde is not null and (now() at time zone 'Europe/Madrid')::date < v_desde then
    raise exception 'Modo paralelo hasta el %: emítela en el otro programa y registra aquí su PDF', to_char(v_desde, 'DD/MM/YYYY');
  end if;

  select estado, origen into v_estado, v_origen from facturas where id = p_factura_id for update;
  if v_estado is null then raise exception 'Factura no encontrada'; end if;
  if v_estado <> 'borrador' then raise exception 'La factura ya está %', v_estado; end if;
  if v_origen <> 'ivan' then raise exception 'Esta factura viene de otro programa: se registra, no se emite'; end if;

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

-- Registra una factura emitida en otro programa con SU número. Solo admite la siguiente de la
-- serie, para que la numeración siga sin huecos, y mueve el contador para que IVAn continúe.
create or replace function registrar_factura_externa(p_factura_id uuid)
returns text
language plpgsql
as $$
declare
  v_ultimo int;
  v_esperado text;
  v_ultimo_txt text;
  v_estado text;
  v_origen text;
  v_numero text;
begin
  select ultimo_numero, serie || lpad((ultimo_numero + 1)::text, digitos_numero, '0'),
         serie || lpad(ultimo_numero::text, digitos_numero, '0')
    into v_ultimo, v_esperado, v_ultimo_txt
    from ajustes where id = 1 for update;
  if v_ultimo is null then raise exception 'Faltan tus datos en la tabla ajustes'; end if;

  select estado, origen, numero_externo into v_estado, v_origen, v_numero
    from facturas where id = p_factura_id for update;
  if v_estado is null then raise exception 'Factura no encontrada'; end if;
  if v_estado <> 'borrador' then raise exception 'La factura ya está %', v_estado; end if;
  if v_origen <> 'externa' or v_numero is null then raise exception 'No es una factura de otro programa'; end if;
  if exists (select 1 from facturas where numero = v_numero) then
    raise exception 'La % ya está en el libro', v_numero;
  end if;
  if v_numero <> v_esperado then
    raise exception 'Toca registrar la % (la última es la %) y esta es la %. Registra antes las que falten.', v_esperado, v_ultimo_txt, v_numero;
  end if;

  update ajustes set ultimo_numero = v_ultimo + 1 where id = 1;
  update facturas
     set numero = v_numero, numero_externo = null, estado = 'emitida', emitida_at = now()
   where id = p_factura_id;
  return v_numero;
end;
$$;
