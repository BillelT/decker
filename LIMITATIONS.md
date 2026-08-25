# Limitations connues

Ce document explique, en langage designer plutôt que technique, ce que
l'export **Figma → Google Slides** peut et ne peut pas reproduire à
l'identique. Il est affiché dans l'interface du plugin avant chaque export
(rapport de fidélité) pour qu'il n'y ait jamais de mauvaise surprise après
coup.

Google Slides est un outil plus simple que Figma sur certains points. Quand
un élément ne peut pas être reproduit fidèlement en gardant son
éditabilité, le plugin le **convertit en image** (« rasterise ») plutôt que
de l'approximer silencieusement, et te le signale.

| Ce que Figma permet | Ce qui se passe dans Slides |
|---|---|
| Dégradés (linéaire, radial, angulaire) | **Non supportés.** Converti en image. |
| Espacement des lettres (tracking) | **Non supporté.** Si l'effet visuel est notable (> 2 % de la largeur du texte), converti en image ; sinon ignoré silencieusement (avec un log). |
| Rayon d'angle personnalisé | Slides impose un rayon fixe qui ne se règle pas précisément. Un rayon « raisonnable » (entre 8 % et 25 % de la plus petite dimension) est approximé automatiquement — tu verras un avertissement informatif. En dehors de cette plage, ou si les 4 coins ont des rayons différents, l'élément est converti en image. |
| Ombres portées / ombres internes / flous | **Non supportés en écriture.** Toujours convertis en image. |
| Transparence d'image | Slides ne permet pas de régler la transparence d'une image après import. Si besoin (ex. calque de contrôle), la transparence est appliquée directement dans le fichier image avant l'envoi. |
| Recadrage, luminosité, contraste, recoloration d'image | Doivent être « cuits » dans l'image avant l'envoi — non modifiables après coup dans Slides. |
| Marge interne des zones de texte | Slides ajoute automatiquement une marge interne aux blocs de texte, non réglable et non documentée par Google. Le plugin compense cette marge (mesurée une fois via l'outil de calibration) pour que le texte tombe pile à la bonne position. |
| Largeur des zones de texte ajustée pile sur le contenu (« hug »/auto-largeur, fréquent pour un libellé court) | Figma et Slides ne rendent jamais une police à l'identique au pixel près (moteurs de rendu différents) : sans marge, un texte sans la moindre marge de largeur peut retourner à la ligne de façon inattendue dans Slides, y compris en plein mot. Le plugin ajoute une petite marge de sécurité à la largeur de chaque zone de texte pour absorber cet écart. |
| Plusieurs remplissages sur une forme, modes de fusion (multiply, screen…) | **Non supportés.** Convertis en image. |
| Contour différent par côté, contour "à l'intérieur" du tracé | Approximé par un contour centré uniforme, ou converti en image si l'écart visuel est trop important. |
| Icônes, tracés vectoriels personnalisés, formes booléennes (union/soustraction…) | **Toujours convertis en image** — Slides n'a pas d'équivalent éditable. |
| Polygone régulier (outil Polygone de Figma) | Slides n'a de forme native que pour 3 à 6 côtés (triangle, losange, pentagone, hexagone) — reproduit fidèlement dans cette plage. Au-delà de 6 côtés, converti en image plutôt que d'être approximé par la forme la plus proche (ex. un octogone ne devient pas un hexagone déformé). |
| Étoile (outil Étoile de Figma) | Reproduite nativement uniquement à 5 branches. Un autre nombre de branches est converti en image plutôt que d'être approximé par une étoile à 5 branches déformée. |
| Lignes (outil Ligne de Figma) | **Éditables nativement** (couleur, épaisseur, pointillés) via le type de ligne dédié de Slides. Convertie en image seulement si elle a plusieurs contours, un contour en dégradé, une épaisseur non uniforme, ou une terminaison décorative (flèche, losange, cercle) non représentable nativement. |
| Polices non disponibles dans Google Fonts ni dans la liste système de Slides | Remplacées par une police proche quand une correspondance existe (ex. *SF Pro Display* → *Inter*), sinon le texte est converti en image et un avertissement bloquant te demande de confirmer ou de changer la police. |
| Auto-layout (agencement automatique) | Converti en positions fixes au moment de l'export — un redimensionnement ultérieur dans Slides ne réajustera pas automatiquement les éléments comme le ferait Figma. |
| Groupes / composants Figma | Aplatis : chaque élément devient indépendant dans Slides, il n'y a pas de "groupe" Slides qu'on peut déplacer d'un bloc. |
| Fond (couleur) d'une frame **imbriquée** (pas la slide elle-même) — ex. une carte, un badge, une pastille colorée | Reproduit nativement (couleur + rayon d'angle, même règle que pour une forme) si le fond est une seule couleur unie. S'il s'agit d'un dégradé, d'une image, de plusieurs remplissages, ou d'un contour non standard, TOUTE la frame (fond + contenu) est convertie en image plutôt que de perdre juste le fond. |

