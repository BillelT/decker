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
| Lignes (outil Ligne de Figma) | **Éditables nativement** (couleur, épaisseur, pointillés) via le type de ligne dédié de Slides. Convertie en image seulement si elle a plusieurs contours, un contour en dégradé, une épaisseur non uniforme, ou une terminaison décorative (flèche, losange, cercle) non représentable nativement. |
| Polices non disponibles dans Google Fonts ni dans la liste système de Slides | Remplacées par une police proche quand une correspondance existe (ex. *SF Pro Display* → *Inter*), sinon le texte est converti en image et un avertissement bloquant te demande de confirmer ou de changer la police. |
| Auto-layout (agencement automatique) | Converti en positions fixes au moment de l'export — un redimensionnement ultérieur dans Slides ne réajustera pas automatiquement les éléments comme le ferait Figma. |
| Groupes / composants Figma | Aplatis : chaque élément devient indépendant dans Slides, il n'y a pas de "groupe" Slides qu'on peut déplacer d'un bloc. |

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
  compte Google** (audit 2026-08) : critère de sortie de Phase 0 atteint
  sur la fixture `01-rects` — SSIM = 0.9973 (seuil ≥ 0.99), écart de
  position nul sur les 5 rectangles (0.000pt, seuil ≤ 0.5pt). Deux bugs
  réels ont été trouvés et corrigés à cette occasion, invisibles tant que
  ce script n'avait jamais tourné pour de vrai :
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
  qu'une mesure.
- Le jeu de fixtures complet listé au spec §9 (`01-rects` à `13-batch`)
  n'a que `01-rects` et `03-text-inset` en version code-générée (sans
  fichier Figma réel — voir plus bas pourquoi les autres n'ont pas été
  construites de la même façon) :
  - `02-rotation`, `06-shapes`, `10-images` testeraient surtout la même
    chaîne coordonnées/échelle déjà validée par `01-rects` (juste avec plus
    de variété de formes) — valeur ajoutée réelle mais secondaire.
  - `04-text-multi-style`, `05-text-edge`, `07-gradients`, `08-effects`,
    `09-vectors`, `11-autolayout` testent la logique de décision native/
    raster et l'extraction Figma **côté plugin** (`packages/plugin/src/serialize`),
    pas ce harnais de calibration backend qui part d'un `IRDocument` déjà
    produit — déjà couverts par les tests unitaires du plugin (mocks de
    nœuds Figma), et une fixture "de référence" en pur code pour un
    dégradé/vecteur/effet n'apporterait rien puisqu'on n'a justement pas de
    moteur de rendu Figma ici pour produire une image de référence fidèle.
  - `12-realistic` et `13-batch` sont des scènes composites de bout en
    bout — utiles surtout une fois qu'un vrai fichier Figma existe pour
    les produire fidèlement, pas en équivalent code.
  Un vrai fichier Figma dédié (spec §9) reste donc la voie normale pour
  ces fixtures-là — voir "Comment ajouter une fixture" ci-dessous, le
  harnais les reprend maintenant automatiquement sans toucher au code.

### Comment ajouter une fixture (spec §9)

`npm run calibrate` scanne désormais le dossier `fixtures/` (racine du
repo) à chaque run : toute paire `<nom>.json` (un `IRDocument`) +
`<nom>.png` (export Figma du même frame) y est reprise automatiquement,
comparée à l'API Slides réelle (SSIM + écart de position), et ajoutée au
rapport — pas besoin de retoucher `calibrate.ts`.

**Limite actuelle du chargeur générique** (`runFileFixture` dans
`calibrate.ts`) : une seule slide par fixture, et aucun élément `image` —
l'hébergement d'un asset public depuis ce script autonome (sans backend
HTTP qui tourne) n'est pas câblé. Une fixture qui en contient est ignorée
avec un message explicite plutôt que de planter tout le run ; couvre pour
l'instant `02`, `04`, `05`, `06`, `11` (pas d'image) — `07`, `08`, `09`,
`10`, `12`, `13` (qui rasterisent forcément quelque chose, ou qui
contiennent plusieurs slides pour `13-batch`) attendront que ce
branchement soit fait.

**Étapes pour construire une fixture, ex. `02-rotation` :**

1. Dans Figma, crée une frame `720×405` (ou n'importe quel ratio — le
   mapper recentre) contenant EXACTEMENT ce que la colonne "Contenu"
   décrit ci-dessous pour la fixture visée.
2. Sélectionne cette frame dans le plugin (mode deck, "Select frames to
   add"), PUIS ouvre **Settings → Developer → "Download IR JSON"** :
   télécharge le `IRDocument` exact tel qu'il serait envoyé à l'export —
   aucun appel réseau, juste un fichier local (audit 2026-08, nouveau).
3. Renomme ce fichier téléchargé en `<nom-de-la-fixture>.json` et dépose-le
   dans `fixtures/` à la racine du repo (ex. `fixtures/02-rotation.json`).
4. Exporte la MÊME frame en PNG depuis Figma (clic droit sur la frame →
   Export, ou panneau Export en bas à droite, échelle 2x) — c'est l'image
   de référence, indépendante du plugin. Renomme-la pareil
   (`fixtures/02-rotation.png`).
5. Relance `npm run calibrate` : la fixture apparaît automatiquement dans
   `calibration-report.html`, avec son propre score SSIM.

**Contenu attendu par fixture** (spec §9 — colonne "Ce que ça teste" pour
le détail de l'intention) :

| Fixture | Contenu à dessiner dans Figma |
|---|---|
| `02-rotation` | 4-5 rectangles unis, identiques sauf leur rotation : 0°, 15°, 45°, 90°, -30°. |
| `04-text-multi-style` | Un seul bloc de texte, un paragraphe, avec au moins un mot en gras, un en italique, un dans une couleur différente, un lien hypertexte, et une liste à puces sur 2-3 lignes. |
| `05-text-edge` | Un bloc avec une police NON disponible dans Google Fonts/Slides (ex. une police système Windows comme "Segoe UI" ou une police de marque), un letter-spacing prononcé (> 5%), du texte en MAJUSCULES via le réglage "Case" de Figma, et un interligne serré (< 100%). |
| `06-shapes` | Une ellipse, un pentagone ou hexagone, une étoile, un rectangle à coins arrondis (rayon dans la fourchette 8-25 % du plus petit côté), et une forme avec un contour (stroke) visible. |
| `11-autolayout` | Un auto-layout (frame avec "Auto layout" activé dans Figma) imbriqué sur 2 niveaux, avec padding et gap réglés, contenant 3-4 éléments texte/forme. |

`07-gradients`, `08-effects`, `09-vectors`, `10-images`, `12-realistic`,
`13-batch` suivent le même processus MAIS resteront ignorées par
`runFileFixture` tant que l'hébergement d'asset n'est pas branché (elles
rasterisent au moins un élément) — construis-les si tu veux, elles seront
prêtes à tourner dès que ce point sera traité.
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
- §7.1 (underlay de contrôle) et §7.2 (drag & drop) sont **volontairement
  non implémentés** : la spec les marque optionnels, à faire après
  validation des phases 0 à 3.
