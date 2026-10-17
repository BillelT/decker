import { isFixedMasterText, type CalibrationData, type IRDocument, type IRElement, type IRSlide, type IRText } from '@figma-to-slides/shared';
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
 * (spikes des 16 et 17 octobre).
 *
 * L'API Slides ne sait ni créer un layout, ni faire d'une forme un
 * placeholder. Mais toute présentation neuve arrive avec ses layouts
 * prédéfinis ("Titre et corps", "Titre seul"…), qui portent déjà de vrais
 * placeholders, et un placeholder de layout dupliqué reste un placeholder
 * (comme un copier-coller dans "Modifier le thème"). Chaque frame du
 * template prend donc l'un de ces layouts :
 * - chaque texte à rôle (`[[title]]`, `[[subtitle]]`, `[[body]]`, texte
 *   `[[custom]]`) devient un placeholder du layout : un existant du bon
 *   type s'il en reste, sinon la copie d'un placeholder du même type,
 *   déplacée, redimensionnée et restylée pour tomber pile sur le texte
 *   Figma. Plusieurs titres, sous-titres ou corps par layout vont donc bien ;
 * - un sous-titre, un corps ou un texte libre prend de préférence un
 *   placeholder de sous-titre (copié au besoin) : le corps natif a des
 *   puces que Google interdit de retirer sur un layout ;
 * - le reste (fond, formes, images, logos, textes sans rôle) est posé sur
 *   le layout comme décor : Slides n'a pas de placeholder d'image (il n'en
 *   existe que dans un PowerPoint importé), une image reste donc dans le
 *   layout, visible sur chaque slide qui l'utilise ;
 * - les placeholders du layout qui ne servent pas sont supprimés ;
 * - la slide du template est créée depuis ce layout, ses placeholders
 *   remplis avec le texte d'exemple : "Nouvelle diapositive" dans Slides
 *   redonne le même layout, placeholders vides.
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
  /** id d'élément IR → objectId du placeholder du layout qui le remplace (existant ou copie). */
  placeholderByElementId: Record<string, string>;
  /** Copies à créer avant tout : `objectId` est la copie de `sourceId`, un placeholder du layout. */
  duplicates?: { sourceId: string; objectId: string }[];
  /** Placeholders du layout sans élément : supprimés. */
  unusedPlaceholderIds: string[];
}

type NativeRole = 'TITLE' | 'SUBTITLE' | 'BODY';

/** Types de placeholder acceptés par rôle, par ordre de préférence. */
/**
 * Un corps ou un texte libre préfère un placeholder de SOUS-TITRE : le corps
 * natif porte des puces que Google interdit de retirer sur un layout
 * (`deleteParagraphBullets` refusé le 17 octobre, comme toute écriture de
 * texte), et chaque nouvelle slide les hériterait. Le corps ne sert que
 * dans un layout sans sous-titre.
 */
const ACCEPTED_TYPES: Record<NativeRole, string[]> = {
  TITLE: ['TITLE', 'CENTERED_TITLE'],
  SUBTITLE: ['SUBTITLE', 'BODY'],
  BODY: ['SUBTITLE', 'BODY'],
};

const ROLE_ORDER: NativeRole[] = ['TITLE', 'SUBTITLE', 'BODY'];

/** Un `[[custom]]` texte se comporte comme un corps : une zone de texte libre. */
function nativeRole(el: IRElement): NativeRole | undefined {
  if (el.kind !== 'text' || !el.placeholder) return undefined;
  const role = el.placeholder.role;
  if (role === 'TITLE' || role === 'SUBTITLE' || role === 'BODY') return role;
  return role === 'CUSTOM' ? 'BODY' : undefined;
}