## Création de template (mode dédié)

Le mode "Create a template" du plugin construit une présentation dont
chaque slide est un layout réutilisable, plutôt qu'un deck ponctuel. Deux
différences par rapport à l'export de deck :

- **Aucune rasterisation tolérée.** Tout ce qui déclencherait une
  conversion en image dans le tableau ci-dessus (dégradé, ombre, mode de
  fusion, masque, vecteur custom, police introuvable…) bloque la création
  du template tant que ce n'est pas corrigé dans Figma — un template
  rasterisé fige l'élément pour tous ses futurs utilisateurs, qui n'ont ni
  le fichier Figma source ni la main sur le rendu.
- **Pas de nouvel objet `Layout` personnalisé.** L'API Slides ne permet
  aucune création de Placeholder/Layout personnalisé en écriture : seuls
  les ~8 layouts prédéfinis créés avec une présentation neuve existent, et
  `CreateSlideRequest` ne peut que référencer l'un d'eux. Un "template"
  produit par ce plugin reste donc une présentation Slides normale à
  dupliquer, pas un objet `Layout` natif de l'API — la même limite
  documentée dans le brief comme la raison pour laquelle aucun concurrent
  ne couvre bien ce cas.
- **En revanche, le vrai thème Slides (couleurs) EST modifiable en
  écriture** — corrige une conclusion erronée d'un précédent audit.
  Confirmé sur le schéma officiel de l'API ET testé en conditions réelles
  (`packages/backend/src/spikes/masterThemeSpike.ts`, audit 2026-08) :
  `PageProperties.colorScheme` de la page `Master` accepte un
  `UpdatePagePropertiesRequest` avec les 12 premiers `ThemeColorType`
  (DARK1/2, LIGHT1/2, ACCENT1-6, HYPERLINK, FOLLOWED_HYPERLINK), et un
  élément (forme ou texte) peut être lié à l'un de ces slots via
  `OpaqueColor.themeColor` plutôt qu'un `rgbColor` figé — un changement
  ultérieur du thème (à la main dans Slides, ou en ré-import) recolore
  alors l'élément en cascade. **De plus, un élément posé directement sur
  la page Master s'hérite bien sur toute slide qui référence un layout
  descendant de ce Master** (confirmé visuellement : un bandeau posé
  UNIQUEMENT sur le Master apparaît sur toutes les slides). Donc si le
  master lui-même ne porte typiquement que le chrome récurrent (logo,
  footer, mention de confidentialité) plutôt que les variantes de mise en
  page — qui restent, elles, des slides normales avec leurs placeholders
  — cette limite n'empêche pas de reproduire un vrai comportement de
  thème/master pour ce qui compte : couleurs globales + éléments
  récurrents. **Capacité désormais implémentée côté mapper**
  (`packages/backend/src/mapper/theme.ts`, `IRDocument.theme` +
  `IRColor.themeRole` dans le contrat partagé) : un `IRDocument` qui porte
  un `theme` complet (12 rôles) déclenche l'écriture du `colorScheme` sur
  le Master, et tout `IRColor` avec un `themeRole` est sérialisé en
  `themeColor` plutôt qu'un `rgbColor` figé. Encore inutilisé en pratique
  faute d'UI pour assigner ces rôles côté plugin (voir `TODO.md` § Mode
  template, point 2 — l'onglet "Style").
