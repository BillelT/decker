# Plugin : mode Template

Ce qui rend la création d'un template moins bloquante et plus guidée. La structure dépend de l'arbitrage C, la correction automatique de l'arbitrage D (tranché le 14 octobre : « Prepare for Slides » reste dans le header, tel quel).

## Blocage et correction

- [ ] **Blocage muet.** Un seul layout en erreur grise « Create template », et la raison n'est que dans une infobulle. → Afficher « 1 layout to fix » près du bouton ; un clic mène au layout en cause.
- [ ] **Correction sur place.** La boîte « Fix before creating the template » liste les causes sans proposer d'action. → Un bouton « Fix automatically » dans la boîte, qui lance le reformatage sur ce layout : il corrige justement les dégradés et les ombres.

## Structure du rapport

- [ ] **Ordre inversé par rapport au Deck.** Les erreurs passent au-dessus de l'aperçu, et la tâche principale (assigner les rôles, liste Content) est tout en bas, invisible en 960×560. → Même ordre dans les deux modes : aperçu, « To fix », Content. Idéalement, Content à côté de l'aperçu (selon C).
  - C tranché : aperçu en haut, rapport dessous, comme le Deck. Reprendre aussi du lot 03 la colonne commune aperçu/rapport (`.f2s-deck-column`), l'icône de sélection au survol des lignes et la phrase « Click a row to select the layer in Figma. ».
- [ ] **Rôle affiché deux fois.** Libellé « TITLE » et sélecteur « [[title]] » sur la même ligne. → Garder seulement le sélecteur, avec un style marqué quand un rôle est assigné.

## Panneau Styles

- [ ] **Rôles de couleur en jargon.** « Text & background 1…4 », « Accent 1…6 », sans explication ni effet visible. → Une ligne d'aide (« Maps your colors to the Slides theme, so people can recolor from Slides »), un bouton « Suggest roles » (la plus foncée en texte, la plus claire en fond, la plus utilisée et saturée en accent), et un aperçu des 12 pastilles du thème Slides obtenu.
- [ ] **Polices en double.** Le bandeau Fonts et la section Typography montrent les mêmes polices. → En mode Template, faire le choix de remplacement dans Typography et masquer le bandeau.
- [ ] **Double état vide.** Le canvas et le panneau de droite affichent chacun un état vide en même temps. → Masquer le panneau de droite tant qu'il n'y a aucun layout.

## Idées à valider (fonctions qui manquent)

- [ ] **Suggestion automatique des rôles de placeholder** : le plus grand texte en `[[title]]`, le suivant en `[[subtitle]]`, le bloc de texte long en `[[body]]`, à confirmer d'un clic.
- [ ] **Aperçu du layout tel qu'il sera dans Slides**, placeholders vides, pour vérifier le rendu avant de créer le template.
