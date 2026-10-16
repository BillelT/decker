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
 * Chaque scène est dessinée à taille fixe (400 x 250, le ratio 8/5 de
 * `.card__media`) puis mise à l'échelle de sa card par FEATURE_SCENES_JS,
 * comme une capture. Elles sont inertes : rien n'y prend le focus, et le
 * lecteur d'écran n'en lit que l'aria-label.
 *
 * Le CSS du plugin et celui des slides viennent de HERO_DEMO_CSS, chargé sur
 * la même page.
 */
import { CHROME, DECK, DECKER_ICON, HILLS, ICONS, LIGHTS } from './heroDemo.js';

/** Jaune de l'icône d'un fichier Google Slides, comme une capture. */
const SLIDES_YELLOW = '#f4b400';

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

/** Coque commune : un puits à ratio fixe, la scène à l'échelle dedans. */
const scene = (name: string, label: string, body: string): string =>
  `<div class="card__media fs fs--${name}" role="img" aria-label="${label}" data-fs><div class="fs-stage" inert aria-hidden="true">${body}</div></div>`;

/** Fenêtre du plugin dans Figma : barre sombre, puis le plugin lui-même. */
const pluginWindow = (cls: string, inner: string): string =>
  `<div class="fs-pwin ${cls}"><div class="dm-pwin__bar">${DECKER_ICON}<span>Decker</span><span class="dm-pwin__x">${ICONS.close}</span></div><div class="dm-plugin">${inner}</div></div>`;

const CURSOR = `<svg class="fs-cursor" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.6 L12.2 14.2 L19 14 Z" fill="var(--b-ink)" stroke="var(--b-white)" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const CHECK = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Une vignette du rail du plugin (ui.tsx), en mode Deck. */
function railItem(pos: number, kind: SlideKind, name: string, cls = ''): string {
  return `<div class="f2s-sidebar-item ${cls}"><div class="f2s-frame-preview${cls.includes('is-active') ? ' is-active' : ''}${cls.includes('is-exporting') ? ' is-exporting' : ''}">${slide(kind)}</div><div class="f2s-frame-info"><span class="f2s-frame-index">${pos}.</span><span class="f2s-frame-name">${name}</span><div class="f2s-frame-controls"><span class="f2s-icon-btn">&#10005;</span></div></div></div>`;
}

/** Barre d'outils de Google Slides, recopiée comme une capture. */
const SLIDES_TOOLBAR = `<div class="fs-gtools"><span class="fs-gtool fs-gtool--font">Arial<i></i></span><span class="fs-gsep"></span><span class="fs-gtool">&minus;</span><span class="fs-gtool fs-gtool--size">40</span><span class="fs-gtool">+</span><span class="fs-gsep"></span><span class="fs-gtool"><b>B</b></span><span class="fs-gtool"><i>I</i></span><span class="fs-gtool"><u>U</u></span><span class="fs-gtool fs-gtool--color">A</span></div>`;

/** Une frame sélectionnée du canvas Figma, en petit. */
const canvasFrameMini = (name: string, kind: SlideKind) =>
  `<div class="fs-frame is-selected"><span class="fs-frame__name">${name}</span>${slide(kind)}</div>`;

/* ---------- What Decker does ---------- */

