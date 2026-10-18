/**
 * Visuels de la page Figma Community du plugin : la couverture et le
 * carrousel, en 1920x1080 (le format que Figma recommande pour les deux).
 *
 * Même parti pris que les cards du site (routes/featureScenes.ts) : chaque
 * visuel défend UN point, avec un recadrage serré de l'écran qui le prouve,
 * et une colonne de texte qui le nomme (surtitre, titre, une phrase). Les
 * titres et les phrases sont ceux du site, pour que la page Community et la
 * landing disent la même chose avec les mêmes mots.
 *
 * Deux différences avec le site :
 * - le plugin n'est PAS redessiné : c'est le vrai (packages/plugin/dist/
 *   ui.html), chargé dans une iframe et piloté par render.ts avec les
 *   messages que code.ts lui enverrait (frames ajoutées, sélection du
 *   canvas, export en cours). Une évolution de l'UI se retrouve donc dans
 *   les visuels au prochain rendu, sans rien recopier ;
 * - les slides sont les vraies slides d'exemple du deck Trailworn
 *   (assets/mockup slides/), pas le faux deck simplifié du site.
 *
 * Le canvas Figma et l'éditeur Google Slides, eux, sont reconstitués comme
 * une capture : leurs couleurs sont celles de ces applications, hors DA.
 *
 * Tailles : la DA est pensée pour un écran, ces visuels pour une vignette.
 * Comme l'image OG (og/ogTemplate.ts), titres et textes sont posés plus
 * grands que l'échelle --b-text-* : la page Community les affiche réduits
 * de moitié environ, tout ce qui passe sous ~28px n'y serait qu'une texture.
 */
import { DESIGN_TOKENS_CSS } from '../generated/designTokens.js';
import { CABINET_GROTESK_BASE64 } from '../routes/fontData.js';
import { DECKER_MARK_SVG, escapeHtml } from '../routes/brand.js';
import { CHROME, SLIDES_ICON } from '../routes/heroDemo.js';
import { DECK, TRAILWORN, slide, slideUrl, type DeckSlide } from './deck.js';
// Le parseur de tags du plugin lui-même : un rôle posé ici se lit comme
// code.ts le relirait sur le calque renommé.
import { parsePlaceholderTag, setPlaceholderTag } from '../../../plugin/src/serialize/placeholder.js';

/* ---------- Ce que render.ts fournit aux scènes ---------- */

/** Le strict nécessaire de Playwright (pas une dépendance du dépôt, voir render.ts). */
export interface PluginFrame {
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  click(selector: string, options?: { force?: boolean }): Promise<void>;
  hover(selector: string, options?: { force?: boolean }): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  waitForSelector(selector: string, options?: { state?: 'visible' | 'attached' }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
}

export interface SceneContext {
  /** L'iframe du plugin `name` (attribut data-plugin), une fois l'UI montée. */
  plugin(name?: string): Promise<PluginFrame>;
  /** Pose le pointeur de la scène sur l'élément `selector` du plugin. */
  pointAt(selector: string, name?: string): Promise<void>;
}

export interface Scene {
  /** Nom du PNG dans assets/community/. */
  file: string;
  /** Texte alternatif, à recopier dans la description Community si besoin. */
  alt: string;
  html: string;
  /** Met le plugin dans l'état à montrer, avant la capture. */
  drive?(ctx: SceneContext): Promise<void>;
}

/* ---------- Pilotage du plugin ---------- */

const send = (f: PluginFrame, msg: Record<string, unknown>) =>
  f.evaluate((m) => window.postMessage({ pluginMessage: m }, '*'), msg);

/**
 * Clic dans le plugin sans faire défiler la scène : le click() de
 * Playwright amène d'abord l'élément à l'écran, ce qui décale la fenêtre
 * dans son cadre quand le bouton est hors champ.
 */
const press = (f: PluginFrame, selector: string) =>
  f.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) throw new Error(`introuvable dans le plugin : ${sel}`);
    el.focus();
    el.click();
  }, selector);

/** Session Google déjà restaurée : pas d'écran de connexion. */
const signIn = (f: PluginFrame) => send(f, { type: 'session-token-restored', token: 'community-render-session' });

/** Une police du deck (bandeau Fonts) : sa famille dans Figma, et celle utilisée dans Slides. */
interface FontSubstitution {
  original: string;
  resolved: string;
  available?: boolean;
}

const FONTS: FontSubstitution[] = [{ original: 'Inter', resolved: 'Inter', available: true }];

/** Les frames du deck ajoutées au mode Deck, dans l'ordre. */
async function addDeckFrames(f: PluginFrame, slides: DeckSlide[], fonts = FONTS): Promise<void> {
  for (const s of slides) {
    await send(f, {
      type: 'candidate-added',
      frame: { id: s.id, name: s.name, width: 1920, height: 1080 },
      previewDataUrl: slideUrl(s),
      nativeCount: s.native,
      rasterCount: 0,
      warnings: [],
      fontSubstitutions: fonts,
    });
  }
}

