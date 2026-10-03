# Pop Mart – Galerie

Petite application web statique pour rechercher un produit popmart.com par nom, voir toutes ses images et constituer une collection exportable en JSON.

- `list-products.mjs` : récupère le catalogue via l'API publique de popmart.com et génère `products.json` et `products.js` (`node list-products.mjs`)
- `index.html` : l'application (la collection est stockée dans le `localStorage`). Animations via GSAP + Flip chargés depuis cdnjs (l'appli reste utilisable sans animation si le CDN est inaccessible ou si `prefers-reduced-motion` est actif)
- `ARCHITECTURE.md` : comportement attendu de l'application et check-list de non-régression
- Nettoyage automatique des partages expirés : exécuter `supabase/cleanup.sql` (tâche `pg_cron` toutes les 30 minutes ; sans lui, ils ne sont supprimés qu'à la création d'un nouveau partage).
- Partage chiffré des figurines perso : exécuter `supabase/shares.sql` (puis `supabase/shares-tests.sql`) dans le SQL Editor Supabase ; sans cela, Share reste limité au catalogue. Détails dans `ARCHITECTURE.md`.
- Partage : le bouton « Share » génère un QR code (lien `BASE_URL#c=…`, voir `ARCHITECTURE.md`). Dépendances supplémentaires : `qrcode-generator` (génération, cdnjs) et `jsQR` (lecture, jsDelivr, chargé seulement si `BarcodeDetector` ne sait pas lire les QR). `BASE_URL` doit pointer vers l'appli publiée (GitHub Pages) pour que l'appareil photo l'ouvre.
- Figurines personnelles : bouton « + Ajouter » de l'onglet Collection (nom + photo prise ou choisie dans la galerie). Les photos sont stockées dans IndexedDB sur l'appareil, jamais envoyées ; elles sont exclues du partage QR et des échanges (voir `ARCHITECTURE.md`).
- Sauvegarde : le bouton-icône « Sauvegarde » de l'onglet Collection exporte/importe un fichier JSON avec les images, les quantités et les figurines perso (photos incluses) ; format décrit dans `ARCHITECTURE.md`.
- PWA : l'appli s'installe sur l'écran d'accueil du téléphone (bannière d'invitation sur mobile) et fonctionne hors-ligne (`sw.js`, `manifest.webmanifest`, `icons/`). Les icônes sont générées par `node scripts/make-icons.mjs`. Détails et limites (images du catalogue) dans `ARCHITECTURE.md`.
- Échanges / ventes : backend Supabase (voir `ARCHITECTURE.md`). Mise en place : créer un projet Supabase, activer *Authentication → Sign In / Providers → Allow anonymous sign-ins*, exécuter `supabase/schema.sql` (puis `supabase/rls-tests.sql` pour vérifier la sécurité) dans le SQL Editor, et renseigner `SUPABASE_URL` / `SUPABASE_ANON_KEY` (clé anon publique, jamais `service_role`) en tête de `exchange.js`.
