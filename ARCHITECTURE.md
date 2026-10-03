# Architecture et comportement attendu

Document de référence pour éviter les régressions. Toute modification de `index.html` doit respecter les comportements ci-dessous.

## Vue d'ensemble

- Application statique mobile-first, sans build : `index.html` (HTML, CSS et JS inline) + `products.js` (`window.PRODUCTS`).
- `products.js` / `products.json` sont générés par `node list-products.mjs` (API publique popmart.com). Ne pas les éditer à la main.
- Dépendances externes : GSAP + Flip (cdnjs) pour les animations, Google Fonts. L'appli doit rester **entièrement fonctionnelle sans elles** (voir « Animations »).
- Conception visuelle : palette crème / encre (`--bg`, `--accent`…), mode sombre via `prefers-color-scheme`, cibles tactiles >= 44 px.

## Responsive : mobile first (règle non négociable)

Le CSS de base cible un écran de **360 à 390 px** ; les `@media (min-width: 640px)` ne font qu'enrichir (grille `auto-fill`, titre plus grand). Ne jamais écrire le mobile comme une surcharge du desktop.

- **Aucun scroll horizontal** à 360 px, dans aucune vue (catalogue, détail, collection, zoom). Toute rangée de boutons doit pouvoir passer à la ligne (`flex-wrap`) ; les onglets se partagent la largeur (`flex:1`).
- En-tête sticky **compact** : titre + pastille, recherche, onglets. Ne pas y ajouter d'autres boutons ; les actions de la collection (Share, Scanner, Vider) vivent dans la ligne du compteur, sous l'en-tête.
- Grilles à **2 colonnes** sur mobile (`repeat(2, minmax(0,1fr))`), toujours avec `minmax(0, …)` pour que le contenu ne force pas la largeur.
- Textes longs : `overflow-wrap:anywhere` sur `body` ; les contenus des cartes sont à largeur contrainte (nom sur 2 lignes max, ligne prix / `n/total` qui peut passer à la ligne).
- Cibles tactiles >= 44 px, champ de recherche en 16 px (évite le zoom automatique iOS), `dvh` et `env(safe-area-inset-*)` pour les barres de navigateur et l'encoche.
- Aucune interaction ne doit dépendre du survol.

## Modèle de données