- **Placeholders marqués via alt text.** Un calque Figma dont le nom est
  préfixé par `[[title]]`, `[[subtitle]]`, `[[body]]`, `[[image]]`,
  `[[logo]]` ou `[[custom:Libellé]]` devient, côté Slides, un élément dont
  l'alt text (titre + description `f2s-placeholder:<RÔLE>`) porte cette
  métadonnée — visible dans le panneau "Texte alternatif" de Slides.

## Ce que ça veut dire concrètement

- **Un badge "N objets natifs · M rasterisés"** apparaît pour chaque frame
  avant l'export. Plus le taux de rasterisation est bas, plus la
  présentation Slides résultante reste facile à retoucher.
- **Cliquer sur un avertissement** dans le rapport sélectionne l'élément
  concerné directement dans Figma, pour que tu puisses l'ajuster si le
  taux de rasterisation te semble trop élevé (ex. simplifier un dégradé en
  couleur unie, redresser un contour multiple).
- Rien n'est jamais silencieusement approximé au-delà des tolérances
  décrites ci-dessus : soit c'est fidèle et éditable, soit c'est signalé.

---

## État du projet (pour l'équipe technique)

Ce dépôt contient l'architecture complète (plugin, backend, mapper, IR
partagé, harnais de calibration) conforme à `figma-to-slides-plugin-spec.md`,
avec les couches suivantes **testées et fonctionnelles hors ligne** :

- `packages/shared` — contrat IR.
- `packages/backend/src/mapper` — IR → requêtes Slides, couverture de tests ≥ 80 %.
- `packages/plugin/src/serialize` — arbre de décision natif/raster, résolution
  de police, mapping texte : logique pure testée par 52 tests unitaires.
- Backend Express (OAuth PKCE, upload d'assets, orchestration d'export,
  retry/backoff) : type-checké et démarre correctement, non exercé contre
  l'API Google réelle dans cet environnement (pas d'identifiants OAuth ni
  de session utilisateur disponibles ici).
