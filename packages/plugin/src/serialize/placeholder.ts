import type { IRPlaceholder, PlaceholderRole } from '@figma-to-slides/shared';

/**
 * Convention de nom de calque pour la création de template
 * (brief-creation-template-google-slides.md) : un créateur de template tague
 * un calque en préfixant son nom Figma par `[[role]]` ou `[[role:Libellé]]`,
 * ex. `[[title]] Titre de la slide`, `[[image:Photo héro]]`.
 *
 * On choisit un tag de NOM plutôt qu'un contrôle dédié dans l'UI du plugin
 * (option envisagée par le brief §"guider l'utilisateur pendant la
 * création") : ça reste visible et modifiable directement dans le panneau
 * de calques Figma, sans aller-retour avec l'UI du plugin, et ça ne demande
 * aucune permission d'écriture supplémentaire (`setPluginData` nécessiterait
 * de re-sélectionner le nœud depuis le plugin à chaque changement de rôle).
 */
const TAG_PATTERN = /^\s*\[\[\s*([a-zA-Z]+)\s*(?::\s*([^\]]+))?\]\]/;

const ROLE_ALIASES: Record<string, PlaceholderRole> = {
  title: 'TITLE',
  titre: 'TITLE',
  heading: 'TITLE',
  subtitle: 'SUBTITLE',
  soustitre: 'SUBTITLE',
  body: 'BODY',
  texte: 'BODY',
  corps: 'BODY',
  text: 'BODY',
  image: 'IMAGE',
  photo: 'IMAGE',
  picture: 'IMAGE',
  logo: 'LOGO',
  custom: 'CUSTOM',
};

function defaultLabel(role: PlaceholderRole): string {
  switch (role) {
    case 'TITLE':
      return 'Title';
    case 'SUBTITLE':
      return 'Subtitle';
    case 'BODY':
      return 'Body text';
    case 'IMAGE':
      return 'Image';
    case 'LOGO':
      return 'Logo';
    case 'CUSTOM':
      return 'Custom placeholder';
  }
}

/** Renvoie `undefined` si le nom de calque ne porte aucun tag reconnu. */
export function parsePlaceholderTag(layerName: string): IRPlaceholder | undefined {
  const match = TAG_PATTERN.exec(layerName);
  if (!match) return undefined;
  const role = ROLE_ALIASES[match[1].toLowerCase()];
  if (!role) return undefined;
  const label = match[2]?.trim();
  return { role, label: label && label.length > 0 ? label : defaultLabel(role) };
}

/**
 * Un calque qui ARBORE la syntaxe de tag (`[[...]]`) mais dont le rôle n'est
 * pas dans `ROLE_ALIASES` (faute de frappe : `[[titel]]`, `[[img]]`…) était
 * ignoré en silence — le créateur du template croyait son placeholder posé,
 * personne ne le voyait manquer avant la livraison. Détecté séparément pour
 * produire un avertissement au lieu de rien.
 */
export function findUnknownPlaceholderTag(layerName: string): string | undefined {
  const match = TAG_PATTERN.exec(layerName);
  if (!match) return undefined;
  return ROLE_ALIASES[match[1].toLowerCase()] ? undefined : match[1];
}

/** Rôles proposés dans les messages d'aide (UI + warning de tag inconnu). */
export const KNOWN_ROLE_TAGS = ['title', 'subtitle', 'body', 'image', 'logo', 'custom'] as const;
