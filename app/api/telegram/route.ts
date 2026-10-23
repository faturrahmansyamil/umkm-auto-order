import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createOrder, listActiveProducts } from "@/lib/orders";
import { tgSend } from "@/lib/channels/telegram";
import { rupiah } from "@/lib/types";

const updateSchema = z.object({
  message: z.object({
    chat: z.object({ id: z.number() }),
    from: z.object({ id: z.number(), first_name: z.string().optional(), username: z.string().optional() }).optional(),
    text: z.string().max(1000).optional(),
  }).optional(),
});

function validSecret(header: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !header) return false;
  const a = Buffer.from(header), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const HELP = [
  "Selamat datang! Cara pesan:",
  "/produk — lihat daftar produk & stok",
  "/pesan <no>x<jumlah>[,<no>x<jumlah>] <qris|cod>",
  "Contoh: /pesan 1x2,3x1 cod",
].join("\n");

/** Telegram opsional & mati secara default. Hanya aktif jika TELEGRAM_ENABLED=true. */
const telegramEnabled = () => process.env.TELEGRAM_ENABLED === "true";

export async function POST(req: NextRequest) {
  if (!telegramEnabled()) return new NextResponse(null, { status: 404 });
  if (!validSecret(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  const msg = parsed.success ? parsed.data.message : undefined;
  if (!msg?.text || !msg.from) return NextResponse.json({ ok: true }); // abaikan update lain

  const chatId = msg.chat.id;
  const [cmd, ...args] = msg.text.trim().split(/\s+/);
  const command = cmd.split("@")[0].toLowerCase();

  try {
    if (command === "/start") {
      await tgSend(chatId, HELP);
    } else if (command === "/produk") {
      const products = await listActiveProducts();
      const text = products.length
        ? products.map((p, i) => `${i + 1}. ${p.name} — ${rupiah(p.price)} (stok ${p.stock})`).join("\n")
        : "Belum ada produk.";
      await tgSend(chatId, text);
    } else if (command === "/pesan") {
      const m = /^((?:\d{1,3}x\d{1,3},?)+)\s+(qris|cod)$/i.exec(args.join(" "));
      if (!m) { await tgSend(chatId, "Format salah.\n" + HELP); return NextResponse.json({ ok: true }); }
      const products = await listActiveProducts(); // urutan sama dengan /produk
      const items: { product_id: string; qty: number }[] = [];
      for (const part of m[1].split(",").filter(Boolean)) {
        const [no, qty] = part.split("x").map(Number);
        const p = products[no - 1];
        if (!p) { await tgSend(chatId, `Produk no ${no} tidak ada. Cek /produk`); return NextResponse.json({ ok: true }); }
        items.push({ product_id: p.id, qty });
      }
      const payment = m[2].toLowerCase() as "qris" | "cod";
      const res = await createOrder({
        channel: "telegram",
        payment_method: payment,
        customer_name: (msg.from.first_name || msg.from.username || "Pelanggan Telegram").slice(0, 100).padEnd(2, "_"),
        telegram_user_id: msg.from.id,
        items,
      });
      if (!res.ok) { await tgSend(chatId, `Gagal: ${res.error}`); return NextResponse.json({ ok: true }); }
      const lines = items.map((it) => {
        const p = products.find((x) => x.id === it.product_id)!;
        return `- ${p.name} x${it.qty} = ${rupiah(p.price * it.qty)}`;
      });
      const qris = process.env.NEXT_PUBLIC_QRIS_IMAGE_URL;
      await tgSend(chatId, [
        `Pesanan #${res.orderId.slice(0, 8)} tersimpan (status: menunggu)`,
        ...lines,
        `Total: ${rupiah(res.total)}`,
        `Tanggal kirim: ${res.deliveryDate}`,
        payment === "qris"
          ? `Bayar via QRIS${qris ? `: ${qris}` : ""} lalu kirim bukti bayar ke penjual.`
          : "Bayar COD saat pesanan diterima.",
      ].join("\n"));
    } else {
      await tgSend(chatId, HELP);
    }
  } catch (e) {
    console.error("telegram webhook error", e instanceof Error ? e.message : "unknown");
  }
  // Selalu 200 agar Telegram tidak retry terus
  return NextResponse.json({ ok: true });
}