- Harnais de calibration (`npm run calibrate`) : le calcul SSIM et la
  génération du rapport sont testés (comparaison d'images synthétiques), et
  **le pipeline complet a maintenant tourné avec succès contre un vrai
  compte Google, sur les 13 fixtures du jeu (`01-rects` à `13-batch`)** —
  toutes passées au vert (2026-08-03). Critère de sortie de Phase 0 validé
  initialement sur `01-rects` — SSIM = 0.9973 (seuil ≥ 0.99), écart de
  position nul sur les 5 rectangles (0.000pt, seuil ≤ 0.5pt) — puis confirmé
  sur l'ensemble du jeu. Le détail par fixture (`calibration-report.html`)
  est un artefact local non commité au repo ; seules les constantes de
  compensation dérivées (`calibration.json`, régénéré à chaque run) sont
  suivies dans git. Deux bugs réels ont été trouvés et corrigés à
  l'occasion du tout premier run, invisibles tant que ce script n'avait
  jamais tourné pour de vrai :
  - `presentations.get` renvoie les positions en **EMU**, pas en points,
    même quand les requêtes d'écriture précisent `unit: 'PT'` — le calcul
    d'écart comparait donc deux unités différentes et rapportait des
    écarts de centaines de milliers de points sur une géométrie en réalité
    parfaite (`calibrate.ts`, conversion `EMU_PER_PT = 12700` ajoutée).
  - La miniature réelle (`pages.getThumbnail`, `thumbnailSize=LARGE`) n'a
    pas forcément la même résolution que l'image de référence générée en
    interne — comparer les deux en **rognant** au plus petit dénominateur
    commun faussait le SSIM sur un contenu par ailleurs identique (visible
    en diff sous forme de liseré dédoublé autour de chaque forme).
    `ssim.ts` **redimensionne** désormais l'image la plus grande avant
    comparaison (plus proche voisin, testé par régression).

### Ce qui reste explicitement non calibré / non fait

- **`textInset` est désormais mesuré pour de vrai** (fixture `03-text-inset`,
  audit 2026-08, code-générée comme `01-rects` — deux `TEXT_BOX` à fond
  gris avec un glyphe "H" rouge gras ancré haut-gauche / bas-droite,
  requêtes construites à la main plutôt que via `mapText` pour ne PAS
  appliquer la compensation qu'on cherche justement à calibrer). Mesure par
  balayage de pixels (`calibration/pixelMeasure.ts`) sur la miniature
  réelle, écrite dans `calibration.json` à chaque run. Voir
  `calibration-report.html` section "03-text-inset" pour la valeur mesurée
  et une vérification visuelle.
- **Trois champs de `CalibrationData` sont des valeurs par défaut non
  mesurées ET ne sont consommés par AUCUN code du mapper ni du plugin**
  (vérifié par recherche exhaustive, audit 2026-08) :
  `roundRectRadiusRatio`, `defaultOutlineWeightPt`, `lineSpacingBaseline`.
  Les calibrer sans d'abord les brancher quelque part ne changerait rien au
  comportement réel — pas de fixture construite pour eux tant que ce
  branchement n'existe pas (voir aussi `radiusNativeTolerance`, qui EXISTE
  dans `CalibrationData` mais dont le plugin utilise en réalité sa propre
  copie codée en dur, `serialize/radius.ts::RADIUS_NATIVE_TOLERANCE` — le
  fichier `calibration.json` produit par le backend n'est de toute façon
  jamais lu côté plugin, seulement côté mapper backend).
  `textWidthSafetyMarginEm` (et ses variantes substituée/tightFit) restent
  aussi non mesurées, mais POUR une raison différente : ce sont des marges
  de sécurité empiriques contre un écart de rendu de police qui varie par
  police/taille, pas une constante unique mesurable par une seule fixture
  géométrique — leur valeur par défaut reste un choix raisonnable plutôt
  qu'une mesure. Les mesurer précisément demanderait un vrai fichier Figma
  (texte `tightFit` sans substitution — la largeur "naturelle" que Figma
  calcule pour une boîte à largeur ajustée n'existe nulle part en dehors de
  Figma lui-même, exactement comme `05-text-edge`/`11-autolayout` plus
  haut) — repoussé pour l'instant (audit 2026-08) : le cas qui dégrade le
  plus la fidélité de taille de zone de texte est justement une police
  substituée cumulée à du letter-spacing, un cas que **"Prepare for
  Slides" est spécifiquement conçu pour absorber en amont** (letter-spacing
  remis à zéro, police choisie explicitement) plutôt que de compter sur
  une marge de sécurité générique côté backend pour le rattraper après
  coup — l'un ne remplace pas l'autre, mais rend le second moins critique.
- **Le SSIM n'est pas un signal de fidélité fiable sur du texte réel**
  (audit 2026-08, confirmé en conditions réelles sur `04`/`05`/`11` :
  position mesurée parfaite — 0.000pt d'écart partout, une fois le bug
  ci-dessus corrigé — mais SSIM entre 0.56 et 0.86 malgré ça). Cause : Figma
  et Slides utilisent chacun leur propre moteur de rendu de police
  (hinting/anti-aliasing distincts), donc même un texte à la position
  EXACTEMENT correcte produit un delta pixel visible sur chaque ligne —
  contrairement aux formes unies (`01-rects`/`02-rotation`/`06-shapes`,
  0.99+). `calibration-report.html` et la console de `npm run calibrate`
  ignorent donc désormais le SSIM dans le statut pass/fail des fixtures
  contenant du texte (`FixtureResult.containsText`) — seul l'écart de
  position reste engageant, le SSIM y est affiché à titre strictement
  informatif.
