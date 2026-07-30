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