/** Pricing : la fiche du plugin, à zéro, sans palier payant. */
export const FEATURE_FREE_HTML = scene(
  'free',
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
  'The Decker plugin exporting a whole Figma file: twelve frames in its rail, slide 3 of 12 being generated',
  pluginWindow(
    'fs-pwin--deck',
    `<header class="f2s-topbar"><div class="f2s-topbar-left"><span class="f2s-toolbar-label">12 slides</span></div><div class="f2s-topbar-actions"><span class="f2s-btn f2s-btn--primary f2s-btn--busy f2s-tabular"><span class="f2s-btn-loading"><span class="f2s-spinner"></span>Exporting 3/12</span></span></div></header>
    <div class="f2s-body"><aside class="f2s-sidebar">${railItem(1, 'cover', 'Cover')}${railItem(2, 'pillars', 'Three pillars')}${railItem(3, 'stats', 'Stats', 'is-active is-exporting')}${railItem(4, 'cover', 'Roadmap')}</aside>
    <main class="f2s-canvas"><div class="f2s-canvas-preview f2s-canvas-preview--retro"><div class="f2s-retro"><div class="f2s-retro-titlebar"><span class="f2s-retro-title">Exporting - Stats</span><span class="f2s-retro-window-buttons"><i>_</i><i>&#9633;</i><i>&#10005;</i></span></div><div class="f2s-retro-screen">${slide('stats')}<div class="f2s-retro-scanlines"></div></div><div class="f2s-retro-status"><span class="f2s-retro-status-text">Slide 3 of 12<span class="f2s-retro-ellipsis">...</span></span><div class="f2s-retro-bar"><div class="f2s-retro-bar-fill" style="--f2s-retro-progress:0.25"></div></div></div></div></div></main></div>`,
  ),
);

/** Templates : un layout aux vrais placeholders, et les couleurs mappées sur le thème. */
const colorRow = (hex: string, role: string) =>
  `<li class="f2s-style-row"><div class="f2s-style-row-main"><span class="f2s-style-swatch" style="background-color:${hex}"></span><span class="f2s-style-label">${hex}</span><select class="f2s-font-dropdown f2s-style-role-select"><option>${role}</option></select></div></li>`;
export const FEATURE_TEMPLATE_HTML = scene(
  'template',
  'A Slides layout with real title and body placeholders, next to the Decker panel mapping the deck colors to theme roles',
  `<div class="fs-layout">${slide('pillars', { layout: true })}</div>
  <div class="fs-panel dm-plugin"><section class="f2s-tmpl-section"><div class="f2s-section-head"><h3 class="f2s-tmpl-heading f2s-style-heading">Colors</h3><span class="f2s-btn f2s-btn--ghost">Suggest roles</span></div>
  <ul class="f2s-style-list">${colorRow(DECK.forest.toUpperCase(), 'Text &amp; background 1')}${colorRow(DECK.sand.toUpperCase(), 'Text &amp; background 4')}${colorRow(DECK.clay.toUpperCase(), 'Accent 1')}${colorRow(DECK.rust.toUpperCase(), 'Accent 2')}</ul></section></div>`,
);

/** Control : les frames choisies sur le canvas, triées dans le rail avant tout export. */
export const FEATURE_PICK_HTML = scene(
  'pick',
  'Two frames selected on the Figma canvas, and the Decker rail where a slide is being dragged to a new position',
  `<div class="fs-pickframes">${canvasFrameMini('Stats', 'stats')}${canvasFrameMini('Three pillars', 'pillars')}</div>` +
    pluginWindow(
      'fs-pwin--pick',
      `<div class="f2s-body"><aside class="f2s-sidebar">${railItem(1, 'cover', 'Cover')}${railItem(2, 'stats', 'Stats', 'is-dragging fs-lifted')}${railItem(3, 'pillars', 'Three pillars')}</aside></div>`,
    ) +
    `<span class="fs-cursor-at fs-cursor-at--pick">${CURSOR}</span>`,
);

/** Fidelity : le titre exporté est une vraie zone de texte Slides, en cours d'édition. */
export const FEATURE_NATIVE_HTML = scene(
  'native',
  'Google Slides editing the exported title as a native text box, with its font and size in the toolbar',
  `<div class="fs-gwin">${SLIDES_TOOLBAR}<div class="fs-gstage">${slide('pillars', { editing: true })}</div></div>
  <div class="fs-chip dm-plugin"><div class="f2s-logs-header"><h3 class="f2s-tmpl-heading">Content</h3><span class="f2s-toolbar-muted f2s-tabular">14 native &middot; 0 rasterized</span></div></div>`,
);

