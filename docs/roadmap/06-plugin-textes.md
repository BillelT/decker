# Plugin : textes de l'interface

À faire en dernier : les états vides et les aides citent les libellés des boutons, qui changent dans le fichier 02. Tout le texte d'interface reste en anglais.

- [ ] **Un nom par mode.** Onglet « Templates », bouton « Create template », barre de titre Win95 « Template creation ». → « Deck » et « Template » partout.
- [ ] **Une casse.** « COLORS » et « TYPOGRAPHY » en capitales, à côté de « Content » et « Composition ». → Majuscule en début de phrase uniquement, réglée en CSS si besoin.
- [ ] **Ponctuation.** « Dimensions : » avec l'espace à la française, guillemets droits dans les consignes (« Click "Select frames" »). → Pas d'espace avant « : », guillemets courbes.
- [ ] **États vides et aides.** Les réécrire avec les nouveaux libellés (fichier 02) : trois étapes, un verbe d'action par bouton.
- [ ] **Messages d'erreur.** Chaque erreur dit ce qui s'est passé et quoi faire, sans code HTTP en clair (voir le fichier 01).
- [ ] **Pluriels.** Construits à la main (`n === 1 ? '' : 's'`). → `Intl.PluralRules` si l'interface doit un jour être traduite ; sinon, garder et centraliser dans une fonction.
