export const ORDER_STATUSES = ["menunggu", "dibayar", "diproses", "dikirim", "selesai", "batal"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = "qris" | "cod";
export type Product = {
  id: string; name: string; price: number; stock: number; is_active: boolean;
  daily_quota: number | null; preorder_lead_days: number;
};
export type Zone = { id: string; name: string; fee: number };

/** Tanggal hari ini (YYYY-MM-DD) zona Asia/Jakarta, + n hari. */
export function jakartaDate(addDays = 0, now = Date.now()) {
  return new Date(now + addDays * 864e5).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
