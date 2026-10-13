# Easter egg du footer : « Pop-up Panic »

Titre de travail. Un mini-jeu caché dans le footer du site.

## L'idée

L'écran se remplit de fausses pop-ups façon années 2000 : des decks qui s'ouvrent tout seuls, de fausses pubs, de fausses alertes virus. Il faut les fermer plus vite qu'elles n'apparaissent. C'est un simulateur de virus rétro, mais dessiné dans notre DA.

## Pourquoi ça colle à Decker

- Le plugin a déjà un skin Windows 95 et une animation d'export rétro : le jeu prolonge cet univers côté site.
- Le méchant est le problème que Decker résout : `SCREENSHOT.EXE`, un virus qui veut aplatir ton deck en une image. Si l'écran déborde, ton deck est rasterisé. La défaite raconte l'inverse de la promesse du produit, la victoire raconte la promesse : « Deck saved. 100% editable. »
- Il donne une raison de rester sur la page et de la partager, sans rien coûter à ceux qui ne le trouvent pas.

## Déclenchement

- Toujours volontaire, jamais au chargement de la page.
- Une petite icône `decker.exe` dans le footer, à côté de la note de bas de page. Variante plus cachée : triple clic sur le logo du footer.
- Bonus possible : le Konami code.

## Déroulé d'une partie

1. **Démarrage.** Une fenêtre « Decker Security 2000 is scanning your deck... » avec une barre de progression, puis un bouton « Start ».
2. **La vague.** Les pop-ups apparaissent à un rythme qui accélère (par exemple une toutes les 1.5 s au début, une toutes les 0.4 s à la fin).
3. **Fermer.** Clic sur la croix, ou Échap sur la pop-up au premier plan.
4. **La jauge.** « Deck integrity » baisse avec le nombre de pop-ups ouvertes et avec les mauvais choix.
5. **Défaite.** La jauge tombe à zéro : écran plein « Your deck was flattened into a screenshot. », fond encre, texte en blanc de marque, bouton « Try again ».
6. **Victoire.** 60 s tenues : « Deck saved. 100% editable. », le score, et un lien « Try Decker on Figma ».

## Les pop-ups

Textes en anglais, comme toute l'interface.

| Type | Exemple | Mécanique |
|---|---|---|
| Deck sauvage | `Q3_Review_FINAL_v7_REALLYFINAL.pptx`, avec une mini-slide | Croix normale |
| Fausse pub | « Congratulations! You are the 1,000,000th designer. Claim your free font. » | Le gros bouton « Claim » ouvre deux autres pop-ups ; il faut trouver la petite croix |
| Fausse alerte | « Warning: 99+ gradients detected. Rasterize now? » avec « Rasterize » et « Keep editable » | « Keep editable » ferme ; « Rasterize » fait perdre de l'intégrité |
| Croix fuyante | La croix se décale une fois quand on la survole | Deux clics |
| Chaîne | « Are you sure you want to close? », puis « Really sure? » | Trois fenêtres en cascade |
| Boss | `SCREENSHOT.EXE`, grande fenêtre « Flattening your deck... 12% » | Dix clics sur « Stop » avant 100 % |
| Bonus | « Decker Antivirus » | Ferme toutes les pop-ups d'un coup, rare |

Humour léger, rien de trompeur en dehors du jeu : aucune vraie URL, aucun vrai téléchargement, tout reste dans la zone de jeu.

## Score

- Points pour chaque pop-up fermée, bonus de combo quand on enchaîne vite, pénalité quand on choisit « Rasterize ».
- Meilleur score gardé dans le navigateur du visiteur (`localStorage`, avec repli silencieux si le stockage est indisponible).
- Partage en texte à copier : « I saved my deck from 142 pop-ups on decker.billeltighidet.fr ».

## Dans notre DA

- Fenêtres sur `--b-surface`, barre de titre à l'encre (`--b-ink`) avec le titre en blanc de marque, biseaux du site, Cabinet Grotesk.
- Boutons pleins à l'orange de marque, texte noir (règle de la DA).
- `--b-accent-red` seulement pour le graphisme d'alerte (icône, barre « Flattening »), jamais pour un état d'interaction.
- Pas de bleu Windows : c'est l'esprit des années 2000 revisité dans notre palette, pas une copie de Windows.
- Pas de son : la DA réserve le feedback sonore à l'archétype outil, et le site est un archétype marketing.

## Accessibilité et garde-fous (non négociables)

- Lancement volontaire uniquement.
- Boutons « Pause » et « Quit » visibles en permanence (WCAG 2.2.2) ; Échap quitte le jeu.
- Aucun clignotement de plus de trois fois par seconde (WCAG 2.3.1), aucun tremblement d'écran.
- `prefers-reduced-motion` : apparitions en fondu, aucune fenêtre qui glisse ou tremble, rythme ralenti.
- Clavier complet : Tab parcourt les pop-ups, Entrée ou Espace ferme, focus visible.
- Lecteur d'écran : une région `role="status"` annonce sobrement le nombre de pop-ups ouvertes ; chaque pop-up a un nom.
- Mobile : pop-ups plus grandes et moins nombreuses, croix d'au moins 44 px.
- Rien ne sort de la page : pas de `window.open`, pas d'`alert()`, pas de vraie fenêtre.

## Technique

- JavaScript et CSS natifs : le site est rendu côté serveur en chaînes HTML, sans framework.
- Script chargé seulement au déclenchement, pour ne rien coûter au chargement de la page.
- Fenêtres en `position: fixed`, animées en `transform` et `opacity` uniquement.
- Visuels en SVG inline : les mini-slides peuvent reprendre les illustrations de `packages/backend/src/routes/artwork.ts`. Aucune image externe.
- Fichiers proposés : `packages/backend/src/routes/easterEgg.ts` (CSS et JS du jeu en chaînes) et le déclencheur dans le footer de `pages.ts`.

## Étapes

- [ ] Prototype jouable derrière le déclencheur : trois types de pop-ups, 60 s, score.
- [ ] Textes des pop-ups et écrans de fin.
- [ ] Boss `SCREENSHOT.EXE` et bonus « Decker Antivirus ».
- [ ] Passe accessibilité : clavier, mouvement réduit, pause.
- [ ] Version mobile.
- [ ] Meilleur score local et partage en texte.

## Questions ouvertes

- Déclencheur visible mais discret (icône `decker.exe`), ou totalement caché (triple clic) ?
- Nom définitif du jeu.
- Le même easter egg dans le plugin, en skin Win95 ?
