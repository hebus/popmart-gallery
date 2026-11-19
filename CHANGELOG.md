# Journal des versions

Numérotation semver : **majeure** = changement incompatible (format de sauvegarde, de partage), **mineure** = nouvelle fonctionnalité, **correctif** = correction. La version affichée en pied de page vient de `APP_VERSION` dans `index.html` ; la date du catalogue vient de `window.PRODUCTS_META` (`products.js`, généré par `node list-products.mjs`). À chaque livraison : incrémenter `APP_VERSION`, ajouter une entrée ici, puis commiter.

## 1.1.1 - 2026-11-19
- Code-barres absent du catalogue : écran « Produit introuvable » lisible (code scanné en grand, explication, boutons « Scanner un autre code » et « Chercher par nom ») à la place d'un message grisé peu visible.

## 1.1.0 - 2026-11-19
- Codes-barres (EAN-13) par SKU dans le catalogue, via l'API de détail `public_FindOne`.
- Scanner : lecture des codes-barres (natif ou ZXing pour iPhone, Firefox, Chrome PC) en plus des QR ; saisie manuelle d'un code ; la recherche retrouve aussi par code-barres ; la fiche affiche les codes.
- Catalogue mis à jour : 765 produits (+74).
- Numéro de version et date du catalogue affichés en pied de page.

## 1.0.0 - 2026-10-03
- Première version suivie : galerie avec recherche, collection, figurines perso, partage par QR et lien chiffré, échanges et ventes (Supabase), sauvegarde par fichier, PWA hors-ligne.
