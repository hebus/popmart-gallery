// Liste tous les produits popmart.com (zone FR) via l'API publique observée dans le HAR.
import { writeFileSync } from 'node:fs';

const API = 'https://prod-uk-online-api.popmart.com/rpc/ec/spu/public_FindSummariesByCollectionId';
const ALL_PRODUCTS = 'e65509b9-1ae7-4f57-81de-4f05c412bddf'; // collection "Tous les produits"
const AREA = process.env.AREA ?? 'FR';
const LANG = process.env.LANG_CODE ?? 'fr';
const PAGE_SIZE = 50;

const post = async (page) => {
  const res = await fetch(API, {
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
    body: JSON.stringify({ json: { page, pageSize: PAGE_SIZE, sortWay: 'recommend', businessTypes: ['shop', 'draw'], categoryId: [], ipId: [], includeAllOptions: true, collectionId: ALL_PRODUCTS } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (page ${page})`);
  return (await res.json()).json;
};

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

writeFileSync('products.json', JSON.stringify(products, null, 2));
writeFileSync('products.js', `window.PRODUCTS=${JSON.stringify(products)};`); // consommé par index.html
console.log(`${products.length} produits (total annoncé : ${first.total}), ${products.reduce((n, p) => n + p.images.length, 0)} images -> products.json, products.js`);
