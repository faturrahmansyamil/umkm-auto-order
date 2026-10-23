"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSeller } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/types";

const schema = z.object({ id: z.uuid(), status: z.enum(ORDER_STATUSES) });

export async function updateStatus(fd: FormData) {
  const parsed = schema.safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return;
  const { supabase, seller } = await requireSeller();
  if (!seller) return;
  // RLS membatasi update hanya ke pesanan milik penjual ini. Trigger DB mengembalikan stok saat -> batal
  // dan menolak mengaktifkan lagi pesanan yang sudah batal.
  const { error } = await supabase.from("orders").update({ status: parsed.data.status }).eq("id", parsed.data.id).eq("seller_id", seller.id);
  if (error) console.error("update status failed", error.code);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/produksi");
  revalidatePath("/dashboard");
}
