-- ============================================================================
-- DATA DEMO — BUKAN DATA ASLI. Semua nama diawali [DEMO]. Hanya untuk demo/dev.
-- Jalankan SETELAH 0001_init.sql dan 0002_stock_quota_zones.sql.
-- Ganti '00000000-0000-0000-0000-000000000000' dengan id user penjual demo dari
-- Supabase Auth (Dashboard > Authentication > Add user), lalu jalankan file ini.
-- ============================================================================
insert into public.sellers (id, auth_user_id, store_name, whatsapp_number)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
        '[DEMO] Dapur Jajanan Contoh', '6281200000000');

insert into public.products (id, seller_id, name, price, stock, daily_quota, preorder_lead_days, aliases) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '[DEMO] Risol Mayo',      5000, 200, 50, 1, '{risol,risoles,rismay}'),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '[DEMO] Kue Lapis',       4000, 150, 40, 1, '{lapis,kue lapis legit}'),
  ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '[DEMO] Dadar Gulung',    3500, 120, 40, 1, '{dadar,kue dadar}'),
  ('22222222-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '[DEMO] Pastel Ayam',     5000, 100, 30, 1, '{pastel}'),
  ('22222222-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '[DEMO] Es Teh Manis',    3000,  80, null, 0, '{es teh,teh}'),
  ('22222222-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '[DEMO] Tumpeng Mini',   75000,  10, 3, 3, '{tumpeng}');

insert into public.delivery_zones (seller_id, name, fee) values
  ('11111111-1111-1111-1111-111111111111', '[DEMO] Kec. Cempaka (dekat)', 5000),
  ('11111111-1111-1111-1111-111111111111', '[DEMO] Kec. Melati', 10000),
  ('11111111-1111-1111-1111-111111111111', '[DEMO] Kec. Anggrek (jauh)', 15000);

-- Beberapa pesanan demo lewat create_order (stok & kuota ikut terpotong seperti order asli)
select public.create_order('11111111-1111-1111-1111-111111111111', 'web', 'cod',
  '[DEMO] Bu Sari', '081200000001', '[DEMO] Jl. Contoh No. 1', null,
  '[{"product_id":"22222222-0000-0000-0000-000000000001","qty":10},{"product_id":"22222222-0000-0000-0000-000000000002","qty":5}]',
  null, (select id from public.delivery_zones where name like '[DEMO] Kec. Melati%'));
select public.create_order('11111111-1111-1111-1111-111111111111', 'chat', 'qris',
  '[DEMO] Mas Budi', '081200000002', '[DEMO] Jl. Contoh No. 2', null,
  '[{"product_id":"22222222-0000-0000-0000-000000000003","qty":8}]',
  null, null);
