# Site web

Le site (decker.billeltighidet.fr, rendu par `packages/backend/src/routes/pages.ts` et `marketingStyles.ts`) partage maintenant la palette de la DA. Reste à le rendre plus conforme, plus juste dans son contenu, et plus fidèle à la DA. L'easter egg du footer a son propre fichier : [08-site-easter-egg-jeu.md](./08-site-easter-egg-jeu.md).

## Accessibilité et mobile

- [ ] **Vidéo de démo sans pause.** Elle tourne en boucle sans contrôle (WCAG 2.2.2, niveau A). Avec « réduire les animations », elle ne démarre pas, mais rien ne permet de la lancer : la démo reste une image figée. → Un bouton lecture / pause visible sur la vidéo.
- [ ] **Encoche iPhone.** La page déclare `viewport-fit=cover` sans marges de sécurité : en paysage, le header passe sous l'encoche. → `env(safe-area-inset-*)` sur le header et les conteneurs, ou retirer `viewport-fit=cover`.
- [ ] **Liens de nav petits.** 14 px de haut : ça passe le niveau AA grâce à l'espacement, mais loin des 44 px visés au doigt. → Zone cliquable étendue par padding.
- [ ] **Focus du logo et du carrousel.** Ils gardent l'anneau par défaut du navigateur. → `--b-focus-outline`, comme les autres liens.

## Contenu

- [ ] **Vidéo de démo périmée.** Elle montre l'ancienne interface (« Select frames to add », barre noire, ancienne palette). → La réenregistrer après la publication de la nouvelle version du plugin.
- [ ] **Card Templates inexacte.** Elle parle d'« a single frame », alors que le mode accepte plusieurs layouts (sans plafond depuis le 15 octobre). → Corriger le texte.
- [ ] **Promesse « Matched, pixel for pixel ».** Le plugin signale lui-même des éléments approximés ou rasterisés. → Reformuler, ou renvoyer vers le rapport de fidélité pour rester honnête.
- [ ] **Apostrophes droites** (« you're », « doesn't »). → Apostrophes typographiques (’).

## DA et code

- [ ] **Biseaux sur les boutons** (arbitrage A). La DA impose zéro ombre sur un bouton. → Trancher dans la DA ; le site suit.
  - Le survol en accent rouge est réglé (13 octobre 2026) : le CTA survole en `--b-accent-hover` (`hsl(20, 100%, 62%)`), et « Buy me a coffee » passe en secondaire de la DA (contour encre, fond encre au survol).
- [ ] **Tokens inventés.** `--b-accent-soft` (illustrations), `--b-selection` (doublon de `--b-accent-20`), `--b-text-4xl` (44 px). → Les intégrer à la DA ou les renommer hors du préfixe `--b-`.
- [ ] **Valeurs en dur.** `13px` (nav sous 560 px) et `48px` (titre du hero sous 720 px). → Tokens existants, ou nouveaux paliers validés dans la DA.
- [ ] **Page de connexion Google** (`auth.ts`). Cabinet Grotesk est déclarée mais pas chargée (la page s'affiche en police système), les variables `--f2s-*` sont propres à la page, et `min-height: 100vh` saute sur mobile. → Charger la police, utiliser les tokens `--b-*`, `100dvh` avec repli.
- [ ] **Une seule source de tokens** : voir le chantier transverse du README.

## À ajouter

- [ ] **Easter egg jouable dans le footer** : voir [08-site-easter-egg-jeu.md](./08-site-easter-egg-jeu.md).
