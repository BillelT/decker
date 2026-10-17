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
import { CHROME, DECK, DECKER_ICON, HILLS, ICONS, SLIDES_ICON } from './heroDemo.js';

/** Jaune de l'icône d'un fichier Google Slides, comme une capture. */
const SLIDES_YELLOW = '#fbbc04';

type SlideKind = 'cover' | 'pillars' | 'stats';

/** Une slide du faux deck, comme slideHtml() dans la démo du hero. */
function slide(kind: SlideKind, opts: { tmpl?: boolean; editing?: boolean } = {}): string {
  const edit = opts.editing ? ' fs-textbox' : '';
  /* Layout de template : mêmes slides, textes remplacés par les textes de
     placeholder que l'on pose dans Figma, ceux de Slides. */
  if (opts.tmpl) {
    if (kind === 'cover') return `<span class="dm-slide dm-slide--cover"><span class="dm-s__title">Click to edit title</span><span class="dm-s__sub">Click to edit subtitle</span>${HILLS}</span>`;
    if (kind === 'pillars') return `<span class="dm-slide dm-slide--pillars"><span class="dm-s__title">Click to edit title</span><span class="fs-s__body">Click to edit text</span></span>`;
    return `<span class="dm-slide dm-slide--stats"><span class="fs-s__big">00%</span><span class="dm-s__cap">Click to edit text</span></span>`;
  }
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

/**
 * Le plugin dans sa fenêtre Figma, avec la structure de ui.tsx : en-tête
 * (onglets Deck / Templates, nom, actions), barre des polices, corps, pied
 * (Settings et signature). Mêmes éléments natifs que le plugin (button,
 * input, select) pour que son CSS s'applique tel quel ; la scène est inerte.
 */
function pluginApp(cls: string, o: { mode: 'deck' | 'template'; actions: string; body: string; name?: string; fonts?: boolean }): string {
  const deck = o.mode === 'deck';
  const tab = (m: 'deck' | 'template', label: string) =>
    `<button type="button" role="tab" class="f2s-tab${o.mode === m ? ' is-active' : ''}" aria-selected="${o.mode === m}">${label}</button>`;
  const fonts = o.fonts === false ? '' : `<div class="f2s-toolbar"><div class="f2s-toolbar-row"><div class="f2s-toolbar-group"><span class="f2s-toolbar-label">Fonts:</span><label class="f2s-font-select"><span class="f2s-font-original">Arial</span><span class="f2s-font-arrow">&rarr;</span><div class="f2s-font-combobox"><input type="text" class="f2s-font-combobox-input" size="10" value="Arial"><span class="f2s-font-combobox-arrow"></span></div></label></div></div></div>`;
  return `<div class="fs-pwin ${cls}"><div class="dm-pwin__bar">${DECKER_ICON}<span>Decker</span><span class="dm-pwin__x">${ICONS.close}</span></div><div class="dm-plugin">
    <header class="f2s-topbar"><div class="f2s-topbar-left"><div class="f2s-tabs" role="tablist">${tab('deck', 'Deck')}${tab('template', 'Templates')}</div>${o.name === undefined ? '' : `<div class="f2s-topbar-title-group"><label class="f2s-toolbar-label">Name:</label><input type="text" class="f2s-title-input" placeholder="${deck ? 'Decker export' : 'Figma template'}" value="${o.name}"></div>`}</div><div class="f2s-topbar-actions">${o.actions}</div></header>
    ${fonts}<div class="f2s-body">${o.body}</div>
    <footer class="f2s-footer"><div class="f2s-footer-left"><button type="button" class="f2s-footer-settings">${ICONS.gear}<span>Settings</span></button></div><div class="f2s-footer-actions"><div class="f2s-signature"><a class="f2s-logo-link"><span class="f2s-logo">${ICONS.logo}</span></a><a class="f2s-coffee-link"><span class="f2s-coffee-label"><span>Buy me a coffee</span>${ICONS.arrow(9)}</span></a></div></div></footer>
  </div></div>`;
}

const btn = (cls: string, label: string, disabled = false) => `<button type="button" class="f2s-btn ${cls}"${disabled ? ' disabled' : ''}>${label}</button>`;

const CURSOR = `<svg class="fs-cursor" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.6 L12.2 14.2 L19 14 Z" fill="var(--b-ink)" stroke="var(--b-white)" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const CHECK = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Une vignette du rail du plugin, comme railHtml() de la démo (ui.tsx). */
function railItem(pos: number, kind: SlideKind, name: string, o: { cls?: string; active?: boolean; exporting?: boolean; master?: boolean; tmpl?: boolean } = {}): string {
  return `<div class="f2s-sidebar-item ${o.cls ?? ''}"><button type="button" class="f2s-frame-preview${o.active ? ' is-active' : ''}${o.exporting ? ' is-exporting' : ''}">${slide(kind, { tmpl: o.tmpl })}${o.master ? '<span class="f2s-frame-tag f2s-frame-tag--master">Master</span>' : ''}</button><div class="f2s-frame-info"><span class="f2s-frame-index">${pos}.</span>${o.tmpl ? `<input type="text" class="f2s-frame-name-input" value="${name}">` : `<span class="f2s-frame-name">${name}</span>`}<div class="f2s-frame-controls"><button type="button" class="f2s-icon-btn">&#10005;</button></div></div></div>`;
}

