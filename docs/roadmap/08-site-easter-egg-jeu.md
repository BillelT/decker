# Easter egg du footer : « Decker 95 »

Pas de nom produit : c'est une intégration. Un mini-jeu caché dans le footer du site, qui reprend le flow du jeu de Luc sur smoo.link : un logo dans le footer, une infobulle, et au clic une page à part, plein écran, avec une fenêtre d'OS rétro au centre et un Asteroids dedans.

## Historique

- **16 octobre, v1 « Pop-up Panic ».** Un jeu de fausses pop-ups façon virus des années 2000, en overlay sur la page. Jugé pas ouf le 17 octobre : trop de lecture, peu de jeu.
- **17 octobre, v2 « Decker 95 ».** Le flow de smoo.link, en pixel art façon Windows 95, aux couleurs de la DA. Remplace la v1 (supprimée : `easterEgg.ts`, route `/easter-egg.js`).

## Le flow

1. **Footer.** Le logo (pile de cartes) est un lien vers `/game`. Au survol, ses cartes se ferment puis se rouvrent une fois (animation inchangée depuis la v1) et l'infobulle « Play a quick game » s'affiche.
2. **Page `/game`.** Fond encre, sans header ni footer du site. Au centre, une fenêtre « Decker 95 ». La partie démarre tout de suite (sauf en mouvement réduit : un dialogue « Ready » d'abord).
3. **Sous la fenêtre**, comme chez smoo : les touches, le crédit de la police, une phrase sur Decker avec « Try it on Figma » et « Back to the site ».
4. **Fin de partie.** Dialogue « Game over » dans la fenêtre : score, meilleur score, « Quit » (retour au site) et « Play again » (bouton par défaut). Les images continuent de dériver derrière.

## Le jeu

- **Le vaisseau est un curseur** (flèche pixel, orange de marque, contour encre) : on est dans un plugin Figma. À sa position de départ, il est droit comme un vrai curseur.
- **Les astéroïdes sont des images plates** (cadre, montagne, petit soleil orange) : ce que Decker évite à tes slides. Trois tailles, chacune se casse en deux plus petites. 20, 50 et 100 points.
- Vagues de 3 images au départ, une de plus par vague (9 au plus), un peu plus rapides à chaque fois.
- 3 vies. À la mort, le curseur se disloque bord par bord, façon Asteroids. Réapparition au centre quand la place est libre, protégée 2.5 s.
- Tir au coup par coup, 4 balles au plus à l'écran : tenir la touche en rafale rendait le jeu trop facile en tournant sur place.
- Meilleur score dans `localStorage` (`decker-game-high`), repli silencieux si le stockage est indisponible.

## Dans notre DA

- **Fenêtre Win95 en tokens** : face `--b-gray-200`, biseaux en `--b-white`, `--b-gray-100`, `--b-gray-500` et `--b-ink` (variables `--w95-*` de `game.ts`, même construction que le skin Win95 du plugin).
- **Barre de titre à l'orange de marque**, dégradé `--b-accent` vers `--b-accent-hover`, titre à l'encre (règle des boutons pleins). Quand un dialogue est ouvert, la barre de la fenêtre passe au gris 600, titre blanc, comme une fenêtre inactive.
- Bouton par défaut plein orange avec le liseré noir de Windows ; focus en pointillé dans le bouton.
- **Écran pixel réel** : canvas de 320 x 180 agrandi d'un facteur entier (1 à 4) en `image-rendering: pixelated`, dessiné pixel par pixel (segments de Bresenham, remplissage par balayage), sans antialiasing. Fond `--b-white` avec une grille de points `--b-gray-200`, comme le canvas de Figma. Couleurs lues dans les tokens au chargement, rien en dur. Sur téléphone, facteur fractionnaire pour remplir la largeur.
- **Police pixel** : Pixelify Sans (Stefie Justprince, OFL), variable 400 à 700, inlinée en base64 sur cette page seulement (`gameFontData.ts`, 12 Ko). La Departure Mono de smoo n'était pas récupérable, et on évite de copier.
- Pas de son : la DA réserve le feedback sonore à l'archétype outil.

## Accessibilité et garde-fous

- Lancement volontaire uniquement (lien du footer).
- Échap ou P met en pause et reprend ; la pause s'ouvre aussi quand la fenêtre perd le focus ou que l'onglet passe en arrière-plan.
- Aucun clignotement : la protection de réapparition est une trame fixe d'un pixel sur deux, pas un clignotement.
- `prefers-reduced-motion` : pas de démarrage automatique (dialogue « Ready »), dialogues sans animation, plus de dérive derrière le « Game over ».
- Lecteur d'écran : région `role="status"` pour les vagues, les vies perdues, la pause et la fin ; canvas en `role="img"` nommé ; dialogue nommé, focus sur son bouton principal.
- Mobile : commandes tactiles (gauche, poussée, droite, tir) en boutons Win95 de 48 px, chacune suit son propre doigt ; la légende des touches est masquée sur un écran sans clavier.
- La page n'est pas indexée (`noindex`, absente du sitemap).

## Technique

- `packages/backend/src/routes/game.ts` : page complète (HTML, CSS, JS ES2017 sans framework en `String.raw`), servie en `/game` par `pages.ts`.
- `packages/backend/src/routes/gameFontData.ts` : la police en base64.
- Footer : `FOOTER_EGG_MARK` dans `pages.ts`, styles `.footer__egg` dans `marketingStyles.ts`.

## Questions ouvertes

- Le même jeu dans le plugin, en skin Win95 ?
- Un partage du score (texte à copier) comme dans la v1 ?
