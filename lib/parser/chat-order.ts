/**
 * "Tempel chat jadi order" — parser rule-based & deterministik (tanpa AI berbayar).
 * Input: teks chat bebas berbahasa Indonesia + katalog produk (nama + alias).
 * Output: item (produk + jumlah), metode bayar, alamat, dan bagian yang tidak dikenali.
 * Fungsi murni: aman dipakai di browser maupun server.
 */

export type CatalogProduct = { id: string; name: string; aliases?: string[] };
export type ParsedItem = { product_id: string; name: string; qty: number; source: string; score: number };
export type ParseResult = {
  items: ParsedItem[];
  payment: "cod" | "qris" | null;
  address: string | null;
  unmatched: string[];
};

const NUM_WORDS: Record<string, number> = {
  satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  sebelas: 11, selusin: 12, sepasang: 2,
};

const FILLER = new Set([
  "kak", "ka", "kakak", "kk", "min", "admin", "gan", "sis", "bun", "bund", "bunda", "mbak", "mba", "mas", "bang", "bu", "pak",
  "halo", "hallo", "hai", "hi", "permisi", "assalamualaikum", "pagi", "siang", "sore", "malam",
  "mau", "pesan", "pesen", "order", "beli", "ambil", "minta", "tolong", "pls", "please", "dong", "donk", "deh", "aja", "saja",
  "ya", "yah", "yaa", "yg", "yang", "nya", "juga", "jg", "lagi", "terus", "trus", "untuk", "buat", "utk", "ok", "oke", "okey",
  "makasih", "terima", "kasih", "thanks", "thx", "nih", "ini", "itu", "aku", "saya", "sy", "gw", "gue", "bisa", "ga", "gak",
  "ada", "kah", "mohon", "dibikinin", "dibuatin", "bikinin", "sama", "dan", "plus", "ama", "the",
]);
const UNITS = new Set(["pcs", "pc", "biji", "bji", "buah", "bh", "bungkus", "bks", "porsi", "box", "kotak", "pack", "pak", "cup", "gelas", "potong", "ptg", "loyang", "toples", "bijii"]);

const ADDRESS_RE =
  /(?:^|[\s,.;])(?:di\s*kirim|kirim(?:in)?|antar(?:kan|in)?|dianter|anter(?:in)?)(?:\s+(?:ke|kesini|ke\s+alamat))?\s*[:\-]?\s+(.+)$|(?:^|[\s,.;])alamat(?:nya)?\s*[:\-]?\s*(.+)$|(?:^|[\s,.;])((?:jl|jln|jalan|gg|gang|perum|komplek|kompleks)\b\.?\s+.+)$/im;

/** Normalisasi untuk pencocokan: huruf kecil, hapus label & tanda baca. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")          // [DEMO], [SAMPLE]
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Kemiripan 0..1 antar dua kata (toleran typo & imbuhan -nya/-an). */
function wordSim(a: string, b: string) {
  if (a === b) return 1;
  const strip = (w: string) => w.replace(/(nya|an)$/, "");
  if (a.length >= 4 && strip(a) === b) return 0.95;
  if (a.length >= 3 && b.startsWith(a)) return 0.85;      // "lap" -> "lapis"
  if (b.length >= 3 && a.startsWith(b)) return 0.85;      // "risoles" vs "risol"
  const d = levenshtein(a, b);
  const r = 1 - d / Math.max(a.length, b.length);
  return Math.min(a.length, b.length) >= 4 && d <= 1 ? Math.max(r, 0.8) : r;
}

/** Skor frasa vs satu nama kandidat: rata-rata kemiripan kata frasa, dikurangi bila kandidat jauh lebih panjang. */
function phraseScore(phrase: string[], cand: string[]) {
  if (!phrase.length || !cand.length) return 0;
  let sum = 0;
  const used = new Set<number>();
  for (const w of phrase) {
    let best = 0, bi = -1;
    cand.forEach((c, i) => { if (!used.has(i)) { const s = wordSim(w, c); if (s > best) { best = s; bi = i; } } });
    if (best >= 0.7) { sum += best; used.add(bi); }
  }
  const precision = sum / phrase.length;
  const coverage = used.size / cand.length;
  return precision * (0.8 + 0.2 * coverage);
}

