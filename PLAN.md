# Sistem Auto-Order UMKM — Rencana Project

## 1. Masalah
- Data BPS 2024: 94,76% usaha yang jualan online pakai aplikasi chat (WA dll), cuma 1,36% lewat website, 74,79% masih bayar tunai.
- Order lewat chat dicatat manual → pesanan kelewat, stok nggak sinkron, omzet nggak kelihatan.
- WhatsApp Business API resmi berbayar & perlu verifikasi Meta → mahal buat UMKM kecil.

**Solusi:** pembeli order lewat **bot Telegram** (gratis, resmi) atau **form web → wa.me** (teks pesanan otomatis terisi). Semua pesanan masuk ke **Supabase**, penjual pantau di **dashboard Next.js**.

## 2. Fitur MVP
**Pembeli**
- Bot Telegram: `/start`, lihat produk & stok, pilih produk + jumlah, pilih bayar (QRIS/COD), terima ringkasan pesanan.
- Form order web: pilih produk, isi data, pilih bayar → pesanan disimpan → buka `wa.me` dengan teks pesanan terisi.
- QRIS statis (gambar) + upload/kirim bukti bayar.

**Penjual (dashboard)**
- Login (Supabase Auth).
- Daftar pesanan + ubah status (menunggu → dibayar → diproses → dikirim → selesai / batal).
- Verifikasi pembayaran QRIS secara manual.
- CRUD produk & stok.
- Grafik omzet (harian/mingguan) + produk terlaris.

## 3. Di luar scope (bukan MVP)
- WhatsApp Business API resmi / Baileys (channel dibuat modular, bisa ditambah nanti).
- Payment gateway otomatis (Midtrans/Xendit, QRIS dinamis).
- Hitung ongkir otomatis, integrasi kurir.
- Multi-toko publik / marketplace, aplikasi mobile.

## 4. Tech Stack
| Bagian | Pilihan |
|---|---|
| Frontend + dashboard | Next.js (App Router) + TypeScript + Tailwind |
| Database & auth | Supabase (PostgreSQL, Auth, Storage buat QRIS/bukti bayar, RLS) |
| Bot | Telegram Bot API via webhook di Next.js Route Handler (mis. library grammY) |
| Chart | Recharts |
| Validasi | Zod |
| Deploy | Vercel |

## 5. Struktur Folder
```
umkm-order/
├─ app/
│  ├─ (shop)/order/page.tsx        # form order web → wa.me
│  ├─ dashboard/                   # orders, products, revenue
│  │  ├─ orders/page.tsx
│  │  ├─ products/page.tsx
│  │  └─ page.tsx                  # ringkasan + grafik omzet
│  ├─ login/page.tsx
│  └─ api/
│     ├─ telegram/webhook/route.ts # handler bot
│     └─ orders/route.ts           # create order (web)
├─ lib/
│  ├─ supabase/                    # client server & browser
│  ├─ channels/                    # telegram.ts, wame.ts (modular)
│  └─ orders.ts                    # logika order & stok bersama
├─ supabase/migrations/            # schema + RLS
├─ diagrams/                       # activity-order.puml, erd.puml (+ PNG)
├─ docs/case-study-syamxuanify.md
└─ README.md
```

## 6. Diagram
- Activity diagram alur order: `diagrams/activity-order.puml` / `.png`
- ERD: `diagrams/erd.puml` / `.png`

## 7. Milestone
1. **Minggu 1 — Fondasi:** setup repo, Next.js + Supabase, migration schema (ERD), RLS, auth penjual.
2. **Minggu 2 — Order web:** katalog produk, form order, simpan ke Supabase, redirect wa.me.
3. **Minggu 3 — Bot Telegram:** webhook, alur pilih produk → bayar → ringkasan, simpan order.
4. **Minggu 4 — Dashboard:** kelola pesanan & status, verifikasi QRIS, CRUD stok, grafik omzet.
5. **Minggu 5 — Polish & rilis:** testing, README + screenshot + diagram, deploy Vercel, demo live.
6. **Minggu 6 — Case study Syamxuanify:** pakai beneran, catat angka sebelum/sesudah (waktu proses order, pesanan kelewat), posting LinkedIn.

## 8. Usulan Nama Repo
1. `umkm-auto-order`
2. `orderin-umkm`
3. `chat-order-dashboard`
