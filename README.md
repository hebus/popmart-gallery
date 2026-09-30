# Pop Mart – Galerie

Petite application web statique pour rechercher un produit popmart.com par nom, voir toutes ses images et constituer une collection exportable en JSON.

- `list-products.mjs` : récupère le catalogue via l'API publique de popmart.com et génère `products.json` et `products.js` (`node list-products.mjs`)
- `index.html` : l'application (aucune dépendance, la collection est stockée dans le `localStorage`)
