/**
 * Contenu de la carte Open Graph, partagée par toutes les pages publiques.
 *
 * Module volontairement sans dépendance : il est lu à la fois par le script
 * de rendu (`render.ts`, hors ligne) et par `routes/pages.ts` à l'exécution,
 * qui n'a besoin que du nom de fichier et du texte alternatif — pas du
 * gabarit HTML ni de la police inlinée que trimballe `ogTemplate.ts`.
 */
export interface OgImageContent {
  /** Libellé du badge "type de produit", posé au-dessus de la marque. */
  eyebrow: string;
  /** Accroche principale — le nom du produit, c'est ce qu'on lit en vignette. */
  headline: string;
  /** Phrase de contexte sous l'accroche, une à deux lignes. */
  subline: string;
  /** Domaine du site, affiché comme signature discrète sous la phrase. */
  domain: string;
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
    eyebrow: 'Figma plugin',
    headline: 'Decker',
    subline: 'Pixel-perfect, editable decks and templates, from Figma to Google Slides.',
    domain: 'decker.billeltighidet.fr',
  },
} as const satisfies { file: string; alt: string; content: OgImageContent };