/** Privacy : le seul état que garde Decker, le compte connecté, visible et révocable. */
export const FEATURE_PRIVATE_HTML = scene(
  'private',
  'Decker settings showing the connected Google account with a Sign out button, and links to the Privacy Policy and Terms of Use',
  `<div class="dm-plugin fs-modal-host"><div class="f2s-modal" role="presentation">
    <header class="f2s-modal-header"><h2 class="f2s-modal-title">Settings</h2><span class="f2s-icon-btn">${ICONS.close}</span></header>
    <div class="f2s-modal-body"><section class="f2s-setting"><div class="f2s-setting-text"><h3 class="f2s-setting-title">Account</h3><p class="f2s-setting-desc">Signed in as <strong>ada@example.com</strong>.</p></div><span class="f2s-btn f2s-btn--secondary">Sign out</span></section></div>
    <footer class="f2s-modal-footer"><a>Privacy Policy</a><a>Terms of Use</a></footer>
  </div></div>`,
);

/* ---------- How it works ---------- */

const canvasFrame = (cls: string, name: string, kind: SlideKind, selected: boolean) =>
  `<div class="fs-frame ${cls}${selected ? ' is-selected' : ''}"><span class="fs-frame__name">${name}</span>${slide(kind)}${selected ? '<span class="fs-frame__h fs-frame__h--tl"></span><span class="fs-frame__h fs-frame__h--tr"></span><span class="fs-frame__h fs-frame__h--bl"></span><span class="fs-frame__h fs-frame__h--br"></span>' : ''}</div>`;

/** Étape 1 : le canvas Figma, deux frames prises au lasso sur trois. */
export const STEP_PICK_FRAMES_HTML = scene(
  'canvas',
  'Three frames on a Figma canvas, two of them selected with a drag',
  `${canvasFrame('fs-frame--a', 'Cover', 'cover', true)}${canvasFrame('fs-frame--b', 'Stats', 'stats', true)}${canvasFrame('fs-frame--c', 'Three pillars', 'pillars', false)}
  <span class="fs-marquee"></span><span class="fs-selsize f2s-tabular">2 frames</span><span class="fs-cursor-at fs-cursor-at--canvas">${CURSOR}</span>`,
);

/** Étape 2 : la même slide, moitié Figma, moitié Slides, sans écart. */
export const STEP_MATCHED_HTML = scene(
  'match',
  'The same slide split in half, Figma on the left and Google Slides on the right, lining up exactly',
  `<div class="fs-split fs-split--figma"><span class="fs-split__label">Figma</span><div class="fs-split__slide">${slide('stats')}</div></div>
  <div class="fs-split fs-split--slides"><span class="fs-split__label">Slides</span><div class="fs-split__slide">${slide('stats')}</div></div>
  <span class="fs-split__line"><i></i></span>`,
);

