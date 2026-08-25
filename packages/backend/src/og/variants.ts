/**
 * Contenu des cartes Open Graph, une par page publique.
 *
 * Module volontairement sans dépendance : il est lu à la fois par le script
 * de rendu (`render.ts`, hors ligne) et par `routes/pages.ts` à l'exécution,
 * qui n'a besoin que des noms de fichiers et des textes alternatifs — pas du
 * gabarit HTML ni de la police inlinée que trimballe `ogTemplate.ts`.
 */
export interface OgImageContent {
  /** Libellé de la barre de titre de la fenêtre (chrome, décoratif). */
  windowTitle: string;
  /** Accroche principale — 3 à 4 mots, c'est ce qu'on lit en vignette. */
  headline: string;
  /** Phrase de contexte sous l'accroche, une seule ligne. */
  subline: string;
  /** Libellé du bouton d'appel à l'action (2 à 4 mots). */
  cta: string;
}

/**
 * Une carte par page publique plutôt qu'une seule image générique : c'est la
 * recommandation constante des guides og:image (une carte qui décrit
 * exactement la page partagée est bien plus cliquée qu'un logo réutilisé
 * partout), et ça reste peu coûteux ici — trois PNG d'aplats, quelques
 * dizaines de Ko chacun. `alt` sert de `og:image:alt` (lu par les lecteurs
 * d'écran des réseaux, et par les moteurs).
 */
export const OG_IMAGE_VARIANTS = {
  home: {
    file: 'og.png',
    alt: 'Decker, a free Figma plugin: export a Figma design to Google Slides. Shown as a Windows 95 window.',
    content: {
      windowTitle: 'Decker.exe',
      headline: 'Figma -> Google Slides',
      subline: 'Native, editable slides — layout, styles and theme preserved.',
      cta: 'Get the plugin on Figma',
    },
  },
  privacy: {
    file: 'og-privacy.png',
    alt: 'Decker privacy policy: what Decker accesses in your Google account, and what it never touches.',
    content: {
      windowTitle: 'Decker.exe — Privacy',
      headline: 'Privacy Policy',
      subline: 'What Decker accesses, and what it never touches.',
      cta: 'Read the policy',
    },
  },
  terms: {
    file: 'og-terms.png',
    alt: 'Decker terms of use: a free plugin, provided as is, built as a personal project.',
    content: {
      windowTitle: 'Decker.exe — Terms',
      headline: 'Terms of Use',
      subline: 'A free plugin, provided as is, as a personal project.',
      cta: 'Read the terms',
    },
  },
} as const satisfies Record<string, { file: string; alt: string; content: OgImageContent }>;

export type OgImageVariant = keyof typeof OG_IMAGE_VARIANTS;