/** Une frame sélectionnée du canvas Figma, en petit. */
const canvasFrameMini = (name: string, kind: SlideKind) =>
  `<div class="fs-frame is-selected"><span class="fs-frame__name">${name}</span>${slide(kind)}</div>`;

/* ---------- Google Slides ---------- */

/** Icônes de l'éditeur Slides (Material Symbols, dessinées au trait). */
const G_ICON = {
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="6"/><path d="m20 20-5.5-5.5M10 7v6M7 10h6"/></svg>',
  select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v15l4-4 3 7 3-1-3-7h6z"/></svg>',
  shape: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="5"/><rect x="11" y="11" width="9" height="9"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/></svg>',
};
const G_CARET = '<i class="fs-gs__caret"></i>';
const G_MENU = ['File', 'Edit', 'View', 'Insert', 'Format', 'Slide', 'Arrange', 'Tools', 'Extensions', 'Help'];

/**
 * L'éditeur Google Slides tel qu'il s'affiche dans le navigateur (version
 * 2026) : en-tête, menus, barre d'outils en pilule, pellicule, règle, slide et
 * notes. `editing` sélectionne le titre : la barre d'outils passe alors aux
 * réglages de texte, comme dans Slides.
 */
function googleSlides(o: { current: number; editing?: boolean }): string {
  const kinds: SlideKind[] = ['cover', 'pillars', 'stats'];
  const kind = kinds[o.current];
  const tools = o.editing
    ? `<span class="fs-gtool fs-gtool--font">Arial${G_CARET}</span><span class="fs-gsep"></span><span class="fs-gtool">&minus;</span><span class="fs-gtool fs-gtool--size">40</span><span class="fs-gtool">+</span><span class="fs-gsep"></span><span class="fs-gtool"><b>B</b></span><span class="fs-gtool"><i>I</i></span><span class="fs-gtool"><u>U</u></span><span class="fs-gtool fs-gtool--color">A</span><span class="fs-gsep"></span><span class="fs-gtool">Format options</span>`
    : `<span class="fs-gtool fs-gtool--on">${G_ICON.select}</span><span class="fs-gtool"><b class="fs-gs__tt">T</b></span><span class="fs-gtool">${G_ICON.shape}</span><span class="fs-gsep"></span><span class="fs-gtool">Background</span><span class="fs-gsep"></span><span class="fs-gtool">Layout${G_CARET}</span><span class="fs-gsep"></span><span class="fs-gtool">Theme</span><span class="fs-gsep"></span><span class="fs-gtool">Transition</span>`;
  return `<div class="fs-gs">
    <div class="fs-gs__head"><span class="fs-gs__logo">${SLIDES_ICON}</span><div class="fs-gs__doc"><div class="fs-gs__title">Trailworn deck <span class="fs-gs__saved">${G_ICON.cloud}Saved to Drive</span></div><div class="fs-gs__menu">${G_MENU.map((m) => `<span>${m}</span>`).join('')}</div></div>
      <div class="fs-gs__right"><span class="fs-gs__ico">${G_ICON.history}</span><span class="fs-gs__ico">${G_ICON.comment}</span><span class="fs-gs__split"><span>Slideshow</span><span>${G_CARET}</span></span><span class="fs-gs__split fs-gs__split--share"><span>${G_ICON.lock}Share</span><span>${G_CARET}</span></span><span class="fs-gs__avatar">A</span></div></div>
    <div class="fs-gs__tools"><span class="fs-gs__search">${G_ICON.search}Menus</span><span class="fs-gs__ico">${G_ICON.plus}${G_CARET}</span><span class="fs-gs__ico">${G_ICON.undo}</span><span class="fs-gs__ico">${G_ICON.redo}</span><span class="fs-gs__ico">${G_ICON.print}</span><span class="fs-gs__ico">${G_ICON.zoom}</span><span class="fs-gtool">Fit${G_CARET}</span><span class="fs-gsep"></span>${tools}</div>
    <div class="fs-gs__body"><div class="fs-gs__film">${kinds.map((k, i) => `<span class="fs-gs__thumb${i === o.current ? ' is-current' : ''}"><i>${i + 1}</i>${slide(k)}</span>`).join('')}</div>
      <div class="fs-gs__main"><span class="fs-gs__ruler"></span><div class="fs-gs__slide">${slide(kind, { editing: o.editing })}${o.editing ? '<span class="fs-gs__sel"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>' : ''}</div><div class="fs-gs__notes">Click to add speaker notes</div></div></div>
  </div>`;
}

