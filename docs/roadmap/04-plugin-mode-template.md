# Plugin : mode Template

Ce qui rend la création d'un template moins bloquante et plus guidée. La structure dépend de l'arbitrage C, la correction automatique de l'arbitrage D (tranché le 14 octobre : « Prepare for Slides » reste dans le header, tel quel).

## Blocage et correction

- [ ] **Blocage muet.** Un seul layout en erreur grise « Create template », et la raison n'est que dans une infobulle. → Afficher « 1 layout to fix » près du bouton ; un clic mène au layout en cause.
  - En partie couvert le 14 octobre : la vignette du layout en cause porte la pastille rouge « 3 to fix » dans le rail. Reste le compteur près du bouton et le clic qui y mène.
  - Décision du 15 octobre : pas de bouton à côté. Tant qu'un layout bloque, « Create template » (inutilisable) devient lui-même le bouton qui mène aux erreurs, une par une, dans l'ordre des layouts.
  - Aparté du 15 octobre : un vecteur à forme complexe (icône, illustration) reste rasterisé après « Prepare for Slides » et bloque tout le template, en rouge, sans explication (`serialize/templateValidation.ts` reclasse tout raster en bloquant). Règle à revoir, voir la recommandation dans la conversation du 15 octobre.
- [ ] **Correction sur place.** La boîte « Fix before creating the template » liste les causes sans proposer d'action. → Un bouton « Fix automatically » dans la boîte, qui lance le reformatage sur ce layout : il corrige justement les dégradés et les ombres.

## Structure du rapport

- [ ] **Ordre inversé par rapport au Deck.** (À requestionner le 15 octobre : tout est déjà là, l'ordre actuel est peut-être le bon. La colonne Content dans l'aside arrivera avec les éléments du Master.) Les erreurs passent au-dessus de l'aperçu, et la tâche principale (assigner les rôles, liste Content) est tout en bas, invisible en 960×560. → Même ordre dans les deux modes : aperçu, « To fix », Content. Idéalement, Content à côté de l'aperçu (selon C).
  - C tranché : aperçu en haut, rapport dessous, comme le Deck. Reprendre aussi du lot 03 la colonne commune aperçu/rapport (`.f2s-deck-column`).
  - ~~Icône de sélection en bout de ligne~~ : retirée des deux modes le 14 octobre (`c3129ee`), plus rien à reprendre.
  - Plus de liste « To fix » séparée : les conflits de composition s'affichent sur la ligne du calque (voir plus bas). L'ordre visé devient donc : boîte bloquante, aperçu, Composition, Content.
  - Fait le 14 octobre : « Composition » est passée sous l'aperçu, juste au-dessus de « Content » (voir plus bas). Reste au-dessus de l'aperçu la seule boîte bloquante « Fix before creating the template ». Depuis le 15 octobre (`fbb5fd0`), elle suit la largeur et le padding des sections.
- [x] **Rôle affiché deux fois.** Libellé « TITLE » et sélecteur « [[title]] » sur la même ligne. → Garder seulement le sélecteur, avec un style marqué quand un rôle est assigné.
  - Fait : puce retirée, le sélecteur seul porte le rôle, écrit à l'encre (« No role » reste grisé).
- [x] **Composition et Content.** Demandé le 14 octobre : « Composition » liste les calques qui ont un rôle, sous la même forme que « Content », qui ne garde que les autres. Un calque passe dans Composition dès qu'il reçoit un rôle et revient dans Content quand on le lui retire (`ui/compositionRows.ts`). Les conflits (rôle en double, `[[title]]` sur une forme…) ne forment plus une liste à part : la ligne du calque prend un contour rouge et la raison s'écrit sous son nom.
- [x] **Sélecteurs de rôle.** Un clic à la souris affichait l'anneau du focus clavier. Ils prennent maintenant le style des champs (comme le sélecteur de polices) : fond blanc, biseau, anneau gris au clic.

## Panneau Styles

- [ ] **Rôles de couleur en jargon.** « Text & background 1…4 », « Accent 1…6 », sans explication ni effet visible. → Une ligne d'aide (« Maps your colors to the Slides theme, so people can recolor from Slides »), un bouton « Suggest roles » (la plus foncée en texte, la plus claire en fond, la plus utilisée et saturée en accent), et un aperçu des 12 pastilles du thème Slides obtenu.
- [ ] **Polices en double.** Le bandeau Fonts et la section Typography montrent les mêmes polices. → En mode Template, faire le choix de remplacement dans Typography et masquer le bandeau.
- [ ] **Double état vide.** Le canvas et le panneau de droite affichent chacun un état vide en même temps. → Masquer le panneau de droite tant qu'il n'y a aucun layout.

## Éléments récurrents du Master

- [ ] **Logo, footer, numéro de page posés une seule fois** (l'ancien « chrome de master », détaillé dans TODO.md, § Mode template, point 3). Ajouté au lot le 14 octobre : il n'était jusque-là que dans TODO.md. → Désigner un élément Figma comme récurrent ; à l'export, il est écrit une fois sur la page Master au lieu d'être recopié sur chaque slide.
  - Décision du 14 octobre : ces éléments globaux iront dans le panneau de droite, avec Colors et Typography, puisqu'ils valent pour toutes les slides du template. Composition, propre à chaque layout, reste sous l'aperçu.
  - Prérequis (audit 2026-09, TODO.md) : le rectangle de fond que le mapper pose sur chaque slide masquerait l'élément hérité du Master. À valider par un spike avant d'écrire l'UI.

## Idées à valider (fonctions qui manquent)

- [ ] **Suggestion automatique des rôles de placeholder** : le plus grand texte en `[[title]]`, le suivant en `[[subtitle]]`, le bloc de texte long en `[[body]]`, à confirmer d'un clic.
- [ ] **Aperçu du layout tel qu'il sera dans Slides**, placeholders vides, pour vérifier le rendu avant de créer le template.
