-- Almacenamiento privado para los PDF de facturas y las fotos/PDF de gastos (solo Supabase)
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict (id) do nothing;
