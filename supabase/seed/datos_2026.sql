-- Datos 2026 importados del libro de la gestoría (Selfconta). Ejecutar después de 001_init.sql y ajustes.local.sql.
insert into clientes (id, nombre, pais, nif, direccion, tipo, idioma, iva_pct, retencion_pct) values
  ('11111111-1111-4111-8111-111111111111', 'Zapflow Oy', 'FI', 'FI26899624', null, 'ue', 'en', 21, 15),
  ('22222222-2222-4222-8222-222222222222', 'Volta Cultural SL', 'ES', 'B23853039', null, 'nacional', 'es', 21, 15)
on conflict (id) do nothing;

insert into facturas (numero, fecha, cliente_id, concepto, base, iva_pct, iva, retencion_pct, retencion, total, tipo, mencion, estado, emitida_at) values
  ('00326', '2026-01-30', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (January 2026) + Cursor subscription', 3020, 0, 0.0, 0, 0, 3020.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-01-30'),
  ('00327', '2026-02-27', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (February 2026) + Cursor subscription', 3020, 0, 0.0, 0, 0, 3020.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-02-27'),
  ('00328', '2026-03-31', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (March 2026) + Cursor subscription', 3020, 0, 0.0, 0, 0, 3020.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-03-31'),
  ('00329', '2026-04-30', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (April 2026) + Cursor subscription', 3020, 0, 0.0, 0, 0, 3020.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-04-30'),
  ('00330', '2026-05-30', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (May 2026) + Cursor subscription', 3020, 0, 0.0, 0, 0, 3020.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-05-30'),
  ('00331', '2026-06-30', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (June 2026) + Cursor subscription', 2720, 0, 0.0, 0, 0, 2720.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-06-30'),
  ('00332', '2026-07-31', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (July 2026) + Cursor subscription', 3020, 0, 0.0, 0, 0, 3020.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-07-31'),
  ('00333', '2026-08-05', '22222222-2222-4222-8222-222222222222', 'Disseny i implementació de la plataforma web impulsa.', 1020, 21, 214.2, 15, 153, 1081.2, 'nacional', null, 'emitida', '2026-08-05'),
  ('00334', '2026-08-31', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (August 2026) + Cursor subscription', 1520, 0, 0.0, 0, 0, 1520.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-08-31'),
  ('00335', '2026-09-30', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (September 2026) + Cursor subscription', 3020, 0, 0.0, 0, 0, 3020.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-09-30'),
  ('00336', '2026-10-30', '11111111-1111-4111-8111-111111111111', 'UX services for Zapflow platform (October 2026) + Cursor subscription', 3060, 0, 0.0, 0, 0, 3060.0, 'ue', 'Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE). Reverse charge: VAT to be accounted for by the recipient.', 'emitida', '2026-10-30')
on conflict (numero) do nothing;

