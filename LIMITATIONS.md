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
  génération du rapport sont testés (comparaison d'images synthétiques),
  mais **le pipeline complet nécessite un compte Google authentifié** pour
  créer une vraie présentation et mesurer le rendu réel de l'API Slides.
  Sans ça, le script s'arrête proprement avec des instructions plutôt que
  de produire un faux rapport.

### Ce qui reste explicitement non calibré / non fait

- `calibration.json` contient des **valeurs par défaut prudentes, non
  mesurées** (`textInset`, `roundRectRadiusRatio`, `lineSpacingBaseline`,
  `textWidthSafetyMarginEm`). Il faut lancer `npm run calibrate` avec un
  vrai compte Google pour les fixer (spec §4) — `textWidthSafetyMarginEm`
  n'est de toute façon pas mesuré par ce harnais actuellement (voir
  `calibrate.ts`), sa valeur par défaut reste une marge de sécurité
  raisonnable plutôt qu'une mesure empirique.
- Le jeu de fixtures complet (spec §9, `01-rects` à `13-batch`) n'existe
  que pour `01-rects` (généré en code, sans fichier Figma réel). Les
  fixtures `02` à `13` nécessitent un fichier Figma dédié à créer.
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
