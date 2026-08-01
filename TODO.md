# TODO

## Feedback utilisateur — audit 2026-08

Plusieurs points ci-dessous ont depuis été implémentés (le rapport de
fidélité du deck, l'affichage des erreurs, la position des dimensions et
du lien "Open presentation", l'animation rétro de progression du deck) —
gardés ici seulement comme trace de décision, ou reformulés en tâche
restante précise.

- ~~**Affichage des erreurs**~~ — fait (footer, par mode) : le backend
  renvoie des messages détaillés par slide (`Slide "Nom": Slides API 400
  — …`) et l'UI les affiche désormais (`ui.tsx`, corrigé dans `d271152`).
- ~~**Progression pendant l'export**~~ — fait en mode deck : l'aperçu
  affiche la frame dont le lot est en cours d'application, "générée" bande
  par bande façon Windows 95, avec "Generating slide N of M" et une barre
  de progression (`ui/RetroExportPreview.tsx`, `ui/exportCursor.ts`).
  **Reste à faire pour le mode template** : `TemplatePanel` ne reçoit pas
  d'`exportCursor` (contrairement à `DeckPanel`), l'écran ne bouge pas
  pendant toute la création du template.
- ~~**Rapport de fidélité du deck**~~ — fait : badge "N natifs · M
  rasterisés" + liste de warnings cliquable qui sélectionne l'élément dans
  Figma (`DeckPanel.tsx`).
- ~~**Lien "Open presentation"**~~ — fait : sorti du header, position
  définitive en footer à côté de Ko-fi.
- ~~**Emplacement des dimensions**~~ — fait : déplacé sous l'aperçu
  (`Dimensions : W × H px`), plus dans le header.
- **Notice de sélection en mode deck** (`selectionNotice` :
  "no-frames-selected" quand on clique "Add selection" sans rien avoir
  sélectionné, "too-many-frames" au-delà de 20 frames ajoutées) — **bug**,
  pas un manque de design : le getter du state est jeté à la
  destructuration (`const [, setSelectionNotice] = useState(...)` dans
  `ui.tsx`), donc rien ne s'affiche jamais côté deck. Le mode template a
  le même besoin et lui l'affiche bien (`templateSelectionNotice` →
  `TemplatePanel`) — porter la même correction côté deck.
- **Retour d'erreur sur une vignette de layout bloquante** (mode
  template) : rouge plein `--color-error` pour l'instant — concevoir un
  retour plus riche qu'une simple bordure.