/** Texte d'un layout, avec ce que templateSummary.ts en mesure. */
const text = (id: string, name: string, fontSizePx: number, y: number, stat = false) => ({
  id,
  sourceNodeId: id,
  name,
  kind: 'text',
  text: { fontSizePx, chars: name.length, paragraphs: 1, y, stat },
});
const image = (id: string, name: string) => ({ id, sourceNodeId: id, name, kind: 'image' });
const shape = (id: string, name: string) => ({ id, sourceNodeId: id, name, kind: 'shape' });

const usage = (o: Partial<Record<'frame' | 'text' | 'link' | 'background' | 'fill' | 'stroke', number>>) => ({
  frame: 0, text: 0, link: 0, background: 0, fill: 0, stroke: 0, ...o,
});

/**
 * Les layouts du template Trailworn : les vraies slides, telles qu'on les
 * ajoute au mode Templates. Leurs calques sont nommés comme Figma nomme un
 * texte (d'après son contenu), et rien n'est encore tagué : c'est
 * « Suggest roles » qui propose titre, sous-titre, corps et image.
 */
const TEMPLATE = [
  {
    slide: slide('01-intro'),
    name: 'Cover',
    elements: [
      text('c:1', 'ANNUAL REPORT', 14, 80),
      text('c:2', 'Built for the long run.', 72, 150),
      text('c:3', 'How Trailworn earned trust one repair at a time.', 22, 255),
      image('c:4', 'Trail photo'),
      text('c:5', 'TRAILWORN', 14, 925),
      text('c:6', '2026', 14, 925),
    ],
    colors: [
      { hex: TRAILWORN.forest, alpha: 1, usageCount: 2, usage: usage({ frame: 1, background: 1 }) },
      { hex: TRAILWORN.white, alpha: 1, usageCount: 3, usage: usage({ text: 3 }) },
      { hex: TRAILWORN.sand, alpha: 1, usageCount: 2, usage: usage({ text: 2 }) },
    ],
  },
  {
    slide: slide('02-pillars'),
    name: 'Three pillars',
    elements: [
      text('p:1', 'HOW THE BRAND HOLDS TOGETHER', 18, 122),
      text('p:2', 'Three pillars, one promise', 80, 190),
      text('p:3', 'Purpose', 36, 418),
      text('p:4', 'Give people a reason to choose better, not just cheaper', 24, 470),
      text('p:5', 'Product', 36, 434),
      text('p:6', 'Built to be repaired, not replaced', 24, 486),
      text('p:7', 'Planet', 36, 414),
      text('p:8', 'Every material weighed against its footprint.', 24, 464),
      shape('p:9', 'Mountains'),
    ],
    colors: [
      { hex: TRAILWORN.sand, alpha: 1, usageCount: 1, usage: usage({ frame: 1 }) },
      { hex: TRAILWORN.night, alpha: 1, usageCount: 4, usage: usage({ text: 4 }) },
      { hex: TRAILWORN.clay, alpha: 1, usageCount: 5, usage: usage({ text: 1, fill: 4 }) },
      { hex: TRAILWORN.forest, alpha: 1, usageCount: 3, usage: usage({ fill: 3 }) },
    ],
  },
  {
    slide: slide('04-stat-87'),
    name: 'Key figure',
    elements: [
      text('k:1', 'WHY IT WORKS', 18, 122),
      text('k:2', '87%', 240, 190, true),
      text('k:3', 'of our customers said they’d pay more for gear they could repair on their own.', 36, 448),
      text('k:4', 'Based on internal survey 2026', 24, 936),
    ],
    colors: [
      { hex: TRAILWORN.clay, alpha: 1, usageCount: 1, usage: usage({ frame: 1 }) },
      { hex: TRAILWORN.sand, alpha: 1, usageCount: 4, usage: usage({ text: 4 }) },
    ],
  },
  {
    slide: slide('08-quote'),
    name: 'Quote',
    elements: [
      text('q:1', 'IN THEIR WORDS', 18, 120),
      text('q:2', '"We used to replace gear that could’ve been mended. Now every repair ships back out the same week."', 48, 200),
      text('q:3', 'Amara Reyes', 16, 455),
      text('q:4', 'Field technician, 12 years', 16, 455),
    ],
    colors: [
      { hex: TRAILWORN.clay, alpha: 1, usageCount: 1, usage: usage({ frame: 1 }) },
      { hex: TRAILWORN.sand, alpha: 1, usageCount: 4, usage: usage({ text: 4 }) },
    ],
  },
  {
    slide: slide('09-conclusion'),
    name: 'Closing',
    elements: [
      text('e:1', 'THANK YOU', 14, 80),
      text('e:2', 'See you on the next trail.', 56, 130),
      text('e:3', 'Questions or repair stories of your own? hello@trailworn.co', 22, 205),
      image('e:4', 'Dolomites photo'),
    ],
    colors: [
      { hex: TRAILWORN.forest, alpha: 1, usageCount: 1, usage: usage({ background: 1 }) },
      { hex: TRAILWORN.white, alpha: 1, usageCount: 2, usage: usage({ text: 2 }) },
    ],
  },
];

