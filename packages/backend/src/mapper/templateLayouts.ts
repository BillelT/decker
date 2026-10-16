import type { CalibrationData, IRDocument, IRElement, IRSlide } from '@figma-to-slides/shared';
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
 * - son `[[title]]` et son `[[subtitle]]` deviennent les placeholders
 *   natifs du layout, déplacés, redimensionnés et restylés pour tomber
 *   pile sur le texte Figma ;
 * - les autres éléments à rôle (`[[body]]`, `[[image]]`…) vont sur la
 *   slide, où ils restent modifiables ;
 * - le reste (fond, formes, images, textes sans rôle) est posé sur le
 *   layout comme décor : il apparaît sur chaque slide qui l'utilise ;
 * - les placeholders du layout qui ne servent pas sont supprimés ;
 * - la slide du template est créée depuis ce layout : "Nouvelle
 *   diapositive" dans Slides redonne le même layout, placeholders vides.
 *
 * Une frame sans layout libre (plus de frames que de layouts prédéfinis)
 * garde l'ancien chemin : tout est écrit sur la slide. La frame Master,
 * elle, va sur la page Master (`mapMasterBatch`).
 */

const EMU_PER_PT = 12700;

export interface LayoutPlaceholder {
  objectId: string;
  type: string;
  index: number;
  widthEmu: number;
  heightEmu: number;
  translateXEmu: number;
  /** Nombre de caractères du texte d'invite du layout (informatif : il ne peut pas être modifié par l'API). */
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

type NativeRole = 'TITLE' | 'SUBTITLE';

/**
 * Seuls le titre et le sous-titre prennent un placeholder natif. Le corps
 * natif de Slides ne s'affiche que comme une liste à puces sur 9 niveaux
 * ("Premier niveau"…) dans "Modifier le thème", texte que l'API interdit de
 * modifier (16 octobre) : un `[[body]]` reste donc une zone de texte
 * classique, posée sur la SLIDE pour rester modifiable (un élément de
 * layout est figé sur les slides).
 */
const ACCEPTED_TYPES: Record<NativeRole, string[]> = {
  TITLE: ['TITLE', 'CENTERED_TITLE'],
  SUBTITLE: ['SUBTITLE'],
};

function nativeRole(el: IRElement): NativeRole | undefined {
  if (el.kind !== 'text' || !el.placeholder) return undefined;
  const role = el.placeholder.role;
  return role === 'TITLE' || role === 'SUBTITLE' ? role : undefined;
}

/** Associe à chaque rôle natif de la frame un placeholder du layout, quand il en a un (un seul titre et un seul sous-titre). */
function matchPlaceholders(slide: IRSlide, layout: NativeLayout): Record<string, string> {
  const result: Record<string, string> = {};
  for (const role of ['TITLE', 'SUBTITLE'] as NativeRole[]) {
    const element = slide.elements.find((el) => nativeRole(el) === role);
    const slot = layout.placeholders.find((p) => ACCEPTED_TYPES[role].includes(p.type));
    if (element && slot) result[element.id] = slot.objectId;
  }
  return result;
}

/** Placeholders texte du layout (titre, sous-titre, corps) : ceux qui restent vides sont supprimés comme les autres. */
function isTextSlot(p: LayoutPlaceholder): boolean {
  return ['TITLE', 'CENTERED_TITLE', 'SUBTITLE', 'BODY'].includes(p.type);
}

/**
 * Choisit un layout distinct par frame : celui qui reçoit le plus de rôles
 * natifs, puis celui qui a le moins de placeholders texte en trop. Les
 * frames qui demandent le plus passent d'abord (seuls deux layouts
 * prédéfinis ont un sous-titre). La frame Master n'en prend aucun : elle
 * est écrite sur le Master (`mapMasterBatch`).
 */
export function planTemplateLayouts(slides: IRSlide[], layouts: NativeLayout[], masterSlideId?: string): Record<string, LayoutAssignment> {
  const plan: Record<string, LayoutAssignment> = {};
  const free = [...layouts];
  const demand = (s: IRSlide) => s.elements.filter((el) => nativeRole(el)).length;
  const ordered = slides.filter((s) => s.sourceNodeId !== masterSlideId).sort((a, b) => demand(b) - demand(a) || a.order - b.order);

  for (const slide of ordered) {
    let best: { layout: NativeLayout; match: Record<string, string>; matched: number; extra: number } | undefined;
    for (const layout of free) {
      const match = matchPlaceholders(slide, layout);
      const matched = Object.keys(match).length;
      const extra = layout.placeholders.filter(isTextSlot).length - matched;
      if (!best || matched > best.matched || (matched === best.matched && extra < best.extra)) best = { layout, match, matched, extra };
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
 * transform), et seul le STYLE est redirigé vers le placeholder : Google
 * refuse toute écriture de texte dans un placeholder de layout ou de
 * Master ("The operation is not allowed on the placeholder shape on a
 * layout or master", vu le 16 octobre sur `deleteText`). Le style du
 * premier run et du premier paragraphe s'applique donc à tout le
 * placeholder (`ALL`), sans indices de texte.
 */
function textOntoPlaceholder(requests: SlidesRequest[], slot: LayoutPlaceholder): SlidesRequest[] {
  const out: SlidesRequest[] = [];
  let textStyled = false;
  let paragraphStyled = false;
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
    } else if ('updateShapeProperties' in req) {
      out.push({ updateShapeProperties: { ...req.updateShapeProperties, objectId: slot.objectId } });
    } else if ('updateTextStyle' in req && !textStyled) {
      textStyled = true;
      out.push({ updateTextStyle: { ...req.updateTextStyle, objectId: slot.objectId, textRange: { type: 'ALL' } } });
    } else if ('updateParagraphStyle' in req && !paragraphStyled) {
      paragraphStyled = true;
      out.push({ updateParagraphStyle: { ...req.updateParagraphStyle, objectId: slot.objectId, textRange: { type: 'ALL' } } });
    }
    // insertText, puces et runs suivants : pas d'équivalent sans écrire de texte.
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

  // Ce qui a un rôle sans placeholder natif ([[body]], [[image]], [[logo]],
  // un second titre…) va sur la slide, où il reste modifiable ; le reste
  // est le décor du layout, repris par chaque nouvelle slide.
  const onSlide: IRElement[] = [];
  for (const el of slide.elements) {
    const slotId = assignment.placeholderByElementId[el.id];
    const slot = slotId ? slotById.get(slotId) : undefined;
    if (slot && el.kind === 'text') {
      requests.push(...textOntoPlaceholder(mapText(el, layoutId, scale, offsetXPt, offsetYPt, calibration), slot));
      // Le placeholder existait avant tout le reste : sans ça, une carte
      // ou un aplat créé ensuite passerait par-dessus le titre.
      requests.push({ updatePageElementsZOrder: { pageElementObjectIds: [slot.objectId], operation: 'BRING_TO_FRONT' } });
      continue;
    }
    if (el.placeholder) {
      onSlide.push(el);
      continue;
    }
    requests.push(...mapElement(el, layoutId, scale, offsetXPt, offsetYPt, resolveAssetUrl, calibration));
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

  for (const el of onSlide) {
    requests.push(...mapElement(el, pageObjectId, scale, offsetXPt, offsetYPt, resolveAssetUrl, calibration));
    requests.push({ updatePageElementAltText: mapPlaceholderAltText(el.id, el.placeholder!) });
  }

  return { sourceSlideId: slide.sourceNodeId, requests };
}

function mapElement(
  el: IRElement,
  pageObjectId: string,
  scale: number,
  offsetXPt: number,
  offsetYPt: number,
  resolveAssetUrl: (assetKey: string) => string,
  calibration: CalibrationData,
): SlidesRequest[] {
  switch (el.kind) {
    case 'shape':
      return mapShape(el, pageObjectId, scale, offsetXPt, offsetYPt);
    case 'text':
      return mapText(el, pageObjectId, scale, offsetXPt, offsetYPt, calibration);
    case 'image':
      return mapImage(el, resolveAssetUrl(el.assetKey), pageObjectId, scale, offsetXPt, offsetYPt);
    case 'line':
      return mapLine(el, pageObjectId, scale, offsetXPt, offsetYPt);
  }
}

/** Hors de la slide, en haut à gauche : là où le titre caché du Master ne se voit pas dans "Modifier le thème". */
const HIDDEN_TITLE_OFFSET_PT = -200;

/**
 * Le titre par défaut du Master ne se supprime pas (il emporterait les
 * titres des layouts, qui en héritent) : quand la frame Master n'a pas de
 * `[[title]]`, il est réduit à 1 pt et sorti de la slide. Les titres des
 * layouts ont leur propre position et leur propre style : rien ne change
 * pour eux.
 */
function hideMasterTitle(slot: LayoutPlaceholder): SlidesRequest[] {
  const target = EMU_PER_PT;
  return [
    {
      updatePageElementTransform: {
        objectId: slot.objectId,
        applyMode: 'ABSOLUTE',
        transform: {
          scaleX: roundForSerialization(target / slot.widthEmu),
          shearY: 0,
          shearX: 0,
          scaleY: roundForSerialization(target / slot.heightEmu),
          translateX: HIDDEN_TITLE_OFFSET_PT,
          translateY: HIDDEN_TITLE_OFFSET_PT,
          unit: 'PT',
        },
      },
    },
    { updateTextStyle: { objectId: slot.objectId, textRange: { type: 'ALL' }, style: { fontSize: { magnitude: 1, unit: 'PT' } }, fields: 'fontSize' } },
  ];
}

/**
 * Frame Master (la première du rail) : son fond et tous ses éléments sont
 * écrits sur la page Master. Slides les peint sur chaque layout et chaque
 * slide, entre le fond de la page et son contenu ; aucune slide n'est
 * créée pour elle. Son `[[title]]` prend le titre par défaut du Master
 * (le style dont partent les titres), sinon ce titre est caché.
 */
export function mapMasterBatch(
  slide: IRSlide,
  doc: IRDocument,
  masterObjectId: string,
  resolveAssetUrl: (assetKey: string) => string,
  calibration: CalibrationData,
  masterTitle?: LayoutPlaceholder,
): RequestBatch {
  const { scale, offsetXPt, offsetYPt } = computeScale(slide.frameSize, doc.slideSize);
  const requests: SlidesRequest[] = [];
  if (slide.background) {
    requests.push({
      updatePageProperties: {
        objectId: masterObjectId,
        pageProperties: { pageBackgroundFill: { solidFill: toSolidFill(slide.background.color) } },
        fields: 'pageBackgroundFill',
      },
    });
  }
  const title = masterTitle ? slide.elements.find((el) => nativeRole(el) === 'TITLE') : undefined;
  for (const el of slide.elements) {
    if (el === title && el.kind === 'text') {
      requests.push(...textOntoPlaceholder(mapText(el, masterObjectId, scale, offsetXPt, offsetYPt, calibration), masterTitle!));
      requests.push({ updatePageElementsZOrder: { pageElementObjectIds: [masterTitle!.objectId], operation: 'BRING_TO_FRONT' } });
      continue;
    }
    requests.push(...mapElement(el, masterObjectId, scale, offsetXPt, offsetYPt, resolveAssetUrl, calibration));
  }
  if (masterTitle && !title) requests.push(...hideMasterTitle(masterTitle));
  return { sourceSlideId: slide.sourceNodeId, requests };
}
