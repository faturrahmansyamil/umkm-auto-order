import { describe, expect, it } from "vitest";
import { extractQty, matchProduct, normalize, parseChatOrder, type CatalogProduct } from "./chat-order";

const catalog: CatalogProduct[] = [
  { id: "risol", name: "[DEMO] Risol Mayo", aliases: ["risol", "risoles", "rismay"] },
  { id: "lapis", name: "[DEMO] Kue Lapis", aliases: ["lapis"] },
  { id: "dadar", name: "[DEMO] Dadar Gulung", aliases: ["dadar", "kue dadar"] },
  { id: "pastel", name: "[DEMO] Pastel Ayam", aliases: ["pastel"] },
  { id: "teh", name: "[DEMO] Es Teh Manis", aliases: ["es teh", "teh"] },
  { id: "tumpeng", name: "[DEMO] Tumpeng Mini", aliases: ["tumpeng"] },
];
const items = (t: string) => parseChatOrder(t, catalog).items.map((i) => [i.product_id, i.qty]);

describe("contoh utama", () => {
  it("parses the brief example", () => {
    const r = parseChatOrder("kak risol 2, kue lapis 1, cod ya, kirim ke Jl. Mawar 3", catalog);
    expect(r.items.map((i) => [i.product_id, i.qty])).toEqual([["risol", 2], ["lapis", 1]]);
    expect(r.payment).toBe("cod");
    expect(r.address).toBe("Jl. Mawar 3");
    expect(r.unmatched).toEqual([]);
  });
});

describe("jumlah", () => {
  it.each([
    ["risol 2", 2], ["2 risol", 2], ["risol 2x", 2], ["2x risol", 2], ["risol x2", 2], ["x3 risol", 3],
    ["risol 2 pcs", 2], ["risol 5pcs", 5], ["risol dua", 2], ["tiga risol", 3], ["risol sepuluh", 10],
    ["risol sebelas", 11], ["risol dua belas", 12], ["risol dua puluh", 20], ["risol dua puluh lima", 25],
    ["risol selusin", 12], ["risol dua lusin", 24], ["setengah lusin risol", 6], ["risol", 1],
    ["risol 2 bungkus", 2], ["risol 4 biji", 4], ["risol 100", 100],
  ])("%s -> %i", (text, qty) => {
    expect(items(text)).toEqual([["risol", qty]]);
  });
  it("caps qty at 999", () => expect(items("risol 5000")).toEqual([["risol", 999]]));
  it("extractQty returns null when absent", () => expect(extractQty("risol mayo").qty).toBeNull());
});

describe("pencocokan produk", () => {
  it.each([
    ["risoles 3", "risol"], ["rismay 3", "risol"], ["risol mayo 3", "risol"], ["risolnya 3", "risol"],
    ["rsol 3", "risol"], ["risool 3", "risol"], ["kue lapis 2", "lapis"], ["lapis 2", "lapis"],
    ["lapiss 2", "lapis"], ["dadar gulung 2", "dadar"], ["kue dadar 2", "dadar"], ["dadar 2", "dadar"],
    ["pastel ayam 1", "pastel"], ["pastel 1", "pastel"], ["es teh 2", "teh"], ["es teh manis 2", "teh"],
    ["teh 2", "teh"], ["tumpeng 1", "tumpeng"], ["RISOL 2", "risol"], ["Kue Lapis 2", "lapis"],
  ])("%s -> %s", (text, id) => {
    expect(parseChatOrder(text, catalog).items[0]?.product_id).toBe(id);
  });
  it("does not match unknown products", () => {
    const r = parseChatOrder("bakso 2, risol 1", catalog);
    expect(r.items.map((i) => i.product_id)).toEqual(["risol"]);
    expect(r.unmatched).toEqual(["bakso 2"]);
  });
  it("matchProduct returns null below threshold", () => expect(matchProduct("martabak", catalog)).toBeNull());
  it("kue lapis is not confused with kue dadar", () => expect(matchProduct("kue lapis", catalog)?.p.id).toBe("lapis"));
  it("normalize strips labels & punctuation", () => expect(normalize("[DEMO] Risol-Mayo!")).toBe("risol mayo"));
});

