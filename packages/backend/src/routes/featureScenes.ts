/**
 * Visuels des cards de la landing : les six de "What Decker does" et les
 * trois de "How it works".
 *
 * Même parti pris que la démo du hero (heroDemo.ts) : de vraies interfaces,
 * pas des schémas. Chaque card montre un recadrage serré de l'écran qui prouve
 * ce qu'elle dit : le plugin (markup f2s-* et CSS du plugin, scopés sous
 * `.dm-plugin`), le canvas Figma ou l'éditeur Slides, avec le faux deck
 * Trailworn de la démo.
 *
 * Toutes les scènes ont le même format, le ratio 7/5 de `.card__media`,
 * mais pas la même échelle : chacune est dessinée à sa propre largeur puis
 * ramenée à celle de sa card par FEATURE_SCENES_JS, comme une capture. Une
 * scène qui a peu à montrer (la fiche à 0 $, la modale Settings) est dessinée
 * petite, donc affichée en grand ; une scène qui a besoin de contexte (le
 * plugin entier, l'éditeur Slides) est dessinée large, donc réduite, le texte
 * devient petit et c'est l'ensemble qui se lit. Elles sont inertes : rien n'y prend le focus, et le
 * lecteur d'écran n'en lit que l'aria-label.
 *
 * Le CSS du plugin et celui des slides viennent de HERO_DEMO_CSS, chargé sur
 * la même page.
 */
import { CHROME, DECK, DECKER_ICON, HILLS, ICONS, LIGHTS, SLIDES_ICON } from './heroDemo.js';

/** Jaune de l'icône d'un fichier Google Slides, comme une capture. */
const SLIDES_YELLOW = '#fbbc04';

type SlideKind = 'cover' | 'pillars' | 'stats';

/** Une slide du faux deck, comme slideHtml() dans la démo du hero. */
function slide(kind: SlideKind, opts: { layout?: boolean; editing?: boolean } = {}): string {
  if (opts.layout) {
    const label = { title: 'Click to add title', subtitle: 'Click to add subtitle', body: 'Click to add text' };
    const boxes: Record<SlideKind, [keyof typeof label, number, number, number, number][]> = {
      cover: [['title', 6, 7, 62, 12], ['subtitle', 6, 24.5, 40, 4]],
      pillars: [['title', 6, 7, 72, 8], ['body', 6, 21, 88, 24]],
      stats: [['title', 6, 4, 50, 23], ['body', 6, 39, 52, 10]],
    };
    const html = boxes[kind]
      .map(([role, x, y, w, h]) => `<span class="fs-ph" style="left:${x}cqw;top:${y}cqw;width:${w}cqw;height:${h}cqw">${label[role]}</span>`)
      .join('');
    return `<span class="dm-slide dm-slide--${kind}">${html}${kind === 'cover' ? HILLS : ''}</span>`;
  }
  const edit = opts.editing ? ' fs-textbox' : '';
  if (kind === 'cover') {
    return `<span class="dm-slide dm-slide--cover"><span class="dm-s__title${edit}">Built for the long run.</span><span class="dm-s__sub">Annual report &middot; Trailworn Inc.</span>${HILLS}</span>`;
  }
  if (kind === 'pillars') {
    const col = (n: string, h: string) =>
      `<span><span class="dm-s__num">${n}</span><span class="dm-s__head">${h}</span><span class="dm-s__line"></span><span class="dm-s__line" style="width:80%"></span><span class="dm-s__line" style="width:60%"></span></span>`;
    return `<span class="dm-slide dm-slide--pillars"><span class="dm-s__title${edit}">Three pillars, one promise</span><span class="dm-s__cols">${col('01', 'Craft')}${col('02', 'Speed')}${col('03', 'Care')}</span></span>`;
  }
  return `<span class="dm-slide dm-slide--stats"><span class="dm-s__big${edit}">87%</span><span class="dm-s__cap">of our clients keep every deck editable after the handoff.</span></span>`;
}

/**
 * Coque commune : un puits au ratio 7/5, la scène dedans. `width` est la
 * largeur à laquelle la scène est dessinée (sa hauteur en découle) : plus elle
 * est grande, plus la scène est réduite dans la card.
 */
const scene = (name: string, width: number, label: string, body: string): string =>
  `<div class="card__media fs fs--${name}" role="img" aria-label="${label}" data-fs="${width}"><div class="fs-stage" style="width:${width}px;height:${Math.round((width * 5) / 7)}px" inert aria-hidden="true">${body}</div></div>`;

/** Fenêtre du plugin dans Figma : barre sombre, puis le plugin lui-même. */
const pluginWindow = (cls: string, inner: string): string =>
  `<div class="fs-pwin ${cls}"><div class="dm-pwin__bar">${DECKER_ICON}<span>Decker</span><span class="dm-pwin__x">${ICONS.close}</span></div><div class="dm-plugin">${inner}</div></div>`;

