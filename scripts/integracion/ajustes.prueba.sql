-- Datos ficticios para las pruebas (los reales van en ajustes.local.sql, fuera del repo)
insert into titulares (nombre, nif) values ('Persona de Prueba', '00000000T') on conflict (nif) do nothing;
insert into ajustes (id, nombre, nif, direccion, email, iban, serie, ultimo_numero, digitos_numero, cuota_autonomo_mensual)
values (1, 'Persona de Prueba', '00000000T', 'Calle Falsa 123, 08320 El Masnou', 'prueba@example.com',
        'ES00 0000 0000 0000 0000 0000', '', 336, 5, 452)
on conflict (id) do update set ultimo_numero = excluded.ultimo_numero;