- **Indicateur de chargement du bouton "Sign in with Google".** Deux
  moments d'attente distincts, aucun des deux visible aujourd'hui :
  (a) juste après montage, pendant l'appel au backend qui récupère l'URL
  Google (bouton grisé, pas de texte) ; (b) après clic sur le lien, tout
  le temps du polling (`pollAuthSession`, jusqu'à 10 min) en attendant que
  l'utilisateur finisse l'auth dans son navigateur — le bouton reste
  affiché "Sign in with Google" sans dire qu'il attend une réponse. Le
  (b) est le plus gênant en pratique.
- **Avertissements non bloquants dans le rapport template** (police
  substituée automatiquement, rayon d'angle approximé…) : n'empêchent pas
  la création du template (l'élément reste éditable), mais ne s'affichent
  nulle part dans le rapport — seuls les warnings *bloquants* y figurent.
  Utile pour que le créateur sache qu'une police n'est pas garantie
  identique dans Slides avant de diffuser son template.

## Divers

- **"Buy me a coffee".** Le bouton "Support me with Ko-fi" est déjà posé
  dans le footer (`href="#"`) — en attente du vrai lien avant de le
  finaliser, pas une tâche de conception restante.
## Mode template — refonte interface & flow (audit 2026-08, benchmark workflow expert Slides / limites API)

Confrontation de deux docs de référence (workflow d'un expert Slides côté
métier, limites techniques de l'API Slides côté technique) avec le code
existant. Conclusions qui ne bougent pas (déjà correctement documentées
dans `LIMITATIONS.md`, confirmées indépendamment par les deux docs) :
**aucune vraie "couleur de thème" Slides modifiable en écriture** (chaque
forme reçoit un `RGBColor` statique, pas de rôle de couleur global), et
**aucun vrai Master/Layout créable en écriture** (`presentations.create`
fige un thème + ~8 layouts prédéfinis, `CreateSlideRequest` ne peut que
RÉFÉRENCER un layout existant). Le mode template reste donc, structurellement,
une présentation normale à dupliquer — pas d'alternative native à chercher.

Ce qu'on contrôle en revanche, et qu'on exploite mal aujourd'hui : la
cohérence côté Figma avant export, et la lisibilité de ce qui est livré.
Axes de refonte, du plus structurant au plus cosmétique :

- **Onglet "Style" au niveau du template entier**, en plus du rapport par
  layout actuel (`templateSummary.ts` n'agrège aujourd'hui que couleurs/
  polices d'UN layout à la fois). Agrégerait couleurs + polices de TOUS
  les layouts, avec édition possible : assigner un rôle sémantique à
  chaque couleur détectée (Primary/Secondary/Accent/Text/Background),
  polices présentées par rôle (Heading/Body) plutôt qu'en liste plate.
  Rôles pré-suggérés à partir du **nom du style de couleur Figma**
  (`fillStyleId`/variable liée) quand il existe, plutôt que d'un hex brut
  sans contexte — non lu du tout aujourd'hui (`serializeFrame.ts` ne
  capture que la couleur résolue, jamais le style/la variable dont elle
  vient).
  - Optionnel, en plus : bouton "Harmoniser" qui réécrit les calques Figma
    utilisant une couleur quasi-identique (ex. `#3366FE` vs `#3467FF`) vers
    le hex canonique choisi pour le rôle — une vraie édition Figma, pas
    juste un rapport en lecture seule.
- **Slide de style guide optionnelle** (checkbox à l'export), générée en
  première position du template : swatches + rôles + échantillon typo par
  police. Une vraie slide Slides (texte/formes natifs, donc 100 %
  faisable), qui documente le "thème" puisque Slides n'a pas d'onglet
  thème éditable dans notre cas.
- **Étiquette "Cover/Master" purement visuelle** sur une vignette du rail
  de layouts — aucune portée technique côté Slides, juste pour que le
  rail se lise comme un vrai jeu de layouts (Cover → Section → Content)
  sans prétendre à un héritage réel qui n'existe pas.
- **Texte de placeholder visuellement explicite** : un calque tagué
  `[[title]]` envoie aujourd'hui à Slides le texte BRUT du calque Figma
  (`placeholder: parsePlaceholderTag(node.name)` ne touche que les
  métadonnées, jamais le contenu texte réel extrait à côté). Remplacer ce
  texte par un indicateur lisible type `[Title]` rendrait évident, pour
  quiconque duplique la slide à la main (même sans outil compagnon), qu'il
  faut le remplacer — et prépare le terrain pour un futur `replaceAllText`
  automatisé (technique du doc API qu'on n'utilise pas du tout aujourd'hui :
  on ne pose que l'alt text `f2s-placeholder:<RÔLE>`, jamais de token
  `{{title}}` dans le texte lui-même).
- **Validation de composition des templates** (approche à définir).
  Exemples concrets à couvrir : deux calques tagués `[[title]]` dans le
  même layout (ambigu : lequel est LE titre ?) ; layout sans aucun
  placeholder (volontaire — slide de séparation — ou oubli ?) ; tag
  incohérent avec le type de calque, ex. `[[image]]` posé sur un calque
  TEXTE (reste du texte côté Slides mais étiqueté "image", trompeur pour
  l'utilisateur final). Commencer par des warnings informatifs non
  bloquants, durcir ensuite si l'usage le confirme.
- **Réordonnancement par glisser-déposer des layouts de template** — même
  besoin que le deck (juste réarranger l'ordre des slides), qui a déjà
  toute la mécanique (`DeckPanel.tsx` + `ui/reorderFrames.ts`) ; à porter
  telle quelle sur `TemplatePanel.tsx`, qui n'a aujourd'hui aucune logique
  de drag.
- **Remplacer la convention de nom de calque `[[role]]`** par un contrôle
  actif dans l'éditeur Figma (property/plugin data assignée depuis un
  panneau du plugin), pour guider la création sans devoir renommer les
  calques à la main.
- **Outil compagnon "dupliquer un layout + remplir ses placeholders"** —
  idée de backlog pour l'utilisateur FINAL d'un template (pas son
  créateur) : repérer automatiquement titre/image/corps de texte grâce au
  tag `f2s-placeholder:<RÔLE>` déjà posé en alt text côté Slides (et, si
  le point ci-dessus sur `replaceAllText` est fait, remplir directement
  via un `batchUpdate` plutôt qu'à la main), pour l'aider à remplir une
  nouvelle slide dupliquée depuis un layout.

## Checklist de test manuel — trouver les limites réelles du plugin

Pas encore vérifié contre un vrai fichier Figma ni un vrai export Slides
(voir LIMITATIONS.md § état du projet — pas d'environnement Figma/Google
dans cet environnement de dev). À dérouler dans un fichier Figma réel,
avec "Prepare for Slides" ET un export brut (sans préparation) pour
comparer les deux, puis vérification du rendu final dans Slides.

- **Couleurs**
  - [ ] Remplissage solide simple, avec opacité < 100 %.
  - [ ] Styles de couleur Figma (fill styles) partagés entre plusieurs calques.
  - [ ] Couleur de contour (stroke) distincte de la couleur de fill.
- **Dégradés**
  - [ ] Linéaire 2 stops → vérifier que "Prepare for Slides" les aplatit
        en solide (couleur du 1er stop) plutôt que de rasteriser.
  - [ ] Linéaire/radial/angulaire à 3+ stops (aplatissement forcément
        avec perte des stops intermédiaires — vérifier que c'est
        acceptable visuellement).
  - [ ] Dégradé appliqué à un contour (stroke), pas juste un fill.
  - [ ] Dégradé sur une LINE (outil Ligne).
- **Images**
  - [ ] Image simple (fill IMAGE) sans transformation.
  - [ ] Image recadrée (crop) / mode "Fill" vs "Fit" vs "Tile".
  - [ ] Image avec coins arrondis ou masque de forme.
  - [ ] Image semi-transparente (opacité réduite).
  - [ ] Très grande image source (poids/temps d'export, cf. limite 413
        déjà traitée côté upload par lots).
- **Formes simples (natif attendu)**
  - [ ] Rectangle sans rayon, avec rayon dans la plage supportée (8–25 %
        du plus petit côté), et pilule (rayon ≥ moitié du plus petit côté).
  - [ ] Rectangle à rayon non uniforme entre les 4 coins → vérifier
        l'uniformisation automatique par "Prepare for Slides".
  - [ ] Rectangle à rayon très faible (< 8 %) ou très fort mais non pilule
        (> 25 %) → vérifier le clamp à 0 ou à la borne haute.
  - [ ] Ellipse, avec/sans contour.
  - [ ] Contour multiple, contour "à l'intérieur"/"à l'extérieur" (non
        centré), épaisseur mixte par côté → vérifier l'unification en un
        seul contour centré.
- **Formes complexes (raster attendu, à confirmer visuellement fidèle)**
  - [ ] Icône vectorielle custom (VECTOR).
  - [ ] Opération booléenne (union/soustraction/intersection).
  - [ ] Étoile et polygone à un nombre de côtés inhabituel (5, 7, 12…).
  - [ ] Groupe avec `clipsContent` et enfants qui débordent.
  - [ ] Calque masqué par un calque au-dessus (masque de calque Figma).
- **Lignes (outil Ligne)**
  - [ ] Ligne simple, pointillée, avec épaisseur variée.
  - [ ] Terminaison décorative (flèche, losange, cercle) → vérifier la
        normalisation à "aucune terminaison" par "Prepare for Slides".
- **Effets**
  - [ ] Ombre portée, ombre interne, flou de calque, flou d'arrière-plan
        → vérifier qu'ils sont bien retirés par "Prepare for Slides" (et
        rasterisés si on exporte sans préparation).
- **Modes de fusion**
  - [ ] Multiply, Screen, Darken, etc. sur un calque avec fond visible
        derrière (vérifier le rendu rasterisé à l'export brut).
- **Texte**
  - [ ] Police déjà disponible dans Slides (Roboto, Arial…) — pas de
        substitution attendue.
  - [ ] Police absente de la liste (ex. police custom de marque) —
        vérifier la substitution auto ET le remplacement par le choix
        fait dans le select "Fonts" de l'UI.
  - [ ] Styles mixtes dans un même bloc (gras + normal + italique sur des
        mots différents).
  - [ ] Espacement des lettres (tracking) prononcé → vérifier qu'il est
        bien remis à 0 par "Prepare for Slides".
  - [ ] Interligne : "Auto", valeur en % et valeur en px, chacun testé.
  - [ ] "Vertical trim" activé sur un texte → vérifier la désactivation.
  - [ ] Alignement vertical Top/Center/Bottom et horizontal
        Left/Center/Right/Justify.
  - [ ] Texte tout en majuscules / petites capitales / casse de titre
        (text case Figma).
  - [ ] Zone de texte en largeur/hauteur fixe vs "hug" (auto-resize) vs
        troncature.
  - [ ] Retour à la ligne manuel (Maj+Entrée) au milieu d'un paragraphe.
  - [ ] Lien hypertexte sur une partie du texte.
  - [ ] Liste à puces / numérotée, indentation.
- **Structure**
  - [ ] Auto-layout (imbriqué sur plusieurs niveaux) → vérifier
        l'aplatissement en positions fixes par "Prepare for Slides".
  - [ ] Frame/groupe/composant imbriqués sur 3+ niveaux de profondeur.
  - [ ] Élément tourné (texte, forme, ligne) à un angle quelconque.
  - [ ] Deck de 20+ frames (seuil `MAX_FRAMES_WARNING`) — vérifier le
        message d'avertissement et le temps de traitement.
- **Flow "Prepare for Slides" spécifiquement**
  - [ ] Re-cliquer "Prepare for Slides" sur une copie déjà taguée
        (retravaillée entre-temps) — doit relinter en place, pas
        dupliquer une nouvelle copie.
  - [ ] Fermer et rouvrir le plugin avec des frames déjà taguées sur le
        canvas — doivent réapparaître automatiquement dans le panneau
        sans re-sélection.
  - [ ] Vérifier que les repères rouges de lint ne se dupliquent pas au
        fil des re-préparations, et disparaissent bien si le problème est
        corrigé.
- **Mode template**
  - [ ] Élément tagué `[[title]]`, `[[body]]`, `[[image]]`, `[[logo]]`,
        `[[custom:...]]` → vérifier le rapport de placeholders et l'alt
        text posé côté Slides après création.
  - [ ] Layout avec un élément qui serait rasterisé → vérifier que la
        création de template est bien bloquée tant qu'il n'est pas corrigé.
- **Après export réel dans Slides**
  - [ ] Comparer visuellement le rendu Slides à la copie "Prepare for
        Slides" sur le canvas Figma (c'est censé être la même chose).
  - [ ] Vérifier qu'aucun élément natif n'est resté éditable de façon
        cassée (texte débordant, forme mal positionnée, couleur éteinte).
