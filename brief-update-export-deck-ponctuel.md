# Brief — Update de l'export de deck ponctuel (Figma → Google Slides)

## Contexte
Le plugin exporte déjà des decks Figma vers Google Slides (version gratuite en prod). Les concurrents (Pitchdeck et autres) passent tous par un fichier PPTX intermédiaire avant import dans Slides, ce qui génère des pertes connues : polices de repli, dégradés aplatis en couleur unie, effets/ombres perdus, blend modes cassés, éléments interactifs réduits en images statiques.

## Objectif
Remplacer le pipeline d'export actuel par un **export direct vers l'API Google Slides**, sans passer par un fichier PPTX intermédiaire, pour éliminer la couche de conversion qui cause la majorité des décalages actuellement observés.

## Nouveau flux proposé
1. L'utilisateur designe son deck normalement dans Figma.
2. Il clique sur le bouton **"Prepare for Slides"** : le plugin génère une **copie de vérification** sur le canvas Figma (pas dans un mini-éditeur du plugin) — les frames sont dupliquées et reformatées automatiquement selon les valeurs et contraintes réellement supportées par le schéma de l'API Slides (types de formes, styles de texte, remplissages, etc.).
3. Chaque frame copiée est taguée automatiquement via `setPluginData` (donnée stockée dans le fichier Figma lui-même, donc persiste à la fermeture du plugin et du fichier) — ex. `slidesExportReady: true` — et visuellement préfixée dans son nom (ex. `[Slides Ready] Slide 1`) pour que l'utilisateur repère la bonne frame même sans le plugin ouvert.
4. L'utilisateur ferme le plugin s'il le souhaite et retravaille librement cette copie directement dans le canvas Figma — c'est là que se fait la friction, dans un environnement où il a de meilleurs outils qu'une fois le deck déjà cassé dans Slides.
5. À la réouverture du plugin (ou juste avant l'export), le plugin retrouve automatiquement les frames taguées via `figma.currentPage.findAll()` — aucune re-sélection manuelle requise, indépendant de la sélection courante de l'utilisateur.
6. L'utilisateur clique sur **"Export to Slides"** : première fois, ce bouton sert à se connecter à Google ; une fois connecté, un reclic exporte directement les frames taguées vers Slides et renvoie le lien.

## Approche retenue : libre + information (pas de verrouillage)
- Pas de restriction dure sur ce que l'utilisateur peut modifier dans la copie de vérification — pas de mini-éditeur avec champs limités (ex. dropdown de typo restreinte) dans le plugin ; l'édition se fait nativement sur le canvas Figma, qui offre déjà tous les outils nécessaires.
- Un **linter visuel** signale les calques utilisant une propriété non supportée par le schéma de l'API Slides (ex. dégradé multi-stops non pris en charge, effet, blend mode), sous forme de hints à la fois dans le panneau du plugin et en annotations directement sur le canvas, avec un message clair expliquant pourquoi et quoi corriger.
- Note : la typographie n'est probablement pas un point de friction prioritaire à contraindre, Google Slides supportant nativement un très large catalogue de Google Fonts — l'effort de linting doit se concentrer sur ce qui casse réellement à l'export (dégradés, effets, blend modes).
- Justification : la personne qui exporte son propre deck est en général celle qui l'a designé — elle sait ce qu'elle fait, la friction "obligatoire" doit rester légère et se faire côté Figma plutôt que côté Slides après coup.
- Les cas mal gérés par l'utilisateur restent sous sa responsabilité (comme suggéré par Luc) — a minima, l'utilisateur est informé du problème avant export, jamais surpris après.

## Points techniques à valider
- Cartographie précise des propriétés du schéma Slides API (formes, styles de texte, remplissages) vs propriétés Figma, pour générer la copie de vérification et le linter.
- Vérifier ce qui est réellement supporté nativement par Slides (ex. les dégradés custom existent bien dans l'éditeur Slides — la perte actuelle vient du passage par PPTX, pas d'une limite native) pour maximiser ce qui peut être préservé via un export API direct.
- Gérer l'authentification/API Google Slides pour l'export direct (remplace la génération de fichier PPTX).
- Utiliser `setPluginData` sur les nodes (et non localStorage/sessionStorage, qui ne survivent pas de façon fiable à la fermeture de l'iframe du plugin) pour marquer les frames prêtes à l'export, afin que le plugin les retrouve automatiquement après une fermeture/réouverture, sans dépendre de la sélection courante de l'utilisateur.
- Interface du plugin en anglais : wording des deux boutons à valider — **"Prepare for Slides"** (génère/retravaille la copie) et **"Export to Slides"** (connexion Google puis export avec lien).

## Hors périmètre de ce brief
La création de templates réutilisables (masters, layouts) fait l'objet d'un brief séparé, avec une approche différente (contraintes plus strictes).
