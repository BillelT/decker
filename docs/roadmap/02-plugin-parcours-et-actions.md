# Plugin : parcours et actions

Le flow commun aux modes Deck et Template : ajouter des frames, lancer l'export, comprendre ce qui se passe, retrouver le résultat. Ces tâches touchent toutes la barre d'actions du header : les faire ensemble, en vérifiant que tout tient sur une ligne à 960 px (arbitrage F).

Lot traité le 14 octobre 2026 (décisions de Billel notées sous chaque tâche). Arbitrage D : « Prepare for Slides » reste dans le header, tel quel. Arbitrage F : les libellés tiennent à 960 px (mesuré en rendu, deux modes, deux skins) ; la taille du texte se tranche au lot 05.

## Ajouter des frames

- [x] **Ajout en un clic.** Aujourd'hui, « Select frames » devient « Add selection » : il faut sélectionner sur le canvas puis recliquer. → Un seul bouton direct « Add 3 frames », avec le nombre d'éléments sélectionnés en direct, désactivé tant que rien n'est sélectionné. `code.ts` envoie déjà `canvas-selection-changed` ; il faut y ajouter le nombre de frames éligibles.
  - Fait : « Add 3 frames » suit en direct les frames sélectionnées qui ne sont pas encore dans le panneau, grisé à zéro. Les frames s'ajoutent dans l'ordre de sélection ; celles sélectionnées d'un seul geste (rectangle, Ctrl+A) suivent l'ordre de lecture du canvas (`serialize/selectionOrder.ts`, testé).
- [x] **Refus visibles dans le plugin.** Une frame au mauvais ratio est refusée via `figma.notify` seulement, hors de l'interface du plugin ; le plafond de 10 layouts s'affiche deux fois (Figma et plugin). → Tout ce qui part d'une action dans le plugin s'affiche dans la notification du plugin, et seulement là.
  - Fait : plus aucun `figma.notify` sauf si le plugin ne démarre pas (aucune interface où l'afficher). Ratio, plafond, bilan de « Prepare for Slides », rôle de couleur réattribué : tout passe par le toast du panneau, avec ce qui s'est passé et quoi faire. Les erreurs techniques brutes partent dans la console. Durée d'affichage selon la longueur du message (4 à 10 s).
- [x] **Bon ton.** « Beyond 20, export may become slow » est un avertissement, mais il s'affiche en rouge erreur. → Ton neutre ou avertissement.
  - Fait : nouveau ton « info » (pastille à l'encre, « i »), utilisé aussi pour le bilan de préparation quand des problèmes sont signalés.

## Bouton principal

- [x] **Un bouton principal qui suit l'étape.**
  - Décision : l'ajout reste un bouton secondaire à part, toujours disponible ; seul « Export » change.
  - Fait : « Export », puis « Exporting 2/4 » avec « Cancel » à côté, puis « Open in Slides » une fois l'aperçu terminé. Dès que le panneau change (ajout, retrait, ordre, nom, retouche d'une frame, police), le résultat est périmé et le bouton redevient « Export again ». Même parcours en Template (« Create template », « Creating 2/4 »).
- [x] **Résultat au bon endroit.** « Open presentation » apparaît dans le footer, à côté de « Buy me a coffee ». → Le remonter dans le header (voir ci-dessus). « Buy me a coffee » devient un simple lien texte.
  - Fait : le lien est le bouton principal. Le footer garde le statut du dernier export et l'action qui en découle, juste à côté : « Retry 2 failed slides » après un échec, « Export again » après un succès, « Open in Slides » après une annulation. « Buy me a coffee » est un lien texte de la DA avec une flèche en diagonale.
  - Revu le 15 octobre (`7d66acf`) : plus de statut ni d'« Export again » dans le footer après un succès, le toast le dit déjà. « Open in Slides » reste le bouton principal jusqu'à son premier clic, puis redevient « Export again ». Le footer ne garde que « Retry » après un échec et le lien après une annulation.
- [x] **Annuler un export.** Arrêter le polling, garder le lien vers la présentation partielle si elle existe déjà dans le Drive.
  - Décision : vrai arrêt côté serveur. Fait : `POST /export/:jobId/cancel`, le job s'arrête avant la slide suivante (statut `canceled`), la présentation garde les slides écrites et perd la slide vide par défaut. Annulé avant la création du job, rien n'est créé.

## « Prepare for Slides » (arbitrage D)

- [x] **Clarifier ce qu'il fait.** Il duplique les frames sur le canvas et déplace la vue, mais seule une infobulle le dit ; sa place dans le header le fait passer pour une étape obligatoire.
  - Décision : il reste dans le header, tel quel (retravailler les slides dans Figma est une force du plugin). Son bilan dit maintenant que les copies sont posées à côté des originaux.

## Comprendre où on est

- [x] **États vides utiles.** Une phrase coupée par un `<br>` en dur. → Trois étapes numérotées par mode.
  - Fait : trois étapes numérotées, avec le nom des boutons. Idée d'animation des étapes gardée pour plus tard (avec la refonte de l'animation d'export, lot 05) : le texte reste dans tous les cas.
- [x] **Différence Deck / Template.** *(abandonné)* Elle n'existe aujourd'hui que dans l'infobulle des onglets.
  - Décision : rien à ajouter, le plugin vise des utilisateurs qui connaissent la différence.
- [x] **Bandeau Fonts.** Il affiche « All fonts will appear here and can be replaced automatically. » alors qu'il ne liste que les polices remplacées.
  - Décision : lister toutes les polices. Fait : chaque police du deck se remplace en un clic dans toute la présentation, même une police que Slides a déjà (une Google Font, par exemple).

## Corrigé en passant

- [x] Footer : logo en 26 × 26 sans marge négative, Settings en 26 px de haut (5 px 10 px), texte centré au pixel sur l'icône.
- [x] Pastilles d'état et croix des toasts : Preact ignorait `strokeWidth`, la coche et la croix s'affichaient en trait de 1 px. Attributs SVG corrigés.
- [x] Le choix de police modifiait la slide en attente elle-même : après un export, la police choisie passait pour la police d'origine (`serialize/fontChoices.ts`, testé).
- [x] Le lot du thème d'un template décalait d'un cran l'aperçu d'export et le total affiché.

## À vérifier une fois le lot fait

- [x] Le header tient sur une ligne à 960 px avec les nouveaux libellés, dans les deux modes et dans les deux skins. L'état le plus large, un export en cours (« Cancel » + « Exporting 12/12 »), tient pile en modern.
- [x] Aucun libellé ne change la largeur du champ « Name » (170 px dans tous les états).
