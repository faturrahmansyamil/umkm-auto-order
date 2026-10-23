import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const orderItemSchema = z.object({
  product_id: z.uuid(),
  qty: z.number().int().min(1).max(999),
});

export const createOrderSchema = z.object({
  channel: z.enum(["web", "telegram"]),
  payment_method: z.enum(["qris", "cod"]),
  customer_name: z.string().trim().min(2).max(100),
  customer_phone: z.string().trim().regex(/^[0-9+\- ]{8,20}$/).optional(),
  customer_address: z.string().trim().max(500).optional(),
  telegram_user_id: z.number().int().positive().optional(),
  items: z.array(orderItemSchema).min(1).max(50),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export function getSellerId() {
  const id = process.env.STORE_SELLER_ID;
  if (!id || !z.uuid().safeParse(id).success) throw new Error("STORE_SELLER_ID belum diset/valid");
  return id;
}

export async function listActiveProducts() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("products")
    .select("id,name,price,stock,is_active")
    .eq("seller_id", getSellerId())
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error("Gagal memuat produk");
  return data;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; total: number }
  | { ok: false; error: string };

/** Logika order bersama untuk web & Telegram. Stok dicek atomik di fungsi DB create_order. */
export async function createOrder(raw: unknown): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Data pesanan tidak valid" };
  const input = parsed.data;

  // Gabungkan item duplikat
  const merged = new Map<string, number>();
  for (const it of input.items) merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.qty);
  const items = [...merged].map(([product_id, qty]) => ({ product_id, qty }));

  const db = createAdminClient();
  const { data, error } = await db.rpc("create_order", {
    p_seller_id: getSellerId(),
    p_channel: input.channel,
    p_payment_method: input.payment_method,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone ?? null,
    p_customer_address: input.customer_address ?? null,
    p_telegram_user_id: input.telegram_user_id ?? null,
    p_items: items,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("OUT_OF_STOCK")) return { ok: false, error: `Stok tidak cukup: ${msg.split("OUT_OF_STOCK:")[1] ?? ""}`.trim() };
    if (msg.includes("PRODUCT_NOT_FOUND")) return { ok: false, error: "Produk tidak ditemukan" };
    console.error("create_order failed", error.code);
    return { ok: false, error: "Gagal menyimpan pesanan" };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, orderId: row.order_id, total: row.total };
}
