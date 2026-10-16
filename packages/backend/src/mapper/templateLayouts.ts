import type { CalibrationData, IRDocument, IRElement, IRSlide, IRText } from '@figma-to-slides/shared';
import { toSolidFill } from './colors.js';
import { mapImage } from './images.js';
import { mapLine } from './lines.js';
import { mapPlaceholderAltText } from './placeholder.js';
import { mapShape } from './shapes.js';
import { mapText } from './text.js';
import { computeScale, roundForSerialization } from './transform.js';
import type { AffineTransform, RequestBatch, SlidesRequest } from './slidesRequests.js';

/**
 * Mode template : vrais layouts et vrais placeholders dans le thème Slides
 * (spike du 16 octobre).
 *
 * L'API Slides ne sait ni créer un layout, ni faire d'une forme un
 * placeholder. Mais toute présentation neuve arrive avec ses layouts
 * prédéfinis ("Titre et corps", "Titre seul"…), qui portent déjà de vrais
 * placeholders. Chaque frame du template prend donc l'un de ces layouts :
 * - ses `[[title]]`, `[[subtitle]]` et `[[body]]` deviennent les
 *   placeholders natifs du layout, déplacés, redimensionnés et restylés
 *   pour tomber pile sur le texte Figma ;
 * - le reste (fond, formes, images, textes sans rôle) est posé sur le
 *   layout comme décor : il apparaît sur chaque slide qui l'utilise ;
 * - les placeholders du layout qui ne servent pas sont supprimés ;
 * - la slide du template est créée depuis ce layout : "Nouvelle
 *   diapositive" dans Slides redonne le même layout, placeholders vides.
 *
 * Une frame sans layout compatible (plus de frames que de layouts, ou plus
 * de placeholders demandés qu'aucun layout n'en a) garde l'ancien chemin :
 * tout est écrit sur la slide.
 */

const EMU_PER_PT = 12700;

export interface LayoutPlaceholder {
  objectId: string;
  type: string;
  index: number;
  widthEmu: number;
  heightEmu: number;
  translateXEmu: number;
  /** Nombre de caractères déjà présents (texte d'invite du layout), à vider avant d'écrire. */
  textLength: number;
}

export interface NativeLayout {
  objectId: string;
  /** Nom prédéfini (`TITLE_AND_BODY`…), `layoutProperties.name`. */
  name: string;
  placeholders: LayoutPlaceholder[];
}

export interface LayoutAssignment {
  layoutId: string;
  layoutName: string;
  /** id d'élément IR → objectId du placeholder du layout qui le remplace. */
  placeholderByElementId: Record<string, string>;
  /** Placeholders du layout sans élément : supprimés. */
  unusedPlaceholderIds: string[];
}

type NativeRole = 'TITLE' | 'SUBTITLE' | 'BODY';

const ACCEPTED_TYPES: Record<NativeRole, string[]> = {
  TITLE: ['TITLE', 'CENTERED_TITLE'],
  SUBTITLE: ['SUBTITLE'],
  BODY: ['BODY'],
};

function nativeRole(el: IRElement): NativeRole | undefined {
  if (el.kind !== 'text' || !el.placeholder) return undefined;
  const role = el.placeholder.role;
  return role === 'TITLE' || role === 'SUBTITLE' || role === 'BODY' ? role : undefined;
}

/**
 * Associe à chaque placeholder natif l'élément IR qui le remplacera, ou
 * `undefined` si le layout n'a pas de quoi accueillir tous les rôles de la
 * frame. Plusieurs `[[body]]` (deux colonnes) suivent l'ordre gauche à
 * droite, des deux côtés.
 */
function matchPlaceholders(slide: IRSlide, layout: NativeLayout): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  for (const role of ['TITLE', 'SUBTITLE', 'BODY'] as NativeRole[]) {
    const elements = slide.elements.filter((el) => nativeRole(el) === role).sort((a, b) => a.rect.x - b.rect.x);
    if (elements.length === 0) continue;
    const slots = layout.placeholders.filter((p) => ACCEPTED_TYPES[role].includes(p.type)).sort((a, b) => a.translateXEmu - b.translateXEmu);
    // Un deuxième titre (doublon déjà signalé côté plugin) reste du décor.
    const wanted = role === 'BODY' ? elements : elements.slice(0, 1);
    if (slots.length < wanted.length) return undefined;
    wanted.forEach((el, i) => (result[el.id] = slots[i].objectId));
  }
  return result;
}

/** Placeholders du layout qui ne sont pas du texte éditable (numéro de slide, pied de page…) : jamais réutilisés, toujours supprimés. */
function isTextSlot(p: LayoutPlaceholder): boolean {
  return Object.values(ACCEPTED_TYPES).some((types) => types.includes(p.type));
}

/**
 * Choisit un layout distinct par frame, dans l'ordre du template : celui
 * qui accueille tous ses rôles avec le moins de placeholders texte en
 * trop. Les frames qui demandent le plus passent d'abord, pour ne pas se
 * faire prendre le seul layout à deux colonnes par une frame qui n'en a
 * pas besoin.
 */
