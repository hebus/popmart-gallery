# Pop Mart – Galerie

Petite application web statique pour rechercher un produit popmart.com par nom, voir toutes ses images et constituer une collection exportable en JSON.

- `list-products.mjs` : récupère le catalogue via l'API publique de popmart.com et génère `products.json` et `products.js`, avec les codes-barres EAN par SKU via l'API de détail (`node list-products.mjs`, ~15 s). Le scanner de l'onglet Collection et la barre de recherche retrouvent un produit par son code-barres
- `index.html` : l'application (la collection est stockée dans le `localStorage`). Animations via GSAP + Flip chargés depuis cdnjs (l'appli reste utilisable sans animation si le CDN est inaccessible ou si `prefers-reduced-motion` est actif)
- Wishlist : cœur sur chaque image du détail d'un produit ; la wishlist a son propre onglet (icône cœur), se partage par lien/QR `#w=` et est incluse dans la sauvegarde par fichier (voir `ARCHITECTURE.md`).
- Transfert direct d'un appareil à l'autre (WebRTC, sans plafond de taille, photos en pleine qualité) : icône de transfert dans l'onglet Collection (voir `ARCHITECTURE.md`).
- `CHANGELOG.md` : journal des versions (semver). La version et la date du catalogue sont affichées en pied de page de l'appli.
- `ARCHITECTURE.md` : comportement attendu de l'application et check-list de non-régression
- Nettoyage automatique des partages expirés : exécuter `supabase/cleanup.sql` (tâche `pg_cron` toutes les 30 minutes ; sans lui, ils ne sont supprimés qu'à la création d'un nouveau partage).
- Partage chiffré des figurines perso : exécuter `supabase/shares.sql` (puis `supabase/shares-tests.sql`) dans le SQL Editor Supabase ; sans cela, Share reste limité au catalogue. Détails dans `ARCHITECTURE.md`.
- Partage : le bouton « Share » génère un QR code (lien `BASE_URL#c=…`, voir `ARCHITECTURE.md`). Dépendances supplémentaires : `qrcode-generator` (génération, cdnjs) et `jsQR` (lecture des QR, jsDelivr, chargé seulement si `BarcodeDetector` ne sait pas lire les QR) et `@zxing/library` (lecture des codes-barres, jsDelivr, chargé seulement si `BarcodeDetector` ne sait pas les lire). `BASE_URL` doit pointer vers l'appli publiée (GitHub Pages) pour que l'appareil photo l'ouvre.
- Figurines personnelles : bouton « + Ajouter » de l'onglet Collection (nom + photo prise ou choisie dans la galerie). Les photos sont stockées dans IndexedDB sur l'appareil, jamais envoyées ; elles sont exclues du partage QR et des échanges (voir `ARCHITECTURE.md`).
- Sauvegarde : le bouton-icône « Sauvegarde » de l'onglet Collection exporte/importe un fichier JSON avec les images, les quantités et les figurines perso (photos incluses) ; format décrit dans `ARCHITECTURE.md`.
- PWA : l'appli s'installe sur l'écran d'accueil du téléphone (bannière d'invitation sur mobile) et fonctionne hors-ligne (`sw.js`, `manifest.webmanifest`, `icons/`). Les icônes sont générées par `node scripts/make-icons.mjs`. Détails et limites (images du catalogue) dans `ARCHITECTURE.md`.
- Échanges / ventes : backend Supabase (voir `ARCHITECTURE.md`). Mise en place : créer un projet Supabase, activer *Authentication → Sign In / Providers → Allow anonymous sign-ins*, exécuter `supabase/schema.sql` (puis `supabase/rls-tests.sql` pour vérifier la sécurité) dans le SQL Editor, et renseigner `SUPABASE_URL` / `SUPABASE_ANON_KEY` (clé anon publique, jamais `service_role`) en tête de `exchange.js`.
