import { requireSeller } from "@/lib/auth";
import { deleteProduct, saveProduct } from "./actions";


const input = "rounded border p-1";

export default async function ProductsPage() {
  const { supabase, seller } = await requireSeller();
  const { data: products } = await supabase
    .from("products").select("id,name,price,stock,is_active").eq("seller_id", seller!.id).order("name");

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Produk & Stok</h1>
      <form action={saveProduct} className="flex flex-wrap gap-2 rounded border p-3">
        <input name="name" required placeholder="Nama produk" className={input} />
        <input name="price" type="number" min={0} required placeholder="Harga" className={input} />
        <input name="stock" type="number" min={0} required placeholder="Stok" className={input} />
        <label className="flex items-center gap-1"><input type="checkbox" name="is_active" defaultChecked /> aktif</label>
        <button className="rounded bg-black px-3 text-white">Tambah</button>
      </form>
      {(products ?? []).map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
          <form action={saveProduct} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input name="name" defaultValue={p.name} required className={input} />
            <input name="price" type="number" min={0} defaultValue={p.price} className={`${input} w-28`} />
            <input name="stock" type="number" min={0} defaultValue={p.stock} className={`${input} w-20`} />
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
