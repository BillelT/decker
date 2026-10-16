/**
 * Démo interactive du hero : remplace la vidéo de démo (décision du 16
 * octobre, roadmap 07). Une reproduction du plugin, posée sur un canvas Figma,
 * qui se joue seule avec un faux curseur (sélection de trois frames, Add
 * frames, Export, puis le deck ouvert dans Slides avec un titre vraiment
 * éditable). Dès que le visiteur clique ou tape dedans, le curseur s'efface et
 * la démo est à lui : tout ce qui est un bouton marche.
 *
 * La scène est dessinée à taille fixe (1200 x 680) puis mise à l'échelle de
 * son conteneur par le script, comme une capture : le plugin garde ses
 * proportions sur tous les écrans.
 *
 * Mouvement : la lecture automatique dépasse 5 s, d'où le bouton Pause
 * (WCAG 2.2.2). En mouvement réduit, rien ne se lance seul : la démo s'ouvre
 * avec les frames déjà ajoutées, et le bouton propose de la lire.
 *
 * Le JS est en `String.raw`, comme celui de l'easter egg : pas de backtick ni
 * de `${` dedans.
 */

/**
 * Couleurs du faux deck affiché dans la démo. Ce sont celles d'un deck de
 * client, pas de l'interface : elles restent hors des tokens de la DA, au même
 * titre qu'une capture d'écran.
 */
const DECK = {
  forest: '#2d3a33',
  sand: '#efe6d8',
  clay: '#c45a35',
  rust: '#8a3d24',
  paper: '#fbfaf9',
};