export const MATCH_THRESHOLD = 0.7;

export function matchProduct(phrase: string, catalog: CatalogProduct[]) {
  const words = normalize(phrase).split(" ").filter((w) => w && !FILLER.has(w));
  let best: { p: CatalogProduct; score: number } | null = null;
  for (const p of catalog) {
    for (const label of [p.name, ...(p.aliases ?? [])]) {
      const cand = normalize(label).split(" ").filter(Boolean);
      const s = phraseScore(words, cand);
      if (!best || s > best.score) best = { p, score: s };
    }
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
}

/** Ambil jumlah dari segmen. Mengembalikan qty (null bila tidak ada) dan sisa kata. */
export function extractQty(segment: string): { qty: number | null; rest: string[] } {
  // pisahkan "2x", "x2", "2pcs" jadi token sendiri
  const s = normalize(segment)
    .replace(/\b(\d+)\s*x\b/g, " $1 ")
    .replace(/\bx\s*(\d+)\b/g, " $1 ")
    .replace(/\b(\d+)(pcs|pc|biji|bh|bks|porsi|box|cup)\b/g, " $1 ");
  const tokens = s.split(" ").filter(Boolean);
  let qty: number | null = null;
  const rest: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (qty === null && /^\d{1,4}$/.test(t)) { qty = Number(t); continue; }
    if (qty === null && t in NUM_WORDS && t !== "se") {
      let n = NUM_WORDS[t];
      const next = tokens[i + 1];
      if (next === "belas" && n < 10) { n += 10; i++; }
      else if (next === "puluh" && n < 10) {
        n *= 10; i++;
        const unit = tokens[i + 1];
        if (unit && unit in NUM_WORDS && NUM_WORDS[unit] < 10 && unit !== "se") { n += NUM_WORDS[unit]; i++; }
      } else if (next === "lusin" && n < 10) { n *= 12; i++; }
      qty = n; continue;
    }
    if (qty === null && t === "setengah" && tokens[i + 1] === "lusin") { qty = 6; i++; continue; }
    if (UNITS.has(t) || t === "x") continue;
    rest.push(t);
  }
  return { qty, rest };
}

export function parseChatOrder(text: string, catalog: CatalogProduct[]): ParseResult {
  let body = text.slice(0, 2000);
  let address: string | null = null;

  const am = ADDRESS_RE.exec(body);
  if (am) {
    let a = (am[1] ?? am[2] ?? am[3] ?? "").trim();
    for (let prev = ""; prev !== a; ) { prev = a; a = a.replace(/[\s,.;!]+(ya|yah|yaa|kak|ka|kk|min|makasih|thx|ok|oke)[\s.!]*$/i, "").replace(/[\s,;!]+$/, ""); }
    address = a || null;
    body = body.slice(0, am.index) + " ";
  }

  let payment: ParseResult["payment"] = null;
  const payRe = /\b(cod|bayar\s+di\s+tempat|bayar\s+ditempat|qris|scan\s+qr|qr)\b/gi;
  for (const m of body.matchAll(payRe)) payment = /cod|tempat/i.test(m[1]) ? "cod" : "qris";
  body = body.replace(payRe, " ").replace(/\bbayar(nya)?\b/gi, " ");

  const segments = body
    .split(/[,;\n]+|\s+(?:dan|sama|sm|ama|plus|terus|trus)\s+|\s+&\s+|\s+\+\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = new Map<string, ParsedItem>();
  const unmatched: string[] = [];
  for (const seg of segments) {
    const { qty, rest } = extractQty(seg);
    const meaningful = rest.filter((w) => !FILLER.has(w));
    if (!meaningful.length) continue;
    const m = matchProduct(meaningful.join(" "), catalog);
    if (!m) { unmatched.push(seg); continue; }
    const prev = merged.get(m.p.id);
    const q = Math.min(qty ?? 1, 999);
    if (prev) prev.qty = Math.min(prev.qty + q, 999);
    else merged.set(m.p.id, { product_id: m.p.id, name: m.p.name, qty: q, source: seg, score: Math.round(m.score * 100) / 100 });
  }
  return { items: [...merged.values()], payment, address, unmatched };
}