/* ---------- What Decker does ---------- */

/** Full deck : le rail du plugin plein, l'export en cours sur tout le fichier. */
const RETRO = `<div class="f2s-canvas-preview f2s-canvas-preview--retro"><div class="f2s-retro"><div class="f2s-retro-titlebar"><span class="f2s-retro-title">Exporting - Stats</span><span class="f2s-retro-window-buttons"><i>_</i><i>&#9633;</i><i>&#10005;</i></span></div><div class="f2s-retro-screen">${slide('stats')}<div class="f2s-retro-scanlines"></div></div><div class="f2s-retro-status"><span class="f2s-retro-status-text">Generating slide 3 of 12<span class="f2s-retro-ellipsis">...</span></span><div class="f2s-retro-bar"><div class="f2s-retro-bar-fill" style="--f2s-retro-progress:0.25"></div></div></div></div></div>`;
export const FEATURE_FULL_DECK_HTML = scene(
  'deck',
  1000,
  'The Decker plugin exporting a whole Figma file: twelve frames in its rail, slide 3 of 12 being generated',
  pluginApp('fs-pwin--deck', {
    mode: 'deck',
    name: 'Trailworn deck',
    actions: `${btn('f2s-btn--secondary', 'Add frames', true)}${btn('f2s-btn--secondary', 'Prepare for Slides', true)}${btn('f2s-btn--ghost', 'Cancel')}<span class="f2s-btn f2s-btn--primary f2s-btn--busy f2s-tabular"><span class="f2s-btn-loading"><span class="f2s-spinner"></span>Exporting 3/12</span></span>`,
    body: `<aside class="f2s-sidebar">${railItem(1, 'cover', 'Cover')}${railItem(2, 'pillars', 'Three pillars')}${railItem(3, 'stats', 'Stats', { active: true, exporting: true })}${railItem(4, 'cover', 'Roadmap')}${railItem(5, 'pillars', 'Team')}</aside><main class="f2s-canvas"><div class="f2s-deck-column">${RETRO}</div></main>`,
  }),
);

/** Templates : le mode Templates du plugin. Les layouts portent des textes de
    placeholder, comme ceux de Slides ; Composition les liste avec leur rôle,
    et les couleurs détectées sont mappées sur le thème. */
const colorRow = (hex: string, role: string) =>
  `<li class="f2s-style-row"><div class="f2s-style-row-main"><span class="f2s-style-swatch" style="background-color:${hex}"></span><span class="f2s-style-label">${hex}</span><select class="f2s-font-dropdown f2s-style-role-select"><option>${role}</option></select></div></li>`;
const roleRow = (role: string, name: string) =>
  `<li class="f2s-log-entry"><button type="button" class="f2s-log-entry-clickarea"><span class="f2s-log-entry-text"><strong class="f2s-log-entry-name">[[${role}]] ${name}</strong></span></button><select class="f2s-font-dropdown f2s-log-entry-role"><option>[[${role}]]</option></select></li>`;
