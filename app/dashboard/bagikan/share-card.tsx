"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";

const noop = () => () => {};

export default function ShareCard({ siteUrl }: { siteUrl: string | null }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const base = (siteUrl || origin).replace(/\/+$/, "");
  const link = base ? `${base}/order` : "";
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { width: 768, margin: 2, errorCorrectionLevel: "M" }).then(setPng).catch(() => setPng(null));
  }, [link]);

  return (
    <div className="space-y-3 rounded border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-zinc-100 px-2 py-1 text-sm">{link || "…"}</code>
        <button type="button" className="rounded border px-2 text-sm" onClick={async () => {
          await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500);
        }}>{copied ? "Tersalin" : "Salin"}</button>
      </div>
      {!siteUrl && <p className="text-xs text-zinc-500">Set <code>NEXT_PUBLIC_SITE_URL</code> agar link memakai domain publik, bukan alamat yang sedang dibuka.</p>}
      {png && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={png} alt={`QR code ${link}`} className="h-64 w-64" />
          <a href={png} download="qr-toko.png" className="inline-block rounded bg-black px-4 py-2 text-white">Unduh PNG</a>
        </>
      )}
    </div>
  );
}
