// Fonctions pures du rafraîchissement du catalogue (utilisées par list-products.mjs, testables sans réseau).

// Fusion avec le catalogue précédent : un produit déjà connu n'est JAMAIS supprimé (il peut être dans des collections, des
// partages ou des annonces). S'il n'est plus renvoyé par le site, il est conservé avec `retired: true` : l'appli le masque du
// catalogue mais continue de le résoudre (collection, partage, code-barres). Un produit qui réapparaît perd `retired`
// (il vient de `current`, qui ne porte pas ce champ).
export function mergeCatalog(current, previous) {
  const seen = new Set(current.map((p) => p.id));
  const retired = previous.filter((p) => !seen.has(p.id)).map((p) => ({ ...p, retired: true }));
  return [...current, ...retired];
}

// Garde-fou : une réponse partielle de l'API (blocage, panne) ne doit pas appauvrir le catalogue.
export function suspiciousDrop(currentCount, previous, ratio = 0.8) {
  const before = previous.filter((p) => !p.retired).length;
  return before > 0 && currentCount < before * ratio;
}
