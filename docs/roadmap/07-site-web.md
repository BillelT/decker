# Site web

Le site (decker.billeltighidet.fr, rendu par `packages/backend/src/routes/pages.ts` et `marketingStyles.ts`) partage maintenant la palette de la DA. Reste à le rendre plus conforme, plus juste dans son contenu, et plus fidèle à la DA. L'easter egg du footer a son propre fichier : [08-site-easter-egg-jeu.md](./08-site-easter-egg-jeu.md).

## Accessibilité et mobile

- [x] **Vidéo de démo sans pause.** Fait le 16 octobre : la vidéo est remplacée par une **démo interactive** (`routes/heroDemo.ts`) : le plugin reproduit sur un canvas Figma, joué en boucle par un faux curseur (sélection, Add frames, Export, deck ouvert dans Slides au titre éditable), mode Templates compris. Un clic ou une touche dedans rend la main au visiteur. Bouton Pause / Play / Replay sous la démo ; en mouvement réduit, rien ne se lance seul. Le hero passe en composition à la Linear : titre, puis accroche à gauche et CTA à droite, puis la démo en grand. La phrase « Free to use… » est retirée.
- [x] **Encoche iPhone.** Fait le 16 octobre : `env(safe-area-inset-left/right)` en padding du `body` (son fond couvre la marge), `safe-area-inset-bottom` sous le footer.
- [x] **Liens de nav petits.** Fait le 16 octobre : ancres du header en 15 px (`--site-text-nav`, hors DA, à y intégrer si le palier sert ailleurs), zone cliquable portée à ~42 px par padding compensé. Le palier 560 px passe de `13px` en dur à `--b-text-sm`.
- [x] **Focus du logo et du carrousel.** Fait le 16 octobre : `--b-focus-outline`, angles droits ; l'anneau du carrousel passe à l'intérieur de la piste.

## Contenu

- [x] ~~**Vidéo de démo périmée.**~~ Sans objet : la vidéo est remplacée par la démo interactive. À garder alignée sur l'interface du plugin quand elle change.
- [x] **Démo fidèle au vrai plugin.** Fait le 16 octobre : la démo reprend le markup du plugin (classes `f2s-*`) et son CSS lui-même, régénéré par `node scripts/sync-plugin-styles.mjs` (`npm run lint` vérifie qu'il est à jour) et scopé sous `.dm-plugin`. Après un changement de CSS du plugin, relancer ce script. Habillage : Figma desktop façon macOS, deux onglets (Trailworn deck, Trailworn template), canvas uni, sélection bleue Figma. Le faux deck est en Arial (une police de navigateur, plus Cabinet Grotesk) et la liste des polices est le vrai combobox. Rail réordonnable (souris et Alt + flèches), Composition et Content en vraies listes de rôles, couleurs et Suggest roles fonctionnels. Pas de faux export (retiré le 16 octobre avec la fenêtre Slides) : Export et Create template affichent une notification qui renvoie au vrai plugin. Le bouton Pause / Replay est retiré (décision du 16 octobre) : la lecture ne passe qu'une fois, à l'écran seulement. Les panneaux du plugin ne défilent qu'après un premier clic dans la démo, pour que la molette reste à la page.
- [x] **Visuels des cards en vraie interface.** Fait le 16 octobre : les schémas SVG (`artwork.ts`, supprimé) sont remplacés par des recadrages de la vraie UI, comme la démo du hero (`routes/featureScenes.ts`) : chaque card montre l'écran qui prouve ce qu'elle dit (fiche à 0 $, rail plein et export 3/12, couleurs mappées sur le thème, rail trié à côté des frames sélectionnées, zone de texte Slides en édition, réglages du compte, lasso sur le canvas Figma, comparaison Figma / Slides, deck ouvert dans Slides). Même markup `f2s-*` et même CSS que le plugin ; la modale Settings fait désormais partie du CSS synchronisé. Scènes dessinées en 400 x 250 et mises à l'échelle de la card, inertes, décrites par leur `aria-label`. Retouches du 16 octobre au soir : card Templates en mode Templates du plugin (Master en tête du rail, layout aux placeholders, Composition, couleurs détectées et mappées), card Fidelity en éditeur Google Slides complet (en-tête, menus, barre d'outils, pellicule, zone de texte sélectionnée), card Privacy en page d'accès du compte Google (seuls `drive.file` et l'e-mail, bouton de retrait).
- [x] **Card Templates inexacte.** Fait le 16 octobre : « Turn your frames into a reusable Slides template: theme colors, fonts, layouts, and real placeholders. » Elle parle d'« a single frame », alors que le mode accepte plusieurs layouts (sans plafond depuis le 15 octobre). → Corriger le texte.
- [x] ~~**Promesse « Matched, pixel for pixel ».**~~ Gardée (16 octobre) : Decker est le plugin le plus fidèle du marché, la promesse tient.
- [x] **Apostrophes droites.** Fait le 16 octobre : apostrophes et guillemets typographiques sur le site et la page de connexion.

## DA et code

- [ ] **Biseaux sur les boutons** (arbitrage A). La DA impose zéro ombre sur un bouton. → Trancher dans la DA ; le site suit.
  - Le survol en accent rouge est réglé (13 octobre 2026) : le CTA survole en `--b-accent-hover` (`hsl(20, 100%, 62%)`), et « Buy me a coffee » passe en secondaire de la DA (contour encre, fond encre au survol).
- [ ] **Tokens inventés.** `--b-accent-soft` (illustrations), `--b-selection` (doublon de `--b-accent-20`), `--b-text-4xl` (44 px). → Les intégrer à la DA ou les renommer hors du préfixe `--b-`.
- [x] **Valeurs en dur.** Fait le 16 octobre : `13px` remplacé par `--b-text-sm`, `48px` par le nouveau palier de la DA `--b-text-5xl` (billel-skill `facf29c`).
- [x] **Page de connexion Google** (`auth.ts`). Fait le 16 octobre : Cabinet Grotesk était déjà chargée depuis le chantier des tokens (skin Modern ; le skin Windows 95 garde Tahoma, comme dans le plugin). Le dernier `--f2s-error` devient `--color-error`, le même nom que l'exception du plugin. `100dvh` avec repli `100vh`, marges resserrées sous 480 px.
- [ ] **Une seule source de tokens** : voir le chantier transverse du README.

- [x] **Carrousel qui bloquait la molette.** Corrigé le 16 octobre : `overflow-x: auto` passait l'axe vertical en `auto`, et le `overscroll-behavior: contain` posé par la DA sur tout élément empêchait la page de reprendre le défilement. Axe vertical en `hidden`, contain sur l'axe horizontal seul.

## À ajouter

- [x] **Easter egg jouable dans le footer** (prototype complet le 16 octobre) : voir [08-site-easter-egg-jeu.md](./08-site-easter-egg-jeu.md).
