# Plugin : mode Deck

Ce qui rend l'export d'un deck plus lisible et plus rapide à corriger. La structure du canvas dépend de l'arbitrage C, les boutons « Fix » de l'arbitrage D (tranché le 14 octobre : « Prepare for Slides » reste dans le header, tel quel).

## Structure

- [ ] **Le rapport utile est sous la ligne de flottaison.** L'aperçu, que l'utilisateur voit déjà dans Figma, prend l'écran ; la liste Content (ce qui sera converti en image) est en bas, avec près de 190 px vides de chaque côté à 1200 px de large. → Même structure que le mode Template : rail, aperçu réduit, rapport (selon C).
- [ ] **Dimensions en faux champs.** Les valeurs sont en lecture seule mais stylées comme des inputs. → Une légende : « 1920 × 1080 px · 16:9 ».

## Rail

- [ ] **Noms des frames.** Le rail n'affiche que des numéros, alors que le mode Template affiche les noms. → Index plus nom tronqué.
- [ ] **Fidélité visible avant l'export.** Il faut ouvrir chaque slide pour savoir ce qui sera converti en image. → Un badge avec le nombre d'éléments rasterisés sur chaque vignette concernée, et un résumé au-dessus du rail (« 3 rasterized on 2 slides »).

## Rapport de fidélité

- [ ] **Lignes cliquables sans indice.** Un clic sélectionne le calque dans Figma, rien ne le dit. → Icône au survol et mention « Click to select in Figma ».
- [ ] **Correction loin du problème.** La liste dit « Gradient » ou « Effect », mais la solution est dans le header. → Un bouton « Fix with a Slides-ready copy » dans l'en-tête de la liste quand des éléments sont rasterisés (selon D).

## Idées à valider (fonctions qui manquent)

- [ ] **Mettre à jour la dernière présentation** au lieu d'en créer une nouvelle à chaque export. Le scope `drive.file` le permet, puisque le fichier a été créé par Decker. À cadrer côté backend (`packages/backend/src/jobs/`).
- [ ] **Exporter une partie du deck** : cases à cocher sur les vignettes, sans retirer les frames du rail.
- [ ] **Historique des exports de la session** : liens vers les présentations créées, pour ne pas les chercher dans le Drive.
