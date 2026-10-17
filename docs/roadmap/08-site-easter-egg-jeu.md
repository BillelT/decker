# Easter egg du footer : « Decker 95 »

Pas de nom produit : c'est une intégration. Notre jeu des pop-ups façon virus des années 2000, présenté avec le flow du jeu de Luc sur smoo.link : un logo dans le footer, une infobulle, et au clic une page à part, plein écran, avec une fenêtre d'OS rétro au centre et le jeu dedans.

## Historique

- **16 octobre, v1.** Le jeu des pop-ups en overlay sur la page du site.
- **17 octobre, essai Asteroids.** Le flow de smoo.link avec un Asteroids pixel : le flow a plu, pas le jeu. On revient à nos fenêtres.
- **17 octobre, v2 « Decker 95 ».** Le flow de smoo.link (page `/game`, fenêtre Win95 pixel) avec notre jeu des pop-ups dedans.
- **17 octobre, retouches.** Départ direct sans écran « Start » et plus lent au début, fond uni, fenêtres plus grandes empilées en léger décalage comme les cartes du logo, plus de croix fuyante systématique (3 % de chance d'un petit saut), plus de légende des touches ni de crédit de police, « Decker » et son accroche au-dessus de la fenêtre.

## Le flow

1. **Footer.** Le logo (pile de cartes) est un lien vers `/game`. Au survol, ses cartes se ferment puis se rouvrent une fois, comme un tour de spam de pop-ups, et l'infobulle « Play a quick game » s'affiche.
2. **Page `/game`.** Fond encre, sans header ni footer du site. En haut, le logo, « Decker » et l'accroche « Google Slides deck with Figma comfort ». Au centre, une fenêtre « Decker 95 » : barre d'outils (Pause, jauge « Deck integrity »), le bureau où tombent les pop-ups, barre d'état (Time, Score, Combo, High).
3. **Sous la fenêtre**, seulement deux liens : « Try it on Figma » et « Back to the site ». Pas de légende des touches (le jeu se joue à la souris) ni de crédit de police.
4. La croix de la fenêtre et les boutons « Quit » ramènent au site.

## Déroulé d'une partie

1. **Démarrage.** Direct, dès l'arrivée sur la page : pas d'écran « Start ». La première pop-up arrive au bout d'environ 1 s.
2. **La vague.** Rythme façon Tetris : 3 s de calme pour que le joueur comprenne (une seule pop-up), puis la vitesse normale (une toutes les 1.3 s), qui monte d'un palier toutes les 6 s, 15 % plus vite à chaque fois, jusqu'à une toutes les 0.38 s. Plus lent sur un petit écran.
3. **Fermer.** Clic sur la croix, ou au clavier (Tab puis Entrée).
4. **La jauge.** « Deck integrity » remonte doucement avec peu de pop-ups ouvertes et fond d'autant plus vite qu'elles s'empilent.
5. **Défaite.** La jauge tombe à zéro : dialogue `SCREENSHOT.EXE` « Your deck was flattened into a screenshot. », temps tenu, score et meilleur score, « Quit » et « Try again ».
6. **Victoire.** 60 s tenues : « Deck saved. 100% editable. », score, meilleur score, partage en texte à copier, « Play again » et « Try Decker on Figma ».

## Les pop-ups

| Type | Exemple | Mécanique |
|---|---|---|
| Deck sauvage | `Q3_Review_FINAL_v7_REALLYFINAL.pptx`, avec une mini-slide | Croix normale |
| Fausse pub | « Congratulations! You are the 1,000,000th designer. Claim your free font. » | Le gros bouton ouvre deux autres pop-ups ; il faut trouver la petite croix |
| Fausse alerte | « Warning: 99+ gradients detected. Rasterize now? » | « Keep editable » ferme ; « Rasterize » fait perdre de l'intégrité |
| Deck têtu | `Untitled_presentation (1).pptx`, « You can’t close me. Probably. » | Croix normale |
| Chaîne | « Are you sure you want to close? », puis « Really sure? » | Trois fenêtres en cascade, chacune décalée de la précédente |
| Boss | `SCREENSHOT.EXE`, « Flattening your deck... 12% » à 32 s | Dix clics sur « Stop » avant 100 % |
| Bonus | « Decker Antivirus » | Ferme toutes les pop-ups d'un coup, sauf le boss |

**Placement.** En pile décalée, comme les cartes du logo Decker : chaque nouvelle pop-up se pose 40 px à droite et 48 px plus haut que la précédente, la plus récente devant, les anciennes qui dépassent en bas à gauche. Quand la pile sort du bureau, une nouvelle démarre ailleurs, dans la moitié basse. Jamais un coin à moins de 24 px du coin d'une autre : deux fenêtres identiques posées pile l'une sur l'autre n'en laissaient voir qu'une.

**Esquive.** Quand la souris arrive sur une croix, la pop-up a 3 % de chance de faire un petit saut (16 à 40 px), pas loin de sa place. Rien au tactile ni au clavier.

Score : points par pop-up fermée, combo jusqu'à x5 quand on enchaîne à moins de 0.9 s, pénalité sur « Rasterize ». Meilleur score dans `localStorage` (`decker-egg-best`, la même clé qu'en v1), repli silencieux si le stockage est indisponible.