/** Étape 3 : le deck ouvert dans Slides, dans le Drive de l'utilisateur. */
export const STEP_GET_DECK_HTML = scene(
  'slides',
  'The exported Trailworn deck open in Google Slides, three slides in its filmstrip',
  `<div class="fs-swin"><div class="fs-sbar">${LIGHTS}<span class="fs-sbar__doc"></span><div><div class="fs-sbar__title">Trailworn deck</div><div class="fs-sbar__menu"><span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span></div></div></div>
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
  position: absolute; top: 0; left: 0; width: 400px; height: 250px;
  transform-origin: 0 0; transform: scale(var(--fs-scale, 0.8));
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
  position: absolute; left: 70px; top: 22px; width: 260px; padding: 16px; gap: 12px;
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
.fs-pwin--deck { left: 16px; top: 16px; width: 368px; height: 300px; }
.fs-pwin--deck .f2s-topbar { padding: 10px 12px; }
.fs-pwin--deck .f2s-sidebar { width: 128px; }
.fs-pwin--deck .f2s-canvas { padding: 14px 12px; justify-content: flex-start; align-items: stretch; }
.fs-pwin--deck .f2s-canvas-preview { width: 100%; }

/* Templates */
.fs--template { --fs-bg: var(--b-surface-subtle); }
.fs-layout { position: absolute; left: 16px; top: 28px; width: 250px; box-shadow: ${CHROME.shadow}; }
.fs-panel {
  position: absolute; right: 10px; top: 64px; width: 250px; padding: 4px;
  border-radius: var(--b-radius-md); box-shadow: ${CHROME.shadowWindow};
}
.fs-panel .f2s-style-role-select { width: 140px; min-width: 0; flex: none; }

/* Control */
.fs-pwin--pick { left: 24px; top: 16px; width: 190px; height: 300px; }
.fs-pwin--pick .f2s-sidebar { width: 100%; }
.fs-pickframes { position: absolute; left: 244px; top: 24px; display: grid; gap: 22px; }
.fs-pickframes .fs-frame { position: relative; width: 136px; }
.fs-lifted { transform: translate(18px, -6px) rotate(-1.5deg); }
.fs-lifted .f2s-frame-preview { box-shadow: ${CHROME.shadowWindow}; cursor: grabbing; }
.fs-cursor-at--pick { left: 150px; top: 200px; }

/* Fidelity */
.fs--native { --fs-bg: var(--b-surface-subtle); }
.fs-gwin {
  position: absolute; left: 24px; top: 20px; width: 420px; height: 260px; display: flex; flex-direction: column;
  border-radius: var(--b-radius-md); overflow: clip; background: #f9fbfd; box-shadow: ${CHROME.shadowWindow};
}
.fs-gtools {
  display: flex; align-items: center; gap: 4px; margin: 8px; padding: 4px 8px; border-radius: 999px;
  background: #edf2fa; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #444746;
}
.fs-gtool { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 24px; padding: 0 4px; border-radius: 4px; }
.fs-gtool--font { gap: 10px; padding: 0 8px; }
.fs-gtool--font i { width: 0; height: 0; border: 4px solid transparent; border-top-color: currentColor; margin-top: 4px; }
.fs-gtool--size { min-width: 30px; border: 1px solid #747775; }
.fs-gtool--color { text-decoration: underline 3px ${DECK.forest}; text-underline-offset: 3px; }
.fs-gsep { width: 1px; height: 18px; margin: 0 4px; background: #c7c7c7; }
.fs-gstage { flex: 1 1 auto; padding: 8px 0 0 16px; background: #f9fbfd; }
.fs-gstage .dm-slide { width: 420px; box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3); }
.fs-textbox { outline: 0.25cqw solid #1a73e8; outline-offset: 1cqw; }
.fs-textbox::after { content: ""; display: inline-block; width: 0.35cqw; height: 0.9em; margin-left: 0.3cqw; vertical-align: -0.08em; background: currentColor; }
.fs-chip {
  position: absolute; right: 16px; bottom: 18px; width: 210px; padding: 10px 12px;
  border-radius: var(--b-radius-md); box-shadow: ${CHROME.shadowWindow};
}

/* Privacy */
.fs--private { --fs-bg: var(--b-surface-subtle); }
.fs-modal-host { position: absolute; left: 32px; top: 28px; width: 336px; background: transparent; }
.fs .f2s-modal { opacity: 1; transform: none; transition: none; box-shadow: ${CHROME.shadowWindow}; }
.fs .f2s-modal-footer a { color: var(--color-text-muted); }

/* Canvas Figma (étape 1) */
.fs-frame { position: absolute; width: 150px; }
.fs-frame__name { display: block; margin-bottom: 4px; font-size: 10px; color: ${CHROME.label}; }
.fs-frame.is-selected .fs-frame__name { color: ${CHROME.select}; }
.fs-frame.is-selected .dm-slide { outline: 1.5px solid ${CHROME.select}; }
.fs-frame__h { position: absolute; width: 6px; height: 6px; background: ${CHROME.barText}; border: 1px solid ${CHROME.select}; }
.fs-frame__h--tl, .fs-frame__h--tr { top: 12px; }
.fs-frame__h--bl, .fs-frame__h--br { bottom: -3px; }
.fs-frame__h--tl, .fs-frame__h--bl { left: -3px; }
.fs-frame__h--tr, .fs-frame__h--br { right: -3px; }
.fs-frame--a { left: 30px; top: 26px; }
.fs-frame--b { left: 210px; top: 26px; }
.fs-frame--c { left: 30px; top: 150px; }
.fs-marquee {
  position: absolute; left: 18px; top: 18px; width: 356px; height: 112px;
  border: 1px solid ${CHROME.select}; background: color-mix(in srgb, ${CHROME.select} 10%, transparent);
}
.fs-selsize {
  position: absolute; left: 196px; top: 138px; translate: -50% 0; padding: 2px 5px; border-radius: var(--b-radius-2xs);
  background: ${CHROME.select}; color: ${CHROME.barText}; font-size: 10px; font-weight: var(--b-font-semibold); white-space: nowrap;
}
.fs-cursor-at--canvas { left: 368px; top: 124px; }

/* Étape 2 : comparaison Figma / Slides */
.fs-split { position: absolute; top: 0; bottom: 0; overflow: clip; }
.fs-split--figma { left: 0; width: 200px; background: ${CHROME.canvas}; }
.fs-split--slides { left: 200px; right: 0; background: #f9fbfd; }
.fs-split__slide { position: absolute; left: 40px; top: 56px; width: 320px; }
.fs-split--slides .fs-split__slide { left: -160px; }
.fs-split__label {
  position: absolute; top: 18px; padding: 3px 8px; border-radius: var(--b-radius-full);
  background: var(--b-surface); font-size: 11px; font-weight: var(--b-font-semibold); box-shadow: ${CHROME.shadow};
}
.fs-split--figma .fs-split__label { left: 40px; }
.fs-split--slides .fs-split__label { right: 40px; }
.fs-split__line { position: absolute; left: 199px; top: 0; bottom: 0; width: 2px; background: var(--b-accent); }
.fs-split__line i {
  position: absolute; left: 50%; top: 86%; width: 20px; height: 20px; translate: -50% -50%;
  border-radius: var(--b-radius-full); background: var(--b-accent); box-shadow: 0 0 0 3px var(--b-surface);
}

/* Étape 3 : le deck dans Slides */
.fs-swin {
  position: absolute; left: 20px; top: 18px; width: 520px; height: 300px; display: flex; flex-direction: column;
  border-radius: var(--b-radius-md); overflow: clip; background: var(--b-surface); box-shadow: ${CHROME.shadowWindow};
}
.fs-sbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 0; flex: none; border-bottom: 1px solid var(--b-border); }
.fs-sbar .dm-lights { padding-right: 4px; }
.fs-sbar__doc { width: 20px; height: 26px; flex: none; border-radius: var(--b-radius-2xs); background: ${SLIDES_YELLOW}; }
.fs-sbar__title { font-size: 15px; font-weight: var(--b-font-semibold); }
.fs-sbar__menu { display: flex; gap: 12px; margin-top: 2px; font-size: 12px; color: var(--b-text-muted); }
.fs-sbody { display: flex; flex: 1 1 auto; min-height: 0; background: var(--b-surface-muted); }
.fs-film { width: 110px; flex: none; padding: 10px; display: flex; flex-direction: column; gap: 8px; background: var(--b-surface); border-right: 1px solid var(--b-border); }
.fs-film__item { display: flex; gap: 6px; font-size: 11px; color: var(--b-text-muted); }
.fs-film__item .dm-slide { flex: 1 1 auto; outline: 2px solid transparent; }
.fs-film__item[aria-current="true"] .dm-slide { outline-color: ${SLIDES_YELLOW}; }
.fs-swin__stage { flex: 1 1 auto; padding: 16px; }
.fs-swin__stage .dm-slide { width: 300px; box-shadow: 0 2px 8px color-mix(in oklab, var(--b-ink) 12%, transparent); }
`;

/** Met chaque scène à l'échelle de sa card, comme la démo du hero. */
export const FEATURE_SCENES_JS = `(function () {
  var scenes = document.querySelectorAll('[data-fs]');
  if (!scenes.length || !window.ResizeObserver) return;
  var ro = new ResizeObserver(function (entries) {
    entries.forEach(function (e) { e.target.style.setProperty('--fs-scale', String(e.contentRect.width / 400)); });
  });
  scenes.forEach(function (s) { ro.observe(s); });
})();`;
