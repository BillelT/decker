# Roadmap Decker

Mise à jour : 14 octobre 2026.

## Où on en est : la palette est corrigée

Le plugin, le site et la DA (`billel-skill`, `skills/design-tokens/token.css`) partagent désormais la même rampe de gris, recalibrée sur la logique de Tailwind stone (référence : interfacecraft.dev). Le blanc de base est quasi neutre, le léger orange est porté par `gray-100`, et la clarté de chaque palier est conservée, donc les contrastes n'ont pas bougé.

| Token | HSL | Hex |
|---|---|---|
| white | `hsl(30, 20%, 98%)` | `#fbfaf9` |
| gray-100 | `hsl(30, 23%, 93%)` | `#f1ede9` |
| gray-300 | `hsl(18, 8%, 84%)` | `#d9d5d3` |
| gray-600 | `hsl(25, 6%, 53%)` | `#8e8680` |
| gray-700 | `hsl(22, 8%, 22%)` | `#3d3734` |
| ink | `hsl(30, 12%, 6%)` | `#110f0d` |

Fait (commits `c60238f` et `584b710` sur `decker`, `48413de` sur `billel-skill`) :

- [x] Rampe de la DA appliquée au plugin, au site, à la page de connexion Google et à l'image OG.
- [x] Gris inventé `#7f756c` retiré du plugin et du site, remplacé par `--b-gray-600` pour les affordances non textuelles.
- [x] Surfaces hors palette (`#ffffff`, `#f2ece8`) remplacées par le blanc et le `gray-100` de la DA.
- [x] Texte noir sur l'orange (6.09:1 au lieu de 3.01:1) dans le plugin et sur la page de connexion, comme le CTA du site et de la DA.
- [x] Onglets inactifs du plugin en `gray-700` (10:1 au lieu de 3.85:1).
- [x] Bordures du plugin en `gray-300` (`--b-border`).
- [x] Tag « approximated » (`#ffc599`) gardé comme exception propre au plugin.
- [ ] Publier la nouvelle version du plugin depuis Figma desktop (*Plugins → Development → Decker → Publish new version...*).

## Le focus maintenant

On passe aux choses qui manquent, aux problèmes de flow et d'UX, et à tout ce qui rend le plugin plus simple à utiliser et plus clair à lire. Ensuite le site, avec un easter egg jouable dans le footer.

## Les fichiers

| Fichier | Thème |
|---|---|
| [01-plugin-accessibilite-et-bugs.md](./01-plugin-accessibilite-et-bugs.md) | Correctifs sans arbitrage : focus, contrastes restants, clavier, bugs vérifiés |
| [02-plugin-parcours-et-actions.md](./02-plugin-parcours-et-actions.md) | Flow commun aux deux modes : ajout de frames, bouton principal, export, retours |
| [03-plugin-mode-deck.md](./03-plugin-mode-deck.md) | Mode Deck : structure, rail, rapport de fidélité, manques |
| [04-plugin-mode-template.md](./04-plugin-mode-template.md) | Mode Template : blocage, correction sur place, rôles, styles |
| [05-plugin-interface-et-da.md](./05-plugin-interface-et-da.md) | Interface et DA : biseaux, typo, animation d'export, icônes |
| [06-plugin-textes.md](./06-plugin-textes.md) | Textes de l'interface, à faire en dernier |
| [07-site-web.md](./07-site-web.md) | Site : accessibilité, contenu, DA, code |
| [08-site-easter-egg-jeu.md](./08-site-easter-egg-jeu.md) | Easter egg du footer : le jeu de pop-ups façon virus des années 2000 |

## Arbitrages encore ouverts

Ils conditionnent plusieurs tâches. Les trancher avant d'attaquer les fichiers concernés.

| # | Question | Options | Fichiers touchés |
|---|---|---|---|
| A | Biseaux en `box-shadow` sur les boutons (plugin et site), alors que la DA impose zéro ombre sur un bouton | La DA admet une variante en relief, ou les deux projets reviennent à plat | 05, 07 |
| E | Fenêtre d'export Win95 dans le skin Modern | Easter egg assumé, ou version Modern | 05 |
| F | Texte en 14 px | La partie « header sur une ligne à 960 px » est tranchée (voir plus bas) ; reste la taille du texte | 05 |
| G | Couleur d'erreur absente de la DA | Rouge plus sombre que `--b-accent-red`, toujours avec icône et libellé | 05, DA |
| H | Thème sombre : la DA n'a que 4 valeurs, le plugin en a inventé 8 | Définir une rampe sombre complète dans la DA, puis aligner | 05, DA |

Tranchés le 14 octobre 2026 :

- **D** : « Prepare for Slides » reste dans le header, tel quel. Retravailler les slides dans Figma est une force du plugin.
- **F** (header) : les libellés du lot 02 tiennent sur une ligne à 960 px, dans les deux modes et les deux skins.
- **C** : on garde l'aperçu en haut et le rapport dessous, dans les deux modes. Pas de rapport à droite : à côté des couleurs et de la typo du mode Template, il ferait un panneau fourre-tout.

## Ordre conseillé

1. **01** : aucun arbitrage, petits correctifs, gros gain.
2. **02** : fait le 14 octobre 2026.
3. **03** : fait le 14 octobre 2026. **04** ensuite, plus aucun arbitrage en attente.
4. **05** : la DA, après A, E, F, G, H.
5. **06** : les textes en dernier, parce que les états vides citent les nouveaux libellés.
6. **07** et **08** : le site, en parallèle du plugin.

Chaque lot du plugin demande un rebuild (`F2S_BACKEND_URL=https://decker-gamma.vercel.app npm run build --workspace packages/plugin`) puis une publication depuis Figma desktop. Grouper les tâches par lot limite le nombre de publications.

## Chantier transverse

- [ ] **Une seule source de tokens.** Quatre copies manuelles coexistent : `--color-*` dans `packages/plugin/src/styles.css`, `--b-*` dans `packages/backend/src/routes/marketingStyles.ts`, `--f2s-*` dans `packages/backend/src/routes/auth.ts`, `--b-*` dans `packages/backend/src/og/ogTemplate.ts`. Comme la DA bouge encore, chaque ajustement demande quatre retouches. Piste : un `tokens.css` unique dans le repo, synchronisé depuis `token.css` de `billel-skill` par un script, et injecté au build du plugin comme dans les chaînes CSS du site.