const CURSOR = `<svg class="fs-cursor" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.6 L12.2 14.2 L19 14 Z" fill="var(--b-ink)" stroke="var(--b-white)" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const CHECK = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Une vignette du rail du plugin (ui.tsx), en mode Deck. */
function railItem(pos: number, kind: SlideKind, name: string, cls = ''): string {
  return `<div class="f2s-sidebar-item ${cls}"><div class="f2s-frame-preview${cls.includes('is-active') ? ' is-active' : ''}${cls.includes('is-exporting') ? ' is-exporting' : ''}">${slide(kind)}</div><div class="f2s-frame-info"><span class="f2s-frame-index">${pos}.</span><span class="f2s-frame-name">${name}</span><div class="f2s-frame-controls"><span class="f2s-icon-btn">&#10005;</span></div></div></div>`;
}

/** Une frame sélectionnée du canvas Figma, en petit. */
const canvasFrameMini = (name: string, kind: SlideKind) =>
  `<div class="fs-frame is-selected"><span class="fs-frame__name">${name}</span>${slide(kind)}</div>`;

/* ---------- What Decker does ---------- */

/** Pricing : la fiche du plugin, à zéro, sans palier payant. */
export const FEATURE_FREE_HTML = scene(
  'free',
  420,
  'Decker priced at $0 forever, with unlimited exports, decks and templates, and every feature included',
  `<div class="fs-price dm-plugin">
    <div class="fs-price__head">${DECKER_ICON}<span class="fs-price__name">Decker</span><span class="fs-price__tag">Figma plugin</span></div>
    <p class="fs-price__amount"><span class="f2s-tabular">$0</span><span class="fs-price__per">forever</span></p>
    <ul class="fs-price__list">
      <li>${CHECK}Unlimited exports</li>
      <li>${CHECK}Decks and templates</li>
      <li>${CHECK}Every feature, no trial</li>
    </ul>
    <div class="fs-price__foot"><span class="f2s-btn f2s-btn--primary">Run Decker</span><span class="f2s-coffee-link"><span class="f2s-coffee-label"><span>Buy me a coffee</span>${ICONS.arrow(9)}</span></span></div>
  </div>`,
);

/** Full deck : le rail du plugin plein, l'export en cours sur tout le fichier. */
export const FEATURE_FULL_DECK_HTML = scene(
  'deck',
  720,
  'The Decker plugin exporting a whole Figma file: twelve frames in its rail, slide 3 of 12 being generated',
  pluginWindow(
    'fs-pwin--deck',
    `<header class="f2s-topbar"><div class="f2s-topbar-left"><span class="f2s-toolbar-label">12 slides</span></div><div class="f2s-topbar-actions"><span class="f2s-btn f2s-btn--primary f2s-btn--busy f2s-tabular"><span class="f2s-btn-loading"><span class="f2s-spinner"></span>Exporting 3/12</span></span></div></header>
    <div class="f2s-body"><aside class="f2s-sidebar">${railItem(1, 'cover', 'Cover')}${railItem(2, 'pillars', 'Three pillars')}${railItem(3, 'stats', 'Stats', 'is-active is-exporting')}${railItem(4, 'cover', 'Roadmap')}${railItem(5, 'pillars', 'Team')}</aside>
    <main class="f2s-canvas"><div class="f2s-canvas-preview f2s-canvas-preview--retro"><div class="f2s-retro"><div class="f2s-retro-titlebar"><span class="f2s-retro-title">Exporting - Stats</span><span class="f2s-retro-window-buttons"><i>_</i><i>&#9633;</i><i>&#10005;</i></span></div><div class="f2s-retro-screen">${slide('stats')}<div class="f2s-retro-scanlines"></div></div><div class="f2s-retro-status"><span class="f2s-retro-status-text">Slide 3 of 12<span class="f2s-retro-ellipsis">...</span></span><div class="f2s-retro-bar"><div class="f2s-retro-bar-fill" style="--f2s-retro-progress:0.25"></div></div></div></div></div></main></div>`,
  ),
);

/** Templates : le mode Templates du plugin, Master en tête du rail, layout aux
    vrais placeholders et couleurs détectées, prêtes à mapper sur le thème. */
const colorRow = (hex: string, role: string) =>
  `<li class="f2s-style-row"><div class="f2s-style-row-main"><span class="f2s-style-swatch" style="background-color:${hex}"></span><span class="f2s-style-label">${hex}</span><select class="f2s-font-dropdown f2s-style-role-select"><option>${role}</option></select></div></li>`;
