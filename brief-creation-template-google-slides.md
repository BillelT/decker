# Brief — Création de templates Google Slides depuis Figma

## Contexte
Idée proposée par Luc (CIB) : en plus de l'export de deck ponctuel, proposer une fonctionnalité dédiée à la **création de templates Google Slides depuis Figma**. Les templates Slides sont réputés pénibles à construire proprement (masters, layouts, placeholders), autant que les decks créés ponctuellement — et cette galère est connue de tout le monde, y compris chez les acteurs payants du marché (aucun concurrent identifié ne couvre bien ce cas, y compris les offres payantes).

## Objectif
Offrir, en gratuit, une **double solution** : export de deck ponctuel (voir brief séparé) + création de template Slides réutilisable, directement depuis Figma.

## Ce qui différencie cette fonctionnalité de l'export de deck
Un template est destiné à être réutilisé par d'autres personnes, souvent moins à l'aise avec Figma ou avec les subtilités de l'export vers Slides — contrairement à un deck ponctuel exporté par son propre créateur.

## Approche retenue : contraintes plutôt que liberté
- À l'inverse du mode "libre + info" retenu pour l'export de deck ponctuel, la création de template doit **restreindre** ce qui est modifiable, pour garantir qu'un template reste exploitable par un utilisateur final qui n'a pas conçu le fichier.
- La friction en amont (contraintes imposées pendant la création du template dans Figma) prime sur la liberté créative, car une erreur ici retombe sur tous les futurs utilisateurs du template, pas seulement sur son créateur.
- Objectif technique : que les masters/layouts générés respectent nativement le schéma de l'API Slides — texte réellement éditable comme texte, images réellement traitées comme placeholders d'image (pas d'image transformée en texte, un problème identifié chez la concurrence sur leurs exports de master slides).

## Points à définir
- Quelles propriétés Figma sont autorisées/interdites lors de la construction d'un template (mapping avec les placeholders et masters supportés par l'API Slides).
- Comment guider l'utilisateur pendant la création (contraintes actives dans l'éditeur Figma, pas seulement un contrôle a posteriori).
- Mécanique d'export du template final vers Google Slides (probablement le même export direct via API que pour les decks, cf. brief export ponctuel).

## Valeur du positionnement
Aucun outil identifié sur le marché (gratuit ou payant) ne résout bien la création de templates Slides propres depuis Figma — même les solutions payantes les plus abouties déconseillent elles-mêmes leur propre fonctionnalité de master slides pour l'export Google Slides à cause de problèmes de gestion des images. Proposer cette fonctionnalité en gratuit, en plus de l'export de deck, comble un vide réel plutôt qu'une amélioration marginale d'une offre existante.

## Hors périmètre de ce brief
L'export de deck ponctuel et son étape de vérification dans Figma font l'objet d'un brief séparé.

## Décisions prises (première itération)

Réponses aux "Points à définir" ci-dessus, pour la version initialement
implémentée (contenu communicable : couleurs, typos, layouts, placeholders).

- **Pas de vrai Master/Layout Slides créé par l'API.** L'API Slides
  n'expose aucune création de Placeholder/Master/Layout personnalisé en
  écriture (`presentations.create` fige un thème et ses ~8 layouts
  prédéfinis ; `CreateSlideRequest` ne peut que RÉFÉRENCER un layout déjà
  présent). Un "template" produit ici est donc une présentation Slides
  normale, dont chaque slide est un **layout réutilisable** (à dupliquer
  par l'utilisateur final), pas un vrai objet `Layout`/`Master` de l'API.
  C'est exactement la limite que la concurrence rencontre (cf. Contexte) —
  ce projet la documente plutôt que de prétendre la contourner.
- **Contrainte active = zéro rasterisation.** Le même arbre de décision
  natif/raster que l'export de deck ponctuel est réutilisé, mais tout
  élément qui y serait rasterisé devient une erreur **bloquante** en mode
  template (`packages/plugin/src/serialize/templateValidation.ts`) : un
  template rasterisé fige cet élément pour tous ses futurs utilisateurs,
  qui n'ont pas la main sur le fichier Figma source. L'export du template
  est refusé (UI + garde-fou côté sandbox) tant qu'un layout a un
  avertissement bloquant.
- **Marquage des placeholders : convention de nom de calque.** Un
  créateur de template préfixe le nom d'un calque Figma par `[[role]]` ou
  `[[role:Libellé]]` (`title`, `subtitle`, `body`, `image`, `logo`, ou
  `custom:...`) — voir `packages/plugin/src/serialize/placeholder.ts`.
  Choisi plutôt qu'un contrôle dédié dans l'UI du plugin : ça reste
  visible/modifiable directement dans le panneau de calques Figma, sans
  aller-retour avec l'UI, et sans permission d'écriture supplémentaire.
  Cette convention peut être remplacée plus tard par un contrôle actif
  dans l'éditeur (property Figma dédiée) sans changer le contrat IR.
- **Le rôle est porté côté Slides en alt text.** Faute de vrai champ
  `Placeholder` disponible en écriture, le rôle/libellé est matérialisé
  via `UpdatePageElementAltTextRequest` (titre + description structurée
  `f2s-placeholder:<ROLE>`) sur l'élément Slides correspondant — visible
  dans le panneau "Texte alternatif" de Slides, et ré-exploitable par un
  outil compagnon futur qui lirait ce tag.
- **Export final : même pipeline que le deck.** Aucun nouvel endpoint
  backend : un template produit un `IRDocument` classique (chaque layout
  = une `IRSlide`), envoyé via les mêmes `POST /assets` puis `POST
  /export` que l'export de deck ponctuel.

### Ce qui reste ouvert

- Réordonnancement par glisser-déposer des layouts de template (le deck
  export l'a déjà) — non fait dans cette première itération.
- Contrôle actif dans l'éditeur Figma (property/plugin data plutôt que
  convention de nom) pour assigner un rôle de placeholder.
- Un outil compagnon "dupliquer un layout de template et remplir ses
  placeholders" qui lirait le tag `f2s-placeholder:<ROLE>` en alt text.
