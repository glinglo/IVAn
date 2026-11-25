alter table bienes_inversion add column if not exists subvencion numeric(12,2) not null default 0;
comment on column bienes_inversion.subvencion is 'Subvención de capital que financió el bien. Se imputa como ingreso en proporción a la amortización.';
