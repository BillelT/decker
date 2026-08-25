/**
 * Contenu de la carte Open Graph, partagée par toutes les pages publiques.
 *
 * Module volontairement sans dépendance : il est lu à la fois par le script
 * de rendu (`render.ts`, hors ligne) et par `routes/pages.ts` à l'exécution,
 * qui n'a besoin que du nom de fichier et du texte alternatif — pas du
 * gabarit HTML ni de la police inlinée que trimballe `ogTemplate.ts`.
 */
export interface OgImageContent {
  /** Libellé du badge "type de produit", posé au-dessus du titre. */
  eyebrow: string;
  /** Libellé de la barre de titre de la fenêtre (chrome, décoratif). */
  windowTitle: string;
  /** Accroche principale — le nom du produit, c'est ce qu'on lit en vignette. */
  headline: string;
  /** Phrase de contexte sous l'accroche, une à deux lignes. */
  subline: string;
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
  alt: 'Decker, a free Figma plugin: export a Figma design to pixel-perfect, editable Google Slides. Shown as a Windows 95 window.',
  content: {
    eyebrow: 'Figma plugin',
    windowTitle: 'Decker.exe',
    headline: 'Decker',
    subline: 'Export a Figma design to pixel-perfect, editable Google Slides.',
  },
} as const satisfies { file: string; alt: string; content: OgImageContent };