- Le jeu de fixtures complet listé au spec §9 (`01-rects` à `13-batch`) a
  maintenant **`01-rects`, `02-rotation`, `03-text-inset` et `06-shapes`
  en version code-générée** (sans fichier Figma réel) — la règle qui
  décide si une fixture PEUT être code-générée (audit 2026-08, corrigée en
  cours de route — voir historique) : est-ce que ce que la fixture teste
  survit jusqu'à l'`IRDocument` (le contrat déjà résolu que consomme le
  mapper backend), ou est-ce que c'est une décision prise **avant**, côté
  plugin, qui ne laisse aucune trace distinctive une fois l'IR construit ?
  - `02-rotation` (transform affine) et `06-shapes` (mapping de presets +
    stroke) sont purement des champs du contrat IR déjà résolus
    (`rotation`, `shapeType`, `stroke` sur `IRShape`/`IRBase`) — le mapper
    n'a besoin que d'un `IRShape` valide, peu importe sa provenance,
    exactement comme `01-rects`. Même chose pour un bloc de texte à
    plusieurs styles (`04-text-multi-style` : `IRTextRun[]`/bold/italic/
    couleur/lien sont des champs directs du contrat) — mais SANS moteur de
    rendu de police ici, impossible de produire une image de référence
    fidèle à comparer par SSIM ; non construite pour cette raison précise
    (pas une histoire d'extraction Figma comme pour les suivantes).
  - `05-text-edge` (substitution de police, letter-spacing, textCase) et
    `11-autolayout` (aplatissement de positions) testent des décisions
    prises **côté plugin** (`packages/plugin/src/serialize`) qui sont déjà
    résolues avant que l'`IRDocument` existe : une police substituée
    arrive déjà sous son nom final dans `IRTextRun.fontFamily`, un
    letter-spacing trop faible pour être visible est déjà silencieusement
    ignoré (rien dans le contrat pour le représenter), un auto-layout est
    déjà aplati en positions fixes. Construire ces fixtures "en code"
    referait donc juste `01`/`02`/`04` sous un autre nom — ces
    fixtures-là ont vraiment besoin d'un fichier Figma réel pour tester ce
    qu'elles sont censées tester (déjà couvert par ailleurs par les tests
    unitaires du plugin, mocks de nœuds Figma).
  - `07-gradients`, `08-effects`, `09-vectors`, `10-images` rasterisent
    toujours au moins un élément (fallback image) — nécessitent un vrai
    fichier Figma ET l'hébergement d'asset (voir plus bas).
  - `12-realistic` et `13-batch` sont des scènes composites de bout en
    bout — utiles surtout une fois qu'un vrai fichier Figma existe pour
    les produire fidèlement.
  Voir "Comment ajouter une fixture" ci-dessous pour les 4 restantes qui
  ont vraiment besoin d'un fichier Figma sans image (`04`, `05`, `11`, et
  toute fixture composite) — le harnais les reprend automatiquement sans
  toucher au code une fois déposées dans `fixtures/`.

### Comment ajouter une fixture (spec §9)

`npm run calibrate` scanne le dossier `fixtures/` (racine du repo) à
chaque run : toute paire `<nom>.json` (un `IRDocument`) + `<nom>.png`
(export Figma du même frame) y est reprise automatiquement, comparée à
l'API Slides réelle (SSIM + écart de position), et ajoutée au rapport —
pas besoin de retoucher `calibrate.ts`.

Le harnais gère deux formes : `runFileFixture` pour une fixture à 1 slide
(le cas normal — une frame Figma = un `IRDocument` à 1 slide) et
`runBatchFixture` (audit 2026-08) pour `13-batch`, la seule fixture à
plusieurs slides — le routage se fait automatiquement sur
`doc.slides.length`, aucune fixture n'a besoin d'indiquer explicitement son
mode. `runBatchFixture` crée toutes les slides dans UNE seule présentation
(comme un vrai deck), puis compare CHACUNE à sa propre référence
`fixtures/13-batch-<i>.png` (i = index dans `doc.slides` une fois trié par
`.order`) — ça vérifie en plus ce qu'une fixture à 1 slide ne peut pas
voir : que Slides crée bien autant de slides que prévu, dans le bon ordre
(un décompte différent fait échouer la fixture explicitement plutôt que de
comparer silencieusement la mauvaise slide à la mauvaise référence).

Les éléments `image` SONT supportés dans les deux chargeurs (audit
2026-08) : chaque asset référencé (toutes slides confondues, pour
`13-batch`) est uploadé via le VRAI
store d'assets de production (`getAssetStore()`, spec §5.3 —
`ASSET_STORAGE_DRIVER=vercel-blob` + `BLOB_READ_WRITE_TOKEN` requis dans
l'environnement, sinon message d'erreur explicite plutôt qu'un plantage
silencieux) pour obtenir une URL que l'API Slides peut réellement fetcher,
puis supprimé une fois la fixture terminée (best-effort). Le fichier
attendu est `fixtures/<nom>-assets/<assetKey-sanitisé>.png` — téléchargé
automatiquement par **Settings → Developer → "Download IR JSON"** en même
temps que le JSON (un fichier PNG par élément `image` de la frame), aucune
manip manuelle supplémentaire.