const plainRow = (name: string) =>
  `<li class="f2s-log-entry"><button type="button" class="f2s-log-entry-clickarea"><span class="f2s-log-entry-text"><strong class="f2s-log-entry-name">${name}</strong></span></button><select class="f2s-font-dropdown f2s-log-entry-role"><option>No role</option></select></li>`;
const chip = (name: string) => `<li><button type="button" class="f2s-tmpl-chip"><span class="f2s-tmpl-chip-label">${name}</span></button></li>`;
const MASTER_SECTION = `<section class="f2s-tmpl-section"><h3 class="f2s-tmpl-heading f2s-style-heading">Master content</h3><ul class="f2s-style-list">${chip('Logo')}${chip('Footer')}</ul></section>`;
const TYPO_SECTION = `<section class="f2s-tmpl-section"><h3 class="f2s-tmpl-heading f2s-style-heading">Typography</h3><ul class="f2s-style-list"><li class="f2s-style-row"><div class="f2s-style-row-main"><span class="f2s-style-font-swatch">Aa</span><span class="f2s-style-font-info"><span class="f2s-tmpl-font-family">Arial</span><span class="f2s-toolbar-muted">400, 700</span></span></div><div class="f2s-style-font-replace"><span class="f2s-font-arrow">&rarr;</span><div class="f2s-font-combobox"><input type="text" class="f2s-font-combobox-input" size="10" value="Arial"><span class="f2s-font-combobox-arrow"></span></div></div></li></ul></section>`;
export const FEATURE_TEMPLATE_HTML = scene(
  'template',
  1000,
  'The Decker plugin in Templates mode: the Cover layout tagged Master, a layout whose title and body are tagged as placeholders, and the detected colors mapped to theme roles',
  pluginApp('fs-pwin--tmpl', {
    mode: 'template',
    name: 'Trailworn template',
    actions: `${btn('f2s-btn--secondary', 'Add frames', true)}${btn('f2s-btn--secondary', 'Prepare for Slides')}${btn('f2s-btn--primary', 'Create template')}`,
    body: `<aside class="f2s-sidebar">${railItem(1, 'cover', 'Cover', { master: true, tmpl: true })}${railItem(2, 'pillars', 'Content', { active: true, tmpl: true })}${railItem(3, 'stats', 'Key figure', { tmpl: true })}</aside>
    <main class="f2s-canvas"><div class="f2s-tmpl-report"><div class="f2s-canvas-preview f2s-tmpl-preview">${slide('pillars', { tmpl: true })}</div>
    <div class="f2s-tmpl-panel"><section class="f2s-tmpl-section"><div class="f2s-section-head"><h3 class="f2s-tmpl-heading">Composition</h3>${btn('f2s-btn--ghost', 'Suggest roles', true)}</div><ul class="f2s-tmpl-list">${roleRow('title', 'Click to edit title')}${roleRow('body', 'Click to edit text')}</ul></section><section class="f2s-tmpl-section"><h3 class="f2s-tmpl-heading">Content</h3><ul class="f2s-tmpl-list">${plainRow('Craft')}${plainRow('Speed')}</ul></section></div></div></main>
    <aside class="f2s-style-aside"><div class="f2s-style-panel">${MASTER_SECTION}<section class="f2s-tmpl-section"><div class="f2s-section-head"><h3 class="f2s-tmpl-heading f2s-style-heading">Colors</h3>${btn('f2s-btn--ghost', 'Suggest roles', true)}</div>
    <ul class="f2s-style-list">${colorRow(DECK.forest.toUpperCase(), 'Text &amp; background 1')}${colorRow(DECK.paper.toUpperCase(), 'Text &amp; background 2')}${colorRow(DECK.sand.toUpperCase(), 'Text &amp; background 4')}${colorRow(DECK.clay.toUpperCase(), 'Accent 1')}${colorRow(DECK.rust.toUpperCase(), 'Accent 2')}</ul></section>${TYPO_SECTION}</div></aside>`,
  }),
);

