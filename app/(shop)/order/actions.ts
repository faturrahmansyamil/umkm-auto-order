"use server";
import { z } from "zod";
import { createOrder, listActiveProducts, listActiveZones, quotaRemaining } from "@/lib/orders";
import { buildOrderText, waMeLink } from "@/lib/channels/wame";

export type SubmitState = { ok: true; waUrl: string; orderId: string; deliveryDate: string } | { ok: false; error: string };

export async function getQuota(date: string): Promise<Record<string, number | null>> {
  if (!z.iso.date().safeParse(date).success) return {};
  try { return await quotaRemaining(date); } catch { return {}; }
}

export async function submitOrder(input: {
  name: string; phone: string; address: string; payment_method: "qris" | "cod";
  delivery_date: string; delivery_zone_id: string | null;
  items: { product_id: string; qty: number }[];
}): Promise<SubmitState> {
  const res = await createOrder({
    channel: "web",
    payment_method: input.payment_method,
    customer_name: input.name,
    customer_phone: input.phone,
    customer_address: input.address,
    delivery_date: input.delivery_date,
    delivery_zone_id: input.delivery_zone_id ?? undefined,
    items: input.items,
  });
  if (!res.ok) return res;

  // Harga & ongkir untuk teks WA diambil dari DB, bukan dari input browser
  const [products, zones] = await Promise.all([listActiveProducts(), listActiveZones()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const zone = zones.find((z) => z.id === input.delivery_zone_id);
  const lines = input.items.map((i) => ({ name: byId.get(i.product_id)?.name ?? "?", qty: i.qty, price: byId.get(i.product_id)?.price ?? 0 }));
  const number = process.env.SELLER_WHATSAPP_NUMBER ?? "";
  const text = buildOrderText({
    orderId: res.orderId, name: input.name, address: input.address, payment: input.payment_method, lines, total: res.total,
    deliveryDate: res.deliveryDate, zone: zone ? { name: zone.name, fee: zone.fee } : undefined,
  });
  return { ok: true, orderId: res.orderId, deliveryDate: res.deliveryDate, waUrl: waMeLink(number, text) };
}