**Étapes pour construire une fixture, ex. `04-text-multi-style` :**

1. Dans Figma, crée une frame `720×405` (ou n'importe quel ratio — le
   mapper recentre) contenant EXACTEMENT ce que la colonne "Contenu"
   décrit ci-dessous pour la fixture visée.
2. Sélectionne cette frame dans le plugin (mode deck, "Select frames to
   add"), PUIS ouvre **Settings → Developer → "Download IR JSON"** :
   télécharge le `IRDocument` exact tel qu'il serait envoyé à l'export —
   aucun appel réseau, juste un fichier local (audit 2026-08, nouveau).
3. Renomme ce fichier téléchargé en `<nom-de-la-fixture>.json` et dépose-le
   dans `fixtures/` à la racine du repo (ex. `fixtures/04-text-multi-style.json`).
   **Si la frame contient une image** (fill IMAGE, dégradé/effet/vecteur
   rasterisé…), le téléchargement produit AUSSI un ou plusieurs `.png` —
   dépose-les dans un dossier `fixtures/<nom-de-la-fixture>-assets/` (à
   créer), sans les renommer (le nom généré correspond déjà à l'`assetKey`
   attendu par le harnais).
4. Exporte la MÊME frame en PNG depuis Figma (clic droit sur la frame →
   Export, ou panneau Export en bas à droite, échelle 2x) — c'est l'image
   de référence, indépendante du plugin. Renomme-la pareil
   (`fixtures/04-text-multi-style.png`).
5. Si la fixture contient une image, configure une fois pour toutes
   `ASSET_STORAGE_DRIVER=vercel-blob` et `BLOB_READ_WRITE_TOKEN=<ton
   token>` (Vercel → ton projet → Storage → Blob) dans ton environnement
   avant de lancer `npm run calibrate` — sans ça, l'erreur retournée
   l'indique explicitement plutôt que de planter ailleurs.
6. Relance `npm run calibrate` : la fixture apparaît automatiquement dans
   `calibration-report.html`, avec son propre score SSIM.

**Contenu attendu par fixture** (spec §9 — colonne "Ce que ça teste" pour
le détail de l'intention) :

| Fixture | Contenu à dessiner dans Figma |
|---|---|
| `04-text-multi-style` | Un seul bloc de texte, un paragraphe, avec au moins un mot en gras, un en italique, un dans une couleur différente, un lien hypertexte, et une liste à puces sur 2-3 lignes. |
| `05-text-edge` | Un bloc avec une police NON disponible dans Google Fonts/Slides (ex. une police système Windows comme "Segoe UI" ou une police de marque), un letter-spacing prononcé (> 5%), du texte en MAJUSCULES via le réglage "Case" de Figma, et un interligne serré (< 100%). |
| `07-gradients` | Une forme avec un dégradé linéaire (2 stops), une autre avec un dégradé radial ou angulaire — toutes deux converties en image à l'export (voir LIMITATIONS.md § tableau principal). |
| `08-effects` | Une forme avec une ombre portée visible, une autre avec un flou de calque — converties en image. |
| `09-vectors` | Une icône vectorielle custom (dessinée à la plume, PAS un rectangle/ellipse simple) ou une opération booléenne (union/soustraction de 2 formes) — convertie en image. |
| `10-images` | Une photo importée (fill IMAGE) sans transformation particulière. |
| `11-autolayout` | Un auto-layout (frame avec "Auto layout" activé dans Figma) imbriqué sur 2 niveaux, avec padding et gap réglés, contenant 3-4 éléments texte/forme. |
| `12-realistic` | Une slide marketing crédible et complète (titre, corps de texte, image, forme de mise en avant) — critère de référence du spec §1.2. |
| `13-batch` | 10 frames variées (un mélange des catégories ci-dessus — texte, formes, dégradés, images…), réunies dans le MÊME export en un seul deck, pour tester le passage à l'échelle plutôt qu'une nouvelle catégorie de bug. |

**`13-batch` construite différemment des autres** (audit 2026-08,
`runBatchFixture` dans `calibrate.ts`), vu que c'est la seule fixture à
plusieurs slides :

1. Dans Figma, crée les 10 frames, ajoute-les TOUTES au plugin (mode deck,
   "Select frames to add") et mets-les dans l'ordre voulu (l'ordre de la
   liste de réorganisation du plugin = l'ordre `i` des références ci-dessous
   — pas l'ordre du canvas Figma).
2. **Download IR JSON** avec les 10 sélectionnées : produit UN SEUL
   `13-batch.json` à 10 slides (plus les `.png` d'assets rasterisés
   éventuels, comme d'habitude) — renomme-le, dépose-le dans `fixtures/`.
3. Exporte CHAQUE frame séparément en PNG depuis Figma, et nomme-les
   `fixtures/13-batch-0.png`, `13-batch-1.png`, ... `13-batch-9.png` — le
   suffixe `-i` DOIT correspondre à la position de la frame dans l'ordre du
   plugin (étape 1), pas à son ordre d'export Figma.
4. Même étape Blob que les autres si une des 10 frames contient une image.
5. `npm run calibrate` détecte automatiquement le JSON à 10 slides et
   produit 10 entrées dans le rapport (`13-batch-00` à `13-batch-09`), une
   par slide, plutôt qu'une seule ligne globale.
- Le stockage d'assets utilisé en production est **Vercel Blob**
  (`ASSET_STORAGE_DRIVER=vercel-blob`, `src/storage/vercelBlobAssetStore.ts`
  — voir README §8.2), pas juste un stockage disque local : ça couvre déjà
  le besoin d'un stockage multi-instance/public tant que le déploiement
  reste sur Vercel. Seule l'alternative S3/R2 (spec §5.3) reste un stub
  qui lève une erreur si sélectionné (`ASSET_STORAGE_DRIVER=s3`) — à
  implémenter seulement si un déploiement hors Vercel devient nécessaire.
- Conséquence du point précédent **en dev local** (driver
  `local-disk`) : Slides récupère
  chaque image/asset exporté lui-même depuis les serveurs Google, donc
  une URL `PUBLIC_BACKEND_URL=http://localhost:...` n'est jamais
  joignable pour lui. Tant qu'une slide n'a aucun élément rasterisé
  (texte/formes natives uniquement), ça ne se voit pas — dès qu'une
  image ou un élément rasterisé (dégradé, ombre, LINE…) apparaît,
  l'export échoue avec « Localhost image URLs are invalid ». Pour tester
  ce cas en local, exposer le backend via un tunnel public (ex. `ngrok
  http 8787`) et pointer `PUBLIC_BACKEND_URL` dessus.
- ~~La reprise ciblée après échec partiel (spec §7.0.6, §8 Phase 3) est
  amorcée (état par lot en mémoire) mais l'endpoint `/export/:jobId/retry`
  ne rejoue pas encore automatiquement les lots échoués — il ne fait que
  les lister.~~ — fait : `POST /export/:jobId/retry` rejoue réellement les
  lots encore `failed` sur la présentation déjà créée (`retryExportJob`,
  `jobs/runner.ts`), sans recréer de présentation ni retoucher les slides
  déjà réussies. Le job persiste désormais l'`IRDocument` original
  (`JobRecord.doc`) pour pouvoir reconstruire ces lots, et les assets
  d'une slide en échec ne sont plus supprimés tant qu'elle n'a pas
  réussi — mais restent soumis au TTL d'1h de l'URL signée
  (`VercelBlobAssetStore`) : passé ce délai, une image référencée par une
  slide encore en échec redevient introuvable et la reprise échoue sur
  cette slide avec un message Slides API explicite plutôt que de planter.
  Non testé contre l'API Slides réelle (comme le reste du backend, voir
  § état du projet plus bas).
- §7.1 (underlay de contrôle) est **volontairement non implémenté** : la
  spec le marque optionnel, à faire après validation des phases 0 à 3.
  §7.2 (réordonnancement des vignettes par drag & drop), en revanche, **est
  fait** : `ui/reorderFrames.ts` (`moveToIndex`) est câblé dans
  `DeckPanel.tsx` et `TemplatePanel.tsx`, dans les deux modes (voir
  `TODO.md`, point 8 du backlog "Mode template").
