# Journal des versions

Numérotation semver : **majeure** = changement incompatible (format de sauvegarde, de partage), **mineure** = nouvelle fonctionnalité, **correctif** = correction. La version affichée en pied de page vient de `APP_VERSION` dans `index.html` ; la date du catalogue vient de `window.PRODUCTS_META` (`products.js`, généré par `node list-products.mjs`). À chaque livraison : incrémenter `APP_VERSION`, ajouter une entrée ici, puis commiter.

## 1.3.1 - 2026-11-21
- Correctif : la saisie manuelle et le scan d'un code-barres n'étaient jamais reconnus comme tels (expression régulière `/^d{8,14}$/` sans antislash : elle n'acceptait que des « d » au lieu de chiffres) ; ils partaient dans l'import de lien. Corrigé en `/^\d{8,14}$/`.

## 1.3.0 - 2026-11-21
- Dossiers dans la collection (un seul niveau : un dossier ne contient que des images, jamais d'autres dossiers ; création uniquement à la racine). Création par le bouton « Nouveau dossier », par glisser-déposer d'une image sur une autre, ou depuis une sélection.
- Glisser une image sur un dossier la déplace dedans ; dans un dossier, la glisser sur « Retour à la collection » la remet à la racine.
- Nom du dossier toujours demandé, prérempli d'après le nom des produits (personnage + série, ex. « THE MONSTERS » ou « DIMOO Mood Forecast »).
- Sélection multiple façon galerie iPhone : appui long sur une image (ou bouton « Sélectionner », Ctrl/Cmd + clic sur PC), puis « Déplacer… » vers un dossier, la racine ou un nouveau dossier.
- Renommer et supprimer un dossier ; la suppression d'un dossier non vide demande **toujours** une confirmation et remet ses images à la racine (aucune image n'est supprimée).
- Les dossiers sont inclus dans la sauvegarde par fichier (clé optionnelle `folders`, format v1 inchangé) et dans le partage chiffré ; le QR `#c=` et le lien wishlist `#w=` restent à plat.

## 1.2.0 - 2026-11-19
- Wishlist : cœur sur chaque image du détail d'un produit ; consultation dans l'onglet Collection (bascule Collection | Wishlist) ; « Déplacer » vers la collection ; suppression ; signalement des souhaits déjà en collection (+ « Retirer les possédés ») ; retrait automatique du souhait quand l'image est ajoutée à la collection.
- Partage de la wishlist par lien et QR code (`#w=`, sans serveur), réception via scanner, lien collé ou appareil photo ; la wishlist est incluse dans la sauvegarde par fichier (jamais dans un partage chiffré).

## 1.1.1 - 2026-11-19
- Code-barres absent du catalogue : écran « Produit introuvable » lisible (code scanné en grand, explication, boutons « Scanner un autre code » et « Chercher par nom ») à la place d'un message grisé peu visible.

## 1.1.0 - 2026-11-19
- Codes-barres (EAN-13) par SKU dans le catalogue, via l'API de détail `public_FindOne`.
- Scanner : lecture des codes-barres (natif ou ZXing pour iPhone, Firefox, Chrome PC) en plus des QR ; saisie manuelle d'un code ; la recherche retrouve aussi par code-barres ; la fiche affiche les codes.
- Catalogue mis à jour : 765 produits (+74).
- Numéro de version et date du catalogue affichés en pied de page.

## 1.0.0 - 2026-10-03
- Première version suivie : galerie avec recherche, collection, figurines perso, partage par QR et lien chiffré, échanges et ventes (Supabase), sauvegarde par fichier, PWA hors-ligne.
