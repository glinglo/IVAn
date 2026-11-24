-- Relleno de categoría para los gastos que ya existían antes de la migración 006.
-- Ejecutar a mano en el SQL Editor de Supabase (no lo ejecuta IVAn).

update gastos set categoria = 'software_ia'
  where categoria is null and (proveedor ilike '%anthropic%' or proveedor ilike '%replit%' or proveedor ilike '%cursor%');

update gastos set categoria = 'email'
  where categoria is null and (
    proveedor ilike '%salesforge%' or proveedor ilike '%zoho%' or proveedor ilike '%proton%'
    or proveedor ilike '%paddle%' or concepto ilike '%plataforma email%'
  );

update gastos set categoria = 'publicidad'
  where categoria is null and (
    proveedor ilike '%meta%' or concepto ilike '%shopify app store ads%' or concepto ilike '%servicio de marketing%'
  );

update gastos set categoria = 'hosting_dominios'
  where categoria is null and (
    proveedor ilike '%framer%' or proveedor ilike '%ionos%' or proveedor ilike '%fly.io%' or proveedor ilike '%cloudflare%'
    or concepto ilike '%dominio%' or concepto ilike '%hosting%' or concepto ilike '%servidor%'
  );

update gastos set categoria = 'apis_datos'
  where categoria is null and (proveedor ilike '%apify%' or proveedor ilike '%google cloud%');

update gastos set categoria = 'otros' where categoria is null;

-- Comprobación: debe dar 0.
select count(*) from gastos where categoria is null;