export function planTemplateLayouts(slides: IRSlide[], layouts: NativeLayout[]): Record<string, LayoutAssignment> {
  const plan: Record<string, LayoutAssignment> = {};
  const free = [...layouts];
  const demand = (s: IRSlide) => s.elements.filter((el) => nativeRole(el)).length;
  const ordered = [...slides].sort((a, b) => demand(b) - demand(a) || a.order - b.order);

  for (const slide of ordered) {
    let best: { layout: NativeLayout; match: Record<string, string>; extra: number } | undefined;
    for (const layout of free) {
      const match = matchPlaceholders(slide, layout);
      if (!match) continue;
      const extra = layout.placeholders.filter(isTextSlot).length - Object.keys(match).length;
      if (!best || extra < best.extra) best = { layout, match, extra };
    }
    if (!best) continue;
    free.splice(free.indexOf(best.layout), 1);
    const used = new Set(Object.values(best.match));
    plan[slide.sourceNodeId] = {
      layoutId: best.layout.objectId,
      layoutName: best.layout.name,
      placeholderByElementId: best.match,
      unusedPlaceholderIds: best.layout.placeholders.filter((p) => !used.has(p.objectId)).map((p) => p.objectId),
    };
  }
  return plan;
}

/**
 * Les requêtes de `mapText` visent une zone de texte qu'elles créent ; ici
 * le placeholder existe déjà. La création devient une transform absolue
 * (la taille d'un élément existant ne se change que par l'échelle de sa
 * transform), le texte d'invite est vidé, et tout le reste (style, texte,
 * paragraphes) est redirigé vers le placeholder.
 */
function textOntoPlaceholder(requests: SlidesRequest[], text: IRText, slot: LayoutPlaceholder): SlidesRequest[] {
  const out: SlidesRequest[] = [];
  for (const req of requests) {
    if ('createShape' in req) {
      const { size, transform } = req.createShape.elementProperties;
      const sx = (size.width.magnitude * EMU_PER_PT) / slot.widthEmu;
      const sy = (size.height.magnitude * EMU_PER_PT) / slot.heightEmu;
      const absolute: AffineTransform = {
        scaleX: roundForSerialization(transform.scaleX * sx),
        shearY: roundForSerialization(transform.shearY * sx),
        shearX: roundForSerialization(transform.shearX * sy),
        scaleY: roundForSerialization(transform.scaleY * sy),
        translateX: transform.translateX,
        translateY: transform.translateY,
        unit: 'PT',
      };
      out.push({ updatePageElementTransform: { objectId: slot.objectId, applyMode: 'ABSOLUTE', transform: absolute } });
      if (slot.textLength > 0) out.push({ deleteText: { objectId: slot.objectId, textRange: { type: 'ALL' } } });
      continue;
    }
    out.push(JSON.parse(JSON.stringify(req).split(`"${text.id}"`).join(`"${slot.objectId}"`)) as SlidesRequest);
  }
  return out;
}

export function mapSlideOntoLayout(
  slide: IRSlide,
  doc: IRDocument,
  assignment: LayoutAssignment,
  layout: NativeLayout,
  resolveAssetUrl: (assetKey: string) => string,
  calibration: CalibrationData,
): RequestBatch {
  const layoutId = assignment.layoutId;
  const { scale, offsetXPt, offsetYPt } = computeScale(slide.frameSize, doc.slideSize);
  const slotById = new Map(layout.placeholders.map((p) => [p.objectId, p]));
  const requests: SlidesRequest[] = [];

  if (slide.background) {
    requests.push({
      updatePageProperties: {
        objectId: layoutId,
        pageProperties: { pageBackgroundFill: { solidFill: toSolidFill(slide.background.color) } },
        fields: 'pageBackgroundFill',
      },
    });
  }

  for (const el of slide.elements) {
    const slotId = assignment.placeholderByElementId[el.id];
    const slot = slotId ? slotById.get(slotId) : undefined;
    if (slot && el.kind === 'text') {
      requests.push(...textOntoPlaceholder(mapText(el, layoutId, scale, offsetXPt, offsetYPt, calibration), el, slot));
      // Le placeholder existait avant tout le reste : sans ça, une carte
      // ou un aplat créé ensuite passerait par-dessus le titre.
      requests.push({ updatePageElementsZOrder: { pageElementObjectIds: [slot.objectId], operation: 'BRING_TO_FRONT' } });
      continue;
    }
    switch (el.kind) {
      case 'shape':
        requests.push(...mapShape(el, layoutId, scale, offsetXPt, offsetYPt));
        break;
      case 'text':
        requests.push(...mapText(el, layoutId, scale, offsetXPt, offsetYPt, calibration));
        break;
      case 'image':
        requests.push(...mapImage(el, resolveAssetUrl(el.assetKey), layoutId, scale, offsetXPt, offsetYPt));
        break;
      case 'line':
        requests.push(...mapLine(el, layoutId, scale, offsetXPt, offsetYPt));
        break;
    }
    if (el.placeholder) requests.push({ updatePageElementAltText: mapPlaceholderAltText(el.id, el.placeholder) });
  }

  for (const objectId of assignment.unusedPlaceholderIds) requests.push({ deleteObject: { objectId } });

  const pageObjectId = `f2s_page_${slide.sourceNodeId}`;
  requests.push({
    createSlide: {
      objectId: pageObjectId,
      slideLayoutReference: { layoutId },
      placeholderIdMappings: Object.values(assignment.placeholderByElementId).map((layoutPlaceholderObjectId) => ({
        layoutPlaceholderObjectId,
        objectId: `${layoutPlaceholderObjectId}_s`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      })),
    },
  });

  return { sourceSlideId: slide.sourceNodeId, requests };
}
