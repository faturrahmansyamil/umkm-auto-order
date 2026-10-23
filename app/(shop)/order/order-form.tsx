"use client";
import { useMemo, useState, useTransition } from "react";
import { submitOrder } from "./actions";
import { rupiah, type Product } from "@/lib/types";

export default function OrderForm({ products, qrisUrl }: { products: Product[]; qrisUrl: string | null }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<"qris" | "cod">("cod");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ waUrl: string; orderId: string } | null>(null);
  const [pending, start] = useTransition();

  const total = useMemo(
    () => products.reduce((s, p) => s + (cart[p.id] ?? 0) * p.price, 0),
    [cart, products],
  );
  const setQty = (p: Product, q: number) =>
    setCart((c) => ({ ...c, [p.id]: Math.max(0, Math.min(p.stock, q)) }));

  function onSubmit(fd: FormData) {
    setError(null);
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([product_id, qty]) => ({ product_id, qty }));
    if (!items.length) return setError("Keranjang masih kosong");
    start(async () => {
      const res = await submitOrder({
        name: String(fd.get("name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        address: String(fd.get("address") ?? ""),
        payment_method: payment,
        items,
      });
      if (!res.ok) return setError(res.error);
      setDone(res);
      window.open(res.waUrl, "_blank", "noopener,noreferrer");
    });
  }

  if (done)
    return (
      <div className="mt-6 space-y-3 rounded border p-4">
        <p className="font-semibold">Pesanan tersimpan (status: menunggu).</p>
        <a className="inline-block rounded bg-green-600 px-4 py-2 text-white" href={done.waUrl} target="_blank" rel="noopener noreferrer">
          Kirim pesan WA ke penjual
        </a>
        {payment === "qris" && (
          <div>
            <p className="text-sm">Bayar via QRIS lalu kirim bukti bayar lewat WA.</p>
            {qrisUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrisUrl} alt="QRIS toko" className="mt-2 w-60" />
            ) : (
              <p className="text-sm text-zinc-500">Gambar QRIS belum diatur penjual.</p>
            )}
          </div>
        )}
      </div>
    );

  return (
    <form action={onSubmit} className="mt-6 space-y-6">
      <ul className="divide-y rounded border">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-4 p-3">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-zinc-500">{rupiah(p.price)} · stok {p.stock}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="h-8 w-8 rounded border" onClick={() => setQty(p, (cart[p.id] ?? 0) - 1)}>-</button>
              <span className="w-6 text-center">{cart[p.id] ?? 0}</span>
              <button type="button" disabled={p.stock === 0} className="h-8 w-8 rounded border disabled:opacity-40" onClick={() => setQty(p, (cart[p.id] ?? 0) + 1)}>+</button>
            </div>
          </li>
        ))}
        {!products.length && <li className="p-3 text-zinc-500">Belum ada produk.</li>}
      </ul>
      <p className="text-right font-semibold">Total: {rupiah(total)}</p>
      <div className="grid gap-3">
        <input name="name" required minLength={2} maxLength={100} placeholder="Nama" className="rounded border p-2" />
        <input name="phone" required pattern="[0-9+\- ]{8,20}" placeholder="No. HP" className="rounded border p-2" />
        <textarea name="address" maxLength={500} placeholder="Alamat (untuk dikirim)" className="rounded border p-2" />
        <fieldset className="flex gap-4">
          {(["cod", "qris"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name="pay" checked={payment === m} onChange={() => setPayment(m)} /> {m.toUpperCase()}
            </label>
          ))}
        </fieldset>
      </div>
      {error && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
      <button disabled={pending} className="w-full rounded bg-black py-3 text-white disabled:opacity-50">
        {pending ? "Menyimpan..." : "Pesan via WhatsApp"}
      </button>
    </form>
  );
}
