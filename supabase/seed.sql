-- SEED CONTOH (SAMPLE DATA) — bukan data asli. Hanya untuk development lokal.
-- Ganti '00000000-0000-0000-0000-000000000000' dengan id user penjual dari Supabase Auth
-- (buat user dulu via Dashboard > Authentication), lalu jalankan file ini.
insert into public.sellers (id, auth_user_id, store_name, whatsapp_number)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '[SAMPLE] Toko Contoh', '6281200000000');

insert into public.products (seller_id, name, price, stock) values
  ('11111111-1111-1111-1111-111111111111', '[SAMPLE] Keripik Singkong 200g', 15000, 30),
  ('11111111-1111-1111-1111-111111111111', '[SAMPLE] Sambal Bawang 150ml', 25000, 20),
  ('11111111-1111-1111-1111-111111111111', '[SAMPLE] Kopi Bubuk 250g', 40000, 12),
  ('11111111-1111-1111-1111-111111111111', '[SAMPLE] Kaos Polos Hitam L', 60000, 0);
