# Journal des versions

Numérotation semver : **majeure** = changement incompatible (format de sauvegarde, de partage), **mineure** = nouvelle fonctionnalité, **correctif** = correction. La version affichée en pied de page vient de `APP_VERSION` dans `index.html` ; la date du catalogue vient de `window.PRODUCTS_META` (`products.js`, généré par `node list-products.mjs`). À chaque livraison : incrémenter `APP_VERSION`, ajouter une entrée ici, puis commiter.

## 1.8.1 - 2026-11-21
- Mise à jour automatique du catalogue : le stock et les tags (OUT_OF_STOCK, COMING_SOON, NEW), qui changent sans cesse, sont ignorés pour décider de commiter ; plus de commit quotidien pour du simple bruit de stock.

## 1.8.0 - 2026-11-21
- Catalogue mis à jour automatiquement chaque jour depuis popmart.com/fr (GitHub Actions, `.github/workflows/update-catalog.yml`) : commit seulement si le catalogue change, lancement manuel possible.
- Fusion avec le catalogue précédent : un produit déjà connu n'est jamais supprimé ; s'il n'est plus sur le site il est conservé (`retired`), masqué du catalogue mais toujours résolu dans les collections, partages et recherches par code-barres, avec la mention « n'est plus proposé sur popmart.com » dans sa fiche.
- Garde-fou : si l'API renvoie plus de 20 % de produits en moins (réponse partielle), rien n'est modifié.

## 1.7.2 - 2026-11-21
- États vides (collection vide, aucun résultat…) : message centré verticalement dans la zone sous l'en-tête, largeur de texte limitée, et le bouton « Ajouter une figurine » sur sa propre ligne, centré.

## 1.7.1 - 2026-11-21
- En-tête : ordre des boutons inversé, de gauche à droite « collection N », alertes, compte.

## 1.7.0 - 2026-11-21
- Un seul bouton Partager (icône), dans la rangée d'onglets de l'en-tête, qui partage ce que montre la vue ouverte : la collection en vue Collection, la wishlist en vue Wishlist (invisible dans le catalogue et les échanges). Les boutons Share des barres d'outils disparaissent.

## 1.6.2 - 2026-11-21
- En-tête : suppression de l'onglet « Collection » (doublon de la pastille « collection N » près du compte et de la cloche). La pastille ouvre la collection et se détache par un contour quand la vue Collection est active ; il reste les onglets Catalogue, Échanges et Wishlist.

## 1.6.1 - 2026-11-21
- Vue Collection : les boutons « Ajouter » et « Share » deviennent des icônes seules (plus, partage), avec libellé accessible et infobulle.

## 1.6.0 - 2026-11-21
- Le scanner de codes-barres / QR passe à côté de la zone de recherche (icône à droite du champ) : accessible depuis toutes les vues, y compris le catalogue, au lieu de la seule ligne d'outils de la collection.

## 1.5.1 - 2026-11-21
- Correctif : les onglets Catalogue et Collection passaient sur deux lignes quand ils étaient sélectionnés (libellé en gras plus large avec quatre onglets) ; retour à la ligne interdit et onglets resserrés sous 420 px.

## 1.5.0 - 2026-11-21
- Transfert direct d'un appareil à l'autre (WebRTC) : QR code à scanner, connexion directe chiffrée, sans plafond de taille, photos en pleine qualité, dossiers et wishlist inclus, rien n'est stocké en ligne. Mise en relation par Supabase Realtime avec des messages chiffrés par une clé qui reste dans le lien.

## 1.4.0 - 2026-11-21
- En-tête : la wishlist devient un onglet à icône cœur (avec compteur) à côté de Catalogue, Collection et Échanges ; la bascule « Collection (n) | Wishlist (n) » est supprimée.
- Dossiers : la vue racine est repeinte proprement après chaque déplacement, création, renommage ou suppression (animations en cours coupées, transition CSS parasite retirée des cartes).
- Partage chiffré : conteneur binaire (photos en octets bruts, plus de base64 dans du JSON, ≈ −25 %), photos en WebP avec compression adaptative sur 5 niveaux pour tenir dans le plafond, progression détaillée, annulation réelle (fermer la fenêtre interrompt tout), délai d'envoi maximum de 90 s. Les anciens partages restent lisibles.

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