describe("pemisah & penggabungan", () => {
  it("splits on dan / sama / & / + / newline / ;", () => {
    expect(items("risol 2 dan lapis 1")).toEqual([["risol", 2], ["lapis", 1]]);
    expect(items("risol 2 sama pastel 3")).toEqual([["risol", 2], ["pastel", 3]]);
    expect(items("risol 2 & lapis 1")).toEqual([["risol", 2], ["lapis", 1]]);
    expect(items("risol 2 + teh 2")).toEqual([["risol", 2], ["teh", 2]]);
    expect(items("risol 2\nlapis 3\ndadar 1")).toEqual([["risol", 2], ["lapis", 3], ["dadar", 1]]);
    expect(items("risol 2; lapis 3")).toEqual([["risol", 2], ["lapis", 3]]);
  });
  it("merges duplicates", () => expect(items("risol 2, risoles 3")).toEqual([["risol", 5]]));
  it("ignores greetings & filler", () => {
    const r = parseChatOrder("Assalamualaikum kak, mau pesan dong\nrisol 2 ya kak\nmakasih", catalog);
    expect(r.items.map((i) => [i.product_id, i.qty])).toEqual([["risol", 2]]);
    expect(r.unmatched).toEqual([]);
  });
  it("empty text", () => expect(parseChatOrder("", catalog)).toEqual({ items: [], payment: null, address: null, unmatched: [] }));
});

describe("pembayaran", () => {
  it.each([
    ["risol 2 cod", "cod"], ["risol 2, COD ya", "cod"], ["risol 2 bayar di tempat", "cod"], ["risol 2 bayar ditempat", "cod"],
    ["risol 2 qris", "qris"], ["risol 2 bayarnya qris kak", "qris"], ["risol 2 scan qr", "qris"], ["risol 2", null],
    ["risol 2 cod, eh qris aja", "qris"],
  ])("%s -> %s", (text, pay) => {
    const r = parseChatOrder(text, catalog);
    expect(r.payment).toBe(pay);
    expect(r.items[0]).toMatchObject({ product_id: "risol", qty: 2 });
  });
});

describe("alamat", () => {
  it.each([
    ["risol 2, kirim ke Jl. Mawar 3", "Jl. Mawar 3"],
    ["risol 2 kirim ke jalan Melati no 5, RT 02/03", "jalan Melati no 5, RT 02/03"],
    ["risol 2, alamat: Perum Griya Asri Blok B2", "Perum Griya Asri Blok B2"],
    ["risol 2, alamatnya Gg. Kenari 7", "Gg. Kenari 7"],
    ["risol 2, antar ke Kantor Kelurahan Sukamaju", "Kantor Kelurahan Sukamaju"],
    ["risol 2, Jl. Anggrek 12 ya kak", "Jl. Anggrek 12"],
    ["risol 2\nalamat: Jl Kenanga 1", "Jl Kenanga 1"],
    ["risol 2", null],
  ])("%s -> %s", (text, addr) => {
    const r = parseChatOrder(text, catalog);
    expect(r.address).toBe(addr);
    expect(r.items).toHaveLength(1);
  });
  it("address numbers are not read as quantities", () => {
    expect(items("lapis 1, kirim ke Jl. Mawar 33")).toEqual([["lapis", 1]]);
  });
});

describe("chat realistis", () => {
  it("multi-line WA chat", () => {
    const r = parseChatOrder(
      "Halo kak 🙏\nSaya mau order:\n- Risol mayo 10\n- kue lapis 5 pcs\n- es teh 3x\nBayarnya COD ya\nAlamat: Jl. Cempaka Putih No. 8",
      catalog,
    );
    expect(r.items.map((i) => [i.product_id, i.qty])).toEqual([["risol", 10], ["lapis", 5], ["teh", 3]]);
    expect(r.payment).toBe("cod");
    expect(r.address).toBe("Jl. Cempaka Putih No. 8");
  });
  it("one-liner with word numbers", () => {
    expect(items("min pesen risol lima sama dadar gulung tiga")).toEqual([["risol", 5], ["dadar", 3]]);
  });
  it("is deterministic", () => {
    const t = "kak risol 2, lapis tiga, qris";
    expect(parseChatOrder(t, catalog)).toEqual(parseChatOrder(t, catalog));
  });
  it("handles very long input safely", () => {
    const r = parseChatOrder("risol 1, ".repeat(5000), catalog);
    expect(r.items[0].product_id).toBe("risol");
  });
});