export const HERO_DEMO_CSS = `
/* ---------- Démo interactive du hero ---------- */
.dm {
  position: relative; width: 100%; aspect-ratio: 1200 / 680; overflow: hidden;
  border: 1px solid var(--b-border); background: var(--b-surface-muted);
  --dm-forest: ${DECK.forest}; --dm-sand: ${DECK.sand}; --dm-clay: ${DECK.clay};
  --dm-rust: ${DECK.rust}; --dm-paper: ${DECK.paper};
}
.dm-stage {
  position: absolute; top: 0; left: 0; width: 1200px; height: 680px;
  transform-origin: 0 0; transform: scale(var(--dm-scale, 1));
  font-size: 13px; line-height: var(--b-leading-tight); color: var(--b-ink);
  -webkit-user-select: none; user-select: none;
}
.dm button { font: inherit; color: inherit; touch-action: manipulation; }
.dm button:focus-visible { outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); }

/* Barre Figma */
.dm-figbar {
  position: absolute; inset: 0 0 auto; height: 40px; display: flex; align-items: center; gap: 12px;
  padding: 0 16px; background: var(--b-ink); color: var(--b-white); font-size: 12px; font-weight: var(--b-font-medium);
}
.dm-figbar__icon { width: 14px; height: 14px; border: 2px solid currentColor; opacity: 0.8; }
.dm-figbar__file { opacity: 0.9; }
.dm-figbar__file b { font-weight: var(--b-font-bold); }
.dm-figbar__run { margin-left: auto; opacity: 0.6; }

/* Canvas et frames */
.dm-canvas {
  position: absolute; inset: 40px 0 0; overflow: hidden;
  background-color: var(--b-surface-muted);
  background-image: radial-gradient(var(--b-gray-200) 1px, transparent 1px);
  background-size: 20px 20px;
}
.dm-frame {
  position: absolute; left: 870px; width: 290px; padding: 0; border: 0; background: none; cursor: pointer; text-align: left;
}
.dm-frame:nth-of-type(1) { top: 40px; }
.dm-frame:nth-of-type(2) { top: 238px; }
.dm-frame:nth-of-type(3) { top: 436px; }
.dm-frame__name { display: block; margin-bottom: 6px; font-size: 11px; color: var(--b-text-faint); }
.dm-frame .dm-slide { outline: 2px solid transparent; }
.dm-frame[aria-pressed="true"] .dm-slide { outline-color: var(--b-accent); }
.dm-frame[aria-pressed="true"] .dm-frame__name { color: var(--b-accent); font-weight: var(--b-font-semibold); }
.dm-frame__size {
  position: absolute; left: 50%; bottom: -22px; translate: -50% 0; padding: 2px 6px; display: none;
  background: var(--b-accent); color: var(--b-ink); font-size: 10px; font-weight: var(--b-font-bold); font-variant-numeric: tabular-nums;
}
.dm-frame[aria-pressed="true"] .dm-frame__size { display: block; }

/* Fenêtre du plugin */
.dm-plugin {
  position: absolute; left: 40px; top: 70px; width: 790px; height: 570px; display: flex; flex-direction: column;
  background: var(--b-surface);
  box-shadow: var(--hyb-out), 0 24px 48px color-mix(in oklab, var(--b-ink) 16%, transparent);
}
.dm-plugin__bar {
  display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; flex: none;
  border-bottom: 1px solid var(--b-border); font-size: 12px; font-weight: var(--b-font-bold);
}
.dm-plugin__bar svg { width: 16px; height: 16px; }
.dm-plugin__bar span:last-child { margin-left: auto; font-weight: var(--b-font-regular); color: var(--b-text-faint); }
.dm-head { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--b-border); flex: none; }
.dm-head__row { display: flex; align-items: center; gap: 10px; }
.dm-head__fonts { font-size: 11px; color: var(--b-text-muted); }
.dm-head__fonts b { color: var(--b-ink); }
.dm-tabs { display: flex; padding: 2px; background: var(--b-surface-muted); box-shadow: var(--hyb-in); }
.dm-tab { padding: 5px 12px; border: 0; background: none; font-size: 12px; font-weight: var(--b-font-semibold); color: var(--b-text-faint); cursor: pointer; }
.dm-tab[aria-selected="true"] { background: var(--b-surface); color: var(--b-ink); box-shadow: var(--hyb-out); }
.dm-name { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: var(--b-font-bold); }
.dm-name span { width: 150px; padding: 4px 6px; border: 1px solid var(--b-border); background: var(--b-surface); font-weight: var(--b-font-regular); color: var(--b-text-faint); }
.dm-head__actions { display: flex; gap: 8px; margin-left: auto; }
.dm-btn {
  display: inline-flex; align-items: center; padding: 6px 10px; border: 1px solid var(--b-ink); border-radius: 0;
  background: var(--b-surface); box-shadow: var(--hyb-out); font-size: 12px; font-weight: var(--b-font-bold); white-space: nowrap; cursor: pointer;
}
.dm-btn--muted { border-color: var(--b-gray-400); color: var(--b-text-faint); }
.dm-btn--cta { border-color: transparent; background: var(--b-accent); }
.dm-btn:disabled { cursor: default; opacity: 0.5; }
.dm-btn:active:not(:disabled) { box-shadow: var(--hyb-pressed); }

.dm-body { position: relative; display: flex; flex: 1 1 auto; min-height: 0; }
.dm-rail { width: 156px; flex: none; padding: 10px; border-right: 1px solid var(--b-border); overflow: hidden; }
.dm-rail__empty { margin: 8px 0 0; font-size: 11px; line-height: var(--b-leading-normal); color: var(--b-text-faint); }
.dm-thumb { margin-bottom: 12px; }
.dm-thumb__pick { display: block; width: 100%; padding: 0; border: 0; background: none; cursor: pointer; }
.dm-thumb__pick .dm-slide { outline: 2px solid transparent; outline-offset: 1px; }
.dm-thumb__pick[aria-current="true"] .dm-slide { outline-color: var(--b-accent); }
.dm-thumb__row { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; font-size: 11px; color: var(--b-text-muted); }
.dm-thumb__x { width: 20px; height: 20px; padding: 0; border: 0; background: none; cursor: pointer; font-size: 13px; color: var(--b-ink); }
.dm-main { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 16px 20px; min-width: 0; }
.dm-main__empty { max-width: 260px; margin: 0; text-align: center; font-size: 12px; line-height: var(--b-leading-normal); color: var(--b-text-faint); }
.dm-preview { position: relative; width: 420px; }
.dm-preview--narrow { width: 340px; }
.dm-report { width: 420px; padding: 10px 12px; background: var(--b-surface-subtle); box-shadow: var(--hyb-in); font-size: 11px; }
.dm-preview--narrow + .dm-report { width: 340px; }
.dm-report__head { display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: var(--b-font-bold); }
.dm-report__head span { font-weight: var(--b-font-regular); color: var(--b-text-muted); font-variant-numeric: tabular-nums; }
.dm-report p { margin: 0; color: var(--b-text-muted); }
.dm-aside[hidden] { display: none; }
.dm-aside { width: 190px; flex: none; padding: 10px; border-left: 1px solid var(--b-border); display: flex; flex-direction: column; gap: 10px; }
.dm-panel { padding: 8px 10px; background: var(--b-surface-subtle); box-shadow: var(--hyb-in); font-size: 11px; }
.dm-panel h3 { margin: 0 0 8px; font-size: 10px; font-weight: var(--b-font-semibold); letter-spacing: var(--b-tracking-wide); text-transform: uppercase; }
.dm-swatch { display: flex; align-items: center; gap: 6px; margin-top: 5px; color: var(--b-text-muted); }
.dm-swatch i { width: 14px; height: 14px; flex: none; box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--b-ink) 15%, transparent); }
.dm-foot { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-top: 1px solid var(--b-border); font-size: 11px; flex: none; }
.dm-foot span:first-child { padding: 4px 8px; box-shadow: var(--hyb-out); font-weight: var(--b-font-semibold); }
.dm-toast {
  position: absolute; top: 10px; left: 50%; translate: -50% 0; padding: 6px 10px; z-index: 2;
  background: var(--b-ink); color: var(--b-white); font-size: 11px; font-weight: var(--b-font-medium); white-space: nowrap;
}

/* Rôles de placeholder (mode Template) */
.dm-role { position: absolute; outline: 1px dashed var(--b-accent); }
.dm-role b {
  position: absolute; left: -1px; bottom: 100%; padding: 1px 4px; background: var(--b-accent); color: var(--b-ink);
  font-size: 9px; font-weight: var(--b-font-bold); font-family: var(--b-font-mono); white-space: nowrap;
}

/* Export en cours : la slide se construit bande par bande, comme dans le plugin. */
.dm-gen { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 420px; }
.dm-gen .dm-slide { width: 100%; }
.dm-gen__label { font-size: 12px; font-weight: var(--b-font-semibold); font-variant-numeric: tabular-nums; }
.dm-bar { width: 100%; height: 12px; padding: 2px; background: var(--b-surface-muted); box-shadow: var(--hyb-in); }
.dm-bar i { display: block; height: 100%; background: var(--b-accent); transform-origin: left center; transition: transform 300ms linear; }
@media (prefers-reduced-motion: no-preference) {
  .dm-gen .dm-slide { animation: dm-build 900ms steps(6, end) both; }
  @keyframes dm-build { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0 0); } }
}

/* Fenêtre Slides */
.dm-slides {
  position: absolute; left: 130px; top: 72px; width: 960px; height: 580px; display: flex; flex-direction: column;
  background: var(--b-surface);
  box-shadow: var(--hyb-out), 0 24px 48px color-mix(in oklab, var(--b-ink) 20%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  .dm-slides { animation: dm-pop 200ms var(--b-ease-out) both; }
  @keyframes dm-pop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
}
.dm-slides__bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--b-border); }
.dm-slides__doc { width: 22px; height: 28px; flex: none; background: var(--b-accent); }
.dm-slides__title { font-size: 15px; font-weight: var(--b-font-semibold); }
.dm-slides__menu { display: flex; gap: 12px; margin-top: 3px; font-size: 11px; color: var(--b-text-muted); }
.dm-slides__close { margin-left: auto; }
.dm-slides__body { display: flex; flex: 1 1 auto; min-height: 0; background: var(--b-surface-muted); }
.dm-film { width: 180px; flex: none; padding: 14px; display: flex; flex-direction: column; gap: 12px; background: var(--b-surface); border-right: 1px solid var(--b-border); }
.dm-film__item { display: flex; gap: 6px; padding: 0; border: 0; background: none; cursor: pointer; font-size: 11px; color: var(--b-text-faint); }
.dm-film__item .dm-slide { flex: 1 1 auto; outline: 2px solid transparent; }
.dm-film__item[aria-current="true"] .dm-slide { outline-color: var(--b-accent); }
.dm-slides__stage { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 20px; }
.dm-slides__stage > .dm-slide { width: 640px; box-shadow: 0 2px 8px color-mix(in oklab, var(--b-ink) 12%, transparent); }
.dm-slides__hint { margin: 0; font-size: 12px; color: var(--b-text-muted); }
.dm-edit { outline: 1px dashed transparent; outline-offset: 0.4cqw; cursor: text; -webkit-user-select: text; user-select: text; }
.dm-edit:hover, .dm-edit:focus, .dm-edit--active { outline-color: var(--b-accent); }
.dm-edit:focus { outline-style: solid; }
.dm-edit--active::after { content: ""; display: inline-block; width: 0.35cqw; height: 0.9em; margin-left: 0.3cqw; vertical-align: -0.08em; background: currentColor; }
@media (prefers-reduced-motion: no-preference) {
  .dm-edit--active::after { animation: dm-caret 1s steps(1, end) infinite; }
  @keyframes dm-caret { 50% { opacity: 0; } }
}

/* Curseur de la lecture automatique */
.dm-cursor {
  position: absolute; left: 0; top: 0; z-index: 5; width: 22px; height: 22px; pointer-events: none;
  transform: translate(1000px, 600px); transition: transform 700ms var(--b-ease-in-out), opacity 200ms var(--b-ease-out);
}
.dm-cursor[hidden] { display: block; opacity: 0; }
.dm-cursor svg { width: 100%; height: 100%; display: block; transition: scale 120ms var(--b-ease-out); }
.dm-cursor--down svg { scale: 0.85; }

/* ---------- Slides du faux deck (unités de conteneur : nettes à toutes les tailles) ---------- */
.dm-slide {
  position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; overflow: hidden;
  container-type: inline-size; font-family: var(--b-font-sans); text-align: left;
}
.dm-slide--cover { background: var(--dm-forest); color: var(--dm-paper); }
.dm-slide--pillars { background: var(--dm-sand); color: var(--dm-forest); }
.dm-slide--stats { background: var(--dm-clay); color: var(--dm-paper); }
.dm-s__title { position: absolute; left: 7cqw; top: 8cqw; margin: 0; font-size: 6.4cqw; font-weight: 700; line-height: 1.05; letter-spacing: -0.02em; }
.dm-slide--pillars .dm-s__title { font-size: 4.6cqw; }
.dm-s__sub { position: absolute; left: 7cqw; top: 25.5cqw; margin: 0; font-size: 2cqw; opacity: 0.75; }
.dm-s__hills { position: absolute; left: 0; bottom: 0; width: 100%; height: 42%; display: block; }
.dm-s__cols { position: absolute; left: 7cqw; right: 7cqw; top: 22cqw; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4cqw; }
.dm-s__num { display: block; font-size: 2.2cqw; font-weight: 700; color: var(--dm-clay); }
.dm-s__head { display: block; margin: 1cqw 0 1.6cqw; font-size: 2.4cqw; font-weight: 700; }
.dm-s__line { display: block; height: 0.9cqw; margin-bottom: 1cqw; background: color-mix(in oklab, var(--dm-forest) 22%, transparent); }
.dm-s__big { position: absolute; left: 7cqw; top: 5cqw; margin: 0; font-size: 21cqw; font-weight: 700; line-height: 1; letter-spacing: -0.04em; }
.dm-s__cap { position: absolute; left: 7cqw; top: 40cqw; margin: 0; max-width: 50cqw; font-size: 2.8cqw; line-height: 1.25; opacity: 0.9; }
.dm-s__ph {
  position: absolute; display: flex; align-items: center; padding: 0 1.5cqw;
  outline: 0.25cqw dashed currentColor; outline-offset: -0.25cqw; opacity: 0.6; font-size: 2.6cqw;
}

/* Bouton de lecture, sous la démo (pause obligatoire au-delà de 5 s). */
.hero__demo-controls { display: flex; justify-content: flex-end; margin-top: var(--b-space-12); }
.demo-toggle {
  display: inline-flex; align-items: center; gap: var(--b-space-8); padding: var(--b-space-4) 0; border: 0; background: none;
  font: inherit; font-size: var(--b-text-sm); font-weight: var(--b-font-medium); color: var(--b-text-muted); cursor: pointer;
  touch-action: manipulation;
}
.demo-toggle svg { width: 14px; height: 14px; display: block; }
.demo-toggle svg[hidden] { display: none; }
.demo-toggle:focus-visible { outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); }
@media (hover: hover) and (pointer: fine) {
  .demo-toggle:hover { color: var(--b-ink); }
}
`;

