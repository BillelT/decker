# Plugin : parcours et actions

Le flow commun aux modes Deck et Template : ajouter des frames, lancer l'export, comprendre ce qui se passe, retrouver le résultat. Ces tâches touchent toutes la barre d'actions du header : les faire ensemble, en vérifiant que tout tient sur une ligne à 960 px (arbitrage F).

## Ajouter des frames

- [ ] **Ajout en un clic.** Aujourd'hui, « Select frames » devient « Add selection » : il faut sélectionner sur le canvas puis recliquer. → Un seul bouton direct « Add 3 frames », avec le nombre d'éléments sélectionnés en direct, désactivé tant que rien n'est sélectionné. `code.ts` envoie déjà `canvas-selection-changed` ; il faut y ajouter le nombre de frames éligibles.
- [ ] **Refus visibles dans le plugin.** Une frame au mauvais ratio est refusée via `figma.notify` seulement, hors de l'interface du plugin ; le plafond de 10 layouts s'affiche deux fois (Figma et plugin). → Tout ce qui part d'une action dans le plugin s'affiche dans la notification du plugin, et seulement là.
- [ ] **Bon ton.** « Beyond 20, export may become slow » est un avertissement, mais il s'affiche en rouge erreur. → Ton neutre ou avertissement.

## Bouton principal

- [ ] **Un bouton principal qui suit l'étape.**
  - Panneau vide : « Add frames ».
  - Frames ajoutées : « Export » (ou « Sign in to export » sans session Google).
  - Pendant l'export : « Exporting 2/4… » et un lien « Cancel ».
  - Export terminé : « Open in Slides », avec « Export again » en secondaire.
- [ ] **Résultat au bon endroit.** « Open presentation » apparaît dans le footer, à côté de « Buy me a coffee ». → Le remonter dans le header (voir ci-dessus). « Buy me a coffee » devient un simple lien texte.
- [ ] **Annuler un export.** Arrêter le polling, garder le lien vers la présentation partielle si elle existe déjà dans le Drive.

## « Prepare for Slides » (arbitrage D)

- [ ] **Clarifier ce qu'il fait.** Il duplique les frames sur le canvas et déplace la vue, mais seule une infobulle le dit ; sa place dans le header le fait passer pour une étape obligatoire. → Le renommer « Create Slides-ready copy », dire « Duplicates the frame next to the original », et le proposer là où le problème est affiché (fichiers 03 et 04) si D va dans ce sens.

## Comprendre où on est

- [ ] **États vides utiles.** Une phrase coupée par un `<br>` en dur. → Trois étapes numérotées par mode, plus une ligne « What's a template » en mode Template (layouts réutilisables, rôles `[[title]]`).
- [ ] **Différence Deck / Template.** Elle n'existe aujourd'hui que dans l'infobulle des onglets. → Une phrase sous l'onglet actif, ou dans l'état vide.
- [ ] **Bandeau Fonts.** Il affiche « All fonts will appear here and can be replaced automatically. » alors qu'il ne liste que les polices remplacées. → Le masquer tant qu'aucune police n'est remplacée ; sinon « Fonts replaced in Slides: ».

## À vérifier une fois le lot fait

- [ ] Le header tient sur une ligne à 960 px avec les nouveaux libellés, dans les deux modes et dans les deux skins.
- [ ] Aucun libellé ne change la largeur du champ « Name ».
