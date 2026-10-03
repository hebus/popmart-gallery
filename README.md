# Pop Mart – Galerie

Petite application web statique pour rechercher un produit popmart.com par nom, voir toutes ses images et constituer une collection exportable en JSON.

- `list-products.mjs` : récupère le catalogue via l'API publique de popmart.com et génère `products.json` et `products.js` (`node list-products.mjs`)
- `index.html` : l'application (la collection est stockée dans le `localStorage`). Animations via GSAP + Flip chargés depuis cdnjs (l'appli reste utilisable sans animation si le CDN est inaccessible ou si `prefers-reduced-motion` est actif)
- `ARCHITECTURE.md` : comportement attendu de l'application et check-list de non-régression
- Partage : le bouton « Share » génère un QR code (lien `BASE_URL#c=…`, voir `ARCHITECTURE.md`). Dépendances cdnjs supplémentaires : `qrcode-generator` (génération) et `jsQR` (lecture, chargé seulement si `BarcodeDetector` est absent). `BASE_URL` doit pointer vers l'appli publiée (GitHub Pages) pour que l'appareil photo l'ouvre.
