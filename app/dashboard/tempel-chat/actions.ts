"use server";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { createOrder, type CreateOrderResult } from "@/lib/orders";

export async function createChatOrder(input: {
  name: string; phone: string; address: string; payment_method: "qris" | "cod";
  delivery_date: string; delivery_zone_id: string | null;
  items: { product_id: string; qty: number }[];
}): Promise<CreateOrderResult> {
  const { seller } = await requireSeller();
  if (!seller) return { ok: false, error: "Bukan akun penjual" };
  // seller_id diambil dari sesi login, bukan dari input browser. Semua field divalidasi Zod di createOrder.
  const res = await createOrder({
    channel: "chat",
    payment_method: input.payment_method,
    customer_name: input.name.trim() || "Pelanggan WA",
    customer_phone: input.phone || undefined,
    customer_address: input.address || undefined,
    delivery_date: input.delivery_date,
    delivery_zone_id: input.delivery_zone_id ?? undefined,
    items: input.items,
  }, seller.id);
  if (res.ok) { revalidatePath("/dashboard/orders"); revalidatePath("/dashboard/produksi"); }
  return res;
}
