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
| Plusieurs remplissages sur une forme, modes de fusion (multiply, screen…) | **Non supportés.** Convertis en image. |
| Contour différent par côté, contour "à l'intérieur" du tracé | Approximé par un contour centré uniforme, ou converti en image si l'écart visuel est trop important. |
| Icônes, tracés vectoriels personnalisés, formes booléennes (union/soustraction…) | **Toujours convertis en image** — Slides n'a pas d'équivalent éditable. |
| Lignes (outil Ligne de Figma) | **Convertis en image pour l'instant.** Slides a un type d'objet dédié pour les lignes éditables, pas encore câblé côté export — voir "État du projet" ci-dessous. |
| Polices non disponibles dans Google Fonts ni dans la liste système de Slides | Remplacées par une police proche quand une correspondance existe (ex. *SF Pro Display* → *Inter*), sinon le texte est converti en image et un avertissement bloquant te demande de confirmer ou de changer la police. |
| Auto-layout (agencement automatique) | Converti en positions fixes au moment de l'export — un redimensionnement ultérieur dans Slides ne réajustera pas automatiquement les éléments comme le ferait Figma. |
| Groupes / composants Figma | Aplatis : chaque élément devient indépendant dans Slides, il n'y a pas de "groupe" Slides qu'on peut déplacer d'un bloc. |

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
  génération du rapport sont testés (comparaison d'images synthétiques),
  mais **le pipeline complet nécessite un compte Google authentifié** pour
  créer une vraie présentation et mesurer le rendu réel de l'API Slides.
  Sans ça, le script s'arrête proprement avec des instructions plutôt que
  de produire un faux rapport.

### Ce qui reste explicitement non calibré / non fait

- `calibration.json` contient des **valeurs par défaut prudentes, non
  mesurées** (`textInset`, `roundRectRadiusRatio`, `lineSpacingBaseline`).
  Il faut lancer `npm run calibrate` avec un vrai compte Google pour les
  fixer (spec §4).
- Le jeu de fixtures complet (spec §9, `01-rects` à `13-batch`) n'existe
  que pour `01-rects` (généré en code, sans fichier Figma réel). Les
  fixtures `02` à `13` nécessitent un fichier Figma dédié à créer.
- Le stockage d'assets S3/R2 (spec §5.3, option recommandée) n'est pas
  implémenté : seul un stockage disque local de développement existe
  derrière l'interface `AssetStore`. À implémenter avant tout déploiement
  multi-instance ou public.
- La reprise ciblée après échec partiel (spec §7.0.6, §8 Phase 3) est
  amorcée (état par lot en mémoire) mais l'endpoint `/export/:jobId/retry`
  ne rejoue pas encore automatiquement les lots échoués — il ne fait que
  les lister.
- Les nœuds Figma de type `LINE` sont rasterisés (spec §3.3 les prévoyait
  natifs, au même titre que RECTANGLE/ELLIPSE). Le mapper ne construit que
  des `CreateShapeRequest` ; Slides représente les lignes via un type de
  requête différent (`CreateLineRequest`, avec `lineCategory`) qui n'a pas
  encore été implémenté. À faire si le taux de rasterisation des lignes
  devient gênant en usage réel.
- §7.1 (underlay de contrôle) et §7.2 (drag & drop) sont **volontairement
  non implémentés** : la spec les marque optionnels, à faire après
  validation des phases 0 à 3.