type Layout = (typeof TEMPLATE)[number];

const layoutMessage = (type: string, l: Layout, roles: Record<string, string> = {}) => ({
  type,
  frame: { id: l.slide.id, name: l.name, width: 1920, height: 1080 },
  previewDataUrl: slideUrl(l.slide),
  warnings: [],
  blocking: false,
  // Comme code.ts : le calque est renommé avec son tag, puis relu.
  elements: l.elements.map((e) => {
    const tag = roles[e.sourceNodeId] as Parameters<typeof setPlaceholderTag>[1] | undefined;
    if (!tag) return e;
    const name = setPlaceholderTag(e.name, tag);
    const placeholder = parsePlaceholderTag(name);
    return { ...e, name, role: placeholder?.role, label: placeholder?.label };
  }),
  colors: l.colors,
  fonts: [{ family: 'Inter', weights: [400, 500, 700] }],
  fontSubstitutions: FONTS,
});

async function addTemplateLayouts(f: PluginFrame): Promise<void> {
  for (const l of TEMPLATE) await send(f, layoutMessage('template-candidate-added', l));
}

/**
 * Suggest roles du layout n : le plugin demande à code.ts de taguer chaque
 * calque (`set-placeholder-role`), code.ts renvoie le layout re-validé. On
 * tient ici le rôle de code.ts : les demandes sont relevées au passage vers
 * la page parente, puis le layout revient avec ses rôles.
 */
async function suggestRoles(f: PluginFrame, n: number): Promise<void> {
  await f.evaluate(() => {
    const w = window as unknown as { __roles: { sourceNodeId: string; tag: string }[] };
    w.__roles = [];
    const forward = window.parent.postMessage.bind(window.parent);
    window.parent.postMessage = ((m: { pluginMessage?: { type?: string; sourceNodeId: string; tag: string } }, target: string) => {
      if (m?.pluginMessage?.type === 'set-placeholder-role') w.__roles.push(m.pluginMessage);
      return forward(m, target);
    }) as typeof window.parent.postMessage;
  }, undefined);
  await press(f, '.f2s-tmpl-panel .f2s-section-head .f2s-btn--ghost:not(:disabled)');
  const asked = await f.evaluate(() => (window as unknown as { __roles: { sourceNodeId: string; tag: string }[] }).__roles, undefined);
  const roles = Object.fromEntries(asked.map((r) => [r.sourceNodeId, r.tag]));
  await send(f, layoutMessage('template-candidate-updated', TEMPLATE[n], roles));
}

/** Ouvre le mode Templates et y ajoute les layouts du template Trailworn. */
async function openTemplates(f: PluginFrame): Promise<void> {
  await press(f, '.f2s-tab:nth-child(2)');
  await f.waitForSelector('.f2s-style-aside');
  await addTemplateLayouts(f);
  await f.waitForSelector('.f2s-sidebar-item');
}

/** Affiche le layout n (0-based) du rail. */
const showRailItem = (f: PluginFrame, n: number) => press(f, `.f2s-sidebar-item:nth-child(${n + 1}) .f2s-frame-preview`);

/* ---------- Habillage commun ---------- */

const MARK = DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const BRAND = `<div class="brand"><svg class="brand__mark" viewBox="2 4 27 25" shape-rendering="crispEdges" aria-hidden="true">${MARK}</svg><span>Decker</span></div>`;

/** Pointeur de souris posé en (x, y), sa pointe sur ce point. */
const cursorAt = (x: number, y: number) =>
  `<svg class="cursor" style="left:${x - 6}px;top:${y - 3}px" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.6 L12.2 14.2 L19 14 Z" fill="var(--b-ink)" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

/**
 * Fenêtre de plugin Figma : barre de titre de Figma (sauf `bare`), puis le
 * vrai plugin dans une iframe à sa taille réelle. `scale` agrandit le tout
 * comme une capture zoomée.
 */
function pluginWindow(o: { name?: string; x: number; y: number; w?: number; h?: number; scale?: number; bare?: boolean; cls?: string }, pluginHtml: string): string {
  const w = o.w ?? 1200;
  const h = o.h ?? 760;
  const bar = o.bare ? '' : `<div class="pwin__bar"><svg viewBox="2 4 27 25" shape-rendering="crispEdges" aria-hidden="true">${MARK}</svg><span>Decker</span><svg class="pwin__x" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.3"/></svg></div>`;
  return `<div class="pwin${o.bare ? ' pwin--bare' : ''} ${o.cls ?? ''}" style="left:${o.x}px;top:${o.y}px;transform:scale(${o.scale ?? 1})">${bar}<iframe data-plugin="${o.name ?? 'main'}" style="width:${w}px;height:${h}px" srcdoc="${pluginHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></div>`;
}

