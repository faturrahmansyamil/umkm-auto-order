import { requireSeller } from "@/lib/auth";
import { rupiah } from "@/lib/types";
import RevenueChart from "./revenue-chart";


function startOfWindow() {
  const d = new Date(Date.now() - 13 * 864e5);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  const { supabase } = await requireSeller();
  const since = startOfWindow();
  const { data: orders } = await supabase
    .from("orders").select("total,status,created_at")
    .gte("created_at", since.toISOString())
    .in("status", ["dibayar", "diproses", "dikirim", "selesai"]);

  const days: { date: string; omzet: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 864e5);
    days.push({ date: d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }), omzet: 0 });
  }
  for (const o of orders ?? []) {
    const key = new Date(o.created_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
    const row = days.find((d) => d.date === key);
    if (row) row.omzet += o.total;
  }
  const total = days.reduce((s, d) => s + d.omzet, 0);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Omzet 14 hari terakhir: {rupiah(total)}</h1>
      <p className="text-sm text-zinc-500">Dihitung dari pesanan berstatus dibayar/diproses/dikirim/selesai.</p>
      <RevenueChart data={days} />
    </section>
  );
}
