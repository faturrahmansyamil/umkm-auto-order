export const ORDER_STATUSES = ["menunggu", "dibayar", "diproses", "dikirim", "selesai", "batal"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = "qris" | "cod";
export type Product = { id: string; name: string; price: number; stock: number; is_active: boolean };

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
