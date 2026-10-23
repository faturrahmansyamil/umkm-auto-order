"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSeller } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  fee: z.coerce.number().int().min(0).max(10_000_000),
  is_active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveZone(fd: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return;
  const { supabase, seller } = await requireSeller();
  if (!seller) return;
  const id = fd.get("id");
  if (id) {
    const zid = z.uuid().safeParse(id);
    if (!zid.success) return;
    await supabase.from("delivery_zones").update(parsed.data).eq("id", zid.data).eq("seller_id", seller.id);
  } else {
    await supabase.from("delivery_zones").insert({ ...parsed.data, seller_id: seller.id });
  }
  revalidatePath("/dashboard/zona");
}

export async function deleteZone(fd: FormData) {
  const zid = z.uuid().safeParse(fd.get("id"));
  if (!zid.success) return;
  const { supabase, seller } = await requireSeller();
  if (!seller) return;
  // Zona yang sudah dipakai pesanan tidak bisa dihapus (FK) -> nonaktifkan
  const { error } = await supabase.from("delivery_zones").delete().eq("id", zid.data).eq("seller_id", seller.id);
  if (error) await supabase.from("delivery_zones").update({ is_active: false }).eq("id", zid.data).eq("seller_id", seller.id);
  revalidatePath("/dashboard/zona");
}
