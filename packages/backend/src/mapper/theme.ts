import type { ThemeColorRole } from '@figma-to-slides/shared';
import { clamp01 } from './colors.js';
import type { RequestBatch, SlidesRequest, ThemeColorPair } from './slidesRequests.js';

/**
 * Les 12 `ThemeColorType` éditables en écriture (spec API — voir
 * LIMITATIONS.md § Création de template). L'API exige TOUS ces rôles
 * d'un coup pour toute mise à jour de `colorScheme` : un rôle absent du
 * tableau envoyé est ignoré plutôt que conservé à sa valeur précédente,
 * d'où l'usage de `Record<ThemeColorRole, …>` (pas un `Partial`) en
 * entrée — c'est à l'appelant (plugin) de compléter les rôles non
 * assignés par le créateur du template avant de construire l'IR.
 */
const ALL_THEME_ROLES: ThemeColorRole[] = [
  'DARK1',
  'LIGHT1',
  'DARK2',
  'LIGHT2',
  'ACCENT1',
  'ACCENT2',
  'ACCENT3',
  'ACCENT4',
  'ACCENT5',
  'ACCENT6',
  'HYPERLINK',
  'FOLLOWED_HYPERLINK',
];

/**
 * Sentinelle utilisée comme `sourceSlideId` pour ce lot spécial (pas une
 * vraie slide) — reconnue par `jobs/runner.ts` pour donner un nom lisible
 * à l'erreur si ce lot échoue, plutôt que d'afficher l'id brut.
 */
export const THEME_BATCH_SOURCE_ID = '__theme__';

/**
 * Construit le lot qui écrit les 12 couleurs du thème sur la page Master
 * (audit 2026-08 — confirmé en conditions réelles, voir
 * `spikes/masterThemeSpike.ts`). Traité comme n'importe quel autre lot par
 * `jobs/runner.ts` : appliqué et suivi indépendamment des lots par slide,
 * donc son échec éventuel n'empêche pas le reste de l'export de continuer.
 */
export function mapThemeBatch(theme: Record<ThemeColorRole, { r: number; g: number; b: number }>, masterObjectId: string): RequestBatch {
  const colors: ThemeColorPair[] = ALL_THEME_ROLES.map((type) => {
    const c = theme[type];
    return { type, color: { red: clamp01(c.r), green: clamp01(c.g), blue: clamp01(c.b) } };
  });

  const requests: SlidesRequest[] = [
    {
      updatePageProperties: {
        objectId: masterObjectId,
        pageProperties: { colorScheme: { colors } },
        fields: 'colorScheme',
      },
    },
  ];

  return { sourceSlideId: THEME_BATCH_SOURCE_ID, requests };
}
