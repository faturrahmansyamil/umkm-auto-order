import ShareCard from "./share-card";

export default function BagikanPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Bagikan Link Toko</h1>
      <p className="text-sm text-zinc-500">Tempel link di bio IG/WA, atau cetak QR untuk lapak. QR dibuat di browser, tanpa layanan luar.</p>
      <ShareCard siteUrl={process.env.NEXT_PUBLIC_SITE_URL || null} />
    </section>
  );
}
