# Architecture et comportement attendu

Document de référence pour éviter les régressions. Toute modification de `index.html` doit respecter les comportements ci-dessous.

## Vue d'ensemble

- Application statique mobile-first, sans build : `index.html` (HTML, CSS et JS inline) + `products.js` (`window.PRODUCTS`) + `exchange.js` (couche données Supabase des échanges, sans UI) + `supabase/schema.sql` (base et règles de sécurité).
- `products.js` / `products.json` sont générés par `node list-products.mjs` (API publique popmart.com). Ne pas les éditer à la main.
- Dépendances externes : GSAP + Flip (cdnjs) pour les animations, Google Fonts. L'appli doit rester **entièrement fonctionnelle sans elles** (voir « Animations »).
- Conception visuelle : palette crème / encre (`--bg`, `--accent`…), mode sombre via `prefers-color-scheme`, cibles tactiles >= 44 px.

## Responsive : mobile first (règle non négociable)

Le CSS de base cible un écran de **360 à 390 px** ; les `@media (min-width: 640px)` ne font qu'enrichir (grille `auto-fill`, titre plus grand). Ne jamais écrire le mobile comme une surcharge du desktop.

- **Aucun scroll horizontal** à 360 px, dans aucune vue (catalogue, détail, collection, zoom). Toute rangée de boutons doit pouvoir passer à la ligne (`flex-wrap`) ; les onglets se partagent la largeur (`flex:1`).
- En-tête sticky **compact** : titre + profil (icône utilisateur) + cloche + pastille, recherche, 3 onglets (« Catalogue », « Collection », « Échanges », libellés courts pour tenir à 360 px). Ne pas y ajouter d'autres boutons ; les actions de la collection (Share, Scanner, Vider) vivent dans la ligne du compteur, sous l'en-tête.
- Grilles à **2 colonnes** sur mobile (`repeat(2, minmax(0,1fr))`), toujours avec `minmax(0, …)` pour que le contenu ne force pas la largeur.
- Textes longs : `overflow-wrap:anywhere` sur `body` ; les contenus des cartes sont à largeur contrainte (nom sur 2 lignes max, ligne prix / `n/total` qui peut passer à la ligne).
- Cibles tactiles >= 44 px, champ de recherche en 16 px (évite le zoom automatique iOS), `dvh` et `env(safe-area-inset-*)` pour les barres de navigateur et l'encoche.
- Aucune interaction ne doit dépendre du survol.

## Modèle de données

