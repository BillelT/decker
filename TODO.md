# TODO

- **Indicateur de chargement du bouton Export.** Tant que le lien Google
  n'est pas prêt (juste après montage, ou après une erreur), le bouton
  Export est simplement désactivé sans aucun feedback visuel. Concevoir
  un état de chargement sympa (spinner, animation…) pour ce moment.
- **"Buy me a coffee".** Ajouter un rappel discret (pied de page ou petit
  encart en bas de l'UI) pointant vers un lien Buy Me a Coffee.
- **Création de template — suite (voir
  brief-creation-template-google-slides.md § Décisions prises).**
  - Réordonnancement par glisser-déposer des layouts de template (le deck
    export l'a déjà via `ui/reorderFrames.ts`).
  - Remplacer la convention de nom de calque `[[role]]` par un contrôle
    actif dans l'éditeur Figma (property/plugin data assignée depuis un
    panneau du plugin), pour guider la création sans devoir renommer les
    calques à la main.
  - Outil compagnon "dupliquer un layout + remplir ses placeholders" qui
    lirait le tag `f2s-placeholder:<RÔLE>` porté en alt text côté Slides.
  - Étendre `TemplateWarning`/le rapport de fidélité pour couvrir aussi
    les avertissements non bloquants (substitution de police, rayon
    approximé) dans l'UI de template, pas seulement les bloquants.