insert into gastos (fecha, proveedor, pais, nif, numero_factura, concepto, tipo, base, iva, estado) values
  ('2026-01-03', 'Salesforge', 'EE', '102636767', '64234', 'servicio de email', 'ISP UE', 41.0, 0.0, 'confirmado'),
  ('2026-01-07', 'ExportApollo', null, '19806', 'EA-25176', 'servicio de marketing', 'ISP fuera UE', 60.68, 0.0, 'confirmado'),
  ('2026-01-14', 'Framer B.v.', 'NL', '853695386B01', '97A706DA-1920528', 'servicio de web hosting', 'ISP UE', 180.0, 0.0, 'confirmado'),
  ('2026-01-14', 'Replit', 'US', '1001', 'QTWS4N8M-0002', 'Programa informatico.', 'ISP fuera UE', 25.49, 0.0, 'confirmado'),
  ('2026-01-20', 'Replit', 'US', '1001', 'OLPFVA-00006', 'Programa informatico.', 'ISP fuera UE', 52.73, 0.0, 'confirmado'),
  ('2026-01-21', 'Paddle.com Market Ltd', 'GB', 'EU372017215', '#77964357-157190021', 'Unicorn platform Site Monthly', 'Sin IVA deducible', 14.74, 0.0, 'confirmado'),
  ('2026-01-21', 'Shopif Inc', 'CA', '847871746', 'SHOP-COM-477773216', 'Tarifa de registro en la App Store', 'ISP fuera UE', 16.0, 0.0, 'confirmado'),
  ('2026-01-22', 'Anthropic, PBC', 'US', '90375', 'HHLYS3DF-0005', 'compra software desarrollo', 'ISP fuera UE', 16.87, 0.0, 'confirmado'),
  ('2026-01-23', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0001', 'compra software desarrollo', 'ISP fuera UE', 18.0, 0.0, 'confirmado'),
  ('2026-01-24', 'Salesforge', 'EE', '102636767', '17228366', 'servicio de email', 'ISP UE', 25.28, 0.0, 'confirmado'),
  ('2026-01-26', 'Proton AG', 'CH', '354686492', '17228365', 'servicio de correo electrónico', 'ISP fuera UE', 7.99, 0.0, 'confirmado'),
  ('2026-01-30', 'Surfer Sp. z o.o.', 'PL', '8971860264', 'F/07834/01/2026', 'servicio de marketing', 'ISP UE', 40.79, 0.0, 'confirmado'),
  ('2026-01-31', 'Google Cloud EMEA Limited', 'IE', '3668997OH', '5477764126', 'servicio de correo electrónico para el dominio basta.me', 'ISP UE', 81.6, 0.0, 'confirmado'),
  ('2026-02-01', 'Anthropic, PBC', 'US', '90375', '8KEKLKOG-0003', 'compra software desarrollo', 'ISP fuera UE', 8.44, 0.0, 'confirmado'),
  ('2026-02-03', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0002', 'compra software desarrollo', 'ISP fuera UE', 78.47, 0.0, 'confirmado'),
  ('2026-02-03', 'Salesforge', 'EE', '102636767', '67826', 'servicio de email', 'ISP UE', 41.0, 0.0, 'confirmado'),
  ('2026-02-03', 'Cursor', 'US', '801', 'HHLYS3DF-0006', 'Programa informático', 'ISP fuera UE', 56.19, 0.0, 'confirmado'),
  ('2026-02-12', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'P33Z6BMM32', 'meta ads', 'ISP UE', 2.54, 0.0, 'confirmado'),
  ('2026-02-13', 'Meta Platforms Ireland Limited', 'IE', '9692928F', '7FKVJDRM32', 'meta ads', 'ISP UE', 4.24, 0.0, 'confirmado'),
  ('2026-02-14', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'RH87ZBHN32', 'meta ads', 'ISP UE', 5.08, 0.0, 'confirmado'),
  ('2026-02-14', 'Meta Platforms Ireland Limited', 'IE', '9692928F', '3TUTTDZM32', 'meta ads', 'ISP UE', 3.39, 0.0, 'confirmado'),
  ('2026-02-14', 'Replit', 'US', '1001', 'OLPFVA-00007', 'Programa informatico.', 'ISP fuera UE', 31.86, 0.0, 'confirmado'),
  ('2026-02-15', 'Meta Platforms Ireland Limited', 'IE', '9692928F', '65F7FDDN32', 'meta ads', 'ISP UE', 5.93, 0.0, 'confirmado'),
  ('2026-02-16', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'LC9DKC9N32', 'meta ads', 'ISP UE', 6.78, 0.0, 'confirmado'),
  ('2026-02-18', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'X959KBVM32', 'meta ads', 'ISP UE', 7.63, 0.0, 'confirmado'),
  ('2026-02-23', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'FJVVBERM32', 'meta ads', 'ISP UE', 19.49, 0.0, 'confirmado'),
  ('2026-02-25', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'QV5EBCMM32', 'meta ads', 'ISP UE', 19.49, 0.0, 'confirmado'),
  ('2026-02-26', 'Proton AG', 'CH', '354686492', 'OLPFVA-00008', 'servicio de correo electrónico', 'ISP fuera UE', 7.99, 0.0, 'confirmado'),
  ('2026-02-27', 'Salesforge', 'EE', '102636767', '70513', 'servicio de email', 'ISP UE', 25.42, 0.0, 'confirmado'),
  ('2026-03-01', 'Meta Platforms Ireland Limited', 'IE', '9692928F', '8Q5KGDMN32', 'meta ads', 'ISP UE', 28.46, 0.0, 'confirmado'),
  ('2026-03-03', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0003', 'compra software desarrollo', 'ISP fuera UE', 90.0, 0.0, 'confirmado'),
  ('2026-03-03', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'A3NPFDHN32', 'meta ads', 'ISP UE', 28.46, 0.0, 'confirmado'),
  ('2026-03-04', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'TE6WHFZM32', 'meta ads', 'ISP UE', 8.02, 0.0, 'confirmado'),
  ('2026-03-10', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'Y4JR2GZM32', 'meta ads', 'ISP UE', 28.65, 0.0, 'confirmado'),
  ('2026-03-12', 'ionos cloud SLU', 'ES', 'B85049435', '311100201590', 'servicio de hosting e email', 'IVA soportado', 11.5, 2.42, 'confirmado'),
  ('2026-03-21', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'MGVH3HZM32', 'meta ads', 'ISP UE', 47.75, 0.0, 'confirmado'),
  ('2026-04-01', 'Fly.io, Inc.', 'US', '4990', 'D6VP43UT-0005', 'servidor', 'ISP fuera UE', 17.27, 0.0, 'confirmado'),
  ('2026-04-03', 'Salesforge', 'EE', '102636767', '76604', 'servicio de email', 'ISP UE', 41.0, 0.0, 'confirmado'),
  ('2026-04-03', 'Salesforge', 'EE', '102636767', '71661', 'servicio de email', 'ISP UE', 41.0, 0.0, 'confirmado'),
  ('2026-04-03', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0004', 'compra software desarrollo', 'ISP fuera UE', 90.0, 0.0, 'confirmado'),
  ('2026-04-04', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'ZA4XWG9N32', 'meta ads', 'ISP UE', 19.96, 0.0, 'confirmado'),
  ('2026-04-09', 'Anthropic, PBC', 'US', '90375', '8KEKLKOG-0006', 'compra software desarrollo', 'ISP fuera UE', 17.08, 0.0, 'confirmado'),
  ('2026-04-19', 'Shopif Inc', 'CA', '847871746', 'D6VP43UT-0006', 'Shopify app store ads', 'ISP fuera UE', 25.2, 0.0, 'confirmado'),
  ('2026-04-24', 'Salesforge', 'EE', '102636767', '80615', 'servicio de email', 'ISP UE', 25.42, 0.0, 'confirmado'),
  ('2026-04-30', 'Zoho Corporation B.V.', 'NL', '855264263B01', '311100236862', 'compra de software', 'ISP UE', 21.6, 0.0, 'confirmado'),
  ('2026-04-30', 'ionos cloud SLU', 'ES', 'B85049435', '311100236861', 'servicio de hosting e email', 'IVA soportado', 1.0, 0.21, 'confirmado'),
  ('2026-05-01', 'Fly.io, Inc.', 'US', '4990', 'EJEIABC8-0003', 'servidor', 'ISP fuera UE', 17.27, 0.0, 'confirmado'),
  ('2026-05-03', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0005', 'compra software desarrollo', 'ISP fuera UE', 18.0, 0.0, 'confirmado'),
  ('2026-05-03', 'Salesforge', 'EE', '102636767', '82061', 'servicio de email', 'ISP UE', 41.0, 0.0, 'confirmado'),
  ('2026-05-04', 'Meta Platforms Ireland Limited', 'IE', '9692928F', 'EJEIABC8-0004', 'meta ads', 'ISP UE', 40.64, 0.0, 'confirmado'),
  ('2026-05-10', 'Figma Inc', 'US', '94102', 'BDYVCL4H-0001', 'licencia de software', 'ISP fuera UE', 20.0, 0.0, 'confirmado'),
  ('2026-05-12', 'ionos cloud SLU', 'ES', 'B85049435', '311100311728', 'servicio de hosting e email', 'IVA soportado', 1.0, 0.21, 'confirmado'),
  ('2026-05-15', 'Anthropic, PBC', 'US', '90375', '8KEKLKOG-0007', 'compra software desarrollo', 'ISP fuera UE', 8.58, 0.0, 'confirmado'),
  ('2026-05-20', 'Shopif Inc', 'CA', '847871746', '533104373', 'Shopify app store ads', 'ISP fuera UE', 6.86, 0.0, 'confirmado'),
  ('2026-05-24', 'Salesforge', 'EE', '102636767', '86243', 'servicio de email', 'ISP UE', 25.42, 0.0, 'confirmado'),
  ('2026-06-01', 'Apify Technologies s.r.o.', 'CZ', '04788290', '#202606011851', 'Servicio de APIs', 'ISP UE', 25.4, 0.0, 'confirmado'),
  ('2026-06-02', 'Fly.io, Inc.', 'US', '4990', 'EJEIABC8-0004', 'server', 'ISP fuera UE', 17.27, 0.0, 'confirmado'),
  ('2026-06-03', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0006', 'compra software desarrollo', 'ISP fuera UE', 18.0, 0.0, 'confirmado'),
  ('2026-06-04', 'Cloudflare, Inc.', 'US', '27-0805829', 'IN-67254545', 'domain', 'ISP fuera UE', 9.64, 0.0, 'confirmado'),
  ('2026-07-01', 'Apify Technologies s.r.o.', 'CZ', '04788290', '#202607011565', 'Servicio de APIs', 'ISP UE', 25.4, 0.0, 'confirmado'),
  ('2026-07-01', 'Fly.io, Inc.', 'US', '4990', 'EJEIABC8-0005', 'server', 'ISP fuera UE', 17.27, 0.0, 'confirmado'),
  ('2026-07-01', '10DENCEHISPAHARD, S.L.', 'ES', 'B62844725', '12207368', 'Dominio', 'IVA soportado', 18.55, 3.9, 'confirmado'),
  ('2026-07-03', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0007', 'compra software desarrollo', 'ISP fuera UE', 18.0, 0.0, 'confirmado'),
  ('2026-07-31', 'Paddle.com Market Ltd', 'GB', 'GB150848114', '#202607011566', 'plataforma email', 'Sin IVA deducible', 5.4, 0.0, 'confirmado'),
  ('2026-08-01', 'Apify Technologies s.r.o.', 'CZ', '04788290', '#202608010440', 'Servicio de APIs', 'ISP UE', 25.4, 0.0, 'confirmado'),
  ('2026-08-03', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0008', 'compra software desarrollo', 'ISP fuera UE', 18.0, 0.0, 'confirmado'),
  ('2026-09-01', 'Apify Technologies s.r.o.', 'CZ', '04788290', '202609011813', 'Servicio de APIs', 'ISP UE', 25.4, 0.0, 'confirmado'),
  ('2026-09-03', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0009', 'compra software desarrollo', 'ISP fuera UE', 18.0, 0.0, 'confirmado'),
  ('2026-09-07', 'Paddle.com Market Ltd', 'GB', 'GB150848114', '1675-573904', 'plataforma email', 'ISP fuera UE', 4.46, 0.0, 'confirmado'),
  ('2026-09-15', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0010', 'compra software desarrollo', 'ISP fuera UE', 79.0, 0.0, 'confirmado'),
  ('2026-10-15', 'Anthropic, PBC', 'US', '90375', 'D6VP43UT-0011', 'compra software desarrollo', 'ISP fuera UE', 90.0, 0.0, 'confirmado');

-- Mac: 623,76 €/año en el P&L de la gestoría = 26 % de 2.399,08 € sin IVA. Fecha de compra aproximada (2025).
insert into bienes_inversion (descripcion, fecha_compra, fecha_aproximada, base, pct_anual)
values ('MacBook', '2025-01-01', true, 2399.08, 26);

-- Trimestrales de 2026 ya presentados por la gestoría (importes por confirmar)
insert into presentaciones (modelo, anio, trimestre, importe, notas) values
  ('303', 2026, 1, null, 'Gestoría'), ('130', 2026, 1, null, 'Gestoría'), ('349', 2026, 1, null, 'Gestoría'),
  ('303', 2026, 2, null, 'Gestoría'), ('130', 2026, 2, null, 'Gestoría'), ('349', 2026, 2, null, 'Gestoría'),
  ('303', 2026, 3, null, 'Gestoría'), ('130', 2026, 3, null, 'Gestoría'), ('349', 2026, 3, null, 'Gestoría')
on conflict (modelo, anio, trimestre) do nothing;
