# Plugin : mode Deck

Ce qui rend l'export d'un deck plus lisible et plus rapide à corriger. La structure du canvas dépend de l'arbitrage C, les boutons « Fix » de l'arbitrage D (tranché le 14 octobre : « Prepare for Slides » reste dans le header, tel quel).

Lot traité le 14 octobre 2026 (décisions de Billel notées sous chaque tâche). Arbitrage C tranché : on garde l'aperçu en haut et le rapport dessous. Le lot 03 est clos.

## Structure

- [x] **Le rapport utile est sous la ligne de flottaison.** L'aperçu, que l'utilisateur voit déjà dans Figma, prend l'écran ; la liste Content (ce qui sera converti en image) est en bas, avec près de 190 px vides de chaque côté à 1200 px de large. → Même structure que le mode Template : rail, aperçu réduit, rapport (selon C).
  - Décision : structure actuelle conservée (aperçu en haut, rapport dessous), taille de l'aperçu inchangée. Le vrai défaut était l'alignement : dès que la hauteur plafonnait l'aperçu, il devenait plus étroit que la boîte Content. Corrigé : aperçu et rapport partagent une seule colonne, calculée d'après le ratio de la frame (`.f2s-deck-column`, unités `cq*`), alignés à toute taille de fenêtre. Une frame portrait garde une colonne de 360 px minimum. La fenêtre d'export rétro prend la même largeur.
- [x] **Dimensions en faux champs.** Les valeurs sont en lecture seule mais stylées comme des inputs. → Une légende : « 1920 × 1080 px · 16:9 ».
  - Fait : légende sous l'aperçu (`ui/frameLabels.ts`). Gardée parce que le ratio est celui que prend la présentation : toutes les frames du deck doivent le partager.

## Rail

- [x] **Noms des frames.** Le rail n'affiche que des numéros, alors que le mode Template affiche les noms. → Index plus nom tronqué.
  - Fait : « 2. Quarterly results… », sans le préfixe `[Slides Ready]` (identique sur toutes les copies), nom Figma complet en infobulle.
- [x] **Fidélité visible avant l'export.** Il faut ouvrir chaque slide pour savoir ce qui sera converti en image. → Un badge avec le nombre d'éléments rasterisés sur chaque vignette concernée, et un résumé au-dessus du rail (« 3 rasterized on 2 slides »).
  - Fait : badge « 2 rasterized » en bas à gauche de la vignette (même rouge que le tag du rapport, le haut droit reste au badge d'échec d'export), résumé en tête du rail, masqué s'il n'y a rien.

## Rapport de fidélité

- [x] **Lignes cliquables sans indice.** Un clic sélectionne le calque dans Figma, rien ne le dit. → Icône au survol et mention « Click to select in Figma ».
  - Fait : icône « cursor » de Carbon (même bibliothèque que la roue des réglages) en bout de ligne, au survol et au focus clavier, place réservée pour que la ligne ne bouge pas. Phrase « Click a row to select the layer in Figma. » sous la liste, pour ne pas repousser les lignes sous le pli. Le mode Template est à aligner dans le lot 04.
- [x] **Correction loin du problème.** La liste dit « Gradient » ou « Effect », mais la solution est dans le header. → Un bouton « Fix with a Slides-ready copy » dans l'en-tête de la liste quand des éléments sont rasterisés (selon D).
  - Décision (D) : pas de bouton dans le rapport, « Prepare for Slides » reste dans le header. À la place, une ligne sous la liste indique où est la correction, seulement quand la slide a un dégradé, un effet, un rayon ou un espacement des lettres que la copie sait simplifier (pas pour un masque ou un vecteur, qui restent des images).

## Idées abandonnées

- [x] ~~**Mettre à jour la dernière présentation** au lieu d'en créer une nouvelle à chaque export.~~
  - Décision : abandonné. Il faudrait deviner quand l'utilisateur veut une nouvelle présentation : un parcours complexe pour peu de gain.
- [x] ~~**Exporter une partie du deck** : cases à cocher sur les vignettes, sans retirer les frames du rail.~~
  - Décision : abandonné. Pour ne pas exporter une frame, il suffit de ne pas l'ajouter.
- [x] ~~**Historique des exports de la session** : liens vers les présentations créées, pour ne pas les chercher dans le Drive.~~
  - Décision : abandonné pour l'instant, jugé superflu.
