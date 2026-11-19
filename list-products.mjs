// Liste tous les produits popmart.com (zone FR) via l'API publique observée dans le HAR.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const API = 'https://prod-uk-online-api.popmart.com/rpc/ec/spu/public_FindSummariesByCollectionId';
const ALL_PRODUCTS = 'e65509b9-1ae7-4f57-81de-4f05c412bddf'; // collection "Tous les produits"
const AREA = process.env.AREA ?? 'FR';
const LANG = process.env.LANG_CODE ?? 'fr';
const PAGE_SIZE = 50;
const DETAIL_API = 'https://prod-uk-online-api.popmart.com/rpc/ec/spu/public_FindOne'; // détail : skus[].skuCode / barCode
const CONCURRENCY = 4;

const rpc = async (url, json) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-language': LANG,
      origin: 'https://www.popmart.com',
      referer: 'https://www.popmart.com/',
      'x-area': AREA,
      'x-device-type': 'web-pc',
      'x-request-id': `web-${Date.now()}-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ json }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).json;
};

const post = (page) => rpc(API, { page, pageSize: PAGE_SIZE, sortWay: 'recommend', businessTypes: ['shop', 'draw'], categoryId: [], ipId: [], includeAllOptions: true, collectionId: ALL_PRODUCTS });

const first = await post(1);
const pages = [first];
for (let p = 2; p <= first.totalPages; p++) pages.push(await post(p));

const pick = (t) => t?.[LANG] || t?.['en-us'] || Object.values(t ?? {}).find(Boolean) || '';
const products = pages.flatMap((pg) => pg.items.flatMap((g) => g.items)).map((p) => ({
  id: p.id,
  name: pick(p.name_trans),
  url: `https://www.popmart.com/${AREA.toLowerCase()}/products/${p.id}/${p.slugTitle}`,
  price: p.price / 100,
  currency: p.currency,
  tags: p.tags,
  stock: p.stock,
  businessType: p.businessType,
  saleStartAt: p.saleStartAt,
  images: [...new Set([pick(p.npcImages_trans), ...(p.bannerImages ?? []).map((b) => pick(b.link_trans)), ...Object.values(p.sceneImages_trans ?? {}).flat()].filter((u) => typeof u === 'string' && u))],
}));

// Codes-barres : un appel de détail par produit (skus[].barCode, EAN-13 ; vide pour certains produits « draw » / à venir).
// Les blind box partagent un seul code pour « Single Box » et « Whole Set ». En cas d'échec, on garde les skus du précédent products.json.
const previous = existsSync('products.json') ? new Map(JSON.parse(readFileSync('products.json', 'utf8')).map((p) => [p.id, p.skus])) : new Map();
const fetchSkus = async (p) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const d = await rpc(DETAIL_API, { id: p.id, channel: p.businessType });
      return (d.skus ?? []).map((s) => ({ name: pick(s.name_trans), skuCode: s.skuCode || '', barCode: s.barCode || '' }));
    } catch (e) {
      if (attempt === 3) { console.warn(`détail indisponible : ${p.name} (${e.message})`); return previous.get(p.id); }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
};
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < products.length) { const p = products[next++]; const skus = await fetchSkus(p); if (skus) p.skus = skus; }
}));
const withCode = products.filter((p) => p.skus?.some((s) => s.barCode)).length;
const missing = products.filter((p) => !p.skus).length;

writeFileSync('products.json', JSON.stringify(products, null, 2));
const meta = { generatedAt: new Date().toISOString(), count: products.length, withBarcode: withCode }; // affiché en pied de page de l'appli
writeFileSync('products.js', `window.PRODUCTS=${JSON.stringify(products)};window.PRODUCTS_META=${JSON.stringify(meta)};`); // consommé par index.html
console.log(`${products.length} produits (total annoncé : ${first.total}), ${products.reduce((n, p) => n + p.images.length, 0)} images -> products.json, products.js`);
console.log(`codes-barres : ${withCode} produits avec au moins un code, ${products.length - withCode - missing} sans code, ${missing} sans détail`);