/** Toast du plugin (StatusIcon.tsx), figé. */
const toast = (tone: 'success' | 'info', text: string) =>
  `<div class="f2s-toast f2s-toast--${tone} fs-toast"><svg class="f2s-status-icon f2s-status-icon--${tone}" width="16" height="16" viewBox="0 0 66 66" fill="none"><rect class="f2s-status-icon-disc" width="66" height="66" rx="33"/>${tone === 'success' ? '<path d="M20 34 L29 43 L46 24" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' : '<path d="M33 31 L33 46 M33 20 L33 20.01" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>'}</svg><span class="f2s-toast-text">${text}</span><span class="f2s-icon-btn f2s-toast-close">${ICONS.close}</span></div>`;

/** Suggest roles : le clic qui vient de taguer le titre et le corps d'un
    layout, cadré sur Composition et les couleurs (même fenêtre que la card
    Templates, décalée pour masquer le rail). */
export const FEATURE_SUGGEST_HTML = scene(
  'suggest',
  760,
  'The Decker plugin right after Suggest roles: the layout title and body are now tagged as placeholders, and a notice confirms two roles were suggested',
  pluginApp('fs-pwin--suggest', {
    mode: 'template',
    name: 'Trailworn template',
    actions: `${btn('f2s-btn--secondary', 'Add frames', true)}${btn('f2s-btn--secondary', 'Prepare for Slides')}${btn('f2s-btn--primary', 'Create template')}`,
    body: `${toast('info', '2 roles suggested. Change any of them in Composition.')}<aside class="f2s-sidebar">${railItem(1, 'cover', 'Cover', { master: true, tmpl: true })}${railItem(2, 'pillars', 'Content', { active: true, tmpl: true })}</aside>
    <main class="f2s-canvas"><div class="f2s-tmpl-report"><div class="f2s-canvas-preview f2s-tmpl-preview">${slide('pillars', { tmpl: true })}</div>
    <div class="f2s-tmpl-panel"><section class="f2s-tmpl-section"><div class="f2s-section-head"><h3 class="f2s-tmpl-heading">Composition</h3>${btn('f2s-btn--ghost fs-pressed', 'Suggest roles')}</div><ul class="f2s-tmpl-list">${roleRow('title', 'Click to edit title')}${roleRow('body', 'Click to edit text')}</ul></section><section class="f2s-tmpl-section"><h3 class="f2s-tmpl-heading">Content</h3><ul class="f2s-tmpl-list">${plainRow('Craft')}${plainRow('Speed')}</ul></section></div></div></main>
    <aside class="f2s-style-aside"><div class="f2s-style-panel">${MASTER_SECTION}</div></aside>`,
  }) + `<span class="fs-cursor-at fs-cursor-at--suggest">${CURSOR}</span>`,
);

/** Prepare for Slides : la frame d'origine, puis sa copie « [Slides Ready] »
    posée à côté sur le canvas, déjà ramenée à ce que Slides sait rendre
    (dégradé aplati, ombre retirée, interlettrage remis à zéro). */
export const FEATURE_PREPARE_HTML = scene(
  'prepare',
  760,
  'On the Figma canvas, a frame with a gradient, a shadow and letter spacing, next to its [Slides Ready] copy where Decker already flattened all three',
  `<div class="fs-frame fs-prep fs-prep--orig"><span class="fs-frame__name">Stats</span>${slide('stats')}</div>
  <div class="fs-frame fs-prep fs-prep--ready is-selected"><span class="fs-frame__name">[Slides Ready] Stats</span>${slide('stats')}</div>
  <span class="fs-prep__arrow">${ICONS.arrow(28)}</span>` +
    pluginApp('fs-pwin--prepare', {
      mode: 'deck',
      name: 'Trailworn deck',
      actions: `${btn('f2s-btn--secondary', 'Add frames', true)}${btn('f2s-btn--secondary fs-pressed', 'Prepare for Slides')}${btn('f2s-btn--primary', 'Export')}`,
      body: `${toast('success', 'Slides ready')}`,
    }) +
    `<span class="fs-cursor-at fs-cursor-at--prepare">${CURSOR}</span>`,
);

/** Fonts : une police absente de Slides, et la liste de celles qui y sont,
    ouverte dans la barre Fonts du plugin. */