function layoutItem(pos: number, kind: SlideKind, name: string, opts: { master?: boolean; active?: boolean } = {}): string {
  return `<div class="f2s-sidebar-item"><div class="f2s-frame-preview${opts.active ? ' is-active' : ''}">${slide(kind)}${opts.master ? '<span class="f2s-frame-tag f2s-frame-tag--master">Master</span>' : ''}</div><div class="f2s-frame-info"><span class="f2s-frame-index">${pos}.</span><span class="f2s-frame-name">${name}</span><div class="f2s-frame-controls"><span class="f2s-icon-btn">&#10005;</span></div></div></div>`;
}
const roleRow = (role: string, name: string) =>
  `<li class="f2s-log-entry"><span class="f2s-log-entry-clickarea"><span class="f2s-log-entry-text"><strong class="f2s-log-entry-name">[[${role}]] ${name}</strong></span></span><select class="f2s-font-dropdown f2s-log-entry-role"><option>[[${role}]]</option></select></li>`;
export const FEATURE_TEMPLATE_HTML = scene(
  'template',
  760,
  'The Decker plugin in Templates mode: the Cover layout tagged Master, a layout with real title and body placeholders, and the detected colors mapped to theme roles',
  pluginWindow(
    'fs-pwin--tmpl',
    `<header class="f2s-topbar"><div class="f2s-topbar-left"><div class="f2s-tabs"><span class="f2s-tab">Deck</span><span class="f2s-tab is-active">Templates</span></div></div><div class="f2s-topbar-actions"><span class="f2s-btn f2s-btn--primary">Create template</span></div></header>
    <div class="f2s-body"><aside class="f2s-sidebar">${layoutItem(1, 'cover', 'Cover', { master: true })}${layoutItem(2, 'pillars', 'Three pillars', { active: true })}${layoutItem(3, 'stats', 'Stats')}</aside>
    <main class="f2s-canvas"><div class="f2s-tmpl-report"><div class="f2s-canvas-preview f2s-tmpl-preview">${slide('pillars', { layout: true })}</div>
    <div class="f2s-tmpl-panel"><section class="f2s-tmpl-section"><div class="f2s-section-head"><h3 class="f2s-tmpl-heading">Composition</h3><span class="f2s-btn f2s-btn--ghost">Suggest roles</span></div><ul class="f2s-tmpl-list">${roleRow('title', 'Three pillars, one promise')}${roleRow('body', 'Pillar descriptions')}</ul></section></div></div></main>
    <aside class="f2s-style-aside"><div class="f2s-style-panel"><section class="f2s-tmpl-section"><div class="f2s-section-head"><h3 class="f2s-tmpl-heading f2s-style-heading">Colors</h3><span class="f2s-btn f2s-btn--ghost">Suggest roles</span></div>
    <ul class="f2s-style-list">${colorRow(DECK.forest.toUpperCase(), 'Text &amp; background 1')}${colorRow(DECK.paper.toUpperCase(), 'Text &amp; background 2')}${colorRow(DECK.sand.toUpperCase(), 'Text &amp; background 4')}${colorRow(DECK.clay.toUpperCase(), 'Accent 1')}${colorRow(DECK.rust.toUpperCase(), 'Accent 2')}</ul></section></div></aside></div>`,
  ),
);

/** Control : les frames choisies sur le canvas, triées dans le rail avant tout export. */
export const FEATURE_PICK_HTML = scene(
  'pick',
  480,
  'Two frames selected on the Figma canvas, and the Decker rail where a slide is being dragged to a new position',
  `<div class="fs-pickframes">${canvasFrameMini('Stats', 'stats')}${canvasFrameMini('Three pillars', 'pillars')}</div>` +
    pluginWindow(
      'fs-pwin--pick',
      `<div class="f2s-body"><aside class="f2s-sidebar">${railItem(1, 'cover', 'Cover')}${railItem(2, 'stats', 'Stats', 'is-dragging fs-lifted')}${railItem(3, 'pillars', 'Three pillars')}</aside></div>`,
    ) +
    `<span class="fs-cursor-at fs-cursor-at--pick">${CURSOR}</span>`,
);

/** Fidelity : l'éditeur Google Slides, le titre exporté sélectionné comme une
    vraie zone de texte, sa police et sa taille dans la barre d'outils. */