/** Collines de la slide de couverture. */
const HILLS = `<svg class="dm-s__hills" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120 L0 70 L70 20 L130 75 L190 35 L260 95 L330 30 L400 80 L400 120 Z" fill="${DECK.rust}"/><path d="M0 120 L0 95 L90 55 L170 100 L250 60 L320 105 L400 70 L400 120 Z" fill="${DECK.clay}"/></svg>`;

export const HERO_DEMO_HTML = `
<div class="dm" data-demo role="region" aria-label="Interactive demo of Decker in Figma">
  <div class="dm-stage" data-demo-stage>
    <div class="dm-figbar" aria-hidden="true">
      <span class="dm-figbar__icon"></span>
      <span class="dm-figbar__file">Drafts / <b>Q3 Review</b></span>
      <span class="dm-figbar__run">Plugins / Decker</span>
    </div>
    <div class="dm-canvas" data-demo-canvas></div>
    <section class="dm-plugin" aria-label="Decker plugin">
      <div class="dm-plugin__bar" aria-hidden="true">
        <svg viewBox="0 0 32 32" shape-rendering="crispEdges"><rect x="3" y="15" width="20" height="14" fill="#7a3b12" stroke="#1a0d02"/><rect x="6" y="10" width="20" height="14" fill="#c1651c" stroke="#1a0d02"/><rect x="9" y="5" width="20" height="14" fill="#ffb238" stroke="#1a0d02"/></svg>
        <span>Decker</span><span>&times;</span>
      </div>
      <div class="dm-head">
        <div class="dm-head__row">
          <div class="dm-tabs" role="tablist" aria-label="Mode">
            <button type="button" class="dm-tab" role="tab" data-mode="deck" aria-selected="true">Deck</button>
            <button type="button" class="dm-tab" role="tab" data-mode="template" aria-selected="false">Templates</button>
          </div>
          <div class="dm-name" aria-hidden="true">Name: <span data-demo-name>Decker export</span></div>
          <div class="dm-head__actions">
            <button type="button" class="dm-btn dm-btn--muted" data-act="add">Add frames</button>
            <button type="button" class="dm-btn" data-act="prepare">Prepare for Slides</button>
            <button type="button" class="dm-btn dm-btn--cta" data-act="export">Export</button>
          </div>
        </div>
        <div class="dm-head__fonts" aria-hidden="true">Fonts: <b>Cabinet Grotesk</b> &rarr; <b>Cabinet Grotesk</b></div>
      </div>
      <div class="dm-body">
        <div class="dm-rail" data-demo-rail></div>
        <div class="dm-main" data-demo-main></div>
        <div class="dm-aside" data-demo-aside hidden></div>
        <p class="dm-toast" data-demo-toast role="status" hidden></p>
      </div>
      <div class="dm-foot" aria-hidden="true"><span>Settings</span><span>Buy me a coffee &nearr;</span></div>
    </section>
    <div data-demo-slides></div>
    <div class="dm-cursor" data-demo-cursor aria-hidden="true" hidden>
      <svg viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.6 L12.2 14.2 L19 14 Z" fill="var(--b-ink)" stroke="var(--b-white)" stroke-width="1.5" stroke-linejoin="round"/></svg>
    </div>
  </div>
</div>
<div class="hero__demo-controls">
  <button type="button" class="demo-toggle" data-demo-toggle>
    <svg data-icon="pause" viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="2" width="3" height="10" fill="currentColor"/><rect x="8" y="2" width="3" height="10" fill="currentColor"/></svg>
    <svg data-icon="play" viewBox="0 0 14 14" aria-hidden="true" hidden><path d="M3 2 L12 7 L3 12 Z" fill="currentColor"/></svg>
    <span data-demo-toggle-label>Pause demo</span>
  </button>
</div>`;

