import { rupiah } from "@/lib/types";

export function buildOrderText(p: {
  orderId: string; name: string; address?: string; payment: string;
  lines: { name: string; qty: number; price: number }[]; total: number;
  deliveryDate?: string; zone?: { name: string; fee: number };
}) {
  const items = p.lines.map((l) => `- ${l.name} x${l.qty} = ${rupiah(l.price * l.qty)}`).join("\n");
  return [
    `Halo, saya mau pesan (ID: ${p.orderId.slice(0, 8)})`,
    items,
    p.zone ? `Ongkir (${p.zone.name}): ${rupiah(p.zone.fee)}` : "",
    `Total: ${rupiah(p.total)}`,
    p.deliveryDate ? `Tanggal kirim: ${p.deliveryDate}` : "",
    `Bayar: ${p.payment.toUpperCase()}`,
    `Nama: ${p.name}`,
    p.address ? `Alamat: ${p.address}` : "",
  ].filter(Boolean).join("\n");
}

export function waMeLink(number: string, text: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
