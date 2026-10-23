"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSeller } from "@/lib/auth";

const base = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.coerce.number().int().min(0).max(1_000_000_000),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  is_active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveProduct(fd: FormData) {
  const id = fd.get("id");
  const parsed = base.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return;
  const { supabase, seller } = await requireSeller();
  if (!seller) return;
  if (id) {
    const pid = z.uuid().safeParse(id);
    if (!pid.success) return;
    await supabase.from("products").update(parsed.data).eq("id", pid.data).eq("seller_id", seller.id);
  } else {
    await supabase.from("products").insert({ ...parsed.data, seller_id: seller.id });
  }
  revalidatePath("/dashboard/products");
}

export async function deleteProduct(fd: FormData) {
  const pid = z.uuid().safeParse(fd.get("id"));
  if (!pid.success) return;
  const { supabase, seller } = await requireSeller();
  if (!seller) return;
  // Produk yang sudah pernah dipesan tidak bisa dihapus (FK) -> nonaktifkan saja
  const { error } = await supabase.from("products").delete().eq("id", pid.data).eq("seller_id", seller.id);
  if (error) await supabase.from("products").update({ is_active: false }).eq("id", pid.data).eq("seller_id", seller.id);
  revalidatePath("/dashboard/products");
}
