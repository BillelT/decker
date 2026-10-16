# Site web

Le site (decker.billeltighidet.fr, rendu par `packages/backend/src/routes/pages.ts` et `marketingStyles.ts`) partage maintenant la palette de la DA. Reste à le rendre plus conforme, plus juste dans son contenu, et plus fidèle à la DA. L'easter egg du footer a son propre fichier : [08-site-easter-egg-jeu.md](./08-site-easter-egg-jeu.md).

## Accessibilité et mobile

- [ ] **Vidéo de démo sans pause.** Elle tourne en boucle sans contrôle (WCAG 2.2.2, niveau A). Décidé le 16 octobre : la vidéo sera remplacée par une **démo interactive** du plugin dans le hero (comme les sites de Voila ou Linear), à faire une fois l'interface du plugin stabilisée. Penser au contrôle pause si la démo s'anime seule plus de 5 s.
- [x] **Encoche iPhone.** Fait le 16 octobre : `env(safe-area-inset-left/right)` en padding du `body` (son fond couvre la marge), `safe-area-inset-bottom` sous le footer.
- [x] **Liens de nav petits.** Fait le 16 octobre : ancres du header en 15 px (`--site-text-nav`, hors DA, à y intégrer si le palier sert ailleurs), zone cliquable portée à ~42 px par padding compensé. Le palier 560 px passe de `13px` en dur à `--b-text-sm`.
- [x] **Focus du logo et du carrousel.** Fait le 16 octobre : `--b-focus-outline`, angles droits ; l'anneau du carrousel passe à l'intérieur de la piste.

## Contenu

- [ ] **Vidéo de démo périmée.** Elle montre l'ancienne interface (« Select frames to add », barre noire, ancienne palette). → La réenregistrer après la publication de la nouvelle version du plugin.
- [x] **Card Templates inexacte.** Fait le 16 octobre : « Turn your frames into a reusable Slides template: theme colors, fonts, layouts, and real placeholders. » Elle parle d'« a single frame », alors que le mode accepte plusieurs layouts (sans plafond depuis le 15 octobre). → Corriger le texte.
- [x] ~~**Promesse « Matched, pixel for pixel ».**~~ Gardée (16 octobre) : Decker est le plugin le plus fidèle du marché, la promesse tient.
- [x] **Apostrophes droites.** Fait le 16 octobre : apostrophes et guillemets typographiques sur le site et la page de connexion.

## DA et code

- [ ] **Biseaux sur les boutons** (arbitrage A). La DA impose zéro ombre sur un bouton. → Trancher dans la DA ; le site suit.
  - Le survol en accent rouge est réglé (13 octobre 2026) : le CTA survole en `--b-accent-hover` (`hsl(20, 100%, 62%)`), et « Buy me a coffee » passe en secondaire de la DA (contour encre, fond encre au survol).
- [ ] **Tokens inventés.** `--b-accent-soft` (illustrations), `--b-selection` (doublon de `--b-accent-20`), `--b-text-4xl` (44 px). → Les intégrer à la DA ou les renommer hors du préfixe `--b-`.
- [ ] **Valeurs en dur.** `13px` réglé le 16 octobre. Reste `48px` (titre du hero sous 720 px, `marketingStyles.ts`) : la DA n'a rien entre `--b-text-3xl` (36) et `--b-text-6xl` (72). → Un palier `--b-text-5xl` dans la DA, ou 36 px.
- [x] **Page de connexion Google** (`auth.ts`). Fait le 16 octobre : Cabinet Grotesk était déjà chargée depuis le chantier des tokens (skin Modern ; le skin Windows 95 garde Tahoma, comme dans le plugin). Le dernier `--f2s-error` devient `--color-error`, le même nom que l'exception du plugin. `100dvh` avec repli `100vh`, marges resserrées sous 480 px.
- [ ] **Une seule source de tokens** : voir le chantier transverse du README.

## À ajouter

- [x] **Easter egg jouable dans le footer** (prototype complet le 16 octobre) : voir [08-site-easter-egg-jeu.md](./08-site-easter-egg-jeu.md).