const FONT_LIST = ['Inter', 'Lato', 'Manrope', 'Montserrat', 'Poppins', 'Roboto'];
export const FEATURE_FONTS_HTML = scene(
  'fonts',
  520,
  'The Fonts bar of the Decker plugin: Satoshi is not available in Google Slides, and the list of Slides fonts is open to pick Inter as its replacement',
  `<div class="fs-pwin fs-pwin--fonts"><div class="dm-pwin__bar">${DECKER_ICON}<span>Decker</span><span class="dm-pwin__x">${ICONS.close}</span></div><div class="dm-plugin">
    <header class="f2s-topbar"><div class="f2s-topbar-left"><div class="f2s-tabs" role="tablist"><button type="button" class="f2s-tab is-active">Deck</button><button type="button" class="f2s-tab">Templates</button></div><div class="f2s-topbar-title-group"><label class="f2s-toolbar-label">Name:</label><input type="text" class="f2s-title-input" value="Trailworn deck"></div></div></header>
    <div class="f2s-toolbar"><div class="f2s-toolbar-row"><div class="f2s-toolbar-group"><span class="f2s-toolbar-label">Fonts:</span><label class="f2s-font-select"><span class="f2s-font-original">Satoshi</span><span class="f2s-font-arrow">&rarr;</span><div class="f2s-font-combobox f2s-font-combobox--open"><input type="text" class="f2s-font-combobox-input" size="10" value="Inter"><span class="f2s-font-combobox-arrow"></span>
    <ul class="f2s-font-combobox-list">${FONT_LIST.map((f, i) => `<li class="f2s-font-combobox-option${i === 0 ? ' f2s-font-combobox-option--active f2s-font-combobox-option--selected' : ''}">${f}</li>`).join('')}</ul></div></label></div></div></div>
    <div class="f2s-body"></div>
  </div></div>`,
);

/** Fidelity : le titre exporté sélectionné dans Slides, une vraie zone de texte. */
export const FEATURE_NATIVE_HTML = scene(
  'native',
  900,
  'Google Slides editing the exported deck: the title is a native text box, selected, with its font and size in the toolbar',
  googleSlides({ current: 1, editing: true }),
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
  640,
  'The exported Trailworn deck open in Google Slides, three slides in its filmstrip',
  googleSlides({ current: 0 }),
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
/* Textes de placeholder des layouts de template, aux places des vrais textes */
.fs-s__body { position: absolute; left: 7cqw; right: 7cqw; top: 21cqw; font-size: 2.6cqw; opacity: 0.75; }
.fs-s__big { position: absolute; left: 7cqw; top: 5cqw; font-size: 21cqw; font-weight: 700; line-height: 1; letter-spacing: -0.04em; }
.fs .f2s-frame-preview .dm-slide { height: 100%; }
.fs .f2s-retro-screen .dm-slide { width: 100%; }
.fs-cursor { width: 22px; height: 22px; display: block; }
.fs-cursor-at { position: absolute; z-index: 20; }

/* Fenêtre du plugin, recadrée */
.fs-pwin {
  position: absolute; display: flex; flex-direction: column; overflow: clip;
  background: var(--b-surface); box-shadow: ${CHROME.shadow};
}
.fs-pwin .dm-pwin__bar { height: 32px; }
.fs-pwin .dm-plugin { flex: 1 1 auto; min-height: 0; }
.fs-pwin .f2s-body { flex: 1 1 auto; min-height: 0; }
.fs-pwin .f2s-sidebar, .fs-pwin .f2s-canvas { overflow: clip; }

/* Fenêtres du plugin à leur taille réelle (960 x 600 sous la barre de
   Figma) : mêmes proportions que dans Figma et que la démo du hero. Seul
   le cadrage change d'une card à l'autre. */
.fs-pwin .dm-pwin__bar { height: 40px; }
.fs-pwin--deck, .fs-pwin--tmpl { left: 20px; top: 37px; width: 960px; height: 640px; }
.fs-pwin--suggest { left: -170px; top: -30px; width: 960px; height: 640px; }
.fs-pwin--prepare { left: -180px; top: 330px; width: 960px; height: 640px; }
.fs-pwin--fonts { left: 30px; top: 40px; width: 960px; height: 640px; }
.fs .f2s-canvas-preview .dm-slide, .fs .f2s-retro-screen .dm-slide { width: 100%; }
.fs-toast { animation: none; }
.fs-pressed { box-shadow: var(--hyb-pressed); }
.fs-cursor-at--suggest { left: 424px; top: 416px; }
.fs-cursor-at--prepare { left: 606px; top: 400px; }

/* Prepare for Slides : la frame d'origine et sa copie prête pour Slides */
.fs-prep { width: 300px; }
.fs-prep--orig { left: 40px; top: 40px; }
.fs-prep--ready { left: 420px; top: 40px; }
.fs-prep--orig .dm-slide { background: linear-gradient(135deg, var(--dm-clay), var(--dm-rust)); box-shadow: 0 18px 30px rgba(0, 0, 0, 0.35); }
.fs-prep--orig .dm-s__cap { letter-spacing: 0.18em; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.4); }
.fs-prep__arrow { position: absolute; left: 356px; top: 120px; color: ${CHROME.label}; rotate: 45deg; }
.fs-prep__arrow svg { display: block; }