/** id d'une copie de placeholder : dérivé de l'élément, unique dans la présentation. */
function duplicateId(elementId: string): string {
  return `f2s_ph_${elementId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface Match {
  placeholderByElementId: Record<string, string>;
  duplicates: { sourceId: string; objectId: string }[];
  matched: number;
  /** Textes servis sans placeholder de corps, donc sans puces. */
  exact: number;
  unused: string[];
}

/**
 * Associe chaque texte à rôle de la frame à un placeholder du layout : un
 * libre du type le plus juste, sinon la copie d'un placeholder de ce type.
 * Titres d'abord, puis sous-titres, puis corps, dans l'ordre de la frame.
 */
function matchPlaceholders(slide: IRSlide, layout: NativeLayout): Match {
  const free = [...layout.placeholders];
  const placeholderByElementId: Record<string, string> = {};
  const duplicates: Match['duplicates'] = [];
  let matched = 0;
  let exact = 0;
  for (const role of ROLE_ORDER) {
    for (const el of slide.elements.filter((e) => nativeRole(e) === role)) {
      // Le type compte plus que la place libre : mieux vaut copier un
      // sous-titre que remplir un corps à puces resté libre.
      const types = ACCEPTED_TYPES[role];
      for (const type of types) {
        const slot = free.find((p) => p.type === type);
        const source = slot ?? layout.placeholders.find((p) => p.type === type);
        if (!source) continue;
        if (slot) {
          free.splice(free.indexOf(slot), 1);
          placeholderByElementId[el.id] = slot.objectId;
        } else {
          const objectId = duplicateId(el.id);
          duplicates.push({ sourceId: source.objectId, objectId });
          placeholderByElementId[el.id] = objectId;
        }
        matched += 1;
        if (type !== 'BODY') exact += 1;
        break;
      }
    }
  }
  return { placeholderByElementId, duplicates, matched, exact, unused: free.map((p) => p.objectId) };
}

/**
 * Les textes du Master (surtitre, sujet, date) doivent rester modifiables
 * sur chaque slide. Or un élément du Master est figé sur les slides, et un
 * placeholder du Master ne s'affiche sur aucune : Slides s'en sert
 * seulement comme modèle des placeholders des layouts. Chaque texte est
 * donc recopié dans chaque layout, où il devient un placeholder comme les
 * autres (même position, même style), et retiré du Master. C'est
 * automatique, sans tag (décision du 17 octobre) : seules les mentions
 * légales (`isFixedMasterText`) restent sur le Master en décor commun,
 * avec le logo, les images et les formes.
 */
export function withMasterPlaceholders(slides: IRSlide[], masterSlideId?: string): IRSlide[] {
  const master = slides.find((s) => s.sourceNodeId === masterSlideId);
  if (!master) return slides;
  const shared = master.elements.filter((el): el is IRText => el.kind === 'text' && el.content.trim().length > 0 && !isFixedMasterText(el.content));
  if (shared.length === 0) return slides;
  return slides.map((s) => {
    if (s === master) return { ...s, elements: s.elements.filter((el) => !shared.includes(el as IRText)) };
    const k = s.frameSize.width / master.frameSize.width;
    const copies = shared.map((el): IRText => ({
      ...el,
      id: `${el.id}_${s.sourceNodeId}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      rect: { x: el.rect.x * k, y: el.rect.y * k, w: el.rect.w * k, h: el.rect.h * k },
      runs: el.runs.map((run) => ({ ...run, fontSizePx: run.fontSizePx * k })),
      // Un texte libre : il prend un placeholder de sous-titre, sans puces.
      placeholder: { role: 'CUSTOM', label: el.content.trim().slice(0, 40) },
    }));
    return { ...s, elements: [...copies, ...s.elements] };
  });
}

/**
 * Choisit un layout distinct par frame : celui qui sert le plus de textes à
 * rôle, puis le plus de textes sans puces, puis celui qui a le
 * moins de placeholders en trop. Les frames qui demandent le plus passent
 * d'abord (seuls deux layouts prédéfinis ont un sous-titre). La frame
 * Master n'en prend aucun : elle est écrite sur le Master (`mapMasterBatch`).
 */