const DEMO_JS = String.raw`
var demo = document.querySelector('[data-demo]');
if (!demo) return;
var q = function (sel) { return demo.querySelector(sel); };
var stage = q('[data-demo-stage]');
var canvas = q('[data-demo-canvas]');
var rail = q('[data-demo-rail]');
var main = q('[data-demo-main]');
var aside = q('[data-demo-aside]');
var toast = q('[data-demo-toast]');
var slidesHost = q('[data-demo-slides]');
var cursor = q('[data-demo-cursor]');
var nameEl = q('[data-demo-name]');
var toggle = document.querySelector('[data-demo-toggle]');
var toggleLabel = document.querySelector('[data-demo-toggle-label]');
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var FRAMES = [
  /* Rôles de placeholder : [rôle, gauche, haut, largeur, hauteur], en cqw. */
  { name: 'Cover', kind: 'cover', native: 9, roles: [['title', 6, 7, 62, 12], ['subtitle', 6, 24.5, 40, 4]] },
  { name: 'Three pillars', kind: 'pillars', native: 14, roles: [['title', 6, 7, 72, 8], ['body', 6, 21, 88, 24]] },
  { name: 'Stats', kind: 'stats', native: 4, roles: [['title', 6, 4, 50, 23], ['body', 6, 39, 52, 10]] }
];
var COLORS = [
  ['var(--dm-forest)', 'Text & background 1'],
  ['var(--dm-paper)', 'Text & background 2'],
  ['var(--dm-sand)', 'Text & background 3'],
  ['var(--dm-clay)', 'Accent 1'],
  ['var(--dm-rust)', 'Accent 2']
];

/* ---------- Slides du faux deck ---------- */
function slideHtml(i, opts) {
  opts = opts || {};
  var f = FRAMES[i];
  var edit = opts.editable ? ' dm-edit" contenteditable="true" spellcheck="false" data-demo-edit="' : '';
  var body = '';
  var box = function (r) {
    return 'left:' + r[1] + 'cqw;top:' + r[2] + 'cqw;width:' + r[3] + 'cqw;height:' + r[4] + 'cqw';
  };
  if (opts.layout) {
    var label = { title: 'Click to add title', subtitle: 'Click to add subtitle', body: 'Click to add text' };
    body = f.roles.map(function (r) {
      return '<span class="dm-s__ph" style="' + box(r) + '">' + label[r[0]] + '</span>';
    }).join('') + (f.kind === 'cover' ? HILLS : '');
    return '<span class="dm-slide dm-slide--' + f.kind + '">' + body + '</span>';
  }
  if (f.kind === 'cover') {
    body = '<span class="dm-s__title' + edit + '">Built for the long run.</span>' +
      '<span class="dm-s__sub">Q3 review &middot; Product team</span>' + HILLS;
  } else if (f.kind === 'pillars') {
    var col = function (n, h) {
      return '<span><span class="dm-s__num">' + n + '</span><span class="dm-s__head">' + h + '</span><span class="dm-s__line"></span><span class="dm-s__line" style="width:80%"></span><span class="dm-s__line" style="width:60%"></span></span>';
    };
    body = '<span class="dm-s__title' + edit + '">Three pillars, one promise</span>' +
      '<span class="dm-s__cols">' + col('01', 'Craft') + col('02', 'Speed') + col('03', 'Care') + '</span>';
  } else {
    body = '<span class="dm-s__big' + edit + '">87%</span>' +
      '<span class="dm-s__cap">of our clients keep every deck editable after the handoff.</span>';
  }
  if (opts.roles) {
    body += f.roles.map(function (r) {
      return '<span class="dm-role" style="' + box(r) + '"><b>[[' + r[0] + ']]</b></span>';
    }).join('');
  }
  return '<span class="dm-slide dm-slide--' + f.kind + '">' + body + '</span>';
}

/* ---------- État ---------- */
var st;
function freshState() {
  return { mode: 'deck', selected: [], rail: [], active: -1, busy: false, slides: null, slideIndex: 0, toastTimer: 0 };
}

function esc(text) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/* Re-rendre une zone fait perdre le focus clavier : on le rend à l'élément
   qui porte la même clé après coup. */
function keepFocus(fn) {
  var a = document.activeElement;
  var key = a && demo.contains(a) ? a.getAttribute('data-key') : null;
  fn();
  if (key) {
    var next = demo.querySelector('[data-key="' + key + '"]');
    if (next) next.focus();
  }
}

function renderCanvas() {
  keepFocus(function () {
    canvas.innerHTML = FRAMES.map(function (f, i) {
      return '<button type="button" class="dm-frame" data-frame="' + i + '" data-key="frame-' + i + '" aria-pressed="' + (st.selected.indexOf(i) > -1) + '">' +
        '<span class="dm-frame__name">' + esc(f.name) + '</span>' + slideHtml(i) +
        '<span class="dm-frame__size">1920 &times; 1080</span></button>';
    }).join('');
  });
  var addBtn = q('[data-act="add"]');
  addBtn.classList.toggle('dm-btn--muted', st.selected.length === 0);
}

function renderRail() {
  keepFocus(function () {
    if (!st.rail.length) {
      rail.innerHTML = '<p class="dm-rail__empty">' + (st.mode === 'deck' ? 'Your frames will line up here.' : 'Your layouts will line up here.') + '</p>';
      return;
    }
    rail.innerHTML = st.rail.map(function (i, pos) {
      var f = FRAMES[i];
      return '<div class="dm-thumb"><button type="button" class="dm-thumb__pick" data-pick="' + i + '" data-key="pick-' + i + '" aria-label="Show ' + esc(f.name) + '" aria-current="' + (st.active === i) + '">' + slideHtml(i) + '</button>' +
        '<div class="dm-thumb__row"><span>' + (pos + 1) + '. ' + esc(f.name) + '</span>' +
        '<button type="button" class="dm-thumb__x" data-remove="' + i + '" data-key="remove-' + i + '" aria-label="Remove ' + esc(f.name) + '">&times;</button></div></div>';
    }).join('');
  });
}

function renderMain() {
  if (st.busy) return;
  keepFocus(function () {
    if (st.active < 0) {
      main.innerHTML = '<p class="dm-main__empty">Select frames on the canvas, then press <b>Add frames</b>.</p>';
      return;
    }
    var f = FRAMES[st.active];
    if (st.mode === 'deck') {
      main.innerHTML = '<div class="dm-preview">' + slideHtml(st.active) + '</div>' +
        '<div class="dm-report"><div class="dm-report__head">Content <span>' + f.native + ' native &middot; 0 rasterized</span></div><p>No issues detected on this frame.</p></div>';
    } else {
      main.innerHTML = '<div class="dm-preview dm-preview--narrow">' + slideHtml(st.active, { roles: true }) + '</div>' +
        '<div class="dm-report"><div class="dm-report__head">Composition <span>' + f.roles.length + ' placeholders</span></div><p>' +
        f.roles.map(function (r) { return '[[' + r[0] + ']]'; }).join(', ') + ' become real Slides placeholders.</p></div>';
    }
  });
}

function renderAside() {
  aside.hidden = st.mode !== 'template';
  if (aside.hidden) return;
  aside.innerHTML = '<div class="dm-panel"><h3>Colors</h3>' +
    COLORS.map(function (c) { return '<div class="dm-swatch"><i style="background:' + c[0] + '"></i>' + c[1] + '</div>'; }).join('') +
    '</div><div class="dm-panel"><h3>Typography</h3><div class="dm-swatch">Title &middot; Cabinet Grotesk Bold</div><div class="dm-swatch">Body &middot; Cabinet Grotesk</div></div>';
}

function renderMode() {
  demo.querySelectorAll('[data-mode]').forEach(function (t) {
    t.setAttribute('aria-selected', String(t.getAttribute('data-mode') === st.mode));
  });
  q('[data-act="export"]').textContent = st.mode === 'deck' ? 'Export' : 'Create template';
  nameEl.textContent = st.mode === 'deck' ? 'Decker export' : 'Q3 theme';
}

function renderAll() {
  renderMode();
  renderCanvas();
  renderRail();
  renderMain();
  renderAside();
  renderSlides();
}

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(st.toastTimer);
  st.toastTimer = window.setTimeout(function () { toast.hidden = true; }, 2600);
}

/* ---------- Fenêtre Slides ---------- */
function renderSlides() {
  if (!st.slides) {
    slidesHost.innerHTML = '';
    return;
  }
  var layout = st.slides === 'template';
  var idx = st.slideIndex;
  keepFocus(function () {
    slidesHost.innerHTML = '<section class="dm-slides" aria-label="The exported presentation in Google Slides">' +
      '<div class="dm-slides__bar"><span class="dm-slides__doc" aria-hidden="true"></span><div>' +
      '<div class="dm-slides__title">' + (layout ? 'Q3 theme' : 'Decker export') + '</div>' +
      '<div class="dm-slides__menu" aria-hidden="true"><span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Slide</span></div></div>' +
      '<button type="button" class="dm-btn dm-slides__close" data-act="close-slides" data-key="close-slides">Back to Figma</button></div>' +
      '<div class="dm-slides__body"><div class="dm-film">' +
      st.rail.map(function (i, pos) {
        return '<button type="button" class="dm-film__item" data-film="' + pos + '" data-key="film-' + pos + '" aria-label="Slide ' + (pos + 1) + '" aria-current="' + (pos === idx) + '"><span>' + (pos + 1) + '</span>' + slideHtml(i, { layout: layout }) + '</button>';
      }).join('') +
      '</div><div class="dm-slides__stage">' + slideHtml(st.rail[idx], { layout: layout, editable: !layout }) +
      '<p class="dm-slides__hint">' + (layout ? 'Theme colors, fonts, and layouts with real placeholders, ready to reuse.' : 'Real Slides objects: click the title and type.') + '</p>' +
      '</div></div></section>';
  });
}

/* ---------- Actions ---------- */
function act(name, arg) {
  if (name === 'frame') {
    if (st.busy) return;
    var at = st.selected.indexOf(arg);
    if (at > -1) st.selected.splice(at, 1); else st.selected.push(arg);
    renderCanvas();
  } else if (name === 'add') {
    if (st.busy) return;
    if (!st.selected.length) { showToast('Select frames on the canvas first.'); return; }
    st.selected.slice().sort().forEach(function (i) { if (st.rail.indexOf(i) === -1) st.rail.push(i); });
    if (st.active < 0) st.active = st.rail[0];
    st.selected = [];
    renderCanvas();
    renderRail();
    renderMain();
  } else if (name === 'pick') {
    if (st.busy) return;
    st.active = arg;
    renderRail();
    renderMain();
  } else if (name === 'remove') {
    if (st.busy) return;
    st.rail = st.rail.filter(function (i) { return i !== arg; });
    if (st.active === arg) st.active = st.rail.length ? st.rail[0] : -1;
    renderRail();
    renderMain();
  } else if (name === 'mode') {
    if (st.busy || st.mode === arg) return;
    st.mode = arg;
    renderMode();
    renderRail();
    renderMain();
    renderAside();
  } else if (name === 'prepare') {
    showToast('Prepare for Slides makes a Slides-ready copy of each frame.');
  } else if (name === 'export') {
    if (st.busy) return;
    if (!st.rail.length) { showToast('Add frames first.'); return; }
    return runExport(st.run);
  } else if (name === 'close-slides') {
    var a = document.activeElement;
    var hadFocus = a && a.getAttribute && a.getAttribute('data-key') === 'close-slides';
    st.slides = null;
    renderSlides();
    if (hadFocus) q('[data-act="export"]').focus();
  } else if (name === 'film') {
    st.slideIndex = arg;
    renderSlides();
  }
}

function runExport(run) {
  st.busy = true;
  var total = st.rail.length;
  var step = 0;
  var deck = st.mode === 'deck';
  return new Promise(function (resolve) {
    var next = function () {
      if (run !== st.run) { resolve(); return; }
      if (step >= total) {
        st.busy = false;
        st.slides = st.mode;
        st.slideIndex = 0;
        renderMain();
        renderSlides();
        resolve();
        return;
      }
      var i = st.rail[step];
      main.innerHTML = '<div class="dm-gen">' + slideHtml(i) +
        '<span class="dm-gen__label">' + (deck ? 'Generating slide ' : 'Writing layout ') + (step + 1) + ' of ' + total + '</span>' +
        '<span class="dm-bar"><i style="transform:scaleX(' + ((step + 1) / total) + ')"></i></span></div>';
      step += 1;
      window.setTimeout(next, reduceMotion ? 500 : 1000);
    };
    next();
  });
}

demo.addEventListener('click', function (e) {
  var t = e.target.closest('button');
  if (!t || !demo.contains(t)) return;
  if (t.hasAttribute('data-frame')) act('frame', Number(t.getAttribute('data-frame')));
  else if (t.hasAttribute('data-pick')) act('pick', Number(t.getAttribute('data-pick')));
  else if (t.hasAttribute('data-remove')) act('remove', Number(t.getAttribute('data-remove')));
  else if (t.hasAttribute('data-mode')) act('mode', t.getAttribute('data-mode'));
  else if (t.hasAttribute('data-film')) act('film', Number(t.getAttribute('data-film')));
  else if (t.hasAttribute('data-act')) act(t.getAttribute('data-act'));
});
/* Entrée dans le titre éditable : pas de saut de ligne, on sort du champ. */
demo.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-demo-edit')) {
    e.preventDefault();
    e.target.blur();
  }
});

/* ---------- Mise à l'échelle ---------- */
var fit = function () {
  var w = demo.clientWidth;
  if (w) demo.style.setProperty('--dm-scale', String(w / 1200));
};
fit();
if (window.ResizeObserver) new ResizeObserver(fit).observe(demo); else window.addEventListener('resize', fit);

/* ---------- Lecture automatique ---------- */
var playState = 'off';
var visible = false;

function setToggle(state) {
  playState = state;
  var playing = state === 'playing';
  /* SVG : pas de propriété hidden, d'où l'attribut. */
  toggle.querySelector('[data-icon="pause"]').toggleAttribute('hidden', !playing);
  toggle.querySelector('[data-icon="play"]').toggleAttribute('hidden', playing);
  toggleLabel.textContent = playing ? 'Pause demo' : state === 'paused' ? 'Play demo' : 'Replay demo';
}

/* Attente qui ne compte que le temps où la démo joue et se voit : elle se
   fige en pause ou hors écran, et s'arrête net si la lecture est annulée. */
function wait(ms, run) {
  return new Promise(function (resolve, reject) {
    var left = ms;
    var tick = function () {
      if (run !== st.run) { reject(new Error('cancelled')); return; }
      if (playState === 'playing' && visible) left -= 100;
      if (left <= 0) resolve(); else window.setTimeout(tick, 100);
    };
    window.setTimeout(tick, 100);
  });
}

function pointAt(el) {
  var scale = parseFloat(demo.style.getPropertyValue('--dm-scale')) || 1;
  var r = el.getBoundingClientRect();
  var s = stage.getBoundingClientRect();
  return { x: (r.left - s.left + r.width * 0.55) / scale, y: (r.top - s.top + r.height * 0.55) / scale };
}

function moveTo(sel, run) {
  var el = typeof sel === 'string' ? demo.querySelector(sel) : sel;
  if (!el) return Promise.resolve();
  var p = pointAt(el);
  cursor.hidden = false;
  cursor.style.transform = 'translate(' + p.x + 'px, ' + p.y + 'px)';
  return wait(750, run);
}

function press(sel, run) {
  return moveTo(sel, run).then(function () {
    cursor.classList.add('dm-cursor--down');
    return wait(150, run);
  }).then(function () {
    cursor.classList.remove('dm-cursor--down');
    var el = demo.querySelector(sel);
    if (el) el.click();
    return wait(350, run);
  });
}

function script(run) {
  return wait(600, run)
    .then(function () { return press('[data-frame="0"]', run); })
    .then(function () { return press('[data-frame="1"]', run); })
    .then(function () { return press('[data-frame="2"]', run); })
    .then(function () { return press('[data-act="add"]', run); })
    .then(function () { return wait(500, run); })
    .then(function () { return press('[data-pick="2"]', run); })
    .then(function () { return wait(700, run); })
    .then(function () { return press('[data-act="export"]', run); })
    .then(function () {
      return new Promise(function (resolve, reject) {
        var check = function () {
          if (run !== st.run) { reject(new Error('cancelled')); return; }
          if (st.slides) resolve(); else window.setTimeout(check, 100);
        };
        check();
      });
    })
    .then(function () { return wait(600, run); })
    .then(function () { return moveTo('[data-demo-edit]', run); })
    .then(function () {
      var edit = demo.querySelector('[data-demo-edit]');
      if (edit) edit.classList.add('dm-edit--active');
      return wait(2600, run);
    })
    .then(function () { return press('[data-act="close-slides"]', run); })
    .then(function () { return wait(800, run); });
}

function reset() {
  if (st) window.clearTimeout(st.toastTimer);
  var run = st ? st.run + 1 : 1;
  st = freshState();
  st.run = run;
  toast.hidden = true;
  renderAll();
  return run;
}

function autoplay() {
  var run = reset();
  setToggle('playing');
  var loop = function () {
    script(run).then(function () {
      if (run !== st.run) return;
      st.selected = []; st.rail = []; st.active = -1; st.slides = null;
      renderAll();
      loop();
    }, function () {});
  };
  loop();
}

/* Le visiteur prend la main : la lecture s'arrête, la démo reste dans son
   état du moment, sans curseur. */
function takeOver() {
  if (playState !== 'playing' && playState !== 'paused') return;
  st.run += 1;
  st.busy = false;
  cursor.hidden = true;
  var edit = demo.querySelector('.dm-edit--active');
  if (edit) edit.classList.remove('dm-edit--active');
  setToggle('off');
  renderMain();
}
demo.addEventListener('pointerdown', takeOver);
demo.addEventListener('keydown', takeOver);

toggle.addEventListener('click', function () {
  if (playState === 'playing') setToggle('paused');
  else if (playState === 'paused') setToggle('playing');
  else autoplay();
});

if ('IntersectionObserver' in window) {
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
  }, { threshold: 0.3 }).observe(demo);
} else {
  visible = true;
}

if (reduceMotion) {
  /* Rien ne bouge seul : les frames sont déjà là, la lecture se demande. */
  reset();
  st.rail = [0, 1, 2];
  st.active = 0;
  renderAll();
  setToggle('off');
  toggleLabel.textContent = 'Play demo';
} else {
  autoplay();
}
`;

export const HERO_DEMO_JS = `(function () {\nvar HILLS = ${JSON.stringify(HILLS)};\n${DEMO_JS}\n})();`;