- **Produit** (`products.js`) : `{ id, name, url, price, currency, images[], … }`. Un « produit » est une série (ex. « … Chibi Series Figures ») qui contient plusieurs images.
- **Collection** : tableau d'**images**, pas de produits : `[{ src, id, name, qty }]` (`src` = URL de l'image, `id`/`name` = produit d'origine, `qty` = nombre d'exemplaires, 1 à 99, 1 par défaut). Un **doublon** = `qty >= 2` (information : toute image du catalogue peut être proposée dans les échanges, pas seulement les doublons).
- Persistance : `localStorage['popmart-collection']`. Au chargement, un ancien format (liste d'identifiants de produits) est converti en images (première image du produit) et `qty` absent vaut 1.
- La quantité n'est **pas** transmise par le partage QR (format `#c=` v1 inchangé) : un import crée des éléments avec `qty = 1`, une fusion conserve la quantité locale. La sauvegarde par fichier (voir « Sauvegarde et restauration ») contient `quantity`.
- **Figurine perso** (absente du catalogue) : `{ src: 'local:<uuid>', id: 'local:<uuid>', name, note?, qty, custom: true }`. `src` et `id` valent la même référence, donc tout le code indexé par `src` fonctionne tel quel. La **photo** n'est pas dans le `localStorage` mais dans **IndexedDB** (base `popmart`, store `photos`, clé = uuid, valeur `{ type, data: ArrayBuffer }` du JPEG, plus fiable qu'un `Blob` selon les navigateurs ; la lecture accepte aussi un `Blob`), via le module `photoStore` ; `img()` charge les `local:` depuis ce module. Les photos ne quittent **jamais** l'appareil. Plafond : 200 figurines perso.

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
3. **Collection** (onglet)
   - Grille des images ajoutées, filtrable par la même recherche (sur le nom du produit) ; compteur `N image(s)`.
   - Un clic sur l'image l'agrandit ; le bouton ✓ la retire (la carte disparaît et la grille se réorganise).
   - Chaque carte a un sélecteur de quantité `− ×n +` (min 1) ; un bouton « Proposer » / « Modifier l'annonce » apparaît sur **toute** carte du catalogue, quelle que soit la quantité (voir « Échanges »). Il est absent des figurines perso (ajouts manuels, pas encore proposables).
   - Boutons (dans la ligne du compteur, pas dans l'en-tête) **Share** (désactivé si la collection ne contient aucune image du catalogue), **Scanner**, **Sauvegarde** et **Vider**. Scanner, Sauvegarde et Vider sont des **boutons-icônes** (44 px, icône seule, `aria-label` + `title` obligatoires : « Scanner un QR code », « Sauvegarde de la collection », « Vider la collection ») ; Vider demande une confirmation. Voir « Partage » ci-dessous. Il n'y a plus de bouton « Exporter JSON » : l'export est la sauvegarde par fichier, aussi proposée dans la fenêtre Share.
   - Collection vide : message « Collection vide » avec un bouton « Ajouter une figurine ».
   - Bouton **« + Ajouter »** (ligne d'outils) : ouvre la fenêtre d'ajout d'une figurine perso. Sur le catalogue, une recherche sans résultat propose « Ajouter « <recherche> » à ma collection » (nom prérempli).
   - **Fenêtre d'ajout / modification** : un **aperçu carré cliquable** (« Aucune photo · Touchez pour prendre une photo » ; un clic ouvre l'appareil photo via `<input type=file accept=image/* capture=environment>`, **y compris quand une photo est déjà visible**, pastille d'appareil photo en coin) et un bouton « Galerie » (même input sans `capture`) ; aucune API caméra, donc aucune autorisation à gérer côté appli (refusée, la galerie reste possible). Nom obligatoire (80 car.), note (140), quantité. « Ajouter » reste désactivé tant que nom **et** photo manquent. La photo est réduite à 1024 px et ré-encodée en JPEG (0,82), ce qui **supprime les métadonnées EXIF, dont le GPS**. Si l'écriture IndexedDB échoue, rien n'est ajouté (la métadonnée n'est écrite qu'après la photo) et le message affiche la **vraie cause** (`storageError` : stockage plein, stockage bloqué / navigation privée, ou autre avec le nom de l'erreur) ; une erreur survenant après l'écriture est signalée comme « Erreur inattendue », jamais déguisée en problème de stockage.
   - **Carte perso** : badge « Ma figurine » (+ note), quantité `− ×n +`, bouton « Modifier » (à la place de « Proposer »), ✓ pour supprimer (confirmation, la photo est supprimée). Une photo introuvable (données du site effacées) affiche « Photo introuvable ».
4. **Échanges** (onglet) : annonces des utilisateurs (toute image du catalogue de leur collection), voir « Échanges, intérêts et notifications ».
5. **Zoom** : `<dialog>` plein écran affichant l'image ; se ferme avec ✕, un clic hors de l'image ou Échap.

La pastille de l'en-tête (un `<button>`, à droite de la cloche) affiche toujours le nombre d'images de la collection et se met à jour immédiatement ; **un clic dessus ouvre l'onglet « Collection »**, comme le bouton d'onglet (y compris depuis le détail d'un produit ou l'onglet Échanges).

## Partage de la collection (Share / Scanner / Import)

Objectif : transférer sa collection vers un autre appareil par QR code, sans serveur.

- **Lien** : `BASE_URL + '#c=' + charge`. `BASE_URL` (`https://hebus.github.io/popmart-gallery/`, GitHub Pages) est une constante en haut du bloc « Partage » de `index.html` ; la changer si l'hébergement change.
- **Charge utile v1** : `1|<idProduit>:<i,j,k>|<idProduit2>:<i>…`. `id` = identifiant du produit, `i` = **indice dans `product.images[]`**. Aucune URL d'image n'est transmise : les deux appareils doivent avoir le même `products.js`. Préfixe `z` + base64url du deflate-raw (si `CompressionStream` existe) ou `r` + base64url brut. Toute évolution du format incrémente la version (`1` -> `2`) ; une version inconnue est refusée.
- **Capacité** : QR niveau L, ≈ 2 950 octets au maximum, soit ~96 produits (≈ 830 images) mesurés. Au-delà, pas de QR tronqué : la fenêtre Share affiche un message et ne propose que « Sauvegarde par fichier ». Au-delà de ~1 100 caractères le QR est dense : un avertissement est affiché.
- **Share** : fenêtre unique `#sheet` (réutilisée par Share, Scanner, Import et les messages) avec QR, « Copier le lien », « Partager… » (Web Share, si dispo), « Sauvegarde par fichier », « Fermer ».
- **Réception par l'appareil photo** : l'URL s'ouvre sur l'appli, le hash `#c=` est lu au chargement (et sur `hashchange`) puis **effacé** (`history.replaceState`) pour qu'un rechargement ne ré-importe pas.
- **Scanner intégré** : caméra arrière (`getUserMedia`, HTTPS ou localhost requis), `BarcodeDetector` si disponible, sinon `jsQR` chargé à la demande. Tout QR contenant `#c=` est accepté ; le flux caméra est **toujours** arrêté (scan réussi, fermeture, changement de contenu de la fenêtre). Caméra refusée : message, l'appli reste utilisable.
- **Import** : collection locale vide -> import direct ; sinon fenêtre **Fusionner** (ajout sans doublon sur `src`) / **Remplacer** (confirmation) / **Annuler**. Après import : onglet « Collection », pastille mise à jour.
- **Figurines perso et partage** : elles n'ont pas d'identifiant catalogue, elles sont donc **exclues** du lien QR (message « N figurine(s) perso non incluse(s) » dans Share) (la sauvegarde par fichier, elle, les inclut avec leurs photos). Share est désactivé si la collection ne contient que du perso. L'import « Remplacer » **conserve** les figurines perso ; « Vider » les supprime avec leurs photos (la confirmation le dit). Elles ne peuvent pas être proposées dans l'onglet Échanges (pas de « Proposer »).
- **Sécurité** : la charge utile est une donnée non fiable. `decodeCollection` valide le préfixe, la taille (déflate plafonné à 200 Ko, anti zip-bomb), la version, le format UUID des ids, l'existence du produit, des indices entiers dans les bornes, <= 2 000 produits / 500 indices par produit ; les éléments invalides sont comptés comme « ignorés ». Les valeurs ne sont jamais insérées via `innerHTML` (seul le SVG du QR, généré localement, l'est).
- Sans CDN : `qrcode-generator` absent -> Share propose la sauvegarde par fichier ; `jsQR` absent -> message dans le scanner ; le reste de l'appli fonctionne.

