import { Suspense } from "react";
import { connection } from "next/server";
import { listActiveProducts } from "@/lib/orders";
import OrderForm from "./order-form";


async function Catalog() {
  await connection();
  let products: Awaited<ReturnType<typeof listActiveProducts>> = [];
  let loadError = false;
  try { products = await listActiveProducts(); } catch { loadError = true; }
  return loadError ? (
    <p className="mt-6 rounded bg-red-50 p-3 text-red-700">Produk belum bisa dimuat. Cek konfigurasi Supabase.</p>
  ) : (
    <OrderForm products={products} qrisUrl={process.env.NEXT_PUBLIC_QRIS_IMAGE_URL || null} />
  );
}

export default function OrderPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Pesan Sekarang</h1>
      <p className="text-sm text-zinc-500">Pilih produk, isi data, lalu pesanan dikirim ke WhatsApp penjual.</p>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Memuat produk...</p>}>
        <Catalog />
      </Suspense>
    </main>
  );
}