const copy = (eyebrow: string, title: string, desc: string) =>
  `<div class="copy"><p class="eyebrow">${eyebrow}</p><h1 class="title">${title}</h1><p class="desc">${desc}</p></div>`;

const page = (body: string, cls = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${CSS}</style>
</head>
<body class="${cls}">${body}</body>
</html>`;

/* ---------- Canvas Figma et éditeur Google Slides ---------- */

const img = (s: DeckSlide, cls = '') => `<img class="slide ${cls}" src="${slideUrl(s)}" alt="" />`;

/** Une frame du canvas Figma : son nom au-dessus, sélectionnée ou non. */
const canvasFrame = (s: DeckSlide, x: number, y: number, w: number, selected: boolean) =>
  `<div class="cframe${selected ? ' is-selected' : ''}" style="left:${x}px;top:${y}px;width:${w}px"><span class="cframe__name">${escapeHtml(s.name)}</span><div class="cframe__box">${img(s)}${selected ? '<i></i><i></i><i></i><i></i>' : ''}</div></div>`;

const G_MENU = ['File', 'Edit', 'View', 'Insert', 'Format', 'Slide', 'Arrange', 'Tools', 'Extensions', 'Help'];
const G_CARET = '<i class="gs__caret"></i>';

/** L'éditeur Google Slides, le deck exporté ouvert, la slide `current` affichée. */
function googleSlides(current: DeckSlide, o: { tools: string; overlay?: string }): string {
  return `<div class="gs">
    <div class="gs__head"><span class="gs__logo">${SLIDES_ICON}</span><div><div class="gs__title">Trailworn deck</div><div class="gs__menu">${G_MENU.map((m) => `<span>${m}</span>`).join('')}</div></div><span class="gs__share">Share</span></div>
    <div class="gs__tools">${o.tools}</div>
    <div class="gs__body">
      <div class="gs__film">${DECK.map((s, i) => `<span class="gs__thumb${s === current ? ' is-current' : ''}"><b>${i + 1}</b>${img(s)}</span>`).join('')}</div>
      <div class="gs__main"><div class="gs__slide">${img(current)}${o.overlay ?? ''}</div><div class="gs__notes">Click to add speaker notes</div></div>
    </div>
  </div>`;
}

/* ---------- Styles ---------- */

const CSS = `
@font-face {
  font-family: "Cabinet Grotesk";
  src: url("data:font/woff2;base64,${CABINET_GROTESK_BASE64}") format("woff2-variations");
  font-weight: 400 900;
  font-style: normal;
}

${DESIGN_TOKENS_CSS}

:root {
  /* Biseaux 95 du site (routes/marketingStyles.ts) : panneau en creux. */
  --hyb-hi: rgba(255, 255, 255, 0.9);
  --hyb-lo: rgba(18, 15, 13, 0.18);
  --hyb-lo-strong: rgba(18, 15, 13, 0.43);
  --hyb-in: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo), inset -2px -2px var(--hyb-hi), inset 2px 2px var(--hyb-lo-strong);
  /* Polices de Figma et de Google Slides, comme dans une capture. */
  --app-font: Inter, "Helvetica Neue", Arial, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: clip;
  font-family: var(--b-font-sans);
  color: var(--b-ink);
  background: var(--b-surface);
  -webkit-font-smoothing: antialiased;
}

/* Lockup du header du site, à l'échelle du visuel. */
.brand {
  position: absolute; left: 112px; top: 96px; z-index: 5;
  display: flex; align-items: center; gap: 14px;
  font-size: 40px; font-weight: var(--b-font-bold); letter-spacing: var(--b-tracking-tight); line-height: 1;
}
.brand__mark { height: 40px; width: auto; aspect-ratio: 27 / 25; flex: none; display: block; translate: 0 -1px; }

/* Colonne de texte : surtitre, titre, une phrase. Centrée sur la hauteur. */
.copy {
  position: absolute; left: 112px; top: 0; bottom: 0; width: 600px;
  display: flex; flex-direction: column; justify-content: center;
}
.eyebrow {
  font-size: 24px; font-weight: var(--b-font-semibold); line-height: 1;
  letter-spacing: var(--b-tracking-wide); text-transform: uppercase; color: var(--b-text-faint);
}
.title {
  margin-top: 28px;
  font-size: 88px; font-weight: var(--b-font-bold); line-height: var(--b-leading-none);
  letter-spacing: var(--b-tracking-tighter); text-wrap: balance;
}
.desc {
  margin-top: 36px;
  font-size: 34px; font-weight: var(--b-font-medium); line-height: var(--b-leading-normal);
  color: var(--b-text-muted); text-wrap: pretty;
}

