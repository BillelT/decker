/**
 * Contenu de la carte Open Graph, partagée par toutes les pages publiques.
 *
 * Module volontairement sans dépendance : il est lu à la fois par le script
 * de rendu (`render.ts`, hors ligne) et par `routes/pages.ts` à l'exécution,
 * qui n'a besoin que du nom de fichier et du texte alternatif — pas du
 * gabarit HTML ni de la police inlinée que trimballe `ogTemplate.ts`.
 */
export interface OgImageContent {
  /** Accroche principale, affichée en h1 : c'est ce qu'on lit en vignette. */
  headline: string;
}

/**
 * Une seule carte pour tout le site plutôt qu'une par page : privacy et
 * terms sont des pages légales pures, sans propos propre à raconter en
 * vignette — les distinguer n'aurait décrit que leur titre, pas le produit.
 * `alt` sert de `og:image:alt` (lu par les lecteurs d'écran des réseaux, et
 * par les moteurs).
 */
export const OG_IMAGE = {
  file: 'og.png',
  alt: 'Decker, a free Figma plugin: pixel-perfect, editable decks and templates, from Figma to Google Slides.',
  content: {
    headline: 'Pixel-perfect, editable decks and templates, from Figma to Google Slides.',
  },
} as const satisfies { file: string; alt: string; content: OgImageContent };
