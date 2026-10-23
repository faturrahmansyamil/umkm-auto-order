import { Suspense } from "react";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { logout } from "@/app/login/actions";

async function Shell({ children }: { children: React.ReactNode }) {
  const { seller, user } = await requireSeller();
  return (
    <>
      <nav className="mb-6 flex flex-wrap items-center gap-4 border-b pb-3">
        <b>{seller?.store_name ?? "Dashboard"}</b>
        <Link href="/dashboard">Ringkasan</Link>
        <Link href="/dashboard/orders">Pesanan</Link>
        <Link href="/dashboard/products">Produk</Link>
        <form action={logout} className="ml-auto"><button className="text-sm text-zinc-500">Keluar ({user.email})</button></form>
      </nav>
      {seller ? children : <p>Akun ini belum terdaftar sebagai penjual (tabel <code>sellers</code>).</p>}
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <Suspense fallback={<p className="text-zinc-500">Memuat...</p>}>
        <Shell>{children}</Shell>
      </Suspense>
    </div>
  );
}
