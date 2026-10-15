# Plugin : interface et DA

La palette est alignée sur la DA. Restent les choix visuels qui donnent sa hiérarchie à l'interface. Presque tout ici dépend d'un arbitrage (voir le README).

## Hiérarchie visuelle

- [ ] **Des biseaux partout** (arbitrage A). Boutons, champs, vignettes, lignes de liste, sections, notifications et modale ont tous un relief : les lignes du rapport ressemblent à des boutons, et les vrais boutons ne ressortent plus. → Garder le relief pour les boutons et les champs, mettre listes et sections à plat. Si la DA tranche « zéro ombre », retirer aussi le relief des boutons.
  - Choix faits le 15 octobre (`612ca28`, `5debef5`, `71ce88d`), qui remplacent la piste « listes et sections à plat » : sections, champs et vignettes du rail sont **en creux** (`--hyb-well`), opacités du biseau revues, toasts en ombres transparentes superposées. Reste à trancher : le relief des boutons, que la DA interdit (aucune ombre sur un bouton).
- [ ] **Typographie plate** (arbitrage F). Presque tout est en 12 px, les titres de section sont en 12 px gris, certains badges sont à 9 px. → Une échelle 14 / 13 / 12, des titres en couleur d'encre, plus rien sous 12 px. Vérifier ensuite que le header tient à 960 px.
- [x] **Sections peu visibles** (skin Modern). Le creux des sections (Content, Composition, « Fix before creating the template », Notes, Colors, Typography) avait un bord bas et droit en blanc sur un fond quasi blanc : on ne voyait pas où finissait la section.
  - Fait le 14 octobre : fond blanc `#ffffff` et creux dessiné sur les quatre côtés (haut et gauche plus sombres que bas et droite). Le skin Windows 95, gris, n'avait pas le problème et ne change pas.
  - Revu le 15 octobre (`612ca28`) : fond `gray-50` (`hsl(40 10% 96%)`) au lieu du blanc pur. Ce gris fait désormais partie de la DA (`--b-gray-50`, rôle `--b-surface-subtle`).
- [ ] **Deux systèmes d'icônes.** Croix « ✕ » en texte dans le rail et la barre Win95, icônes SVG dans la modale. → Une seule source SVG en `currentColor`.

## Animation d'export (arbitrage E)

- [ ] La fenêtre d'export rétro (barre bleu marine, fond turquoise, image tramée) s'affiche aussi dans le skin Modern, alors que `styles.modern.css` exclut justement ces éléments de ce skin. → Soit on l'assume comme easter egg, soit une version Modern : habillage aux couleurs de la DA, même apparition par bandes. La fenêtre 95 complète reste réservée au skin Win95.

## Couleurs encore ouvertes

- [ ] **Couleur d'erreur** (arbitrage G). Le plugin pose `#e00000` en dur, faute de token dans la DA ; ce rouge est à 6° de teinte de `--b-accent-red`. → Le définir dans la DA, plus sombre que l'accent rouge, toujours accompagné d'une icône et d'un libellé.
- [x] ~~**Thème sombre** (arbitrage H). La DA a 4 valeurs sombres (dont 2 dérivées en transparence) ; le plugin a dû inventer le reste (surface, surface creusée, survol, gris intermédiaire). → Rampe sombre complète dans la DA, puis alignement du plugin.~~
  - Décision du 14 octobre : thème sombre retiré du plugin, avec le réglage *Appearance*. L'UI reste claire quel que soit le thème de Figma ; seul l'habillage (Modern ou Windows 95) se choisit.
- [x] ~~**`gray-50`** posé dans le plugin le 15 octobre pour les sections, hors de la rampe de la DA.~~
  - Tranché : `gray-50` fait partie de la DA (`--b-gray-50`, rôle `--b-surface-subtle` pour les fonds de section).
- [x] ~~**`--b-gray-900`** n'a pas été recalibré : il a presque la même clarté que `gray-700`.~~
  - Tranché dans la DA le 14 octobre : l'ancien `gray-900` (`#333231`) est retiré, doublon de `gray-800` (1.09:1 entre les deux).

## Robustesse

- [ ] **Mode contraste élevé de Windows.** Le skin Modern retire les bordures et ne garde que les biseaux en `box-shadow`. En mode contraste forcé, les ombres disparaissent : champs, modale et notifications perdent tout contour. → Garder `border: 1px solid transparent` sous chaque biseau.
