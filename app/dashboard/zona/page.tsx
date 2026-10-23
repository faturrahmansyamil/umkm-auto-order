import { requireSeller } from "@/lib/auth";
import { deleteZone, saveZone } from "./actions";

const input = "rounded border p-1";

export default async function ZonaPage() {
  const { supabase, seller } = await requireSeller();
  const { data: zones } = await supabase.from("delivery_zones").select("id,name,fee,is_active").eq("seller_id", seller!.id).order("fee");
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Zona Antar & Ongkir</h1>
      <p className="text-sm text-zinc-500">Isi per kecamatan/area. Pembeli memilih zona, ongkir otomatis ditambahkan ke total.</p>
      <form action={saveZone} className="flex flex-wrap gap-2 rounded border p-3">
        <input name="name" required maxLength={80} placeholder="Kecamatan / zona" className={input} />
        <input name="fee" type="number" min={0} required placeholder="Ongkir (Rp)" className={input} />
        <label className="flex items-center gap-1"><input type="checkbox" name="is_active" defaultChecked /> aktif</label>
        <button className="rounded bg-black px-3 text-white">Tambah</button>
      </form>
      {(zones ?? []).map((z) => (
        <div key={z.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
          <form action={saveZone} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={z.id} />
            <input name="name" defaultValue={z.name} required maxLength={80} className={input} />
            <input name="fee" type="number" min={0} defaultValue={z.fee} className={`${input} w-28`} />
            <label className="flex items-center gap-1"><input type="checkbox" name="is_active" defaultChecked={z.is_active} /> aktif</label>
            <button className="rounded border px-2">Simpan</button>
          </form>
          <form action={deleteZone}><input type="hidden" name="id" value={z.id} /><button className="rounded border px-2 text-red-600">Hapus</button></form>
        </div>
      ))}
    </section>
  );
}
