import { requireSeller } from "@/lib/auth";
import { deleteProduct, saveProduct } from "./actions";


const input = "rounded border p-1";

export default async function ProductsPage() {
  const { supabase, seller } = await requireSeller();
  const { data: products } = await supabase
    .from("products").select("id,name,price,stock,is_active,daily_quota,preorder_lead_days,aliases").eq("seller_id", seller!.id).order("name");

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Produk & Stok</h1>
      <p className="text-sm text-zinc-500">Stok berkurang otomatis saat pesanan masuk dan kembali saat pesanan dibatalkan. Kuota/hari membatasi jumlah produksi per tanggal kirim; pre-order H-n = minimal n hari sebelum tanggal kirim.</p>
      <form action={saveProduct} className="flex flex-wrap gap-2 rounded border p-3">
        <input name="name" required placeholder="Nama produk" className={input} />
        <input name="price" type="number" min={0} required placeholder="Harga" className={input} />
        <input name="stock" type="number" min={0} required placeholder="Stok" className={input} />
        <input name="daily_quota" type="number" min={1} placeholder="Kuota/hari (kosong = bebas)" className={input} />
        <input name="preorder_lead_days" type="number" min={0} max={30} defaultValue={0} title="Pre-order H-n" className={`${input} w-20`} />
        <input name="aliases" maxLength={400} placeholder="Alias, pisah koma (risol, rismay)" className={input} />
        <label className="flex items-center gap-1"><input type="checkbox" name="is_active" defaultChecked /> aktif</label>
        <button className="rounded bg-black px-3 text-white">Tambah</button>
      </form>
      {(products ?? []).map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
          <form action={saveProduct} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input name="name" defaultValue={p.name} required className={input} />
            <input name="price" type="number" min={0} defaultValue={p.price} className={`${input} w-28`} />
            <input name="stock" type="number" min={0} defaultValue={p.stock} className={`${input} w-20`} title="Stok" />
            <input name="daily_quota" type="number" min={1} defaultValue={p.daily_quota ?? ""} placeholder="kuota" title="Kuota/hari" className={`${input} w-20`} />
            <input name="preorder_lead_days" type="number" min={0} max={30} defaultValue={p.preorder_lead_days} title="Pre-order H-n" className={`${input} w-16`} />
            <input name="aliases" defaultValue={(p.aliases ?? []).join(", ")} maxLength={400} placeholder="alias" title="Alias" className={input} />
            <label className="flex items-center gap-1"><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> aktif</label>
            <button className="rounded border px-2">Simpan</button>
          </form>
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={p.id} />
            <button className="rounded border px-2 text-red-600">Hapus</button>
          </form>
        </div>
      ))}
    </section>
  );
}
