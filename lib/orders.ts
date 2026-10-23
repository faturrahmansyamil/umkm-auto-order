import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const orderItemSchema = z.object({
  product_id: z.uuid(),
  qty: z.number().int().min(1).max(999),
});

export const createOrderSchema = z.object({
  channel: z.enum(["web", "telegram", "chat"]),
  payment_method: z.enum(["qris", "cod"]),
  customer_name: z.string().trim().min(2).max(100),
  customer_phone: z.string().trim().regex(/^[0-9+\- ]{8,20}$/).optional(),
  customer_address: z.string().trim().max(500).optional(),
  telegram_user_id: z.number().int().positive().optional(),
  items: z.array(orderItemSchema).min(1).max(50),
  delivery_date: z.iso.date().optional(),
  delivery_zone_id: z.uuid().optional(),
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
    .select("id,name,price,stock,is_active,daily_quota,preorder_lead_days")
    .eq("seller_id", getSellerId())
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error("Gagal memuat produk");
  return data;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; total: number; deliveryDate: string }
  | { ok: false; error: string };

export async function listActiveZones() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("delivery_zones").select("id,name,fee")
    .eq("seller_id", getSellerId()).eq("is_active", true).order("fee");
  if (error) throw new Error("Gagal memuat zona");
  return data;
}

/** Sisa kuota per produk utk tanggal kirim. null = tanpa kuota. */
export async function quotaRemaining(date: string) {
  if (!z.iso.date().safeParse(date).success) return {};
  const db = createAdminClient();
  const { data, error } = await db.rpc("quota_remaining", { p_seller_id: getSellerId(), p_date: date });
  if (error) throw new Error("Gagal memuat kuota");
  return Object.fromEntries((data as { product_id: string; remaining: number | null }[]).map((r) => [r.product_id, r.remaining]));
}

const DB_ERRORS: [string, (detail: string) => string][] = [
  ["OUT_OF_STOCK:", (d) => `Stok tidak cukup: ${d}`],
  ["QUOTA_FULL:", (d) => `Kuota produksi untuk tanggal itu sudah penuh: ${d}`],
  ["LEAD_TIME:", (d) => `Pre-order: tanggal kirim paling cepat ${d}`],
  ["DATE_TOO_FAR", () => "Tanggal kirim maksimal 30 hari ke depan"],
  ["PRODUCT_NOT_FOUND", () => "Produk tidak ditemukan"],
  ["ZONE_NOT_FOUND", () => "Zona antar tidak ditemukan"],
  ["INVALID_QTY", () => "Jumlah tidak valid"],
];

/** Logika order bersama untuk web, chat & Telegram. Stok + kuota dicek & dipotong atomik di fungsi DB create_order. */
export async function createOrder(raw: unknown, sellerId = getSellerId()): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Data pesanan tidak valid" };
  const input = parsed.data;

  // Gabungkan item duplikat
  const merged = new Map<string, number>();
  for (const it of input.items) merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.qty);
  const items = [...merged].map(([product_id, qty]) => ({ product_id, qty }));

  const db = createAdminClient();
  const { data, error } = await db.rpc("create_order", {
    p_seller_id: sellerId,
    p_channel: input.channel,
    p_payment_method: input.payment_method,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone ?? null,
    p_customer_address: input.customer_address ?? null,
    p_telegram_user_id: input.telegram_user_id ?? null,
    p_items: items,
    p_delivery_date: input.delivery_date ?? null,
    p_delivery_zone_id: input.delivery_zone_id ?? null,
  });
  if (error) {
    const msg = error.message ?? "";
    for (const [code, fmt] of DB_ERRORS) {
      const i = msg.indexOf(code);
      if (i >= 0) return { ok: false, error: fmt(msg.slice(i + code.length).trim()) };
    }
    console.error("create_order failed", error.code);
    return { ok: false, error: "Gagal menyimpan pesanan" };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, orderId: row.order_id, total: row.total, deliveryDate: row.delivery_date };
}
