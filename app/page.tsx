import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">UMKM Auto-Order</h1>
      <p className="text-zinc-500">Order lewat web (wa.me) atau bot Telegram, dipantau di dashboard penjual.</p>
      <div className="flex gap-3">
        <Link href="/order" className="rounded bg-black px-4 py-2 text-white">Pesan</Link>
        <Link href="/dashboard" className="rounded border px-4 py-2">Dashboard Penjual</Link>
      </div>
    </main>
  );
}