const G_ICON = {
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/></svg>',
};
const G_MENU = ['File', 'Edit', 'View', 'Insert', 'Format', 'Slide', 'Arrange', 'Tools', 'Extensions', 'Help'];
export const FEATURE_NATIVE_HTML = scene(
  'native',
  900,
  'Google Slides editing the exported deck: the title is a native text box, selected, with its font and size in the toolbar',
  `<div class="fs-gs">
    <div class="fs-gs__head"><span class="fs-gs__logo">${SLIDES_ICON}</span><div class="fs-gs__doc"><div class="fs-gs__title">Trailworn deck <span class="fs-gs__saved">${G_ICON.cloud}Saved to Drive</span></div><div class="fs-gs__menu">${G_MENU.map((m) => `<span>${m}</span>`).join('')}</div></div>
      <div class="fs-gs__right"><span class="fs-gs__ico">${G_ICON.history}</span><span class="fs-gs__ico">${G_ICON.comment}</span><span class="fs-gs__slideshow">Slideshow</span><span class="fs-gs__share">${G_ICON.lock}Share</span><span class="fs-gs__avatar">A</span></div></div>
    <div class="fs-gs__tools"><span class="fs-gs__search">${G_ICON.search}Menus</span><span class="fs-gs__ico">${G_ICON.undo}</span><span class="fs-gs__ico">${G_ICON.redo}</span><span class="fs-gsep"></span><span class="fs-gtool fs-gtool--font">Arial<i></i></span><span class="fs-gsep"></span><span class="fs-gtool">&minus;</span><span class="fs-gtool fs-gtool--size">40</span><span class="fs-gtool">+</span><span class="fs-gsep"></span><span class="fs-gtool"><b>B</b></span><span class="fs-gtool"><i>I</i></span><span class="fs-gtool"><u>U</u></span><span class="fs-gtool fs-gtool--color">A</span><span class="fs-gsep"></span><span class="fs-gtool">Format options</span></div>
    <div class="fs-gs__body"><div class="fs-gs__film"><span class="fs-gs__thumb"><i>1</i>${slide('cover')}</span><span class="fs-gs__thumb is-current"><i>2</i>${slide('pillars')}</span><span class="fs-gs__thumb"><i>3</i>${slide('stats')}</span></div>
      <div class="fs-gs__main"><span class="fs-gs__ruler"></span><div class="fs-gs__slide">${slide('pillars', { editing: true })}<span class="fs-gs__sel"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></div><div class="fs-gs__notes">Click to add speaker notes</div></div></div>
  </div>`,
);

/** Privacy : la page d'accès du compte Google, où Decker n'a que deux droits,
    les plus étroits possibles, et se retire d'un clic. */
const DRIVE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3h8l6 10-4 7H6l-4-7z"/><path d="M8 3l6 10h8M2 13h12l-4 7"/></svg>';
const MAIL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
export const FEATURE_PRIVATE_HTML = scene(
  'private',
  520,
  'The Google Account page for Decker: access limited to the Drive files Decker creates and to your email address, with a button to remove all access',
  `<div class="fs-ga">
    <div class="fs-ga__head"><span class="fs-ga__app">${DECKER_ICON}</span><div><p class="fs-ga__name">Decker</p><p class="fs-ga__sub">Decker has some access to your Google Account</p></div></div>
    <p class="fs-ga__label">Access given to Decker</p>
    <ul class="fs-ga__list">
      <li><span class="fs-ga__ico">${DRIVE_ICON}</span><div><strong>Google Drive</strong><span>See, edit, create and delete only the specific Google Drive files you use with this app</span></div></li>
      <li><span class="fs-ga__ico">${MAIL_ICON}</span><div><strong>Email address</strong><span>See your primary Google Account email address</span></div></li>
    </ul>
    <span class="fs-ga__btn">Delete all connections you have with Decker</span>
  </div>`,
);

/* ---------- How it works ---------- */

const canvasFrame = (cls: string, name: string, kind: SlideKind, selected: boolean) =>
  `<div class="fs-frame ${cls}${selected ? ' is-selected' : ''}"><span class="fs-frame__name">${name}</span>${slide(kind)}${selected ? '<span class="fs-frame__h fs-frame__h--tl"></span><span class="fs-frame__h fs-frame__h--tr"></span><span class="fs-frame__h fs-frame__h--bl"></span><span class="fs-frame__h fs-frame__h--br"></span>' : ''}</div>`;

/** Étape 1 : le canvas Figma, deux frames prises au lasso sur trois. */
export const STEP_PICK_FRAMES_HTML = scene(
  'canvas',
  440,
  'Three frames on a Figma canvas, two of them selected with a drag',
  `${canvasFrame('fs-frame--a', 'Cover', 'cover', true)}${canvasFrame('fs-frame--b', 'Stats', 'stats', true)}${canvasFrame('fs-frame--c', 'Three pillars', 'pillars', false)}
  <span class="fs-marquee"></span><span class="fs-selsize f2s-tabular">2 frames</span><span class="fs-cursor-at fs-cursor-at--canvas">${CURSOR}</span>`,
);

/** Étape 2 : la même slide, moitié Figma, moitié Slides, sans écart. */
export const STEP_MATCHED_HTML = scene(
  'match',
  440,
  'The same slide split in half, Figma on the left and Google Slides on the right, lining up exactly',
  `<div class="fs-split fs-split--figma"><span class="fs-split__label">Figma</span><div class="fs-split__slide">${slide('stats')}</div></div>
  <div class="fs-split fs-split--slides"><span class="fs-split__label">Slides</span><div class="fs-split__slide">${slide('stats')}</div></div>
  <span class="fs-split__line"><i></i></span>`,
);