/* Fonts : la liste des polices de Slides, ouverte sous son champ */
/* La rangée de la barre Fonts défile en x dans le plugin, ce qui rognait la
   liste ouverte : ici elle n'a rien à faire défiler. */
.fs .dm-plugin .f2s-toolbar-row { overflow: visible; }
.fs .f2s-font-combobox { position: relative; }
.fs .dm-plugin .f2s-font-combobox-list { position: absolute; top: calc(100% + 4px); left: -1px; min-width: calc(100% + 2px); }

/* Templates */
.fs--template { --fs-bg: ${CHROME.canvas}; }
.fs .f2s-frame-preview { position: relative; }

/* Fidelity : Google Slides, recopié comme une capture */
.fs--native { --fs-bg: var(--b-surface-subtle); }
.fs-gs {
  position: absolute; left: 24px; top: 24px; width: 852px; height: 660px; display: flex; flex-direction: column;
  overflow: clip; background: #f9fbfd; box-shadow: ${CHROME.shadowWindow};
  font-family: Arial, Helvetica, sans-serif; color: #1f1f1f;
}
.fs-gs__head svg, .fs-gs__tools .fs-gs__ico svg, .fs-gs__search svg { width: 18px; height: 18px; display: block; }
.fs-gs__head { display: flex; align-items: center; gap: 10px; padding: 10px 16px 4px; }
.fs-gs__logo svg { width: 30px; height: 30px; }
.fs-gs__title { display: flex; align-items: center; gap: 12px; font-size: 18px; }
.fs-gs__saved { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #444746; }
.fs-gs__saved svg { width: 16px; height: 16px; }
.fs-gs__menu { display: flex; gap: 10px; margin-top: 4px; font-size: 13px; }
.fs-gs__right { display: flex; align-items: center; gap: 8px; flex: none; margin-left: auto; color: #444746; }
.fs-gs__right svg { width: 22px; height: 22px; }
.fs-gs__split { display: inline-flex; align-items: stretch; border: 1px solid #747775; border-radius: 999px; font-size: 14px; color: #1f1f1f; }
.fs-gs__split > span { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; }
.fs-gs__split > span + span { padding: 7px 10px 7px 8px; border-left: 1px solid #747775; }
.fs-gs__split--share { border-color: transparent; background: #e3e3e3; }
.fs-gs__split--share > span + span { border-left-color: #c7c7c7; }
.fs-gs__split svg { width: 16px; height: 16px; }
.fs-gs__caret { display: inline-block; width: 0; height: 0; margin-left: 6px; border: 4px solid transparent; border-top-color: currentColor; transform: translateY(2px); }
.fs-gs__ico .fs-gs__caret { margin-left: 2px; }
.fs-gtool--on { background: #d3e3fd; }
.fs-gtool svg { width: 18px; height: 18px; display: block; }
.fs-gs__tt { font-family: Georgia, serif; font-size: 16px; }
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
.fs-gtool--size { min-width: 34px; border: 1px solid #747775; }
.fs-gtool--color { text-decoration: underline 3px ${DECK.forest}; text-underline-offset: 3px; }
.fs-gsep { width: 1px; height: 20px; margin: 0 6px; background: #c7c7c7; }
.fs-textbox::after { content: ""; display: inline-block; width: 0.35cqw; height: 0.9em; margin-left: 0.3cqw; vertical-align: -0.08em; background: currentColor; }

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
