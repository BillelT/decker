import type { IRElement, IRWarning, PlaceholderRole } from '@figma-to-slides/shared';

/**
 * Validation de COMPOSITION d'un layout de template (TODO.md § Mode
 * template, point 7), distincte de `templateValidation.ts`, qui ne parle
 * que de fidélité (natif vs rasterisé). Ici, rien n'est perdu à l'export :
 * ce sont les intentions du créateur qui sont douteuses, et qui retomberont
 * sur tous les futurs utilisateurs du template si personne ne les relève.
 *
 * Tous les avertissements produits ici sont NON BLOQUANTS, volontairement :
 * chaque cas a une lecture légitime (une slide de séparation n'a
 * effectivement aucun placeholder, deux zones de corps de texte côte à côte
 * peuvent être assumées). On commence par informer ; on durcira si l'usage
 * le confirme.
 *
 * Pure et testable comme le reste de `serialize/` : n'opère que sur l'IR
 * déjà sérialisé, sans aucun accès à l'API Figma.
 */

/** Rôles qui n'ont de sens que sur un calque TEXTE : un `[[title]]` posé sur un rectangle ne produira jamais de titre éditable côté Slides. */
const TEXT_ONLY_ROLES = new Set<PlaceholderRole>(['TITLE', 'SUBTITLE', 'BODY']);

/**
 * Rôles qui n'ont de sens que sur un visuel. Une FORME est acceptée en plus
 * d'une image : marquer un rectangle vide comme `[[image]]` est la façon
 * habituelle de réserver un emplacement d'image dans un layout, alors qu'il
 * n'y a encore aucun pixel à placer.
 */
const VISUAL_ONLY_ROLES = new Set<PlaceholderRole>(['IMAGE', 'LOGO']);

const ROLE_LABELS: Record<PlaceholderRole, string> = {
  TITLE: 'title',
  SUBTITLE: 'subtitle',
  BODY: 'body',
  IMAGE: 'image',
  LOGO: 'logo',
  CUSTOM: 'custom',
};

/** Nom lisible d'un élément pour les messages (`sourceNodeName` est optionnel dans le contrat partagé, voir IRBase). */
function nameOf(el: IRElement): string {
  return el.sourceNodeName ?? el.placeholder?.label ?? el.kind;
}

/**
 * Clé de regroupement pour la détection de doublons. Deux `[[custom:…]]`
 * ne sont ambigus entre eux que s'ils portent le MÊME libellé : c'est le
 * libellé, pas le rôle générique CUSTOM, qui identifie un placeholder
 * personnalisé.
 */
function duplicateKey(role: PlaceholderRole, label: string): string {
  return role === 'CUSTOM' ? `CUSTOM:${label.toLowerCase()}` : role;
}

function isVisualKind(kind: IRElement['kind']): boolean {
  return kind === 'image' || kind === 'shape';
}

export interface CompositionInput {
  /** id du nœud Figma de la frame de layout : porte l'avertissement de niveau layout. */
  sourceNodeId: string;
  frameName: string;
  elements: IRElement[];
}

export function collectCompositionWarnings(layout: CompositionInput): IRWarning[] {
  const warnings: IRWarning[] = [];
  const tagged = layout.elements.filter((el) => el.placeholder);

  if (tagged.length === 0) {
    warnings.push({
      code: 'LAYOUT_WITHOUT_PLACEHOLDER',
      severity: 'info',
      sourceNodeId: layout.sourceNodeId,
      nodeName: layout.frameName,
      message:
        'This layout has no placeholder. Whoever reuses it will not know what to replace. Tag a layer with [[title]], [[body]], [[image]]… unless the layout is meant to stay fixed (a section divider, for instance).',
    });
  }

  // Doublons : un layout qui porte deux `[[title]]` ne dit pas lequel EST le
  // titre. Signalé sur CHAQUE occurrence plutôt que sur les suivantes
  // seulement : le créateur doit pouvoir cliquer les deux pour arbitrer.
  const byKey = new Map<string, IRElement[]>();
  for (const el of tagged) {
    const key = duplicateKey(el.placeholder!.role, el.placeholder!.label);
    const group = byKey.get(key);
    if (group) group.push(el);
    else byKey.set(key, [el]);
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const { role, label } = group[0].placeholder!;
    const tag = role === 'CUSTOM' ? `[[custom:${label}]]` : `[[${ROLE_LABELS[role]}]]`;
    for (const el of group) {
      warnings.push({
        code: 'PLACEHOLDER_ROLE_DUPLICATE',
        severity: 'warning',
        sourceNodeId: el.sourceNodeId,
        nodeName: nameOf(el),
        message: `${group.length} layers of this layout are tagged ${tag}. Keep one, or give the others a different role, so the placeholder stays unambiguous.`,
      });
    }
  }

  // Tag incohérent avec le type de calque : l'élément part quand même vers
  // Slides, mais étiqueté comme ce qu'il n'est pas. Le plus trompeur des
  // trois cas pour l'utilisateur final, qui lit l'alt text posé par le
  // mapper (`f2s-placeholder:<RÔLE>`) sans voir le fichier Figma.
  for (const el of tagged) {
    const { role } = el.placeholder!;
    if (TEXT_ONLY_ROLES.has(role) && el.kind !== 'text') {
      warnings.push({
        code: 'PLACEHOLDER_ROLE_KIND_MISMATCH',
        severity: 'warning',
        sourceNodeId: el.sourceNodeId,
        nodeName: nameOf(el),
        message: `Tagged [[${ROLE_LABELS[role]}]] but this layer is not a text layer. Slides will label it as text without it being editable as such.`,
      });
    } else if (VISUAL_ONLY_ROLES.has(role) && !isVisualKind(el.kind)) {
      warnings.push({
        code: 'PLACEHOLDER_ROLE_KIND_MISMATCH',
        severity: 'warning',
        sourceNodeId: el.sourceNodeId,
        nodeName: nameOf(el),
        message: `Tagged [[${ROLE_LABELS[role]}]] but this layer is a ${el.kind} layer, not a picture or a shape reserving its spot.`,
      });
    }
  }

  return warnings;
}

/** Codes produits par cette validation : l'UI les regroupe dans une section à part (ni fidélité, ni bloquant). */
export const COMPOSITION_WARNING_CODES: ReadonlySet<string> = new Set([
  'PLACEHOLDER_ROLE_DUPLICATE',
  'PLACEHOLDER_ROLE_KIND_MISMATCH',
  'LAYOUT_WITHOUT_PLACEHOLDER',
]);
