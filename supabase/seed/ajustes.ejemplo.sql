-- Plantilla: cópiala como ajustes.local.sql (está en .gitignore), pon tus datos y ejecútala
-- después de las migraciones (001, 002, 003) y antes de datos_2026.sql.
insert into ajustes (id, nombre, nif, direccion, email, telefono, iban, serie, ultimo_numero, digitos_numero, cuota_autonomo_mensual, emitir_desde)
values (1, 'Nombre Apellidos', '00000000X', 'Calle, número, CP Municipio (Provincia)', 'tu@email.com', null,
        'ES00 0000 0000 0000 0000 0000', '', 336, 5, 452,
        '2027-01-01')  -- modo paralelo con Selfconta: IVAn emite desde el 1/1/2027
on conflict (id) do update set
  nombre = excluded.nombre, nif = excluded.nif, direccion = excluded.direccion, email = excluded.email,
  telefono = excluded.telefono, iban = excluded.iban, ultimo_numero = excluded.ultimo_numero,
  cuota_autonomo_mensual = excluded.cuota_autonomo_mensual, emitir_desde = excluded.emitir_desde;