/* Scène : le puits en creux des cards du site, qui sort par la droite. */
.stage {
  position: absolute; left: 800px; top: 80px; bottom: 80px; right: 0;
  overflow: clip; background: var(--b-surface-muted);
}
.stage::after { content: ""; position: absolute; inset: 0; z-index: 30; box-shadow: var(--hyb-in); pointer-events: none; }

/* Fenêtre de plugin Figma */
.pwin {
  position: absolute; z-index: 10; transform-origin: 0 0;
  display: flex; flex-direction: column; overflow: clip;
  border-radius: 4px; background: var(--b-surface); box-shadow: ${CHROME.shadowWindow};
}
.pwin__bar {
  height: 40px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 14px;
  background: ${CHROME.bar}; color: ${CHROME.barText}; font: 500 13px/1 var(--app-font);
}
.pwin__bar svg { width: 15px; height: 15px; }
.pwin__bar .pwin__x { margin-left: auto; width: 16px; height: 16px; color: ${CHROME.barMuted}; }
.pwin iframe { display: block; border: 0; background: var(--b-surface); }
.pwin--bare { box-shadow: 0 0 0 1px rgba(18, 15, 13, 0.12), 0 2px 4px rgba(18, 15, 13, 0.04), 0 8px 28px rgba(18, 15, 13, 0.09); }

.cursor { position: absolute; z-index: 40; width: 34px; height: 34px; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25)); }

.slide { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }

/* Pastille du site (.pill), pour nommer une moitié de scène. */
.pill {
  position: absolute; z-index: 20;
  display: inline-flex; align-items: center; padding: 10px 18px;
  font-size: 24px; font-weight: var(--b-font-semibold); line-height: 1; white-space: nowrap;
  color: var(--b-ink); background: var(--b-surface); box-shadow: var(--hyb-in);
}