export function planTemplateLayouts(slides: IRSlide[], layouts: NativeLayout[], masterSlideId?: string): Record<string, LayoutAssignment> {
  const plan: Record<string, LayoutAssignment> = {};
  const free = [...layouts];
  slides = withMasterPlaceholders(slides, masterSlideId);
  const demand = (s: IRSlide) => s.elements.filter((el) => nativeRole(el)).length;
  const ordered = slides.filter((s) => s.sourceNodeId !== masterSlideId).sort((a, b) => demand(b) - demand(a) || a.order - b.order);

  for (const slide of ordered) {
    let best: { layout: NativeLayout; match: Match } | undefined;
    for (const layout of free) {
      const match = matchPlaceholders(slide, layout);
      if (
        !best ||
        match.matched > best.match.matched ||
        (match.matched === best.match.matched && (match.exact > best.match.exact || (match.exact === best.match.exact && match.unused.length < best.match.unused.length)))
      ) {
        best = { layout, match };
      }
    }
    if (!best) continue;
    free.splice(free.indexOf(best.layout), 1);
    plan[slide.sourceNodeId] = {
      layoutId: best.layout.objectId,
      layoutName: best.layout.name,
      placeholderByElementId: best.match.placeholderByElementId,
      duplicates: best.match.duplicates,
      unusedPlaceholderIds: best.match.unused,
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
      // Certains placeholders prédéfinis ont un fond (17 octobre : un
      // grand aplat gris derrière le titre de la slide orange) : la zone de
      // texte Figma n'en a jamais.
      const { shapeProperties, fields } = req.updateShapeProperties;
      out.push({
        updateShapeProperties: {
          objectId: slot.objectId,
          shapeProperties: { ...shapeProperties, shapeBackgroundFill: { propertyState: 'NOT_RENDERED' } },
          fields: `${fields},shapeBackgroundFill.propertyState`,
        },
      });
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

/** Écart gardé entre une boîte élargie et son voisin, en px Figma. */
const WIDEN_GAP_PX = 16;

/**
 * Un texte Figma en largeur auto (hug) colle pile à son contenu. Sur un
 * placeholder, Slides affiche à la place son invite ("Cliquez ici pour
 * modifier le style du titre du thème"), bien plus longue, qui se coupait
 * mot à mot dans une boîte taillée pour "87%". Slides ne sait pas élargir
 * une zone de texte d'après son contenu (et l'API ne règle que l'autofit
 * NONE) : la boîte prend donc d'emblée toute la largeur disponible, en
 * gardant le bord d'alignement du texte. Elle s'arrête avant le texte
 * voisin sur la même bande (trois cartes côte à côte), sinon à la marge de
 * la frame (la plus petite marge de ses textes, à gauche comme à droite).
 * Le texte lui-même ne bouge pas.
 */
export function widenForPrompt(el: IRText, frameWidth: number, others: IRText[] = []): IRText {
  if (!el.tightFit || el.rotation !== 0) return el;
  const { x, y, w, h } = el.rect;
  if (x < 0 || x + w > frameWidth) return el;
  const margin = Math.min(...[el, ...others].flatMap((o) => [o.rect.x, frameWidth - o.rect.x - o.rect.w]).filter((m) => m >= 0));
  const sameBand = others.filter((o) => o !== el && o.rect.y < y + h && o.rect.y + o.rect.h > y);
  const rightLimit = Math.min(frameWidth - margin, ...sameBand.filter((o) => o.rect.x >= x + w).map((o) => o.rect.x - WIDEN_GAP_PX));
  const leftLimit = Math.max(margin, ...sameBand.filter((o) => o.rect.x + o.rect.w <= x).map((o) => o.rect.x + o.rect.w + WIDEN_GAP_PX));
  const align = el.paragraphs[0]?.align ?? 'START';
  let nx = x;
  let nw = w;
  if (align === 'CENTER') {
    const half = Math.min(x + w / 2 - leftLimit, rightLimit - (x + w / 2));
    nx = x + w / 2 - half;
    nw = 2 * half;
  } else if (align === 'END') {
    nx = leftLimit;
    nw = x + w - leftLimit;
  } else {
    nw = rightLimit - x;
  }
  if (nw <= w) return el;
  return { ...el, tightFit: false, rect: { ...el.rect, x: nx, w: nw } };
}

/**
 * Un rectangle plein qui couvre toute la frame, sous tout le reste, est un
 * fond : posé sur le layout, il passerait par-dessus le décor du Master
 * (17 octobre, logo du Master caché). Il devient le fond de la page.
 */
export function absorbFullBleedBackground(slide: IRSlide): { background: IRSlide['background']; elements: IRElement[] } {
  const { width, height } = slide.frameSize;
  let background = slide.background;
  let i = 0;
  for (; i < slide.elements.length; i++) {
    const el = slide.elements[i];
    if (el.kind !== 'shape' || el.placeholder || el.stroke || !el.fill || el.rotation !== 0) break;
    if (el.shapeType !== 'RECTANGLE' && el.shapeType !== 'TEXT_BOX') break;
    if (el.fill.color.a * el.opacity < 0.99) break;
    const { x, y, w, h } = el.rect;
    if (x > 1 || y > 1 || x + w < width - 1 || y + h < height - 1) break;
    background = { ...el.fill, color: { ...el.fill.color, a: 1 } };
  }
  return { background, elements: slide.elements.slice(i) };
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
  const { background, elements } = absorbFullBleedBackground(slide);
  const texts = elements.filter((el): el is IRText => el.kind === 'text');

  if (background) {
    requests.push({
      updatePageProperties: {
        objectId: layoutId,
        pageProperties: { pageBackgroundFill: { solidFill: toSolidFill(background.color) } },
        fields: 'pageBackgroundFill',
      },
    });
  }

  // Les copies d'abord : elles partent de leur source avant que celle-ci
  // soit déplacée, et sont ensuite restylées comme les autres.
  for (const dup of assignment.duplicates ?? []) {
    const source = slotById.get(dup.sourceId);
    if (!source) continue;
    requests.push({ duplicateObject: { objectId: dup.sourceId, objectIds: { [dup.sourceId]: dup.objectId } } });
    slotById.set(dup.objectId, { ...source, objectId: dup.objectId });
  }

  // Textes à rôle : sur leur placeholder. Tout le reste est le décor du
  // layout, repris par chaque nouvelle slide (images et logos compris,
  // Slides n'ayant pas de placeholder d'image). Un texte à rôle sans
  // placeholder (layout sans titre ni corps) va sur la slide.
  const onSlide: IRElement[] = [];
  const filled: { slotId: string; content: string; bulleted: boolean; styles: SlidesRequest[] }[] = [];
  const placed: string[] = [];
  for (const el of elements) {
    const slotId = assignment.placeholderByElementId[el.id];
    const slot = slotId ? slotById.get(slotId) : undefined;
    if (slot && el.kind === 'text') {
      const onSlot = textOntoPlaceholder(mapText(widenForPrompt(el, slide.frameSize.width, texts), layoutId, scale, offsetXPt, offsetYPt, calibration), slot);
      requests.push(...onSlot);
      placed.push(slot.objectId);
      const styles = onSlot.filter((q) => 'updateTextStyle' in q || 'updateParagraphStyle' in q);
      filled.push({ slotId: slot.objectId, content: el.content, bulleted: slot.type === 'BODY', styles });
      continue;
    }
    if (el.placeholder && el.kind === 'text') {
      onSlide.push(el);
      continue;
    }
    requests.push(...mapElement(el, layoutId, scale, offsetXPt, offsetYPt, resolveAssetUrl, calibration));
    if (el.placeholder) requests.push({ updatePageElementAltText: mapPlaceholderAltText(el.id, el.placeholder) });
  }
  // Les placeholders existaient avant tout le reste : sans ça, une carte
  // ou un aplat créé ensuite passerait par-dessus leur texte.
  if (placed.length > 0) requests.push({ updatePageElementsZOrder: { pageElementObjectIds: placed, operation: 'BRING_TO_FRONT' } });

  for (const objectId of assignment.unusedPlaceholderIds) requests.push({ deleteObject: { objectId } });

  const pageObjectId = `f2s_page_${slide.sourceNodeId}`;
  const slideIdOf = (layoutPlaceholderObjectId: string) => `${layoutPlaceholderObjectId}_s`.replace(/[^a-zA-Z0-9_-]/g, '_');
  requests.push({
    createSlide: {
      objectId: pageObjectId,
      slideLayoutReference: { layoutId },
      placeholderIdMappings: Object.values(assignment.placeholderByElementId).map((layoutPlaceholderObjectId) => ({
        layoutPlaceholderObjectId,
        objectId: slideIdOf(layoutPlaceholderObjectId),
      })),
    },
  });

  // La slide d'exemple montre le texte d'exemple, pas l'invite de Google
  // ("Cliquez ici pour ajouter un titre") : écrire dans un placeholder de
  // SLIDE est permis, le style vient du layout.
  // Les puces d'un corps, elles, ne se retirent que sur la slide.
  // Le style est réécrit sur la slide aussi : un texte inséré n'hérite pas
  // toujours de celui posé sur l'invite du layout (17 octobre, couleur
  // perdue sur des sous-titres).
  for (const { slotId, content, bulleted, styles } of filled) {
    if (content.length === 0) continue;
    const objectId = slideIdOf(slotId);
    requests.push({ insertText: { objectId, text: content, insertionIndex: 0 } });
    for (const q of styles) {
      if ('updateTextStyle' in q) requests.push({ updateTextStyle: { ...q.updateTextStyle, objectId } });
      else if ('updateParagraphStyle' in q) requests.push({ updateParagraphStyle: { ...q.updateParagraphStyle, objectId } });
    }
    if (bulleted) requests.push({ deleteParagraphBullets: { objectId: slideIdOf(slotId), textRange: { type: 'ALL' } } });
  }

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

/** Écart entre la slide et un placeholder caché du Master, au-dessus d'elle. */
const HIDDEN_PLACEHOLDER_GAP_PT = 100;

/**
 * Le titre et le corps par défaut du Master ne se suppriment pas : les
 * placeholders des layouts en héritent, et les supprimer leur fait perdre
 * leur style (17 octobre, sous-titres repassés en noir). Ils gardent leur
 * taille (réduits à 1 pt de large, les 9 niveaux du corps s'écrivaient une
 * lettre par ligne), passent en texte de 1 pt et sortent au-dessus de la
 * slide. Les placeholders des layouts ont leur propre position et leur
 * propre style : rien ne change pour eux.
 */
function hidePlaceholder(slot: LayoutPlaceholder): SlidesRequest[] {
  return [
    {
      updatePageElementTransform: {
        objectId: slot.objectId,
        applyMode: 'ABSOLUTE',
        transform: {
          scaleX: 1,
          shearY: 0,
          shearX: 0,
          scaleY: 1,
          translateX: 0,
          translateY: roundForSerialization(-(slot.heightEmu / EMU_PER_PT) - HIDDEN_PLACEHOLDER_GAP_PT),
          unit: 'PT',
        },
      },
    },
    { updateTextStyle: { objectId: slot.objectId, textRange: { type: 'ALL' }, style: { fontSize: { magnitude: 1, unit: 'PT' } }, fields: 'fontSize' } },
  ];
}

/**
 * Frame Master (la première du rail) : son fond et tous ses éléments sont
 * écrits sur la page Master, comme décor. Slides les peint sur chaque
 * layout et chaque slide, entre le fond de la page et son contenu ; aucune
 * slide n'est créée pour elle. Ses textes (hors mentions légales) n'y sont
 * plus : ils sont recopiés en placeholders dans chaque layout
 * (`withMasterPlaceholders`),
 * car un placeholder du Master ne s'affiche sur aucune slide (17 octobre,
 * un `[[title]]` posé sur un surtitre disparaissait). Son titre et son
 * corps par défaut sont toujours cachés.
 */
export function mapMasterBatch(
  slide: IRSlide,
  doc: IRDocument,
  masterObjectId: string,
  resolveAssetUrl: (assetKey: string) => string,
  calibration: CalibrationData,
  masterTitle?: LayoutPlaceholder,
  masterBody?: LayoutPlaceholder,
): RequestBatch {
  const { scale, offsetXPt, offsetYPt } = computeScale(slide.frameSize, doc.slideSize);
  const requests: SlidesRequest[] = [];
  const { background, elements } = absorbFullBleedBackground(slide);
  if (background) {
    requests.push({
      updatePageProperties: {
        objectId: masterObjectId,
        pageProperties: { pageBackgroundFill: { solidFill: toSolidFill(background.color) } },
        fields: 'pageBackgroundFill',
      },
    });
  }
  for (const el of elements) requests.push(...mapElement(el, masterObjectId, scale, offsetXPt, offsetYPt, resolveAssetUrl, calibration));
  for (const slot of [masterTitle, masterBody]) if (slot) requests.push(...hidePlaceholder(slot));
  return { sourceSlideId: slide.sourceNodeId, requests };
}
