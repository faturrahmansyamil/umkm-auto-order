import { requireSeller } from "@/lib/auth";
import { ORDER_STATUSES, rupiah } from "@/lib/types";
import { updateStatus } from "./actions";


type Row = {
  id: string; channel: string; payment_method: string; status: string; total: number; created_at: string;
  customers: { name: string; phone: string | null; address: string | null } | null;
  order_items: { qty: number; unit_price: number; products: { name: string } | null }[];
};

export default async function OrdersPage() {
  const { supabase } = await requireSeller();
  const { data } = await supabase
    .from("orders")
    .select("id,channel,payment_method,status,total,created_at,customers(name,phone,address),order_items(qty,unit_price,products(name))")
    .order("created_at", { ascending: false })
    .limit(100);
  const orders = (data ?? []) as unknown as Row[];

  return (
    <section>
      <h1 className="mb-4 text-xl font-bold">Pesanan</h1>
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-mono">#{o.id.slice(0, 8)} · {o.channel} · {o.payment_method.toUpperCase()}</span>
              <span>{new Date(o.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</span>
            </div>
            <p>{o.customers?.name} {o.customers?.phone ? `· ${o.customers.phone}` : ""}</p>
            {o.customers?.address && <p className="text-zinc-500">{o.customers.address}</p>}
            <ul className="my-2 list-disc pl-5">
              {o.order_items.map((it, i) => <li key={i}>{it.products?.name} x{it.qty} @ {rupiah(it.unit_price)}</li>)}
            </ul>
            <div className="flex items-center justify-between">
              <b>{rupiah(o.total)}</b>
              <form action={updateStatus} className="flex gap-2">
                <input type="hidden" name="id" value={o.id} />
                <select name="status" defaultValue={o.status} className="rounded border p-1">
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="rounded bg-black px-3 text-white">Simpan</button>
              </form>
            </div>
          </div>
        ))}
        {!orders.length && <p className="text-zinc-500">Belum ada pesanan.</p>}
      </div>
    </section>
  );
}