/** Étape 3 : le deck ouvert dans Slides, dans le Drive de l'utilisateur. */
export const STEP_GET_DECK_HTML = scene(
  'slides',
  720,
  'The exported Trailworn deck open in Google Slides, three slides in its filmstrip',
  `<div class="fs-swin"><div class="fs-sbar">${LIGHTS}<span class="fs-sbar__doc">${SLIDES_ICON}</span><div><div class="fs-sbar__title">Trailworn deck</div><div class="fs-sbar__menu"><span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span></div></div></div>
  <div class="fs-sbody"><div class="fs-film"><span class="fs-film__item" aria-current="true"><span>1</span>${slide('cover')}</span><span class="fs-film__item"><span>2</span>${slide('pillars')}</span><span class="fs-film__item"><span>3</span>${slide('stats')}</span></div><div class="fs-swin__stage">${slide('cover')}</div></div></div>`,
);

export const FEATURE_SCENES_CSS = `
/* ---------- Visuels des cards (scènes à l'échelle) ---------- */
.fs {
  position: relative; overflow: clip; background: var(--fs-bg, ${CHROME.canvas});
  --dm-forest: ${DECK.forest}; --dm-sand: ${DECK.sand}; --dm-clay: ${DECK.clay};
  --dm-rust: ${DECK.rust}; --dm-paper: ${DECK.paper};
  --dm-deck-font: Arial, Helvetica, sans-serif;
}
/* Le creux 95 du puits passe au-dessus de la scène, qui sinon le recouvre. */
.fs::after { content: ""; position: absolute; inset: 0; z-index: 3; box-shadow: var(--hyb-in); pointer-events: none; }
.fs-stage {
  position: absolute; top: 0; left: 0;
  transform-origin: 0 0; transform: scale(var(--fs-scale, 0.7));
  font-family: var(--b-font-sans); font-size: 12px; line-height: var(--b-leading-tight); color: var(--b-ink);
  -webkit-user-select: none; user-select: none; pointer-events: none;
}
.fs .dm-plugin { height: auto; }
.fs .dm-slide { width: 100%; }
/* Placeholders d'un layout Slides, en pointillés */
.fs-ph {
  position: absolute; display: flex; align-items: center; padding: 0 1.5cqw;
  outline: 0.25cqw dashed currentColor; outline-offset: -0.25cqw; opacity: 0.6; font-size: 2.6cqw;
}
.fs .f2s-frame-preview .dm-slide { height: 100%; }
.fs .f2s-retro-screen .dm-slide { width: 100%; }
.fs-cursor { width: 22px; height: 22px; display: block; }
.fs-cursor-at { position: absolute; z-index: 20; }

/* Fenêtre du plugin, recadrée */
.fs-pwin {
  position: absolute; display: flex; flex-direction: column; overflow: clip;
  border-radius: var(--b-radius-md); background: var(--b-surface); box-shadow: ${CHROME.shadow};
}
.fs-pwin .dm-pwin__bar { height: 32px; }
.fs-pwin .dm-plugin { flex: 1 1 auto; min-height: 0; }
.fs-pwin .f2s-topbar { padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
.fs-pwin .f2s-body { flex: 1 1 auto; min-height: 0; }
.fs-pwin .f2s-sidebar, .fs-pwin .f2s-canvas { overflow: clip; }

/* Pricing */
.fs--free { --fs-bg: var(--b-accent-20); }
.fs-price {
  position: absolute; left: 80px; top: 44px; width: 260px; padding: 16px; gap: 12px;
  border-radius: var(--b-radius-md); box-shadow: ${CHROME.shadow};
}
.fs-price__head { display: flex; align-items: center; gap: 8px; }
.fs-price__head svg { width: 20px; height: 20px; display: block; }
.fs-price__name { font-size: 14px; font-weight: var(--b-font-bold); }
.fs-price__tag { margin-left: auto; color: var(--color-text-muted); }
.fs-price__amount { display: flex; align-items: baseline; gap: 6px; margin: 0; font-size: 40px; font-weight: var(--b-font-bold); letter-spacing: -0.02em; line-height: 1; }
.fs-price__per { font-size: 13px; font-weight: var(--b-font-medium); letter-spacing: 0; color: var(--color-text-muted); }
.fs-price__list { display: grid; gap: 6px; margin: 0; padding: 12px 0 0; list-style: none; border-top: 1px solid var(--color-border); font-size: 13px; font-weight: var(--b-font-medium); }
.fs-price__list li { display: flex; align-items: center; gap: 8px; }
.fs-price__list svg { width: 14px; height: 14px; flex: none; color: var(--b-accent); }
.fs-price__foot { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }

/* Full deck */
.fs-pwin--deck .dm-pwin__bar, .fs-pwin--tmpl .dm-pwin__bar { height: 44px; font-size: 16px; }
.fs-pwin--deck .dm-pwin__bar svg, .fs-pwin--tmpl .dm-pwin__bar svg { width: 22px; height: 22px; }
.fs-pwin--deck { left: 32px; top: 28px; width: 656px; height: 520px; }
.fs-pwin--deck .f2s-topbar { padding: 10px 12px; }
.fs-pwin--deck .f2s-sidebar { width: 170px; }
.fs-pwin--deck .f2s-canvas { padding: 24px; justify-content: flex-start; align-items: stretch; }
.fs-pwin--deck .f2s-canvas-preview { width: 100%; }

/* Templates */
.fs--template { --fs-bg: ${CHROME.canvas}; }
.fs-pwin--tmpl { left: 28px; top: 28px; width: 704px; height: 560px; }
.fs-pwin--tmpl .f2s-topbar { padding: 12px 16px; }
.fs-pwin--tmpl .f2s-sidebar { width: 128px; }
.fs-pwin--tmpl .f2s-canvas { padding: 16px; justify-content: flex-start; align-items: stretch; }
.fs-pwin--tmpl .f2s-style-aside { width: 272px; overflow: clip; }
.fs-pwin--tmpl .f2s-frame-tag { top: 3px; left: 3px; padding: 1px 4px; font-size: 9px; }
.fs-pwin--tmpl .f2s-style-role-select { width: 150px; min-width: 0; flex: none; }
.fs .f2s-frame-preview { position: relative; }

/* Control */
.fs-pwin--pick { left: 28px; top: 28px; width: 200px; height: 340px; }
.fs-pwin--pick .f2s-sidebar { width: 100%; }
.fs-pickframes { position: absolute; left: 268px; top: 40px; display: grid; gap: 28px; }
.fs-pickframes .fs-frame { position: relative; width: 170px; }
.fs-lifted { transform: translate(18px, -6px) rotate(-1.5deg); }
.fs-lifted .f2s-frame-preview { box-shadow: ${CHROME.shadowWindow}; cursor: grabbing; }
.fs-cursor-at--pick { left: 160px; top: 214px; }

/* Fidelity : Google Slides, recopié comme une capture */
.fs--native { --fs-bg: var(--b-surface-subtle); }
.fs-gs {
  position: absolute; left: 32px; top: 32px; width: 836px; height: 660px; display: flex; flex-direction: column;
  border-radius: var(--b-radius-md); overflow: clip; background: #f9fbfd; box-shadow: ${CHROME.shadowWindow};
  font-family: Arial, Helvetica, sans-serif; color: #1f1f1f;
}
.fs-gs__head svg, .fs-gs__tools svg { width: 18px; height: 18px; display: block; }
.fs-gs__head { display: flex; align-items: center; gap: 10px; padding: 10px 16px 4px; }
.fs-gs__logo svg { width: 30px; height: 30px; }
.fs-gs__title { display: flex; align-items: center; gap: 12px; font-size: 18px; }
.fs-gs__saved { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #444746; }
.fs-gs__saved svg { width: 16px; height: 16px; }
.fs-gs__menu { display: flex; gap: 11px; margin-top: 4px; font-size: 13px; }
.fs-gs__right { display: flex; align-items: center; gap: 10px; flex: none; margin-left: auto; color: #444746; }
.fs-gs__right svg { width: 22px; height: 22px; }
.fs-gs__slideshow { padding: 8px 16px; border: 1px solid #747775; border-radius: 999px; font-size: 14px; color: #1f1f1f; }
.fs-gs__share { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; background: #c2e7ff; font-size: 14px; color: #001d35; }
.fs-gs__share svg { width: 16px; height: 16px; }
.fs-gs__avatar { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: ${DECK.clay}; color: #fff; font-size: 15px; }
.fs-gs__tools {
  display: flex; align-items: center; gap: 4px; margin: 8px 16px; padding: 4px 10px; border-radius: 999px;
  background: #edf2fa; font-size: 14px; color: #444746;
}
.fs-gs__search { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; margin-right: 6px; border-radius: 999px; background: #fff; }
.fs-gs__ico { display: inline-flex; padding: 4px; }
.fs-gs__body { flex: 1 1 auto; min-height: 0; display: flex; }
.fs-gs__film { width: 150px; flex: none; display: flex; flex-direction: column; gap: 14px; padding: 8px 12px 0 8px; }
.fs-gs__thumb { display: flex; gap: 8px; font-size: 12px; color: #444746; }
.fs-gs__thumb i { width: 12px; font-style: normal; text-align: right; }
.fs-gs__thumb .dm-slide { flex: 1 1 auto; border-radius: 6px; outline: 1px solid #c7c7c7; }
.fs-gs__thumb.is-current .dm-slide { outline: 3px solid ${SLIDES_YELLOW}; }
.fs-gs__main { flex: 1 1 auto; position: relative; padding: 22px 24px 0 28px; background: #f9fbfd; }
.fs-gs__ruler { position: absolute; left: 28px; right: 0; top: 6px; height: 10px; border-bottom: 1px solid #c7c7c7; background: repeating-linear-gradient(90deg, #c7c7c7 0 1px, transparent 1px 12px) bottom / 100% 5px no-repeat; }
.fs-gs__slide { position: relative; width: 620px; box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3); }
.fs-gs__notes { margin-top: 18px; padding: 12px 14px; border-radius: 8px; background: #fff; font-size: 13px; color: #444746; }
/* Sélection Slides autour du titre (zone de texte native) : cadre bleu et
   ses huit poignées, posé sur la position du titre dans la slide. */
.fs-gs__sel { position: absolute; left: 6%; top: 12%; width: 62%; height: 12%; border: 1.5px solid #1a73e8; }
.fs-gs__sel i { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border: 1.5px solid #1a73e8; border-radius: 50%; background: #fff; }
.fs-gs__sel i:nth-child(1) { left: 0; top: 0; } .fs-gs__sel i:nth-child(2) { left: 50%; top: 0; } .fs-gs__sel i:nth-child(3) { left: 100%; top: 0; }
.fs-gs__sel i:nth-child(4) { left: 0; top: 50%; } .fs-gs__sel i:nth-child(5) { left: 100%; top: 50%; }
.fs-gs__sel i:nth-child(6) { left: 0; top: 100%; } .fs-gs__sel i:nth-child(7) { left: 50%; top: 100%; } .fs-gs__sel i:nth-child(8) { left: 100%; top: 100%; }
.fs-gs .fs-textbox { outline: 0; }
.fs-gtool { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 26px; padding: 0 5px; border-radius: 4px; }
.fs-gtool--font { gap: 12px; padding: 0 8px; }
.fs-gtool--font i { width: 0; height: 0; border: 4px solid transparent; border-top-color: currentColor; margin-top: 4px; }
.fs-gtool--size { min-width: 34px; border: 1px solid #747775; }
.fs-gtool--color { text-decoration: underline 3px ${DECK.forest}; text-underline-offset: 3px; }
.fs-gsep { width: 1px; height: 20px; margin: 0 6px; background: #c7c7c7; }
.fs-textbox::after { content: ""; display: inline-block; width: 0.35cqw; height: 0.9em; margin-left: 0.3cqw; vertical-align: -0.08em; background: currentColor; }

/* Privacy : la page Accès du compte Google, recopiée comme une capture */
.fs--private { --fs-bg: var(--b-surface-subtle); }
.fs-ga {
  position: absolute; left: 36px; top: 34px; width: 448px; padding: 22px 24px 24px;
  border-radius: 12px; background: #fff; box-shadow: ${CHROME.shadowWindow};
  font-family: Arial, Helvetica, sans-serif; color: #1f1f1f;
}
.fs-ga p { margin: 0; }
.fs-ga__head { display: flex; align-items: center; gap: 14px; }
.fs-ga__app { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid #dadce0; border-radius: 50%; }
.fs-ga__app svg { width: 24px; height: 24px; display: block; }
.fs-ga__name { font-size: 20px; }
.fs-ga__sub { margin-top: 4px !important; font-size: 13px; color: #444746; }
.fs-ga__label { margin: 22px 0 8px !important; font-size: 14px; font-weight: 700; }
.fs-ga__list { display: grid; margin: 0; padding: 0; list-style: none; border-top: 1px solid #e3e3e3; }
.fs-ga__list li { display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid #e3e3e3; font-size: 13px; line-height: 1.4; }
.fs-ga__list div { display: grid; gap: 2px; }
.fs-ga__list span:not(.fs-ga__ico) { color: #444746; }
.fs-ga__ico { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #e8f0fe; color: #0b57d0; }
.fs-ga__ico svg { width: 16px; height: 16px; display: block; }
.fs-ga__btn { display: inline-block; margin-top: 18px; padding: 9px 18px; border: 1px solid #747775; border-radius: 999px; font-size: 13px; color: #0b57d0; }

/* Canvas Figma (étape 1) */
.fs-frame { position: absolute; width: 170px; }
.fs-frame__name { display: block; margin-bottom: 4px; font-size: 10px; color: ${CHROME.label}; }
.fs-frame.is-selected .fs-frame__name { color: ${CHROME.select}; }
.fs-frame.is-selected .dm-slide { outline: 1.5px solid ${CHROME.select}; }
.fs-frame__h { position: absolute; width: 6px; height: 6px; background: ${CHROME.barText}; border: 1px solid ${CHROME.select}; }
.fs-frame__h--tl, .fs-frame__h--tr { top: 12px; }
.fs-frame__h--bl, .fs-frame__h--br { bottom: -3px; }
.fs-frame__h--tl, .fs-frame__h--bl { left: -3px; }
.fs-frame__h--tr, .fs-frame__h--br { right: -3px; }
.fs-frame--a { left: 34px; top: 40px; }
.fs-frame--b { left: 236px; top: 40px; }
.fs-frame--c { left: 34px; top: 196px; }
.fs-marquee {
  position: absolute; left: 22px; top: 30px; width: 398px; height: 132px;
  border: 1px solid ${CHROME.select}; background: color-mix(in srgb, ${CHROME.select} 10%, transparent);
}
.fs-selsize {
  position: absolute; left: 221px; top: 170px; translate: -50% 0; padding: 2px 5px; border-radius: var(--b-radius-2xs);
  background: ${CHROME.select}; color: ${CHROME.barText}; font-size: 10px; font-weight: var(--b-font-semibold); white-space: nowrap;
}
.fs-cursor-at--canvas { left: 412px; top: 154px; }

/* Étape 2 : comparaison Figma / Slides */
.fs-split { position: absolute; top: 0; bottom: 0; overflow: clip; }
.fs-split--figma { left: 0; width: 220px; background: ${CHROME.canvas}; }
.fs-split--slides { left: 220px; right: 0; background: #f9fbfd; }
.fs-split__slide { position: absolute; left: 40px; top: 70px; width: 360px; }
.fs-split--slides .fs-split__slide { left: -180px; }
.fs-split__label {
  position: absolute; top: 18px; padding: 3px 8px; border-radius: var(--b-radius-full);
  background: var(--b-surface); font-size: 11px; font-weight: var(--b-font-semibold); box-shadow: ${CHROME.shadow};
}
.fs-split--figma .fs-split__label { left: 40px; }
.fs-split--slides .fs-split__label { right: 40px; }
.fs-split__line { position: absolute; left: 219px; top: 0; bottom: 0; width: 2px; background: var(--b-accent); }
.fs-split__line i {
  position: absolute; left: 50%; top: 86%; width: 20px; height: 20px; translate: -50% -50%;
  border-radius: var(--b-radius-full); background: var(--b-accent); box-shadow: 0 0 0 3px var(--b-surface);
}

/* Étape 3 : le deck dans Slides */
.fs-swin {
  position: absolute; left: 32px; top: 32px; width: 720px; height: 520px; display: flex; flex-direction: column;
  border-radius: var(--b-radius-md); overflow: clip; background: var(--b-surface); box-shadow: ${CHROME.shadowWindow};
}
.fs-sbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 0; flex: none; border-bottom: 1px solid var(--b-border); }
.fs-sbar .dm-lights { padding-right: 4px; }
.fs-sbar__doc { flex: none; }
.fs-sbar__doc svg { width: 28px; height: 28px; display: block; }
.fs-sbar__title { font-size: 15px; font-weight: var(--b-font-semibold); }
.fs-sbar__menu { display: flex; gap: 12px; margin-top: 2px; font-size: 12px; color: var(--b-text-muted); }
.fs-sbody { display: flex; flex: 1 1 auto; min-height: 0; background: var(--b-surface-muted); }
.fs-film { width: 150px; flex: none; padding: 10px; display: flex; flex-direction: column; gap: 8px; background: var(--b-surface); border-right: 1px solid var(--b-border); }
.fs-film__item { display: flex; gap: 6px; font-size: 11px; color: var(--b-text-muted); }
.fs-film__item .dm-slide { flex: 1 1 auto; outline: 2px solid transparent; }
.fs-film__item[aria-current="true"] .dm-slide { outline-color: ${SLIDES_YELLOW}; }
.fs-swin__stage { flex: 1 1 auto; padding: 24px; }
.fs-swin__stage .dm-slide { width: 440px; box-shadow: 0 2px 8px color-mix(in oklab, var(--b-ink) 12%, transparent); }
`;

/** Met chaque scène à l'échelle de sa card, comme la démo du hero. */
export const FEATURE_SCENES_JS = `(function () {
  var scenes = document.querySelectorAll('[data-fs]');
  if (!scenes.length || !window.ResizeObserver) return;
  var ro = new ResizeObserver(function (entries) {
    entries.forEach(function (e) { e.target.style.setProperty('--fs-scale', String(e.contentRect.width / Number(e.target.getAttribute('data-fs')))); });
  });
  scenes.forEach(function (s) { ro.observe(s); });
})();`;