## Échanges, intérêts et notifications (Supabase)

Backend partagé : Supabase (Postgres + Auth anonyme + temps réel), l'appli reste statique. Tout le code réseau est dans `exchange.js` (`window.Exchange`) ; l'UI est dans `index.html`. La base est décrite et sécurisée par `supabase/schema.sql` ; `supabase/rls-tests.sql` vérifie les règles (à rejouer après toute modification du schéma).

- **Configuration** : `SUPABASE_URL` et `SUPABASE_ANON_KEY` en tête de `exchange.js` (clé anon **publique** par conception). Ne **jamais** y mettre la clé `service_role`. Vides ou CDN `supabase-js` inaccessible : `Exchange.configured` est faux, la cloche et « Proposer » sont masqués, l'onglet Échanges affiche « Échanges indisponibles » ; **le reste de l'appli fonctionne**.
- **Boutons de l'en-tête** : « Mon profil » (icône utilisateur) et « Notifications » (icône cloche + pastille de non-lus) sont au même niveau, côte à côte, à gauche de la pastille de collection ; tous deux masqués si Supabase n'est pas configuré. Boutons d'icône : classe `.iconbtn`, 44 px, `aria-label` obligatoire.
- **Identité** : compte **anonyme** Supabase, créé **seulement à la première écriture** (publier, taguer) ; la lecture des annonces marche sans compte. `profiles.id = auth.uid()` est l'identifiant unique de l'utilisateur. Pseudo obligatoire (3 à 20 car. `[A-Za-z0-9_.-]`, unique), contact optionnel. L'identité est liée au navigateur (données effacées = identité perdue ; avertissement affiché ; lien email hors périmètre v1).
- **Annonce** (`listings`) : `product_id` + `image_index` (même convention que le partage QR, jamais d'URL d'image), `kind` `exchange` | `sale`, `price` (vente uniquement, optionnel), `qty` proposée, `note` <= 140 car. Une annonce par (propriétaire, produit, image). **Règle : `qty` proposée <= `qty` possédée en collection** (on peut proposer toutes ses images, y compris l'unique exemplaire) ; baisser la quantité sous la quantité proposée la réduit, retirer l'image de la collection supprime l'annonce (`reconcileListing`). Les figurines perso ne peuvent pas être proposées.
- **Intérêt = tag** (`interests`) : cliquer « Ça m'intéresse » insère, re-cliquer supprime. L'image est taguée (ruban « Intéressé », bouton `✓ Intéressé·e`, bordure) et l'état est **persisté côté serveur** : retrouvé après rechargement et dans « Mes intérêts ». On ne peut pas taguer sa propre annonce.
- **Notifications** : créées **uniquement par le trigger** `interests_notify` (les clients n'ont aucun droit d'insertion) ; retirer le tag supprime la notification. Le propriétaire les gère via la **cloche** (pastille de non-lus, temps réel) : « Marquer lu », « Tout marquer lu », « Supprimer », « Tout supprimer », « Voir mes annonces ». Chaque notification affiche le pseudo, le produit, la date et le **contact** de la personne intéressée.
- **Contact** (`contacts`) : visible uniquement par son auteur et par l'**autre partie d'un intérêt** (fonction `is_counterpart`). Jamais public.
- **Onglet Échanges** : filtres « Toutes / Mes annonces / Mes intérêts » et « Tous / Échange / Vente », recherche par nom côté client, pagination par 60 (« Afficher plus »). Mes propres annonces ont « Modifier » / « Retirer » au lieu du tag.
- **Sécurité** : RLS sur toutes les tables, droits de colonnes minimaux (`grant insert/update (cols)`), plafonds (200 annonces, 100 intérêts par utilisateur), contraintes `check` (formats UUID, longueurs). Pseudos, notes et contacts sont des **données non fiables** : toujours `textContent` (helpers `mk`, jamais `innerHTML`).

## Sauvegarde et restauration par fichier

Bouton-icône « Sauvegarde » (onglet Collection, ligne d'outils) : fenêtre avec « Exporter » et « Importer ». Seul moyen de transférer ou conserver les **figurines perso avec leurs photos** (jamais envoyées sur un serveur).

- **Fichier** `popmart-sauvegarde-AAAA-MM-JJ.json`, format v1 : `{ app: 'popmart-gallery', version: 1, exportedAt, count, items }`. Élément catalogue : `{ type: 'catalog', productId, imageIndex, image, quantity, productName, productUrl, price, currency }` (les champs d'information sont ignorés à l'import). Élément perso : `{ type: 'custom', customId, name, note?, quantity, photo: 'data:image/jpeg;base64,…' }`. Une évolution du format incrémente `version` ; l'import accepte aussi l'ancien export (éléments catalogue sans `type`).
- **Export** : une photo perso introuvable (données du site effacées) est ignorée et comptée dans le message.
- **Import** : fichier <= 100 Mo, <= 2 500 éléments, <= 200 figurines perso ; nom <= 80 car., note <= 140, quantité 1 à 99 ; les ids produit sont validés comme pour le partage QR ; les photos doivent être des data URL `jpeg|png|webp` et sont **ré-encodées** (`processPhoto`, 1024 px, sans EXIF) avant stockage. Les éléments invalides sont comptés (« ignoré(s) »), jamais injectés en HTML.
- **Collection vide** : import direct. Sinon **Fusionner** (ajoute ce qui manque, **conserve les quantités locales**) / **Remplacer** (confirmation, remplace tout, supprime les photos perso devenues inutiles) / **Annuler**. Chaque figurine perso garde son `customId` : réimporter deux fois le même fichier en fusion **ne crée pas de doublons**. Progression « Photos : i/n » pendant l'import ; les écritures de photos se font avant la mise à jour de la collection.

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
- [ ] Onglet « Collection » : les images ajoutées sont affichées ; en retirer une la fait disparaître ; la quantité `− ×n +` fonctionne et persiste après rechargement.
- [ ] Figurine perso : un clic sur l'aperçu ouvre l'appareil photo (même avec une photo déjà visible), « Galerie » les photos ; l'aperçu s'affiche, « Ajouter » est désactivé sans nom ou sans photo ; la carte survit au rechargement et au redémarrage du navigateur.
- [ ] Photo perso réduite à <= 1024 px, sans EXIF/GPS ; modifier nom/photo/quantité ; supprimer retire la carte et la photo ; « Vider » aussi.
- [ ] Collection mixte : Share affiche « figurine(s) perso non incluse(s) » ; import « Remplacer » garde les perso ; pas de « Proposer » sur une carte perso.
- [ ] Recherche sans résultat dans le catalogue : le bouton « Ajouter « … » » préremplit le nom.
- [ ] Sauvegarde : « Exporter » télécharge un fichier ; « Importer » (collection vide) restaure images, quantités et figurines perso avec photos ; en fusion, rien n'est dupliqué en réimportant deux fois ; « Remplacer » demande confirmation.
- [ ] Fichier invalide ou corrompu : message « Import impossible », aucune erreur console, collection intacte.
- [ ] Sans Supabase configuré : aucune erreur console, cloche et « Proposer » masqués, onglet Échanges avec message clair.
- [ ] Avec Supabase (2 navigateurs) : A publie une figurine de sa collection (même avec qty = 1), B voit l'annonce, la tague (ruban + contact de A), A reçoit la notification en temps réel avec le contact de B ; B retire le tag : la notification disparaît ; B retrouve son tag après rechargement.
- [ ] Cloche : marquer lu, tout marquer lu, supprimer, tout supprimer ; pastille correcte.
- [ ] « Proposer » est disponible sur toute image du catalogue de la collection (qty = 1 incluse), absent sur une figurine perso ; baisser la quantité sous la quantité proposée réduit l'annonce ; retirer l'image la supprime.
- [ ] `supabase/rls-tests.sql` n'affiche que des « OK ».
- [ ] 360 px : aucun scroll horizontal dans l'onglet Échanges ni dans les fenêtres Profil / Proposer / Notifications.
- [ ] Recharger la page : la collection est conservée.
- [ ] Vider (confirmation) fonctionne ; Share est désactivé quand la collection est vide.
- [ ] Share : le QR s'affiche, « Copier le lien » donne un lien `…/#c=…` ; ouvert dans un onglet privé il importe la même collection.
- [ ] Import avec une collection existante : Fusionner (sans doublon) / Remplacer (confirmation) / Annuler ; le hash disparaît de l'URL.
- [ ] Scanner : lit un QR Share ; la caméra s'éteint (voyant) après le scan et à la fermeture ; refus de caméra = message sans erreur.
- [ ] Liens invalides ou produits inconnus : message « ignorée(s) » ou « Import impossible », aucune erreur console.
- [ ] Collection énorme : message + « Sauvegarde par fichier », pas de QR cassé.
- [ ] Aucune erreur console ; l'appli fonctionne avec GSAP bloqué.