- **Produit** (`products.js`) : `{ id, name, url, price, currency, images[], … }`. Un « produit » est une série (ex. « … Chibi Series Figures ») qui contient plusieurs images.
- **Collection** : tableau d'**images**, pas de produits : `[{ src, id, name }]` (`src` = URL de l'image, `id`/`name` = produit d'origine).
- Persistance : `localStorage['popmart-collection']`. Au chargement, un ancien format (liste d'identifiants de produits) est converti en images (première image du produit).

## Écrans et parcours attendus

L'en-tête (titre, pastille de compteur, recherche, onglets) est sticky et visible partout.

1. **Catalogue** (onglet « Catalogue », vue par défaut)
   - Grille de cartes produit : image de couverture, nom, prix, indicateur `n/total en collection` (ou `N image(s)`).
   - La recherche filtre par nom (insensible à la casse et aux accents, tous les mots doivent correspondre) avec un délai de 200 ms ; le compteur affiche `N produit(s)`.
   - Affichage par lots de 40 avec « Afficher plus ».
   - **Un clic sur une carte ouvre le détail du produit** (fonction principale, ne pas la retirer).
2. **Détail d'un produit**
   - Remplace le catalogue (le catalogue est masqué, sa recherche et sa position de scroll sont conservées).
   - Affiche le nom, le prix, le nombre d'images, le lien « Voir sur popmart.com » et **toutes les images du produit**.
   - Chaque image a un bouton rond + / ✓ : un clic sur le bouton ou sur l'image ajoute ou retire **cette image** de la collection. Un bouton ⤢ l'agrandit.
   - « Retour à la liste » revient au catalogue avec la même recherche, le même scroll, et les indicateurs `n/total` mis à jour.
   - Changer d'onglet ou modifier la recherche quitte le détail.
3. **Ma collection** (onglet)
   - Grille des images ajoutées, filtrable par la même recherche (sur le nom du produit) ; compteur `N image(s)`.
   - Un clic sur l'image l'agrandit ; le bouton ✓ la retire (la carte disparaît et la grille se réorganise).
   - Boutons (dans la ligne du compteur, pas dans l'en-tête) **Share** (désactivé si la collection est vide), **Scanner** et **Vider** (avec confirmation). Voir « Partage » ci-dessous. Il n'y a plus de bouton « Exporter JSON » : le JSON n'est qu'un repli dans la fenêtre Share.
   - Collection vide : message « Collection vide ».
4. **Zoom** : `<dialog>` plein écran affichant l'image ; se ferme avec ✕, un clic hors de l'image ou Échap.

La pastille de l'en-tête affiche toujours le nombre d'images de la collection et se met à jour immédiatement.

## Partage de la collection (Share / Scanner / Import)

Objectif : transférer sa collection vers un autre appareil par QR code, sans serveur.

- **Lien** : `BASE_URL + '#c=' + charge`. `BASE_URL` (`https://hebus.github.io/popmart-gallery/`, GitHub Pages) est une constante en haut du bloc « Partage » de `index.html` ; la changer si l'hébergement change.
- **Charge utile v1** : `1|<idProduit>:<i,j,k>|<idProduit2>:<i>…`. `id` = identifiant du produit, `i` = **indice dans `product.images[]`**. Aucune URL d'image n'est transmise : les deux appareils doivent avoir le même `products.js`. Préfixe `z` + base64url du deflate-raw (si `CompressionStream` existe) ou `r` + base64url brut. Toute évolution du format incrémente la version (`1` -> `2`) ; une version inconnue est refusée.
- **Capacité** : QR niveau L, ≈ 2 950 octets au maximum, soit ~96 produits (≈ 830 images) mesurés. Au-delà, pas de QR tronqué : la fenêtre Share affiche un message et ne propose que « Télécharger JSON » (champs `image`, `productId`, `productName`, `productUrl`, `price`, `currency`). Au-delà de ~1 100 caractères le QR est dense : un avertissement est affiché.
- **Share** : fenêtre unique `#sheet` (réutilisée par Share, Scanner, Import et les messages) avec QR, « Copier le lien », « Partager… » (Web Share, si dispo), « Télécharger JSON », « Fermer ».
- **Réception par l'appareil photo** : l'URL s'ouvre sur l'appli, le hash `#c=` est lu au chargement (et sur `hashchange`) puis **effacé** (`history.replaceState`) pour qu'un rechargement ne ré-importe pas.
- **Scanner intégré** : caméra arrière (`getUserMedia`, HTTPS ou localhost requis), `BarcodeDetector` si disponible, sinon `jsQR` chargé à la demande. Tout QR contenant `#c=` est accepté ; le flux caméra est **toujours** arrêté (scan réussi, fermeture, changement de contenu de la fenêtre). Caméra refusée : message, l'appli reste utilisable.
- **Import** : collection locale vide -> import direct ; sinon fenêtre **Fusionner** (ajout sans doublon sur `src`) / **Remplacer** (confirmation) / **Annuler**. Après import : onglet « Ma collection », pastille mise à jour.
- **Sécurité** : la charge utile est une donnée non fiable. `decodeCollection` valide le préfixe, la taille (déflate plafonné à 200 Ko, anti zip-bomb), la version, le format UUID des ids, l'existence du produit, des indices entiers dans les bornes, <= 2 000 produits / 500 indices par produit ; les éléments invalides sont comptés comme « ignorés ». Les valeurs ne sont jamais insérées via `innerHTML` (seul le SVG du QR, généré localement, l'est).
- Sans CDN : `qrcode-generator` absent -> Share propose le JSON ; `jsQR` absent -> message dans le scanner ; le reste de l'appli fonctionne.

## Animations (GSAP)

Toutes passent par l'objet `fx` ; la logique métier ne doit jamais dépendre d'une animation.

- Ajout : l'image s'envole vers la pastille, le compteur rebondit, le bouton + devient ✓ avec une onde.
- Suppression : la carte se réduit puis disparaît, la grille se réorganise (Flip).
- Transitions : apparition en cascade des cartes, glissement du détail à l'ouverture et au retour.
- Sans GSAP (CDN inaccessible) ou avec `prefers-reduced-motion`, `fx` ne fait rien et tous les parcours ci-dessus fonctionnent à l'identique.

## Check-list de non-régression

À vérifier après toute modification (sur mobile 390 px et sur desktop) :

- [ ] À 360 px et 390 px de large : aucun scroll horizontal dans le catalogue, le détail, la collection (avec les boutons Share / Scanner / Vider) et les fenêtres Share, Scanner, Import et le zoom.
- [ ] Rechercher un mot, cliquer un produit : le détail affiche toutes ses images.
- [ ] Ajouter plusieurs images depuis le détail : la pastille s'incrémente, le bouton passe à ✓.
- [ ] Retour : même recherche, même scroll, indicateur `n/total` correct.
- [ ] Onglet « Ma collection » : les images ajoutées sont affichées ; en retirer une la fait disparaître.
- [ ] Recharger la page : la collection est conservée.
- [ ] Vider (confirmation) fonctionne ; Share est désactivé quand la collection est vide.
- [ ] Share : le QR s'affiche, « Copier le lien » donne un lien `…/#c=…` ; ouvert dans un onglet privé il importe la même collection.
- [ ] Import avec une collection existante : Fusionner (sans doublon) / Remplacer (confirmation) / Annuler ; le hash disparaît de l'URL.
- [ ] Scanner : lit un QR Share ; la caméra s'éteint (voyant) après le scan et à la fermeture ; refus de caméra = message sans erreur.
- [ ] Liens invalides ou produits inconnus : message « ignorée(s) » ou « Import impossible », aucune erreur console.
- [ ] Collection énorme : message + « Télécharger JSON », pas de QR cassé.
- [ ] Aucune erreur console ; l'appli fonctionne avec GSAP bloqué.
