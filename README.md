# UMKM Auto-Order

Sistem order untuk UMKM yang **WhatsApp-first**: pembeli pesan lewat **form web → WhatsApp (wa.me)**, penjual bisa **menempel chat WA bebas** dan sistem mengubahnya jadi pesanan, semua tercatat di **Supabase**, lalu penjual memantau pesanan, stok, produksi per tanggal, dan omzet di **dashboard Next.js**. Gratis, tanpa WhatsApp Business API berbayar dan tanpa AI berbayar.

## Masalah
- Data BPS 2024: **94,76%** usaha yang jualan online memakai aplikasi chat (WA dll), hanya **1,36%** lewat website, dan **74,79%** masih bayar tunai.
- Order lewat chat dicatat manual → pesanan kelewat, stok tidak sinkron, kuota produksi jebol, omzet tidak kelihatan.
- WhatsApp Business API resmi berbayar & perlu verifikasi Meta → mahal untuk UMKM kecil.

## Channel
- **Utama: WhatsApp (wa.me).** Form web menyimpan pesanan lalu membuka WhatsApp dengan teks pesanan terisi. Chat WA bebas bisa ditempel penjual di dashboard (*Tempel Chat*).
- **Opsional: bot Telegram — mati secara default.** Aktifkan dengan `TELEGRAM_ENABLED=true`; jika tidak, `/api/telegram` mengembalikan 404. Alasan bukan channel utama: pembeli UMKM di Indonesia mayoritas memakai WhatsApp, dan di beberapa negara pendaftaran akun Telegram baru bisa diminta membayar *one-time SMS fee* (biaya verifikasi SMS) ([sumber](https://dripl.ai/blog/telegram-sms-fee)).

## Fitur
**Pembeli** (`/order`)
- Daftar produk, stok, dan sisa kuota produksi untuk tanggal yang dipilih.
- **Pre-order:** pilih tanggal kirim; produk dengan lead time (mis. H-3) otomatis membatasi tanggal paling cepat.
- **Zona antar:** pilih kecamatan/zona atau ambil sendiri; ongkir ditambahkan ke total.
- QRIS statis atau COD → WhatsApp terbuka dengan ringkasan pesanan, ongkir, dan tanggal kirim.

**Penjual** (`/dashboard`, login email Supabase Auth)
- **Tempel Chat jadi Order:** tempel chat seperti `kak risol 2, kue lapis 1, cod ya, kirim ke Jl. Mawar 3` → parser rule-based (nama + alias produk, typo ringan, jumlah `2`/`dua`/`2x`/`x2`/`selusin`, COD/QRIS, alamat) → pratinjau yang bisa diedit → buat pesanan. Deterministik, tanpa AI; bagian yang tidak dikenali ditampilkan.
- **Produksi:** daftar jumlah yang harus dibuat per tanggal kirim (14 hari ke depan) beserta pemakaian kuota.
- Pesanan + ubah status (menunggu → dibayar → diproses → dikirim → selesai / batal).
- Produk: harga, stok, kuota/hari, lead time pre-order, alias.
- Zona antar & ongkir.
- **Bagikan:** link toko + QR code (dibuat di browser, bisa diunduh PNG).
- Grafik omzet 14 hari.

**Stok & kuota (fungsi DB `create_order`)**
- Baris produk dikunci `FOR UPDATE` (urutan id tetap untuk hindari deadlock), stok & kuota dicek lalu **stok langsung dikurangi** dalam satu transaksi → tidak bisa oversell walau banyak order bersamaan.
- Pesanan diubah ke **batal** → trigger mengembalikan stok; pesanan batal tidak bisa diaktifkan lagi (mencegah stok terpotong dua kali).

**Keamanan**
- Validasi input di server (Zod); harga, ongkir, dan total dihitung di database, bukan dari browser.
- Row Level Security aktif di semua tabel; insert pesanan hanya lewat server (service role). Penjual hanya bisa meng-update kolom `status`/`payment_proof_url` pesanan (column-level grant).
- Fungsi `security definer` memakai `search_path = public, pg_temp`; `create_order` & `quota_remaining` hanya bisa dipanggil `service_role`.
- Webhook Telegram (jika diaktifkan) diverifikasi lewat header `X-Telegram-Bot-Api-Secret-Token` (perbandingan timing-safe).

## Tech Stack
Next.js 16.4.3 (App Router) · React 19.3.1 · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, RLS) · Zod · Recharts · qrcode · Vitest · Node.js 24

## Demo
> **Semua data demo diberi label `[DEMO]` dan bukan data asli.**

1. Ikuti *Setup* di bawah, jalankan `supabase/seed.sql` (toko `[DEMO] Dapur Jajanan Contoh`: 6 produk jajanan dengan kuota & pre-order, 3 zona antar, 2 pesanan contoh).
2. Coba:
   - `/order` → pilih **[DEMO] Tumpeng Mini** (pre-order H-3, kuota 3/hari) dan lihat tanggal paling cepat berubah.
   - `/dashboard/tempel-chat` → tempel `kak risol 2, kue lapis 1, cod ya, kirim ke Jl. Mawar 3`.
   - `/dashboard/produksi` → lihat daftar produksi per tanggal.
   - `/dashboard/orders` → ubah pesanan ke `batal`, lalu cek stok kembali di `/dashboard/products`.
   - `/dashboard/bagikan` → unduh QR toko.
3. Akun demo: buat sendiri di Supabase Auth (email/password demo) — kredensial tidak disimpan di repo.

### Screenshot
> _Placeholder — belum ada screenshot asli. Lihat [`docs/screenshots/`](docs/screenshots/README.md)._
<!-- ![Halaman order](docs/screenshots/order.png) -->
<!-- ![Tempel chat](docs/screenshots/tempel-chat.png) -->
<!-- ![Produksi](docs/screenshots/produksi.png) -->
<!-- ![Bagikan + QR](docs/screenshots/bagikan.png) -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->

## Diagram
### Activity Diagram — Alur Order
![Activity diagram](diagrams/activity-order.png)

Sumber: [`diagrams/activity-order.puml`](diagrams/activity-order.puml)

### ERD
![ERD](diagrams/erd.png)

Sumber: [`diagrams/erd.puml`](diagrams/erd.puml)

## Setup
1. Pakai Node.js 24 (`nvm use`), lalu `npm install`.
2. Buat project di [Supabase](https://supabase.com), lalu jalankan berurutan di SQL Editor: `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_stock_quota_zones.sql`.
3. Buat user penjual di **Authentication > Users**, salin id-nya ke `supabase/seed.sql` (data **[DEMO]**), lalu jalankan seed.
4. `cp .env.example .env.local` dan isi nilainya. `SUPABASE_SERVICE_ROLE_KEY` **rahasia**, jangan diberi prefix `NEXT_PUBLIC_`. Isi `NEXT_PUBLIC_SITE_URL` untuk link/QR toko.
5. `npm run dev` → buka http://localhost:3000/order dan http://localhost:3000/dashboard.

## Test
- `npm test` — unit test parser *Tempel Chat* (Vitest).
- `supabase/tests/run.sh` — uji migrasi + seed + stok/kuota/batal + **uji konkurensi** (order paralel) di PostgreSQL lokal memakai stub minimal Supabase (`supabase/tests/_supabase_stub.sql`). Butuh `psql` dan akses superuser lokal.

### Bot Telegram (opsional)
1. Set `TELEGRAM_ENABLED=true`, buat bot lewat [@BotFather](https://t.me/BotFather), isi `TELEGRAM_BOT_TOKEN` & `TELEGRAM_WEBHOOK_SECRET`.
2. Setelah app online (HTTPS), daftarkan webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<domain>/api/telegram" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
3. Order via Telegram memakai tanggal kirim paling cepat yang diizinkan dan tanpa zona antar.

## Batasan
- Satu toko (`STORE_SELLER_ID`).
- Bukti bayar QRIS dikirim lewat chat; upload ke Supabase Storage belum ada.
- Parser Tempel Chat berbasis aturan: hasil selalu perlu dicek di pratinjau sebelum disimpan.
- Pesanan yang sudah `batal` bersifat final (buat pesanan baru bila perlu).
- Tanggal "hari ini" untuk pre-order/kuota memakai zona Asia/Jakarta.

## Lisensi
[MIT](LICENSE)