## Dans notre DA, en pixel Win95

- **Fenêtres en tokens** : face `--b-gray-200`, biseaux en `--b-white`, `--b-gray-100`, `--b-gray-500` et `--b-ink` (variables `--w95-*` de `game.ts`), ombre portée dure de 4 px.
- **Une seule fenêtre active**, comme sous Windows : barre de titre en dégradé orange de marque, titre à l'encre ; les autres pop-ups passent au gris 600, titre blanc. Pendant un dialogue, la fenêtre Decker 95 passe en inactive aussi.
- Boutons Win95 ; le bouton par défaut est plein orange avec le liseré noir de Windows ; focus en pointillé dans le bouton.
- Barres de progression en blocs, rognées (`clip-path`) plutôt qu'étirées. `--b-accent-red` seulement pour le graphisme d'alerte (triangle, jauge basse, barre du boss).
- Icônes en pixels (`crispEdges`) : triangle d'alerte, bulle « ? » de la chaîne, croix de fermeture, flèches.
- Bureau sur `--b-white` uni : les pop-ups font tout le décor. Fenêtres de 440 px (520 px pour le boss).
- **Police pixel** : Pixelify Sans (OFL), variable 400 à 700, inlinée en base64 sur cette page seulement (`gameFontData.ts`, 12 Ko). Pas de crédit affiché sur la page (la licence ne l'exige pas).
- Pas de son : la DA réserve le feedback sonore à l'archétype outil.

## Accessibilité et garde-fous

- Lancement volontaire uniquement : la partie démarre en arrivant sur `/game`, page qu'on n'ouvre qu'en cliquant le logo du footer.
- Bouton « Pause » visible en permanence (WCAG 2.2.2) ; Échap met en pause et reprend ; la pause s'ouvre aussi quand l'onglet passe en arrière-plan.
- Aucun clignotement de plus de trois fois par seconde (WCAG 2.3.1), aucun tremblement d'écran.
- `prefers-reduced-motion` : apparitions en fondu, rythme ralenti.
- Clavier complet : Tab parcourt les pop-ups, Entrée ou Espace ferme, focus visible ; une fenêtre qui prend le focus passe au premier plan.
- Lecteur d'écran : région `role="status"` qui annonce sobrement le nombre de pop-ups ouvertes, la pause, le boss et la fin ; chaque pop-up a un nom ; jauge en `role="progressbar"`.
- Mobile : bureau plus haut que large, pop-ups moins fréquentes, croix et boutons d'au moins 44 px .
- Rien ne sort de la page : pas de `window.open`, pas d'`alert()`, pas de vraie fenêtre. Page non indexée (`noindex`, absente du sitemap).

## Technique

- `packages/backend/src/routes/game.ts` : page complète (HTML, CSS, JS ES2017 sans framework en `String.raw`), servie en `/game` par `pages.ts`.
- `packages/backend/src/routes/gameFontData.ts` : la police en base64.
- Footer : `FOOTER_EGG_MARK` dans `pages.ts`, styles `.footer__egg` dans `marketingStyles.ts`.

## Questions ouvertes

- Le même jeu dans le plugin, en skin Win95 ?
