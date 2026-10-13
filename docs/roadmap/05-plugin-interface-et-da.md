# Plugin : interface et DA

La palette est alignée sur la DA. Restent les choix visuels qui donnent sa hiérarchie à l'interface. Presque tout ici dépend d'un arbitrage (voir le README).

## Hiérarchie visuelle

- [ ] **Des biseaux partout** (arbitrage A). Boutons, champs, vignettes, lignes de liste, sections, notifications et modale ont tous un relief : les lignes du rapport ressemblent à des boutons, et les vrais boutons ne ressortent plus. → Garder le relief pour les boutons et les champs, mettre listes et sections à plat. Si la DA tranche « zéro ombre », retirer aussi le relief des boutons.
- [ ] **Typographie plate** (arbitrage F). Presque tout est en 12 px, les titres de section sont en 12 px gris, certains badges sont à 9 px. → Une échelle 14 / 13 / 12, des titres en couleur d'encre, plus rien sous 12 px. Vérifier ensuite que le header tient à 960 px.
- [ ] **Deux systèmes d'icônes.** Croix « ✕ » en texte dans le rail et la barre Win95, icônes SVG dans la modale. → Une seule source SVG en `currentColor`.

## Animation d'export (arbitrage E)

- [ ] La fenêtre d'export rétro (barre bleu marine, fond turquoise, image tramée) s'affiche aussi dans le skin Modern, alors que `styles.modern.css` exclut justement ces éléments de ce skin. → Soit on l'assume comme easter egg, soit une version Modern : habillage aux couleurs de la DA, même apparition par bandes. La fenêtre 95 complète reste réservée au skin Win95.

## Couleurs encore ouvertes

- [ ] **Couleur d'erreur** (arbitrage G). Le plugin pose `#e00000` en dur, faute de token dans la DA ; ce rouge est à 6° de teinte de `--b-accent-red`. → Le définir dans la DA, plus sombre que l'accent rouge, toujours accompagné d'une icône et d'un libellé.
- [ ] **Thème sombre** (arbitrage H). La DA a 4 valeurs sombres (dont 2 dérivées en transparence) ; le plugin a dû inventer le reste (surface, surface creusée, survol, gris intermédiaire). → Rampe sombre complète dans la DA, puis alignement du plugin.
- [ ] **`--b-gray-900`** n'a pas été recalibré : il a presque la même clarté que `gray-700`. À trancher dans la DA.

## Robustesse

- [ ] **Mode contraste élevé de Windows.** Le skin Modern retire les bordures et ne garde que les biseaux en `box-shadow`. En mode contraste forcé, les ombres disparaissent : champs, modale et notifications perdent tout contour. → Garder `border: 1px solid transparent` sous chaque biseau.
