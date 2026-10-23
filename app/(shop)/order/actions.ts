"use server";
import { createOrder, listActiveProducts } from "@/lib/orders";
import { buildOrderText, waMeLink } from "@/lib/channels/wame";

export type SubmitState = { ok: true; waUrl: string; orderId: string } | { ok: false; error: string };

export async function submitOrder(input: {
  name: string; phone: string; address: string; payment_method: "qris" | "cod";
  items: { product_id: string; qty: number }[];
}): Promise<SubmitState> {
  const res = await createOrder({
    channel: "web",
    payment_method: input.payment_method,
    customer_name: input.name,
    customer_phone: input.phone,
    customer_address: input.address,
    items: input.items,
  });
  if (!res.ok) return res;

  const products = await listActiveProducts();
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = input.items.map((i) => ({ name: byId.get(i.product_id)?.name ?? "?", qty: i.qty, price: byId.get(i.product_id)?.price ?? 0 }));
  const number = process.env.SELLER_WHATSAPP_NUMBER ?? "";
  const text = buildOrderText({ orderId: res.orderId, name: input.name, address: input.address, payment: input.payment_method, lines, total: res.total });
  return { ok: true, orderId: res.orderId, waUrl: waMeLink(number, text) };
}
