import type { IRPlaceholder } from '@figma-to-slides/shared';
import type { UpdatePageElementAltTextRequest } from './slidesRequests.js';

/**
 * Préfixe stable du tag machine-lisible porté dans `description` — permet à
 * un outil compagnon futur (ou à un humain via le panneau "Texte alt" de
 * Slides) de retrouver un placeholder de template par son rôle, sans
 * dépendre du `title`, pensé pour rester lisible par un humain.
 */
export const PLACEHOLDER_ALT_TEXT_PREFIX = 'f2s-placeholder';

export function mapPlaceholderAltText(objectId: string, placeholder: IRPlaceholder): UpdatePageElementAltTextRequest {
  return {
    objectId,
    title: `Template placeholder: ${placeholder.label}`,
    description: `${PLACEHOLDER_ALT_TEXT_PREFIX}:${placeholder.role}`,
  };
}
