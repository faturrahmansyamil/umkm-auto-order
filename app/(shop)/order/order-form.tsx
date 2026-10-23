"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { getQuota, submitOrder } from "./actions";
import { jakartaDate, rupiah, type Product, type Zone } from "@/lib/types";

export default function OrderForm({ products, zones, qrisUrl }: { products: Product[]; zones: Zone[]; qrisUrl: string | null }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [date, setDate] = useState(() => jakartaDate(0));
  const [zoneId, setZoneId] = useState<string>("");
  const [quota, setQuota] = useState<Record<string, number | null>>({});
  const [payment, setPayment] = useState<"qris" | "cod">("cod");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ waUrl: string; orderId: string; deliveryDate: string } | null>(null);
  const [pending, start] = useTransition();

  const subtotal = useMemo(
    () => products.reduce((s, p) => s + (cart[p.id] ?? 0) * p.price, 0),
    [cart, products],
  );
  const fee = zones.find((z) => z.id === zoneId)?.fee ?? 0;
  const total = subtotal + fee;
  // Pre-order: tanggal paling cepat = hari ini + lead time terbesar di keranjang
  const minLead = products.reduce((m, p) => ((cart[p.id] ?? 0) > 0 ? Math.max(m, p.preorder_lead_days) : m), 0);
  const minDate = jakartaDate(minLead);
  const maxDate = jakartaDate(30);
  const effectiveDate = date < minDate ? minDate : date;

  useEffect(() => {
    let alive = true;
    getQuota(effectiveDate).then((q) => { if (alive) setQuota(q); });
    return () => { alive = false; };
  }, [effectiveDate]);

  const maxFor = (p: Product) => {
    const q = quota[p.id];
    return q === null || q === undefined ? p.stock : Math.min(p.stock, q);
  };
  const setQty = (p: Product, q: number) =>
    setCart((c) => ({ ...c, [p.id]: Math.max(0, Math.min(maxFor(p), q)) }));

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
        delivery_date: effectiveDate,
        delivery_zone_id: zoneId || null,
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
        <p className="font-semibold">Pesanan tersimpan (status: menunggu), tanggal kirim {done.deliveryDate}.</p>
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
              <p className="text-sm text-zinc-500">
                {rupiah(p.price)} · stok {p.stock}
                {p.daily_quota !== null && ` · sisa kuota ${effectiveDate}: ${quota[p.id] ?? "…"}`}
                {p.preorder_lead_days > 0 && ` · pre-order H-${p.preorder_lead_days}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="h-8 w-8 rounded border" onClick={() => setQty(p, (cart[p.id] ?? 0) - 1)}>-</button>
              <span className="w-6 text-center">{cart[p.id] ?? 0}</span>
              <button type="button" disabled={maxFor(p) <= (cart[p.id] ?? 0)} className="h-8 w-8 rounded border disabled:opacity-40" onClick={() => setQty(p, (cart[p.id] ?? 0) + 1)}>+</button>
            </div>
          </li>
        ))}
        {!products.length && <li className="p-3 text-zinc-500">Belum ada produk.</li>}
      </ul>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">Tanggal kirim / ambil
          <input type="date" required min={minDate} max={maxDate} value={effectiveDate}
            onChange={(e) => setDate(e.target.value)} className="rounded border p-2" />
        </label>
        {zones.length > 0 && (
          <label className="grid gap-1 text-sm">Zona antar
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="rounded border p-2">
              <option value="">Ambil sendiri (gratis)</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name} — {rupiah(z.fee)}</option>)}
            </select>
          </label>
        )}
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
      <div className="text-right text-sm">
        <p>Subtotal: {rupiah(subtotal)}</p>
        {fee > 0 && <p>Ongkir: {rupiah(fee)}</p>}
        <p className="text-base font-semibold">Total: {rupiah(total)}</p>
      </div>
      {error && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
      <button disabled={pending} className="w-full rounded bg-black py-3 text-white disabled:opacity-50">
        {pending ? "Menyimpan..." : "Pesan via WhatsApp"}
      </button>
    </form>
  );
}