/* ---------- Canvas Figma ---------- */
.canvas { position: absolute; inset: 0; background: ${CHROME.canvas}; font-family: var(--app-font); }
.cframe { position: absolute; }
.cframe__name { display: block; margin-bottom: 8px; font-size: 15px; color: ${CHROME.label}; white-space: nowrap; }
.cframe__box { position: relative; }
.cframe.is-selected .cframe__name { color: ${CHROME.select}; }
.cframe.is-selected .cframe__box { outline: 2px solid ${CHROME.select}; }
.cframe__box i { position: absolute; width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; background: #fff; border: 1.5px solid ${CHROME.select}; }
.cframe__box i:nth-child(2) { left: 0; top: 0; } .cframe__box i:nth-child(3) { left: 100%; top: 0; }
.cframe__box i:nth-child(4) { left: 0; top: 100%; } .cframe__box i:nth-child(5) { left: 100%; top: 100%; }
.marquee { position: absolute; z-index: 5; border: 1.5px solid ${CHROME.select}; background: rgba(13, 153, 255, 0.08); }
.selsize {
  position: absolute; z-index: 6; padding: 5px 9px; border-radius: 4px;
  background: ${CHROME.select}; color: #fff; font: 600 15px/1 var(--app-font); white-space: nowrap;
}

/* ---------- Google Slides ---------- */
.gs { position: absolute; inset: 0; display: flex; flex-direction: column; background: #f9fbfd; font-family: var(--app-font); color: #1f1f1f; }
.gs__head { display: flex; align-items: center; gap: 14px; padding: 16px 24px 8px; }
.gs__logo svg { width: 44px; height: 44px; display: block; }
.gs__title { font-size: 24px; }
.gs__menu { display: flex; gap: 16px; margin-top: 6px; font-size: 17px; }
.gs__share { margin-left: auto; padding: 12px 26px; border-radius: 999px; background: #c2e7ff; font-size: 18px; font-weight: 500; }
.gs__tools {
  display: flex; align-items: center; gap: 6px; margin: 6px 16px 0; padding: 7px 14px; height: 52px;
  border-radius: 999px; background: #edf2fa; font-size: 18px; color: #444746; white-space: nowrap;
}
.gtool { display: inline-flex; align-items: center; height: 38px; padding: 0 12px; border-radius: 6px; }
.gtool--box { background: #fff; border: 1px solid #c7c7c7; color: #1f1f1f; }
.gtool--on { background: #d3e3fd; color: #041e49; }
.gsep { width: 1px; height: 26px; margin: 0 8px; background: #c7c7c7; }
.gs__caret { display: inline-block; width: 0; height: 0; margin-left: 10px; border: 5px solid transparent; border-top-color: currentColor; transform: translateY(3px); }
.gs__body { flex: 1 1 auto; min-height: 0; display: flex; }
.gs__film { width: 230px; flex: none; display: flex; flex-direction: column; gap: 18px; padding: 18px 16px 0 10px; overflow: hidden; }
.gs__thumb { display: flex; gap: 10px; font-size: 15px; color: #444746; }
.gs__thumb b { width: 18px; flex: none; font-weight: 400; text-align: right; }
.gs__thumb .slide { flex: 1 1 auto; min-width: 0; border-radius: 8px; outline: 1px solid #c7c7c7; }
.gs__thumb.is-current .slide { outline: 4px solid #fbbc04; outline-offset: -1px; }
.gs__main { flex: 1 1 auto; position: relative; padding: 36px 36px 0 40px; }
.gs__slide { position: relative; width: 100%; box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
/* Zone de texte sélectionnée dans Slides : cadre bleu, huit poignées. */
.gsel { position: absolute; border: 2px solid #1a73e8; }
.gsel i { position: absolute; width: 13px; height: 13px; margin: -6.5px 0 0 -6.5px; border: 2px solid #1a73e8; border-radius: 50%; background: #fff; }
.gsel i:nth-child(1) { left: 0; top: 0; } .gsel i:nth-child(2) { left: 50%; top: 0; } .gsel i:nth-child(3) { left: 100%; top: 0; }
.gsel i:nth-child(4) { left: 0; top: 50%; } .gsel i:nth-child(5) { left: 100%; top: 50%; }
.gsel i:nth-child(6) { left: 0; top: 100%; } .gsel i:nth-child(7) { left: 50%; top: 100%; } .gsel i:nth-child(8) { left: 100%; top: 100%; }
.gs__notes { margin-top: 28px; padding: 18px 20px; border-radius: 10px; background: #fff; font-size: 17px; color: #444746; }
.gcaret { position: absolute; width: 3px; background: #fff; }

/* ---------- Moitié Figma, moitié Slides ---------- */
.split { position: absolute; top: 0; bottom: 0; overflow: clip; font-family: var(--app-font); }
.split--figma { left: 0; width: 50%; background: ${CHROME.canvas}; }
.split--slides { left: 50%; right: 0; background: #f9fbfd; }
/* Même slide aux mêmes coordonnées de scène dans les deux moitiés : chacune
   n'en montre que sa part. */
.split__slide { position: absolute; top: 160px; width: 960px; }
.split--figma .split__slide { left: 80px; }
.split--slides .split__slide { left: calc(80px - 100%); }
.split--slides .slide { box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15); }
.split__line { position: absolute; z-index: 15; left: 50%; top: 0; bottom: 0; width: 3px; margin-left: -1.5px; background: var(--b-accent); }
.split__line i { position: absolute; left: 50%; top: 86%; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%; background: var(--b-accent); box-shadow: 0 0 0 5px var(--b-surface); }

/* ---------- Couverture ---------- */
.cover .brand { left: 96px; top: 72px; }
.cover__title {
  position: absolute; left: 96px; top: 160px; width: 1500px;
  font-size: 104px; font-weight: var(--b-font-bold); line-height: var(--b-leading-none);
  letter-spacing: var(--b-tracking-tighter); text-wrap: balance;
}
/* Forme orange de l'image OG : elle sort par le bas, 32px de chaque côté
   du plugin, et son haut passe sous lui. */
.cover__shape {
  position: absolute; left: 64px; right: 64px; top: 496px; bottom: 0;
  background: var(--b-accent); border-radius: 8px 8px 0 0;
}
`;

/* ---------- Les visuels ---------- */

export function scenes(pluginHtml: string): Scene[] {
  const plugin = (o: Parameters<typeof pluginWindow>[0]) => pluginWindow(o, pluginHtml);

  /* 0. Couverture : la promesse, et le plugin avec le deck Trailworn. */
  const cover: Scene = {
    file: '00-cover.png',
    alt: 'Decker: export editable, pixel perfect decks and templates. The Decker plugin with the nine slides of the Trailworn deck.',
    html: page(
      `${BRAND}<h1 class="cover__title">Export editable, pixel perfect decks and templates</h1>
      <div class="cover__shape"></div>
      ${plugin({ x: 96, y: 440, w: 1440, h: 690, scale: 1.2, bare: true })}`,
      'cover',
    ),
    async drive(ctx) {
      const f = await ctx.plugin();
      await signIn(f);
      await addDeckFrames(f, DECK);
    },
  };

  /* 1. Étape 1 : choisir ses frames sur le canvas. */
  const W = 316;
  const col = (i: number) => 72 + i * (W + 44);
  const pick: Scene = {
    file: '01-pick-frames.png',
    alt: 'Three Trailworn frames selected on the Figma canvas, and the Decker plugin ready to add them after the two already in its list.',
    html: page(
      `${BRAND}${copy('Step 1', 'Pick your frames', 'Select frames on the canvas, then add them to Decker in the order you want.')}
      <div class="stage"><div class="canvas">
        ${DECK.slice(0, 6).map((s, i) => canvasFrame(s, col(i % 3), i < 3 ? 56 : 300, W, i >= 3)).join('')}
        <span class="marquee" style="left:${col(0) - 24}px;top:278px;width:${col(2) + W - col(0) + 48}px;height:246px"></span>
        <span class="selsize" style="left:${col(1) + W / 2 - 40}px;top:532px">3 frames</span>
      </div>
      ${plugin({ x: 120, y: 600 })}
      ${cursorAt(1100, 680)}
      </div>`,
    ),
    async drive(ctx) {
      const f = await ctx.plugin();
      await signIn(f);
      await addDeckFrames(f, DECK.slice(0, 2));
      await send(f, { type: 'canvas-selection-changed', hasSelection: true, deckAddable: 3, templateAddable: 3 });
      await f.hover('.f2s-topbar-actions .f2s-btn:first-child');
      await ctx.pointAt('.f2s-topbar-actions .f2s-btn:first-child');
    },
  };

  /* 2. Étape 2 : la même slide, moitié Figma, moitié Slides, sans écart. */
  const chart = slide('06-chart');
  const matched: Scene = {
    file: '02-pixel-perfect.png',
    alt: 'The Trailworn repairs chart split in half, Figma on the left and Google Slides on the right, lining up exactly.',
    html: page(
      `${BRAND}${copy('Step 2', 'Matched, pixel for pixel', 'Every layer, font, and color becomes a native Slides object, right where it sat in Figma.')}
      <div class="stage stage--split">
        <div class="split split--figma"><div class="split__slide"><span class="cframe__name">${escapeHtml(chart.name)}</span>${img(chart)}</div></div>
        <div class="split split--slides"><div class="split__slide"><span class="cframe__name">&nbsp;</span>${img(chart)}</div></div>
        <span class="split__line"><i></i></span>
        <span class="pill" style="left:32px;top:32px">Figma</span>
        <span class="pill" style="right:32px;top:32px">Google Slides</span>
      </div>`,
    ),
  };

  /* 3. Fidelity : dans Slides, le titre est une vraie zone de texte. */
  const intro = slide('01-intro');
  const editable: Scene = {
    file: '03-editable.png',
    alt: 'The exported Trailworn deck in Google Slides: the cover title is a native text box, selected, with its font and size in the toolbar.',
    html: page(
      `${BRAND}${copy('Fidelity', 'Real Slides objects', 'Text, shapes, colors, and fonts arrive as native objects you can edit, never as a flat screenshot.')}
      <div class="stage">${googleSlides(intro, {
        tools: `<span class="gtool gtool--box">Inter${G_CARET}</span><span class="gsep"></span><span class="gtool">&minus;</span><span class="gtool gtool--box">40</span><span class="gtool">+</span><span class="gsep"></span><span class="gtool gtool--on"><b>B</b></span><span class="gtool"><i>I</i></span><span class="gtool"><u>U</u></span><span class="gtool">A</span><span class="gsep"></span><span class="gtool">Format options</span>`,
        overlay: `<span class="gsel" style="left:3.4%;top:12.6%;width:40.2%;height:10.6%"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="gcaret" style="left:42.1%;top:14.4%;height:7%"></span>`,
      })}</div>`,
    ),
  };

  /* 4. Full deck : tout le fichier part d'un coup, l'export est en cours. */
  const fullDeck: Scene = {
    file: '04-full-deck.png',
    alt: 'The Decker plugin exporting the nine Trailworn frames: three are already in Google Slides, the fourth is being generated.',
    html: page(
      `${BRAND}${copy('Full deck', 'Export a whole file', 'Send every frame to Slides as one real deck you can present, not one slide at a time.')}
      <div class="stage">${plugin({ x: 40, y: 92 })}</div>`,
    ),
    async drive(ctx) {
      const f = await ctx.plugin();
      await signIn(f);
      await addDeckFrames(f, DECK);
      await f.fill('.f2s-title-input', 'Trailworn annual report');
      // Comme dans Figma : le clic sur Export demande le document à code.ts,
      // qui répond par export-payload.
      await press(f, '.f2s-topbar-actions .f2s-btn--primary');
      await send(f, {
        type: 'export-payload',
        document: { title: 'Trailworn annual report', slides: DECK.map((s, i) => ({ id: s.id, sourceNodeId: s.id, order: i, elements: [] })) },
        assets: [],
      });
      await f.waitForSelector('.f2s-retro');
      await f.waitForTimeout(2600);
    },
  };

  /* 5. Fonts : chaque police se remplace par une police de Slides. */
  const fonts: Scene = {
    file: '05-fonts.png',
    alt: 'The Fonts bar of the Decker plugin with its font list open: Satoshi, which Google Slides does not have, is about to be swapped for Manrope.',
    html: page(
      `${BRAND}${copy('Fonts', 'Swap any font in one click', 'Pick from the fonts of Google Slides, and swap any font in the whole deck, even one Slides already has.')}
      <div class="stage">${plugin({ x: 24, y: -96, scale: 1.75 })}${cursorAt(0, 0)}</div>`,
    ),
    async drive(ctx) {
      const f = await ctx.plugin();
      await signIn(f);
      await addDeckFrames(f, DECK.slice(0, 4), [
        { original: 'Satoshi', resolved: 'Inter' },
        { original: 'Inter', resolved: 'Inter', available: true },
      ]);
      await press(f, '.f2s-font-select:first-of-type .f2s-font-combobox-input');
      await f.waitForSelector('[role="option"]');
      // L'option visée, marquée pour la retrouver, au milieu de la liste.
      await f.evaluate(() => {
        const o = Array.from(document.querySelectorAll('[role="option"]')).find((el) => el.textContent?.trim() === 'Manrope');
        if (!o) throw new Error('Manrope absente de la liste des polices');
        o.setAttribute('data-community-target', '');
        o.scrollIntoView({ block: 'center' });
      }, undefined);
      await f.hover('[data-community-target]');
      await ctx.pointAt('[data-community-target]');
    },
  };

  /* 6. Templates : les mêmes slides deviennent les layouts d'un template. */
  const template: Scene = {
    file: '06-template.png',
    alt: 'The Decker plugin in Templates mode: the Trailworn slides as layouts, the cover as Master, the Key figure layout with its title and body placeholders, and the deck colors mapped to theme roles.',
    html: page(
      `${BRAND}${copy('Templates', 'Export a template', 'Turn your frames into a Slides template you can reuse, with theme colors, fonts, layouts, and real placeholders.')}
      <div class="stage">${plugin({ x: 24, y: 56, w: 1096, h: 800 })}</div>`,
    ),
    async drive(ctx) {
      const f = await ctx.plugin();
      await signIn(f);
      await openTemplates(f);
      await f.fill('.f2s-title-input', 'Trailworn template');
      await showRailItem(f, 2);
      await f.waitForTimeout(200);
      await suggestRoles(f, 2);
      await press(f, '.f2s-style-panel .f2s-section-head .f2s-btn--ghost:not(:disabled)');
      await f.evaluate(() => document.querySelectorAll('.f2s-toast').forEach((t) => t.remove()), undefined);
    },
  };

  /* 7. Suggest roles : un clic, et le layout a ses placeholders. */
  const suggest: Scene = {
    file: '07-suggest-roles.png',
    alt: 'Suggest roles in the Decker plugin: the Three pillars layout gets its title, subtitles and body texts in one click.',
    html: page(
      `${BRAND}${copy('Templates', 'Suggested placeholders and colors', 'Decker reads each layout and suggests its placeholders and theme colors. Change any of them in one click.')}
      <div class="stage">${plugin({ x: -290, y: -180, w: 960, h: 1000, scale: 1.5 })}${cursorAt(0, 0)}</div>`,
    ),
    async drive(ctx) {
      const f = await ctx.plugin();
      await signIn(f);
      await openTemplates(f);
      await showRailItem(f, 1);
      await f.waitForTimeout(200);
      await press(f, '.f2s-style-panel .f2s-section-head .f2s-btn--ghost:not(:disabled)');
      await suggestRoles(f, 1);
      const btn = '.f2s-tmpl-panel .f2s-section-head .f2s-btn--ghost:last-child';
      await f.hover(btn, { force: true });
      await ctx.pointAt(btn);
    },
  };

  /* 8. Google : le compte connecté, et rien d'autre que le deck créé. */
  const account: Scene = {
    file: '08-google-access.png',
    alt: 'The Settings window of the Decker plugin, showing the Google account the export lands in.',
    html: page(
      `${BRAND}${copy('Google access', 'Only what the export needs', 'Decker only touches the deck it creates for you, shows which account is connected, and keeps nothing after the export.')}
      <div class="stage">${plugin({ x: -640, y: -380, scale: 2 })}</div>`,
    ),
    async drive(ctx) {
      const f = await ctx.plugin();
      await signIn(f);
      await addDeckFrames(f, DECK);
      await f.waitForTimeout(300);
      await press(f, '.f2s-footer-settings');
      await f.waitForSelector('[role="dialog"]');
    },
  };

  return [cover, pick, matched, editable, fullDeck, fonts, template, suggest, account];
}

