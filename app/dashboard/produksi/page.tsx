import { requireSeller } from "@/lib/auth";
import { jakartaDate } from "@/lib/types";

type Row = { delivery_date: string; status: string; order_items: { qty: number; products: { name: string; daily_quota: number | null } | null }[] };

export default async function ProduksiPage() {
  const { supabase, seller } = await requireSeller();
  const from = jakartaDate(0), to = jakartaDate(14);
  const { data } = await supabase
    .from("orders")
    .select("delivery_date,status,order_items(qty,products(name,daily_quota))")
    .eq("seller_id", seller!.id)
    .neq("status", "batal")
    .gte("delivery_date", from).lte("delivery_date", to)
    .order("delivery_date");
  const byDate = new Map<string, { orders: number; items: Map<string, { qty: number; quota: number | null }> }>();
  for (const o of (data ?? []) as unknown as Row[]) {
    const d = byDate.get(o.delivery_date) ?? { orders: 0, items: new Map() };
    d.orders++;
    for (const it of o.order_items) {
      const name = it.products?.name ?? "?";
      const cur = d.items.get(name) ?? { qty: 0, quota: it.products?.daily_quota ?? null };
      cur.qty += it.qty;
      d.items.set(name, cur);
    }
    byDate.set(o.delivery_date, d);
  }
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Daftar Produksi per Tanggal</h1>
      <p className="text-sm text-zinc-500">{from} s/d {to} (WIB), semua pesanan kecuali yang batal.</p>
      {[...byDate].map(([date, d]) => (
        <div key={date} className="rounded border p-3">
          <h2 className="font-semibold">{date} · {d.orders} pesanan</h2>
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left text-zinc-500"><th>Produk</th><th>Jumlah</th><th>Kuota</th></tr></thead>
            <tbody>
              {[...d.items].map(([name, v]) => (
                <tr key={name} className="border-t">
                  <td>{name}</td><td>{v.qty}</td>
                  <td>{v.quota === null ? "—" : `${v.qty}/${v.quota}${v.qty >= v.quota ? " (penuh)" : ""}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {!byDate.size && <p className="text-zinc-500">Belum ada pesanan untuk 14 hari ke depan.</p>}
    </section>
  );
}
