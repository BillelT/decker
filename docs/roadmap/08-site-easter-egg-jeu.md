# Easter egg du footer : « Decker 95 »

Pas de nom produit : c'est une intégration. Notre jeu des pop-ups façon virus des années 2000, présenté avec le flow du jeu de Luc sur smoo.link : un logo dans le footer, une infobulle, et au clic une page à part, plein écran, avec une fenêtre d'OS rétro au centre et le jeu dedans.

## Historique

- **16 octobre, v1.** Le jeu des pop-ups en overlay sur la page du site.
- **17 octobre, essai Asteroids.** Le flow de smoo.link avec un Asteroids pixel : le flow a plu, pas le jeu. On revient à nos fenêtres.
- **17 octobre, v2 « Decker 95 ».** Le flow de smoo.link (page `/game`, fenêtre Win95 pixel) avec notre jeu des pop-ups dedans.
- **17 octobre, bruitages, couleurs, tailles.** Sons 8-bit discrets, trois tailles de fenêtres. Teintes secondaires de l'orange de la DA au lieu de l'aplat (un essai avec la palette du logo a été écarté), rythme varié dont la cadence monte en ligne droite.
- **17 octobre, retouches.** Départ direct sans écran « Start » et plus lent au début, fond uni, fenêtres plus grandes empilées en léger décalage comme les cartes du logo, plus de croix fuyante systématique (3 % de chance d'un petit saut), plus de légende des touches ni de crédit de police, « Decker » et son accroche au-dessus de la fenêtre.

## Le flow

1. **Footer.** Le logo (pile de cartes) est un lien vers `/game`. Au survol, ses cartes se ferment puis se rouvrent une fois, comme un tour de spam de pop-ups, et l'infobulle « Get spammed like it’s 2003 » s'affiche.
2. **Page `/game`.** Fond encre, sans header ni footer du site. En haut, le logo, « Decker » et l'accroche « Google Slides deck with Figma comfort ». Au centre, une fenêtre « Decker 95 » : barre d'outils (Pause, jauge « Deck integrity »), le bureau où tombent les pop-ups, barre d'état (Time, Score, Combo, High).
3. **Sous la fenêtre**, seulement deux liens : « Try it on Figma » et « Back to the site ». Pas de légende des touches (le jeu se joue à la souris) ni de crédit de police.
4. La croix de la fenêtre et les boutons « Quit » ramènent au site.

## Déroulé d'une partie

1. **Démarrage.** Direct, dès l'arrivée sur la page : pas d'écran « Start ».
2. **Les vagues.** Une vague lâche quelques pop-ups (0.24 à 0.56 s d'écart), puis on respire : la vague suivante part 0.9 s après que le bureau est vide, ou au plus tard après une attente qui raccourcit (6 s au début, 1.8 s à la fin). Les vagues grossissent, de 2 ou 3 pop-ups jusqu'à 9. Plus lent sur un petit écran. Simulé (200 parties, sans le boss ni les pièges) : qui ferme une pop-up toutes les 1.1 s gagne toujours, toutes les 1.3 s une fois sur sept, toutes les 1.5 s jamais. Un peu durci le 17 octobre (avant : 1.3 s gagnait presque toujours). (Essais du 17 octobre : un flux continu, même irrégulier, laissait toujours au moins une pop-up ouverte, et la partie devenait impossible à gagner quand la cadence montait.)
3. **Fermer.** Clic sur la croix, ou au clavier (Tab puis Entrée).
4. **La jauge.** « Deck integrity » remonte doucement avec peu de pop-ups ouvertes et fond d'autant plus vite qu'elles s'empilent.
5. **Défaite.** La jauge tombe à zéro : dialogue `SCREENSHOT.EXE` « Your deck was flattened into a screenshot. », temps tenu, score et meilleur score, « Quit », « Share my score » et « Try again ».
6. **Victoire.** 60 s tenues : « Deck saved. 100% editable. », score, meilleur score, « Share my score », « Play again » et « Try Decker on Figma ».
7. **Partage.** « Share my score », gagné ou perdu, ouvre dans un nouvel onglet un post X pré-rempli (lien d'intention `x.com/intent/tweet`) avec le score et le lien de `/game`. Défaite : « SCREENSHOT.EXE flattened my deck after 41 s. Score: 1,715. Can you beat it? » ; victoire : « I saved my deck from 42 pop-ups. Score: 2,310. Can you beat it? ». La page `/game` a sa carte de partage (titre « Decker 95 », image OG du site), elle reste non indexée.

## Les pop-ups

| Type | Exemple | Mécanique |
|---|---|---|
| Deck sauvage | `Q3_Review_FINAL_v7_REALLYFINAL.pptx`, avec une mini-slide | Croix normale |
| Fausse pub | « Congratulations! You are the 1,000,000th designer. Claim your free font. » | Le gros bouton ouvre deux autres pop-ups ; il faut trouver la petite croix |
| Fausse alerte | « Warning: 99+ gradients detected. Rasterize now? » | « Keep editable » ferme ; « Rasterize » fait perdre de l'intégrité |
| Deck têtu | `Untitled_presentation (1).pptx`, « You can’t close me. Probably. » | Croix normale |
| Confirmation | « Are you sure you want to close this deck? » | Une seule fenêtre : « Yes, close it » ou la croix. (Elle ouvrait la suivante en cascade, retiré le 17 octobre : fermer une pop-up n'en ouvre jamais une autre.) |
| Boss | `SCREENSHOT.EXE`, « Flattening your deck... 12% » à 32 s, consigne en gras « Spam-click Stop! 10 clicks to go. » qui décompte | Dix clics sur « Stop (10 left) » avant 100 %. Toujours au premier plan : les pop-ups suivantes cachaient sa consigne |
| Bonus | « Decker Antivirus » | Ferme toutes les pop-ups d'un coup, sauf le boss |

**Placement.** En pile décalée, comme les cartes du logo Decker : chaque nouvelle pop-up se pose 40 px à droite et 48 px plus haut que la précédente, la plus récente devant, les anciennes qui dépassent en bas à gauche. Quand la pile sort du bureau, une nouvelle démarre ailleurs, dans la moitié basse. Jamais un coin à moins de 24 px du coin d'une autre : deux fenêtres identiques posées pile l'une sur l'autre n'en laissaient voir qu'une.

**Tailles.** Trois tailles pour varier : grande (80 % de la largeur du bureau), moyenne (50 %), petite (15 %), avec des minimums lisibles (260 px et 170 px). Un grand deck montre trois slides, les autres une seule. Decks au hasard dans les trois tailles ; pub en moyenne ou grande ; alerte et antivirus en moyenne ; confirmation et deck têtu en petite ou moyenne ; boss en grande. Hauteurs variées aussi : six fois sur dix, une pop-up est étirée à 35, 50 ou 65 % de la hauteur du bureau (boutons en bas), le boss garde la sienne.

**Esquive.** Quand la souris arrive sur une croix, la pop-up a 3 % de chance de faire un petit saut (16 à 40 px), pas loin de sa place. Rien au tactile ni au clavier.

Score : points par pop-up fermée, combo jusqu'à x5 quand on enchaîne à moins de 0.9 s, pénalité sur « Rasterize ». Meilleur score dans `localStorage` (`decker-egg-best`, la même clé qu'en v1), repli silencieux si le stockage est indisponible.

## Dans notre DA, en pixel Win95

- **Fenêtres en tokens** : face `--b-gray-200`, biseaux en `--b-white`, `--b-gray-100`, `--b-gray-500` et `--b-ink` (variables `--w95-*` de `game.ts`), ombre portée dure de 4 px.
- **Couleurs posées comme sur le site** (17 octobre, après deux essais écartés : palette du logo, puis teintes saumon et pêche de l'orange) : fenêtres claires (face `--b-gray-100`, biseaux en `--b-gray-50`, `--b-white`, `--b-gray-500`, `--b-ink`), bureau `--b-white` ; barre de titre active à l'encre, titre blanc, comme le bleu marine de Windows 95 ; barres inactives en `--b-gray-200`, titre `--b-gray-800` ; l'orange de la DA en aplat seulement sur le bouton par défaut (texte à l'encre et liseré noir de Windows, comme le CTA du site), les blocs de progression et les mini-slides. Tout vient des tokens.
- **Une seule fenêtre active**, comme sous Windows : les autres passent au gris clair. Pendant un dialogue, la fenêtre Decker 95 passe en inactive aussi.
- `--b-accent-red` seulement pour le graphisme d'alerte (triangle, jauge basse, barre du boss).
- Barres de progression en blocs, rognées (`clip-path`) plutôt qu'étirées. Icônes en pixels (`crispEdges`) : triangle d'alerte, bulle « ? », croix, coche.
- **Police pixel** : Pixelify Sans (OFL), variable 400 à 700, inlinée en base64 sur cette page seulement (`gameFontData.ts`, 12 Ko). Pas de crédit affiché sur la page (la licence ne l'exige pas).

## Bruitages

Dérogation à la DA (le son y est réservé à l'archétype outil), demandée pour le jeu le 17 octobre. Les règles de `ui-audio` sont gardées : case « Sound » visible dans la barre d'outils, cochée par défaut (choix gardé dans `localStorage`, `decker-game-sound`), décochée et grisée en mouvement réduit ; aucun son avant le premier geste (l'`AudioContext` ne démarre qu'à ce moment) ; gains bas, de 0.06 à 0.2, plus bas pour les sons fréquents ; rien sur Pause. Synthé Web Audio en ondes carrées et triangle, façon 8-bit : aucun fichier, aucune lib.

| Événement | Son |
|---|---|
| Une pop-up s'ouvre | Petit blip triangle, note au hasard dans une gamme pentatonique (le plus discret) |
| Pop-up fermée | Clic carré qui monte d'une note à chaque cran de combo |
| « Keep editable », « Yes, close it » | Deux notes montantes |
| « Rasterize » | Note qui s'écrase |
| « Claim my free font » | Bourdon grave, puis les deux pop-ups qui s'ouvrent |
| La croix esquive | Boing qui monte |
| Arrivée du boss | Sirène à deux tons, trois fois |
| Chaque « Stop » sur le boss | Note qui monte à mesure qu'il cède ; arpège quand il tombe |
| Antivirus | Balayage montant et deux notes |
| Jauge sous 30 % | Battement de cœur grave, plus rapide sous 15 % |
| Défaite / victoire | Descente classique / petite fanfare |

## Accessibilité et garde-fous

- Lancement volontaire uniquement : la partie démarre en arrivant sur `/game`, page qu'on n'ouvre qu'en cliquant le logo du footer.
- Bouton « Pause » visible en permanence (WCAG 2.2.2) ; Échap met en pause et reprend ; la pause s'ouvre aussi quand l'onglet passe en arrière-plan.
- Aucun clignotement de plus de trois fois par seconde (WCAG 2.3.1), aucun tremblement d'écran.
- `prefers-reduced-motion` : apparitions en fondu, rythme ralenti.
- Clavier complet : Tab parcourt les pop-ups, Entrée ou Espace ferme, focus visible ; une fenêtre qui prend le focus passe au premier plan.
- Lecteur d'écran : région `role="status"` qui annonce sobrement le nombre de pop-ups ouvertes, la pause, le boss et la fin ; chaque pop-up a un nom ; jauge en `role="progressbar"`.
- Mobile : bureau plus haut que large, pop-ups moins fréquentes, croix et boutons d'au moins 44 px .
- Rien ne sort de la page sans un clic du joueur : pas de `window.open`, pas d'`alert()`, pas de vraie fenêtre ; seuls les liens « Share my score » et « Try Decker on Figma » ouvrent un nouvel onglet. Page non indexée (`noindex`, absente du sitemap).

## Technique

- `packages/backend/src/routes/game.ts` : page complète (HTML, CSS, JS ES2017 sans framework en `String.raw`), servie en `/game` par `pages.ts`.
- `packages/backend/src/routes/gameFontData.ts` : la police en base64.
- Footer : `FOOTER_EGG_MARK` dans `pages.ts`, styles `.footer__egg` dans `marketingStyles.ts`.

## Questions ouvertes

- Le même jeu dans le plugin, en skin Win95 ?
