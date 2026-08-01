# TODO

## Feedback utilisateur — à designer AVANT d'intégrer (audit 2026-08)

L'ancien footer de statut a été retiré ; tous les états existent encore
dans le code (`ui.tsx` : `exportError`, `exportProgress`, `selectionNotice`,
`too-many-frames`…) mais ne sont plus affichés en mode deck. À designer
proprement plutôt que réintégrer tel quel :

- **Affichage des erreurs** (export échoué, backend injoignable, session
  expirée). Le backend renvoie désormais des messages détaillés par slide
  (`Slide "Nom": Slides API 400 — …`) — l'UI doit juste leur trouver une
  place.
- ~~**Progression pendant l'export**~~ — fait en mode deck : l'aperçu
  affiche la frame dont le lot est en cours d'application, "générée" bande
  par bande façon Windows 95, avec "Generating slide N of M" et une barre
  de progression (`ui/RetroExportPreview.tsx`, `ui/exportCursor.ts`).
  Reste à faire pour le mode template, qui n'a pas d'équivalent.
- **Notices de sélection en mode deck** (`selectionNotice` :
  "no-frames-selected", "too-many-frames") — état aujourd'hui muet.
- **Rapport de fidélité du deck** (badge "N natifs · M rasterisés" +
  warnings cliquables — les données arrivent déjà dans `candidate-added`
  et sont ignorées par l'UI). Utilité à confirmer : peut-être ne jamais
  l'afficher, les pastilles rouges de "Prepare for Slides" couvrent déjà
  le besoin sur le canvas.
- **Lien "Open presentation"** : ne doit PAS s'ajouter au header (position
  actuelle = provisoire) ; concevoir une autre apparition du lien de
  résultat (toast, zone dédiée…). Problème global aux deux modes.
- **Retour d'erreur sur une vignette de layout bloquante** (mode
  template) : rouge plein `--color-error` pour l'instant — concevoir un
  retour plus riche qu'une simple bordure.
- **Emplacement des dimensions** : unités `px` ajoutées, mais le bloc n'a
  plus sa place dans le header — à déplacer (où ?).
- **Indicateur de chargement du bouton "Sign in with Google".** Tant que
  le lien Google n'est pas prêt (juste après montage, ou après une
  erreur), le bouton est simplement désactivé sans feedback visuel.
- **Avertissements non bloquants dans le rapport template** (substitution
  de police, rayon approximé, tag inconnu…) : réfléchir à leur
  intégration dans l'UI du rapport — jugés plus importants côté template
  que côté deck.

## Divers

- **"Buy me a coffee".** Ajouter un rappel discret (pied de page ou petit
  encart en bas de l'UI) pointant vers un lien Buy Me a Coffee.
- **Validation de composition des templates** (approche à définir — voir
  discussion d'audit) : layout sans aucun placeholder, rôles dupliqués
  (`[[title]]` ×2), tag incohérent avec le type de calque (`[[image]]`
  sur un texte)… Commencer par des warnings informatifs non bloquants,
  durcir ensuite si l'usage le confirme.
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
