# Plugin : accessibilité et bugs

Correctifs qui n'attendent aucun arbitrage. Tous les constats ont été vérifiés au rendu (Chromium, données simulées) ou dans le code.

## Accessibilité

- [ ] **Focus clavier visible.** Aucun style `:focus-visible` dans le CSS. Sur « Prepare for Slides », l'anneau est invisible (`outline: 1px solid transparent` sur `.f2s-btn--secondary` écrase celui du navigateur) ; sur « Export », il est presque invisible (WCAG 2.4.7). → Un anneau unique de 2 px sur `:focus-visible`, calqué sur `--b-focus-outline` de la DA, contrasté sur tous les fonds. Fichier : `packages/plugin/src/styles.css`.
- [ ] **Texte orange du bouton secondaire.** Orange sur blanc : 3.01:1, sous les 4.5:1 exigés. → Texte encre avec bordure orange, ou un orange plus foncé réservé au texte (valeur à fixer dans la DA).
- [ ] **Survol du bouton principal en `#f04000`.** La DA réserve `--b-accent-red` au graphisme et l'interdit sur un état d'interaction ; il est en plus à 6° de teinte du rouge d'erreur. → Assombrir l'orange au survol.
- [ ] **Langue du document.** `ui.html` déclare `lang="fr"` alors que toute l'interface est en anglais : les lecteurs d'écran lisent l'anglais avec une voix française (WCAG 3.1.1, niveau A). → `lang="en"`. Fichier : `packages/plugin/src/ui.html`.
- [ ] **Champs sans nom accessible** (WCAG 4.1.2, niveau A). Le champ « Name » n'a qu'un placeholder (le libellé visible n'est pas relié) ; les sélecteurs de rôle des couleurs n'ont aucun libellé. → `<label for>` sur le champ, `aria-label` du type « Theme role for #F06800 » sur chaque sélecteur. Fichiers : `ui.tsx`, `ui/TemplateStylePanel.tsx`.
- [ ] **Progression d'export muette.** « Generating slide 2 of 4 » n'est pas annoncé aux lecteurs d'écran. → Une région `role="status"` stable, rendue vide avant l'export, qui annonce l'avancée.
- [ ] **Réordonner au clavier** (WCAG 2.5.7). Le rail ne se réordonne qu'au glisser-déposer. → Boutons « Move up » / « Move down » au survol de chaque vignette et raccourci Alt+↑/↓. À faire après le hook commun (voir Bugs).
- [ ] **Notifications d'erreur.** Elles disparaissent seules après 4 à 7 s et ne réagissent pas au survol (`pointer-events: none`). → Les erreurs restent jusqu'à fermeture, avec un bouton « Close » ; seuls les succès disparaissent seuls.
- [ ] **Modale Settings.** Le focus n'y est pas bloqué et ne revient pas sur le bouton Settings à la fermeture ; Interface et Appearance sont codés en onglets alors que ce sont des boutons radio. → `<dialog>` avec `showModal()`, focus restauré, `role="radiogroup"`. Fichier : `ui/SettingsModal.tsx`.
- [ ] **Noms des croix.** Toutes s'appellent « Remove ». → « Remove slide 2 », « Remove layout Title slide ».
- [ ] **Textes tronqués.** Le texte complet n'est accessible qu'au survol de la souris (attribut `title`). → Infobulle accessible au clavier, ou texte complet affiché au focus.
- [ ] **Animations d'export sans pause.** Balayage, clignotement des points et pulsation de la vignette tournent pendant tout l'export, ignorent `prefers-reduced-motion` et n'ont pas de pause (WCAG 2.2.2). → Fondu simple en mouvement réduit, et un bouton pause sur l'aperçu.
- [ ] **Chiffres qui bougent.** Pas de `tabular-nums` sur « Generating slide 1 of 4 » ni sur « 14 native · 2 rasterized ». → `font-variant-numeric: tabular-nums`.
- [ ] **Barre de progression.** Elle anime `width`. → `transform: scaleX()`, comme le veulent les rules de mouvement.

## Bugs

- [ ] **Vignette collée au curseur** (reproduit). Les écouteurs `pointerup` sont posés dans un `useEffect`, sans `setPointerCapture` : après un clic rapide ou un relâchement hors de la fenêtre du plugin, la vignette suit le curseur. → `setPointerCapture` au `pointerdown` (comme `ResizeGrip`), gestion de `pointercancel`, dans un hook commun `useRailReorder`. `DeckPanel.tsx` et `TemplatePanel.tsx` dupliquent aujourd'hui environ 150 lignes de glisser-déposer.
- [ ] **Mode sélection fantôme.** « Add selection » et la consigne restent affichés pendant et après l'export. → Réinitialiser au lancement de l'export et au changement de mode. Disparaît de fait avec l'ajout en un clic (fichier 02).
- [ ] **Aperçu du mode Template calé à gauche.** Quand la hauteur limite l'image, elle laisse une bande vide encadrée à droite. → Centrer l'image dans son conteneur.
- [ ] **Erreurs serveur brutes.** L'utilisateur voit « Asset upload rejected (413) » ou « Backend responded 500 ». → Un message humain qui dit quoi faire, le détail technique dans une zone repliable.
