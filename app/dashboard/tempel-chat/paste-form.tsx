"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { parseChatOrder } from "@/lib/parser/chat-order";
import { jakartaDate, rupiah, type Zone } from "@/lib/types";
import { createChatOrder } from "./actions";

type P = { id: string; name: string; aliases: string[]; price: number; stock: number; preorder_lead_days: number };
type Line = { product_id: string; qty: number; source?: string };

const input = "rounded border p-2";

export default function PasteForm({ products, zones }: { products: P[]; zones: Zone[] }) {
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[] | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [payment, setPayment] = useState<"cod" | "qris">("cod");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(() => jakartaDate(0));
  const [zoneId, setZoneId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function parse() {
    const r = parseChatOrder(text, products);
    setLines(r.items.map((i) => ({ product_id: i.product_id, qty: i.qty, source: i.source })));
    setUnmatched(r.unmatched);
    if (r.payment) setPayment(r.payment);
    setAddress(r.address ?? "");
    setMsg(null);
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const valid = (lines ?? []).filter((l) => byId.has(l.product_id) && l.qty > 0);
  const lead = valid.reduce((m, l) => Math.max(m, byId.get(l.product_id)!.preorder_lead_days), 0);
  const minDate = jakartaDate(lead);
  const effDate = date < minDate ? minDate : date;
  const fee = zones.find((z) => z.id === zoneId)?.fee ?? 0;
  const subtotal = valid.reduce((s, l) => s + byId.get(l.product_id)!.price * l.qty, 0);
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls!.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function submit() {
    if (!valid.length) return setMsg({ ok: false, text: "Belum ada item valid" });
    start(async () => {
      const res = await createChatOrder({
        name, phone, address, payment_method: payment, delivery_date: effDate, delivery_zone_id: zoneId || null,
        items: valid.map(({ product_id, qty }) => ({ product_id, qty })),
      });
      setMsg(res.ok
        ? { ok: true, text: `Pesanan #${res.orderId.slice(0, 8)} tersimpan (${rupiah(res.total)}, kirim ${res.deliveryDate}).` }
        : { ok: false, text: res.error });
      if (res.ok) { setLines(null); setText(""); }
    });
  }

  return (
    <div className="space-y-4">
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={6} className={`${input} w-full`}
        placeholder="contoh: kak risol 2, kue lapis 1, cod ya, kirim ke Jl. Mawar 3" />
      <button type="button" onClick={parse} disabled={!text.trim()} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">Baca chat</button>

      {lines && (
        <div className="space-y-3 rounded border p-3">
          <h2 className="font-semibold">Pratinjau (bisa diedit)</h2>
          {lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={l.product_id} onChange={(e) => update(i, { product_id: e.target.value })} className={input}>
                {!byId.has(l.product_id) && <option value="">— pilih produk —</option>}
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({rupiah(p.price)}, stok {p.stock})</option>)}
              </select>
              <input type="number" min={1} max={999} value={l.qty} onChange={(e) => update(i, { qty: Number(e.target.value) })} className={`${input} w-20`} />
              {l.source && <span className="text-xs text-zinc-500">dari: “{l.source}”</span>}
              <button type="button" onClick={() => setLines((ls) => ls!.filter((_, j) => j !== i))} className="text-red-600">hapus</button>
            </div>
          ))}
          <button type="button" onClick={() => setLines((ls) => [...ls!, { product_id: products[0]?.id ?? "", qty: 1 }])} className="rounded border px-2 text-sm">+ item</button>
          {unmatched.length > 0 && (
            <p className="rounded bg-yellow-50 p-2 text-sm text-yellow-800">Tidak dikenali: {unmatched.map((u) => `“${u}”`).join(", ")} — tambahkan manual atau isi alias produk.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama pembeli" minLength={2} maxLength={100} className={input} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="No. HP (opsional)" className={input} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat" maxLength={500} className={`${input} sm:col-span-2`} />
            <label className="text-sm">Tanggal kirim
              <input type="date" min={minDate} max={jakartaDate(30)} value={effDate} onChange={(e) => setDate(e.target.value)} className={`${input} w-full`} />
            </label>
            <label className="text-sm">Zona antar
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={`${input} w-full`}>
                <option value="">Ambil sendiri</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name} — {rupiah(z.fee)}</option>)}
              </select>
            </label>
            <fieldset className="flex gap-4">
              {(["cod", "qris"] as const).map((m) => (
                <label key={m} className="flex items-center gap-1"><input type="radio" checked={payment === m} onChange={() => setPayment(m)} /> {m.toUpperCase()}</label>
              ))}
            </fieldset>
          </div>
          <p className="text-right">Subtotal {rupiah(subtotal)}{fee ? ` + ongkir ${rupiah(fee)}` : ""} = <b>{rupiah(subtotal + fee)}</b></p>
          <button type="button" onClick={submit} disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
            {pending ? "Menyimpan..." : "Buat pesanan"}
          </button>
        </div>
      )}
      {msg && (
        <p className={`rounded p-2 ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {msg.text} {msg.ok && <Link href="/dashboard/orders" className="underline">Lihat pesanan</Link>}
        </p>
      )}
    </div>
  );
}
