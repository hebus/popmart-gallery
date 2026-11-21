// Code de sortie 0 si products.json (copie de travail) ne diffère de celui du dernier commit que par des champs volatils
// (stock, tags : voir catalog-merge.mjs) ; 1 s'il y a un vrai changement ou si la comparaison est impossible.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sameCatalog } from '../catalog-merge.mjs';

try {
  const committed = JSON.parse(execFileSync('git', ['show', 'HEAD:products.json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const fresh = JSON.parse(readFileSync('products.json', 'utf8'));
  const same = sameCatalog(committed, fresh);
  console.log(same ? 'Seuls des champs volatils (stock, tags) ont changé.' : 'Changement réel du catalogue.');
  process.exit(same ? 0 : 1);
} catch (e) {
  console.log(`Comparaison impossible (${e.message.split('\n')[0]}) : on considère que le catalogue a changé.`);
  process.exit(1);
}
