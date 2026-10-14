# Plugin : mode Deck

Ce qui rend l'export d'un deck plus lisible et plus rapide à corriger. La structure du canvas dépend de l'arbitrage C, les boutons « Fix » de l'arbitrage D (tranché le 14 octobre : « Prepare for Slides » reste dans le header, tel quel).

Lot traité le 14 octobre 2026 (décisions de Billel notées sous chaque tâche). Arbitrage C tranché : on garde l'aperçu en haut et le rapport dessous. Le lot 03 est clos.

## Structure

- [x] **Le rapport utile est sous la ligne de flottaison.** L'aperçu, que l'utilisateur voit déjà dans Figma, prend l'écran ; la liste Content (ce qui sera converti en image) est en bas, avec près de 190 px vides de chaque côté à 1200 px de large. → Même structure que le mode Template : rail, aperçu réduit, rapport (selon C).
  - Décision : structure actuelle conservée (aperçu en haut, rapport dessous), taille de l'aperçu inchangée. Le vrai défaut était l'alignement : dès que la hauteur plafonnait l'aperçu, il devenait plus étroit que la boîte Content. Corrigé : aperçu et rapport partagent une seule colonne, calculée d'après le ratio de la frame (`.f2s-deck-column`, unités `cq*`), alignés à toute taille de fenêtre. Une frame portrait garde une colonne de 360 px minimum. La fenêtre d'export rétro prend la même largeur.
- [x] **Dimensions en faux champs.** Les valeurs sont en lecture seule mais stylées comme des inputs. → Une légende : « 1920 × 1080 px · 16:9 ».
  - Décision du 14 octobre : dimensions supprimées, inutiles (la frame se choisit dans Figma).

## Rail

- [x] **Noms des frames.** Le rail n'affiche que des numéros, alors que le mode Template affiche les noms. → Index plus nom tronqué.
  - Fait : « 2. Quarterly results… », sans le préfixe `[Slides Ready]` (identique sur toutes les copies), nom Figma complet en infobulle.
- [x] **Fidélité visible avant l'export.** Il faut ouvrir chaque slide pour savoir ce qui sera converti en image. → Un badge avec le nombre d'éléments rasterisés sur chaque vignette concernée, et un résumé au-dessus du rail (« 3 rasterized on 2 slides »).
  - Fait : pastille « 2 rasterized » en bas à gauche de chaque vignette concernée, discrète (fond gray-200, texte gray-800, comme les tags du rapport) : une image n'empêche pas l'export, ce n'est pas une erreur. Pas de résumé au-dessus du rail (retiré le 14 octobre : chaque slide porte déjà son info). En mode Template, même pastille avec le nombre, en rouge : « 3 to fix ».

## Rapport de fidélité

- [x] **Lignes cliquables sans indice.** Un clic sélectionne le calque dans Figma, rien ne le dit. → Icône au survol et mention « Click to select in Figma ».
  - Fait : survol de ligne en fond gray-200 de la DA au lieu de la bordure orange, dans les deux modes. Ni icône ni phrase d'aide (retirées le 14 octobre).
- [x] **Correction loin du problème.** La liste dit « Gradient » ou « Effect », mais la solution est dans le header. → Un bouton « Fix with a Slides-ready copy » dans l'en-tête de la liste quand des éléments sont rasterisés (selon D).
  - Décision (D) : pas de bouton dans le rapport, « Prepare for Slides » reste dans le header. La ligne de renvoi ajoutée sous la liste a été retirée le 14 octobre : tout en bas, on ne la voyait pas.

## Idées abandonnées

- [x] ~~**Mettre à jour la dernière présentation** au lieu d'en créer une nouvelle à chaque export.~~
  - Décision : abandonné. Il faudrait deviner quand l'utilisateur veut une nouvelle présentation : un parcours complexe pour peu de gain.
- [x] ~~**Exporter une partie du deck** : cases à cocher sur les vignettes, sans retirer les frames du rail.~~
  - Décision : abandonné. Pour ne pas exporter une frame, il suffit de ne pas l'ajouter.
- [x] ~~**Historique des exports de la session** : liens vers les présentations créées, pour ne pas les chercher dans le Drive.~~
  - Décision : abandonné pour l'instant, jugé superflu.
