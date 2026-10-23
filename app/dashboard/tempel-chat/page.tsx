import { requireSeller } from "@/lib/auth";
import PasteForm from "./paste-form";

export default async function TempelChatPage() {
  const { supabase, seller } = await requireSeller();
  const [{ data: products }, { data: zones }] = await Promise.all([
    supabase.from("products").select("id,name,aliases,price,stock,preorder_lead_days").eq("seller_id", seller!.id).eq("is_active", true).order("name"),
    supabase.from("delivery_zones").select("id,name,fee").eq("seller_id", seller!.id).eq("is_active", true).order("fee"),
  ]);
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Tempel Chat jadi Order</h1>
      <p className="text-sm text-zinc-500">
        Salin chat pembeli dari WhatsApp, tempel di bawah, lalu cek hasilnya sebelum disimpan.
        Pencocokan memakai aturan tetap (nama & alias produk), bukan AI — selalu periksa pratinjau.
      </p>
      <PasteForm products={products ?? []} zones={zones ?? []} />
    </section>
  );
}
