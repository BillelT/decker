# Brief — Update de l'export de deck ponctuel (Figma → Google Slides)

## Contexte
Le plugin exporte déjà des decks Figma vers Google Slides (version gratuite en prod). Les concurrents (Pitchdeck et autres) passent tous par un fichier PPTX intermédiaire avant import dans Slides, ce qui génère des pertes connues : polices de repli, dégradés aplatis en couleur unie, effets/ombres perdus, blend modes cassés, éléments interactifs réduits en images statiques.

## Objectif
Remplacer le pipeline d'export actuel par un **export direct vers l'API Google Slides**, sans passer par un fichier PPTX intermédiaire, pour éliminer la couche de conversion qui cause la majorité des décalages actuellement observés.

## Nouveau flux proposé
1. L'utilisateur designe son deck normalement dans Figma.
2. Le plugin génère une **copie de vérification** dans Figma : les frames sont dupliquées et reformatées automatiquement selon les valeurs et contraintes réellement supportées par le schéma de l'API Slides (types de formes, styles de texte, remplissages, etc.).
3. L'utilisateur ajuste manuellement cette copie directement dans Figma — c'est là que se fait la friction, dans un environnement où il a de meilleurs outils qu'une fois le deck déjà cassé dans Slides.
4. Export direct de cette copie vers Google Slides via l'API (pas de PPTX).

## Approche retenue : libre + information (pas de verrouillage)
- Pas de restriction dure sur ce que l'utilisateur peut modifier dans la copie de vérification.
- Un **linter visuel** signale les calques utilisant une propriété non supportée par le schéma de l'API Slides (ex. dégradé multi-stops non pris en charge, effet, blend mode), avec un message clair expliquant pourquoi et quoi corriger.
- Justification : la personne qui exporte son propre deck est en général celle qui l'a designé — elle sait ce qu'elle fait, la friction "obligatoire" doit rester légère et se faire côté Figma plutôt que côté Slides après coup.
- Les cas mal gérés par l'utilisateur restent sous sa responsabilité (comme suggéré par Luc) — a minima, l'utilisateur est informé du problème avant export, jamais surpris après.

## Points techniques à valider
- Cartographie précise des propriétés du schéma Slides API (formes, styles de texte, remplissages) vs propriétés Figma, pour générer la copie de vérification et le linter.
- Vérifier ce qui est réellement supporté nativement par Slides (ex. les dégradés custom existent bien dans l'éditeur Slides — la perte actuelle vient du passage par PPTX, pas d'une limite native) pour maximiser ce qui peut être préservé via un export API direct.
- Gérer l'authentification/API Google Slides pour l'export direct (remplace la génération de fichier PPTX).

## Hors périmètre de ce brief
La création de templates réutilisables (masters, layouts) fait l'objet d'un brief séparé, avec une approche différente (contraintes plus strictes).
