-- IVA de los gastos por tipo: desglose por línea (tal como lo pone la factura), y si un gasto de
-- restaurante es manutención propia o una atención a clientes (art. 96.Uno.5º y 6º LIVA).

alter table gastos add column if not exists desglose jsonb not null default '[]';
alter table gastos add column if not exists uso text;
do $$ begin
  alter table gastos add constraint gastos_uso_check check (uso in ('manutencion', 'atencion_cliente'));
exception when duplicate_object then null; end $$;
-- Límite diario de manutención: 26,67 € en España, 48,08 € en el extranjero; con pernocta, 53,34 € y 91,35 €.
alter table gastos add column if not exists manutencion_limite numeric(6,2);

-- Backfill: a los gastos "IVA soportado" que ya existen les pone una línea de desglose si su
-- IVA/base da un tipo español entero (4, 10 o 21 %). Si no da un tipo exacto (por redondeo de
-- céntimos u otro motivo), se deja sin desglose (desglose = '[]'); el aviso de abajo los lista.
update gastos
   set desglose = jsonb_build_array(jsonb_build_object(
         'pct', round(iva / base * 100),
         'base', base,
         'cuota', iva
       ))
 where tipo = 'IVA soportado'
   and base is not null and base <> 0
   and round(iva / base * 100) in (4, 10, 21);

do $$
declare
  v_sin_desglose int;
begin
  select count(*) into v_sin_desglose
    from gastos
   where tipo = 'IVA soportado'
     and base is not null and base <> 0
     and jsonb_array_length(desglose) = 0;
  if v_sin_desglose > 0 then
    raise notice '% gasto(s) "IVA soportado" sin un tipo de IVA español exacto en el backfill: revisar a mano (desglose vacío)', v_sin_desglose;
  end if;
end $$;
