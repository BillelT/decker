# Visuels Figma Community

Couverture et carrousel de la page Community du plugin, en 1920x1080 (format recommandé par Figma pour les deux). Générés par `packages/backend/src/community/` : ne pas retoucher les PNG à la main, relancer le rendu.

```
npm run community:build --workspace packages/backend
```

(Playwright à fournir, voir l'en-tête de `packages/backend/src/community/render.ts`.)

Chaque visuel montre le vrai plugin (`packages/plugin/dist/ui.html`) avec les vraies slides Trailworn (`assets/mockup slides/`), et défend un seul point, avec les titres du site.

| Ordre | Fichier | Point | Texte alternatif |
|---|---|---|---|
| Couverture | `00-cover.png` | La promesse | Decker: export editable, pixel perfect decks and templates. The Decker plugin with the nine slides of the Trailworn deck. |
| 1 | `01-pick-frames.png` | Step 1, Pick your frames | Three Trailworn frames selected on the Figma canvas, and the Decker plugin ready to add them after the two already in its list. |
| 2 | `02-pixel-perfect.png` | Step 2, Matched, pixel for pixel | The Trailworn repairs chart split in half, Figma on the left and Google Slides on the right, lining up exactly. |
| 3 | `03-editable.png` | Fidelity, Real Slides objects | The exported Trailworn deck in Google Slides: the cover title is a native text box, selected, with its font and size in the toolbar. |
| 4 | `04-full-deck.png` | Full deck, Export a whole file | The Decker plugin exporting the nine Trailworn frames: three are already in Google Slides, the fourth is being generated. |
| 5 | `05-fonts.png` | Fonts, Swap any font in one click | The Fonts bar of the Decker plugin with its font list open: Satoshi, which Google Slides does not have, is about to be swapped for Manrope. |
| 6 | `06-template.png` | Templates, Export a template | The Decker plugin in Templates mode: the Trailworn slides as layouts, the cover as Master, the Key figure layout with its title and body placeholders, and the deck colors mapped to theme roles. |
| 7 | `07-suggest-roles.png` | Templates, Suggested placeholders and colors | Suggest roles in the Decker plugin: the Three pillars layout gets its title, subtitles and body texts in one click. |
| 8 | `08-google-access.png` | Google access, Only what the export needs | The Settings window of the Decker plugin, showing the Google account the export lands in. |
