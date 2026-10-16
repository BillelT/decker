/**
 * Démo interactive du hero : remplace la vidéo de démo (décision du 16
 * octobre, roadmap 07). Le vrai plugin, recopié dans une fenêtre Figma
 * desktop (macOS) : même markup, mêmes classes f2s-*, et le CSS du plugin
 * lui-même, régénéré par scripts/sync-plugin-styles.mjs et scopé sous
 * `.dm-plugin`. Seul l'habillage autour (barre d'onglets Figma, canvas,
 * fenêtre du plugin) est propre à la démo.
 *
 * Elle se joue une fois avec un faux curseur (sélection de trois frames, Add,
 * réordonnancement dans le rail, puis le mode Templates), et s'arrête sur un
 * état à explorer : rail, polices, rôles, couleurs. Pas de faux export
 * (décision du 16 octobre) : Export et Create template renvoient vers le
 * vrai plugin. Dès que le visiteur clique ou tape dedans, le curseur
 * s'efface et la démo est à lui.
 * Pas de bouton pause (décision du 16 octobre) : la lecture ne boucle pas, et
 * ne tourne que lorsque la démo est à l'écran.
 *
 * La scène est dessinée à taille fixe (1440 x 840, le plugin à sa taille
 * minimale réelle) puis mise à l'échelle de son conteneur par le script,
 * comme une capture.
 *
 * Le JS est en `String.raw`, comme celui de l'easter egg : pas de backtick ni
 * de `${` dedans.
 */
import { PLUGIN_STYLES_CSS } from '../generated/pluginStyles.js';

/**
 * Couleurs du faux deck affiché dans la démo. Ce sont celles d'un deck de
 * client (Trailworn, notre deck fictif), pas de l'interface : elles restent
 * hors des tokens de la DA, au même titre qu'une capture d'écran.
 */
const DECK = {
  forest: '#2d3a33',
  sand: '#efe6d8',
  clay: '#c45a35',
  rust: '#8a3d24',
  paper: '#fbfaf9',
};

/**
 * Chrome de Figma desktop et de macOS, recopié comme une capture : ce sont
 * leurs couleurs et leurs ombres, pas celles de la DA.
 */
const CHROME = {
  bar: '#2c2c2c',
  tab: '#3d3d3d',
  barText: '#ffffff',
  barMuted: '#b3b3b3',
  canvas: '#e5e5e5',
  select: '#0d99ff',
  label: '#808080',
  close: '#ff5f57',
  minimize: '#febc2e',
  zoom: '#28c840',
  shadow: '0 0 0.5px rgba(0, 0, 0, 0.15), 0 5px 12px rgba(0, 0, 0, 0.13), 0 1px 3px rgba(0, 0, 0, 0.1)',
  shadowWindow: '0 0 0.5px rgba(0, 0, 0, 0.3), 0 20px 48px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.12)',
};

export const HERO_DEMO_CSS = `
/* ---------- Démo interactive du hero ---------- */
${PLUGIN_STYLES_CSS}

/* overflow: clip partout, jamais hidden : un bloc en hidden reste un
   conteneur de défilement, et avec le overscroll-behavior: contain que la DA
   (et le plugin) posent, la molette se perdait dessus au lieu de faire
   défiler la page (même bug que le rail du plugin et le carrousel). */
.dm, .dm *, .dm .dm-plugin, .dm .dm-plugin * { overscroll-behavior: auto; }
.dm {
  position: relative; width: 100%; aspect-ratio: 1440 / 840; overflow: clip;
  border-radius: var(--b-radius-md); background: ${CHROME.canvas};
  box-shadow: ${CHROME.shadowWindow};
  --dm-forest: ${DECK.forest}; --dm-sand: ${DECK.sand}; --dm-clay: ${DECK.clay};
  --dm-rust: ${DECK.rust}; --dm-paper: ${DECK.paper};
  --dm-deck-font: Arial, Helvetica, sans-serif;
}
.dm-stage {
  position: absolute; top: 0; left: 0; width: 1440px; height: 840px;
  transform-origin: 0 0; transform: scale(var(--dm-scale, 1));
  font-size: 12px; line-height: var(--b-leading-tight); color: var(--b-ink);
}
.dm-tabbar button, .dm-canvas button { font: inherit; color: inherit; touch-action: manipulation; }
.dm button:focus-visible { outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); }

/* Barre d'onglets de Figma desktop, version macOS */
.dm-tabbar {
  position: absolute; inset: 0 0 auto; height: 40px; display: flex; align-items: stretch;
  background: ${CHROME.bar}; color: ${CHROME.barMuted}; font-family: var(--b-font-sans); font-size: 12px;
  -webkit-user-select: none; user-select: none;
}
.dm-lights { display: flex; align-items: center; gap: 8px; padding: 0 16px 0 14px; }
.dm-lights i { width: 12px; height: 12px; border-radius: var(--b-radius-full); }
.dm-lights i:nth-child(1) { background: ${CHROME.close}; }
.dm-lights i:nth-child(2) { background: ${CHROME.minimize}; }
.dm-lights i:nth-child(3) { background: ${CHROME.zoom}; }
.dm-home { display: flex; align-items: center; padding: 0 12px; }
.dm-home svg, .dm-ftab svg { width: 16px; height: 16px; display: block; flex: none; }
.dm-ftabs { display: flex; }
.dm .dm-ftab {
  display: flex; align-items: center; gap: 8px; min-width: 190px; padding: 0 12px; border: 0; border-radius: 0;
  background: transparent; color: ${CHROME.barMuted}; font-weight: var(--b-font-medium); cursor: pointer;
}
.dm .dm-ftab[aria-selected="true"] { background: ${CHROME.tab}; color: ${CHROME.barText}; font-weight: var(--b-font-semibold); }
.dm-ftab__x { margin-left: auto; font-size: 14px; opacity: 0; }
.dm-ftab[aria-selected="true"] .dm-ftab__x { opacity: 0.8; }
@media (hover: hover) and (pointer: fine) {
  .dm .dm-ftab:hover { color: ${CHROME.barText}; }
}

/* Canvas Figma (uni, sans grille de points : Figma n'en affiche pas) */
.dm-canvas { position: absolute; inset: 40px 0 0; overflow: clip; background: ${CHROME.canvas}; }
.dm .dm-frame {
  position: absolute; left: 1046px; width: 360px; padding: 0; border: 0; background: none; cursor: default; text-align: left;
  font-family: var(--b-font-sans);
}
.dm-frame:nth-of-type(1) { top: 26px; }
.dm-frame:nth-of-type(2) { top: 280px; }
.dm-frame:nth-of-type(3) { top: 534px; }
.dm-frame__name { display: block; margin-bottom: 6px; font-size: 11px; color: ${CHROME.label}; }
.dm-frame .dm-slide { outline: 1px solid transparent; }
.dm-frame[aria-pressed="true"] .dm-slide { outline: 1.5px solid ${CHROME.select}; }
.dm-frame[aria-pressed="true"] .dm-frame__name { color: ${CHROME.select}; }
@media (hover: hover) and (pointer: fine) {
  .dm-frame:hover .dm-slide { outline: 1.5px solid ${CHROME.select}; }
}
.dm-frame__size {
  position: absolute; left: 50%; bottom: -24px; translate: -50% 0; padding: 2px 4px; display: none;
  border-radius: var(--b-radius-2xs); background: ${CHROME.select}; color: ${CHROME.barText};
  font-size: 10px; font-weight: var(--b-font-semibold); font-variant-numeric: tabular-nums; white-space: nowrap;
}
.dm-frame[aria-pressed="true"] .dm-frame__size { display: block; }

/* Fenêtre du plugin, telle que Figma la dessine */
.dm-pwin {
  position: absolute; left: 32px; top: 72px; width: 960px; height: 640px; display: flex; flex-direction: column;
  overflow: clip; border-radius: var(--b-radius-md); background: var(--b-surface); box-shadow: ${CHROME.shadow};
}
.dm-pwin__bar {
  display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 8px 0 12px; flex: none;
  background: ${CHROME.bar}; color: ${CHROME.barText}; font-family: var(--b-font-sans); font-size: 12px; font-weight: var(--b-font-semibold);
  -webkit-user-select: none; user-select: none;
}
.dm-pwin__bar svg { width: 16px; height: 16px; display: block; }
.dm-pwin__x { margin-left: auto; display: flex; padding: 8px; color: ${CHROME.barMuted}; }
.dm .dm-pwin .dm-plugin { flex: 1 1 auto; min-height: 0; height: auto; }
/* Les panneaux du plugin défilent, mais seulement une fois que le visiteur a
   cliqué dans la démo : avant, la molette qui traverse la page passerait par
   eux et s'y arrêterait au lieu de faire défiler la page. */
.dm:not(.is-engaged) .dm-plugin .f2s-sidebar,
.dm:not(.is-engaged) .dm-plugin .f2s-canvas,
.dm:not(.is-engaged) .dm-plugin .f2s-style-aside { overflow: clip; }

/* Ajustements du plugin propres à la démo */
/* La liste des polices est en position fixe dans le plugin : dans la scène
   mise à l'échelle, elle se cale sous son champ. */
.dm .dm-plugin .f2s-font-combobox { position: relative; }
.dm .dm-plugin .f2s-font-combobox-list { position: absolute; top: calc(100% + 4px); left: -1px; min-width: calc(100% + 2px); }
.dm .dm-plugin .f2s-canvas-preview .dm-slide { width: 100%; }
.dm .dm-plugin .f2s-frame-preview .dm-slide { width: 100%; height: 100%; pointer-events: none; }
.dm .f2s-sidebar[hidden], .dm .f2s-style-aside[hidden] { display: none; }
.dm .dm-plugin .f2s-style-font-swatch { font-family: var(--dm-deck-font); }
/* Calque posé sur la démo pendant la lecture automatique. Le script remplace
   sans cesse les éléments sous le pointeur, et Chrome perd la molette quand
   l'élément qu'il défilait disparaît en plein geste : la page se figeait. Le
   calque, lui, ne bouge jamais, donc la molette passe à la page. Un clic
   dessus rend la main au visiteur et est transmis à ce qu'il visait. */
.dm-shield { position: absolute; inset: 0; z-index: 6; cursor: pointer; }
.dm-shield[hidden] { display: none; }

/* Curseur de la lecture automatique */
.dm-cursor {
  position: absolute; left: 0; top: 0; z-index: 5; width: 22px; height: 22px; pointer-events: none;
  transform: translate(1200px, 700px); transition: transform 700ms var(--b-ease-in-out), opacity 200ms var(--b-ease-out);
}
.dm-cursor--drag { transition: opacity 200ms var(--b-ease-out); }
.dm-cursor[hidden] { display: block; opacity: 0; }
.dm-cursor svg { width: 100%; height: 100%; display: block; transition: scale 120ms var(--b-ease-out); }
.dm-cursor--down svg { scale: 0.85; }

/* ---------- Slides du faux deck (unités de conteneur : nettes à toutes les tailles) ---------- */
.dm-slide {
  position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; overflow: clip;
  container-type: inline-size; font-family: var(--dm-deck-font); text-align: left; line-height: 1.2;
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
`;

/** Collines de la slide de couverture. */
const HILLS = `<svg class="dm-s__hills" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120 L0 70 L70 20 L130 75 L190 35 L260 95 L330 30 L400 80 L400 120 Z" fill="${DECK.rust}"/><path d="M0 120 L0 95 L90 55 L170 100 L250 60 L320 105 L400 70 L400 120 Z" fill="${DECK.clay}"/></svg>`;

/** Icônes du plugin, recopiées de ui.tsx (Carbon, Apache-2.0), StatusIcon.tsx et assets/logo.svg. */
const ICONS = {
  gear: '<svg class="f2s-icon-gear" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M27,16.76c0-.25,0-.5,0-.76s0-.51,0-.77l1.92-1.68A2,2,0,0,0,29.3,11L26.94,7a2,2,0,0,0-1.73-1,2,2,0,0,0-.64.1l-2.43.82a11.35,11.35,0,0,0-1.31-.75l-.51-2.52a2,2,0,0,0-2-1.61H13.64a2,2,0,0,0-2,1.61l-.51,2.52a11.48,11.48,0,0,0-1.32.75L7.43,6.06A2,2,0,0,0,6.79,6,2,2,0,0,0,5.06,7L2.7,11a2,2,0,0,0,.41,2.51L5,15.24c0,.25,0,.5,0,.76s0,.51,0,.77L3.11,18.45A2,2,0,0,0,2.7,21L5.06,25a2,2,0,0,0,1.73,1,2,2,0,0,0,.64-.1l2.43-.82a11.35,11.35,0,0,0,1.31.75l.51,2.52a2,2,0,0,0,2,1.61h4.72a2,2,0,0,0,2-1.61l.51-2.52a11.48,11.48,0,0,0,1.32-.75l2.42.82a2,2,0,0,0,.64.1,2,2,0,0,0,1.73-1L29.3,21a2,2,0,0,0-.41-2.51ZM25.21,24l-3.43-1.16a8.86,8.86,0,0,1-2.71,1.57L18.36,28H13.64l-.71-3.55a9.36,9.36,0,0,1-2.7-1.57L6.79,24,4.43,20l2.72-2.4a8.9,8.9,0,0,1,0-3.13L4.43,12,6.79,8l3.43,1.16a8.86,8.86,0,0,1,2.71-1.57L13.64,4h4.72l.71,3.55a9.36,9.36,0,0,1,2.7,1.57L25.21,8,27.57,12l-2.72,2.4a8.9,8.9,0,0,1,0,3.13L27.57,20Z"/><path d="M16,22a6,6,0,1,1,6-6A5.94,5.94,0,0,1,16,22Zm0-10a3.91,3.91,0,0,0-4,4,3.91,3.91,0,0,0,4,4,3.91,3.91,0,0,0,4-4A3.91,3.91,0,0,0,16,12Z"/></svg>',
  arrow: (size: number) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M10,6V8H22.59L6,24.59,7.41,26,24,9.41V22h2V6Z"/></svg>`,
  close:
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  logo: '<svg viewBox="30.62 21 19.24 37.5" fill="none" aria-hidden="true"><rect width="80" height="80" rx="40" fill="#F06800"/><path d="M48.6887 47.1716C50.2508 48.7337 50.2508 51.2664 48.6887 52.8285L44.2034 57.3138C41.6836 59.8336 37.375 58.049 37.375 54.4854L37.375 45.5148C37.375 41.9512 41.6836 40.1665 44.2034 42.6864L48.6887 47.1716Z" fill="#F2ECE8"/><path d="M48.6887 27.1715C50.2508 28.7335 50.2508 31.2662 48.6887 32.8283L44.2034 37.3136C41.6836 39.8334 37.375 38.0488 37.375 34.4852L37.375 25.5146C37.375 21.951 41.6836 20.1663 44.2034 22.6862L48.6887 27.1715Z" fill="#F2ECE8"/><rect x="30.6235" y="21.0001" width="3" height="37" rx="1.5" fill="#F2ECE8"/></svg>',
};

/** Pastilles d'état du plugin (StatusIcon.tsx), par ton. */
const STATUS_ICONS = {
  success: '<path d="M20 34 L29 43 L46 24" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  info: '<path d="M33 31 L33 46 M33 20 L33 20.01" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
  error: '<path d="M24 24 L42 42 M42 24 L24 42" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
};

/** Icône du plugin dans la barre de sa fenêtre (cartes empilées de Decker). */
const DECKER_ICON =
  '<svg viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="15" width="20" height="14" fill="#7a3b12" stroke="#1a0d02"/><rect x="6" y="10" width="20" height="14" fill="#c1651c" stroke="#1a0d02"/><rect x="9" y="5" width="20" height="14" fill="#ffb238" stroke="#1a0d02"/></svg>';

/** Icône de fichier Figma dans un onglet (la grille de l'outil Frame). */
const FILE_ICON =
  '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5.5 2.5v11M10.5 2.5v11M2.5 5.5h11M2.5 10.5h11" stroke="currentColor" stroke-width="1.2"/></svg>';

const LIGHTS = '<span class="dm-lights" aria-hidden="true"><i></i><i></i><i></i></span>';

function figmaTab(file: 'deck' | 'template', label: string): string {
  return `<button type="button" class="dm-ftab" role="tab" data-file="${file}" aria-selected="${file === 'deck'}">${FILE_ICON}<span>${label}</span><span class="dm-ftab__x" aria-hidden="true">&times;</span></button>`;
}

export const HERO_DEMO_HTML = `
<div class="dm" data-demo role="region" aria-label="Interactive demo of Decker in Figma">
  <div class="dm-shield" data-demo-shield hidden></div>
  <div class="dm-stage" data-demo-stage>
    <div class="dm-tabbar">
      ${LIGHTS}
      <span class="dm-home" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M2.5 7.2 8 2.5l5.5 4.7v6.3h-3.7V9.7H6.2v3.8H2.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg></span>
      <div class="dm-ftabs" role="tablist" aria-label="Figma files">
        ${figmaTab('deck', 'Trailworn deck')}
        ${figmaTab('template', 'Trailworn template')}
      </div>
    </div>
    <div class="dm-canvas" data-demo-canvas></div>
    <section class="dm-pwin" aria-label="Decker plugin">
      <div class="dm-pwin__bar">${DECKER_ICON}<span>Decker</span><span class="dm-pwin__x" aria-hidden="true">${ICONS.close}</span></div>
      <div class="dm-plugin" data-demo-plugin>
        <header class="f2s-topbar">
          <div class="f2s-topbar-left">
            <div class="f2s-tabs" role="tablist" aria-label="Deck or template">
              <button type="button" role="tab" class="f2s-tab is-active" data-mode="deck" aria-selected="true" title="Export a one-off deck to Slides.">Deck</button>
              <button type="button" role="tab" class="f2s-tab" data-mode="template" aria-selected="false" title="Build a reusable Slides template with tagged placeholders.">Templates</button>
            </div>
            <div class="f2s-topbar-title-group">
              <label class="f2s-toolbar-label" for="dm-title-input">Name:</label>
              <input id="dm-title-input" type="text" class="f2s-title-input" placeholder="Decker export" data-demo-title />
            </div>
          </div>
          <div class="f2s-topbar-actions" data-demo-actions></div>
        </header>
        <div class="f2s-toolbar">
          <div class="f2s-toolbar-row">
            <div class="f2s-toolbar-group" data-demo-fonts></div>
          </div>
        </div>
        <div class="f2s-body" data-demo-body>
          <p class="f2s-sr-only" role="status" data-demo-status></p>
          <aside class="f2s-sidebar" data-demo-rail hidden></aside>
          <main class="f2s-canvas" data-demo-main></main>
          <aside class="f2s-style-aside" data-demo-aside hidden></aside>
        </div>
        <footer class="f2s-footer">
          <div class="f2s-footer-left">
            <button type="button" class="f2s-footer-settings" data-act="settings" aria-haspopup="dialog" aria-expanded="false">${ICONS.gear}<span>Settings</span></button>
          </div>
          <div class="f2s-footer-actions">
            <div class="f2s-signature">
              <a class="f2s-logo-link" href="https://billeltighidet.fr" target="_blank" rel="noopener" title="billeltighidet.fr" aria-label="Made by Billel Tighidet, billeltighidet.fr (opens in a new tab)"><span class="f2s-logo">${ICONS.logo}</span></a>
              <a href="https://buymeacoffee.com/billelt" target="_blank" rel="noopener noreferrer" class="f2s-coffee-link"><span class="f2s-coffee-label"><span>Buy me a coffee</span>${ICONS.arrow(9)}</span></a>
            </div>
          </div>
        </footer>
      </div>
    </section>
    <div class="dm-cursor" data-demo-cursor aria-hidden="true" hidden>
      <svg viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.6 L12.2 14.2 L19 14 Z" fill="var(--b-ink)" stroke="var(--b-white)" stroke-width="1.5" stroke-linejoin="round"/></svg>
    </div>
  </div>
</div>`;

const DEMO_JS = String.raw`
var demo = document.querySelector('[data-demo]');
if (!demo) return;
var q = function (sel) { return demo.querySelector(sel); };
var stage = q('[data-demo-stage]');
var canvas = q('[data-demo-canvas]');
var body = q('[data-demo-body]');
var rail = q('[data-demo-rail]');
var main = q('[data-demo-main]');
var aside = q('[data-demo-aside]');
var actions = q('[data-demo-actions]');
var fontsHost = q('[data-demo-fonts]');
var titleInput = q('[data-demo-title]');
var srStatus = q('[data-demo-status]');
var cursor = q('[data-demo-cursor]');
var shield = q('[data-demo-shield]');
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Frames du fichier Figma, et les calques que le mode Templates en liste.
   suggest : le rôle que « Suggest roles » proposerait. */
var FRAMES = [
  { name: 'Cover', kind: 'cover', native: 9, els: [
    { id: 'c-title', name: 'Built for the long run.', type: 'text', role: 'title' },
    { id: 'c-sub', name: 'Annual report · Trailworn Inc.', type: 'text', role: 'subtitle' },
    { id: 'c-hills', name: 'Hills', type: 'vector', role: '' }
  ] },
  { name: 'Three pillars', kind: 'pillars', native: 14, els: [
    { id: 'p-title', name: 'Three pillars, one promise', type: 'text', role: '', suggest: 'title' },
    { id: 'p-craft', name: 'Craft', type: 'text', role: '' },
    { id: 'p-speed', name: 'Speed', type: 'text', role: '' },
    { id: 'p-care', name: 'Care', type: 'text', role: '' },
    { id: 'p-body', name: 'Pillar descriptions', type: 'text', role: '', suggest: 'body' }
  ] },
  { name: 'Stats', kind: 'stats', native: 4, els: [
    { id: 's-big', name: '87%', type: 'text', role: 'title' },
    { id: 's-cap', name: 'of our clients keep every deck editable after the handoff.', type: 'text', role: 'body' }
  ] }
];
var TEXT_TAGS = ['title', 'subtitle', 'body', 'custom'];
var IMAGE_TAGS = ['image', 'logo', 'custom'];
var THEME_ROLES = [
  ['DARK1', 'Text & background 1'], ['LIGHT1', 'Text & background 2'], ['DARK2', 'Text & background 3'],
  ['LIGHT2', 'Text & background 4'], ['ACCENT1', 'Accent 1'], ['ACCENT2', 'Accent 2'], ['ACCENT3', 'Accent 3'],
  ['ACCENT4', 'Accent 4'], ['ACCENT5', 'Accent 5'], ['ACCENT6', 'Accent 6'], ['HYPERLINK', 'Link']
];
var COLORS = ['forest', 'paper', 'sand', 'clay', 'rust'];
var COLOR_SUGGESTIONS = { forest: 'DARK1', paper: 'LIGHT1', sand: 'LIGHT2', clay: 'ACCENT1', rust: 'ACCENT2' };
/* Polices de Slides qu'un navigateur affiche sans rien charger. */
var FONTS = ['Arial', 'Comic Sans MS', 'Courier New', 'Georgia', 'Impact', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
var FONT_STACKS = { 'Georgia': 'Georgia, serif', 'Times New Roman': '"Times New Roman", serif', 'Courier New': '"Courier New", monospace' };

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/* ---------- Slides du faux deck ---------- */
function slideHtml(i) {
  var f = FRAMES[i];
  var html = '';
  if (f.kind === 'cover') {
    html = '<span class="dm-s__title">Built for the long run.</span>' +
      '<span class="dm-s__sub">Annual report &middot; Trailworn Inc.</span>' + HILLS;
  } else if (f.kind === 'pillars') {
    var col = function (n, h) {
      return '<span><span class="dm-s__num">' + n + '</span><span class="dm-s__head">' + h + '</span><span class="dm-s__line"></span><span class="dm-s__line" style="width:80%"></span><span class="dm-s__line" style="width:60%"></span></span>';
    };
    html = '<span class="dm-s__title">Three pillars, one promise</span>' +
      '<span class="dm-s__cols">' + col('01', 'Craft') + col('02', 'Speed') + col('03', 'Care') + '</span>';
  } else {
    html = '<span class="dm-s__big">87%</span>' +
      '<span class="dm-s__cap">of our clients keep every deck editable after the handoff.</span>';
  }
  return '<span class="dm-slide dm-slide--' + f.kind + '">' + html + '</span>';
}

/* ---------- État ---------- */
var st;
function freshState() {
  var roles = {};
  FRAMES.forEach(function (f) { f.els.forEach(function (el) { roles[el.id] = el.role; }); });
  return {
    mode: 'deck', selected: [], rails: { deck: [], template: [] }, active: { deck: -1, template: -1 },
    titles: { deck: '', template: '' }, names: {}, roles: roles, colorRoles: { forest: 'DARK1', paper: 'LIGHT1' },
    font: 'Arial', run: st ? st.run + 1 : 1
  };
}
function layoutName(i) { return st.names[i] != null ? st.names[i] : FRAMES[i].name; }
function curRail() { return st.rails[st.mode]; }

/* Re-rendre une zone fait perdre le focus clavier : on le rend à l'élément
   qui porte la même clé après coup. */
function keepFocus(fn) {
  var a = document.activeElement;
  var key = a && demo.contains(a) ? a.getAttribute('data-key') : null;
  fn();
  if (key) {
    var next = demo.querySelector('[data-key="' + key + '"]');
    if (next && next !== a) next.focus();
  }
}

/* ---------- Figma ---------- */
function renderCanvas() {
  keepFocus(function () {
    canvas.innerHTML = FRAMES.map(function (f, i) {
      return '<button type="button" class="dm-frame" data-frame="' + i + '" data-key="frame-' + i + '" aria-pressed="' + (st.selected.indexOf(i) > -1) + '" aria-label="Select frame ' + esc(f.name) + '">' +
        '<span class="dm-frame__name">' + esc(f.name) + '</span>' + slideHtml(i) +
        '<span class="dm-frame__size">1920 &times; 1080</span></button>';
    }).join('');
  });
}

function renderTabs() {
  var deck = st.mode === 'deck';
  demo.querySelectorAll('[data-file]').forEach(function (t) {
    t.setAttribute('aria-selected', String(t.getAttribute('data-file') === st.mode));
  });
  demo.querySelectorAll('[data-mode]').forEach(function (t) {
    var on = t.getAttribute('data-mode') === st.mode;
    t.setAttribute('aria-selected', String(on));
    t.classList.toggle('is-active', on);
  });
  titleInput.placeholder = deck ? 'Decker export' : 'Figma template';
  if (document.activeElement !== titleInput) titleInput.value = st.titles[st.mode];
}

/* ---------- En-tête du plugin ---------- */
function addable() {
  return st.selected.filter(function (i) { return curRail().indexOf(i) === -1; }).length;
}

function renderActions() {
  var deck = st.mode === 'deck';
  var n = addable();
  var where = deck ? 'the deck' : 'the template';
  var html = '<button type="button" class="f2s-btn f2s-btn--secondary f2s-tabular" data-act="add" data-key="add"' + (n === 0 ? ' disabled' : '') +
    ' title="' + (n > 0 ? 'Add the selected frames to ' + where + ', in the order you selected them.' : 'Select frames on the Figma canvas to add them to ' + where + '.') + '">' +
    (n === 0 ? 'Add frames' : 'Add ' + n + ' frame' + (n === 1 ? '' : 's')) + '</button>';
  html += '<button type="button" class="f2s-btn f2s-btn--secondary" data-act="prepare" data-key="prepare"' + (!st.selected.length && !curRail().length ? ' disabled' : '') + '>Prepare for Slides</button>';
  html += '<button type="button" class="f2s-btn f2s-btn--primary" data-act="export" data-key="export"' + (!curRail().length ? ' disabled' : '') + '>' + (deck ? 'Export' : 'Create template') + '</button>';
  keepFocus(function () { actions.innerHTML = html; });
}

/* ---------- Liste de polices (FontCombobox du plugin) ---------- */
function comboHtml(key) {
  var size = Math.min(26, Math.max(10, st.font.length + 1));
  return '<div class="f2s-font-combobox" data-combo="' + key + '"><input type="text" class="f2s-font-combobox-input" size="' + size + '" value="' + esc(st.font) +
    '" aria-label="Replacement font for &quot;Arial&quot;" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="dm-fonts-' + key + '" autocomplete="off" data-key="combo-' + key + '">' +
    '<span class="f2s-font-combobox-arrow" aria-hidden="true"></span></div>';
}

function renderFonts() {
  if (fontsHost.contains(document.activeElement)) return;
  fontsHost.innerHTML = '<span class="f2s-toolbar-label">Fonts:</span>' +
    (curRail().length ? '<label class="f2s-font-select" title="Pick another font to use instead of &quot;Arial&quot; everywhere in Slides."><span class="f2s-font-original">Arial</span><span class="f2s-font-arrow">&rarr;</span>' + comboHtml('bar') + '</label>'
      : '<span class="f2s-toolbar-muted">The fonts of your frames will appear here, ready to replace.</span>');
}

var combo = null;
function comboOptions() {
  var text = combo.typed ? combo.input.value.trim().toLowerCase() : '';
  return FONTS.filter(function (f) { return !text || f.toLowerCase().indexOf(text) > -1; });
}
function renderCombo() {
  var list = combo.root.querySelector('.f2s-font-combobox-list');
  if (!list) {
    list = document.createElement('ul');
    list.className = 'f2s-font-combobox-list';
    list.setAttribute('role', 'listbox');
    list.id = combo.input.getAttribute('aria-controls');
    combo.root.appendChild(list);
  }
  var opts = comboOptions();
  combo.highlight = Math.max(0, Math.min(combo.highlight, opts.length - 1));
  list.innerHTML = opts.length ? opts.map(function (f, i) {
    return '<li role="option" id="' + list.id + '-' + i + '" data-font="' + esc(f) + '" aria-selected="' + (f === st.font) + '" class="f2s-font-combobox-option' +
      (i === combo.highlight ? ' f2s-font-combobox-option--active' : '') + (f === st.font ? ' f2s-font-combobox-option--selected' : '') + '">' + esc(f) + '</li>';
  }).join('') : '<li class="f2s-font-combobox-empty">No matching font</li>';
  combo.input.setAttribute('aria-expanded', 'true');
  if (opts.length) combo.input.setAttribute('aria-activedescendant', list.id + '-' + combo.highlight);
  else combo.input.removeAttribute('aria-activedescendant');
}
function openCombo(input) {
  if (combo && combo.input === input) return;
  closeCombo();
  combo = { input: input, root: input.closest('.f2s-font-combobox'), highlight: Math.max(0, FONTS.indexOf(st.font)), typed: false };
  renderCombo();
  input.select();
}
function closeCombo() {
  if (!combo) return;
  var list = combo.root.querySelector('.f2s-font-combobox-list');
  if (list) list.remove();
  combo.input.setAttribute('aria-expanded', 'false');
  combo.input.removeAttribute('aria-activedescendant');
  combo.input.value = st.font;
  combo = null;
}
function commitFont(font) {
  st.font = font;
  demo.style.setProperty('--dm-deck-font', FONT_STACKS[font] || '"' + font + '", sans-serif');
  closeCombo();
  demo.querySelectorAll('.f2s-font-combobox-input').forEach(function (input) {
    input.value = font;
    input.size = Math.min(26, Math.max(10, font.length + 1));
  });
}

/* ---------- Corps du plugin ---------- */
function railHtml() {
  var deck = st.mode === 'deck';
  var r = curRail();
  var lit = st.active[st.mode];
  return r.map(function (i, pos) {
    var name = deck ? FRAMES[i].name : layoutName(i);
    var noun = deck ? 'slide' : 'layout';
    return '<div class="f2s-sidebar-item" data-item="' + i + '">' +
      '<button type="button" class="f2s-frame-preview' + (lit === i ? ' is-active' : '') + '" data-pick="' + i + '" data-key="pick-' + i + '" aria-label="' + esc(name) + '" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown">' +
      slideHtml(i) + (!deck && pos === 0 && r.length >= 2 ? '<span class="f2s-frame-tag f2s-frame-tag--master">Master</span>' : '') + '</button>' +
      '<div class="f2s-frame-info"><span class="f2s-frame-index">' + (pos + 1) + '.</span>' +
      (deck ? '<span class="f2s-frame-name" title="' + esc(name) + '">' + esc(name) + '</span>'
        : '<input type="text" class="f2s-frame-name-input" value="' + esc(name) + '" title="' + esc(name) + '" aria-label="Layout name" data-rename="' + i + '" data-key="rename-' + i + '">') +
      '<div class="f2s-frame-controls"><button type="button" class="f2s-icon-btn" data-remove="' + i + '" data-key="remove-' + i + '"' +
      ' title="Remove ' + noun + ' ' + (pos + 1) + '" aria-label="Remove ' + noun + ' ' + (pos + 1) + '">&#10005;</button></div></div></div>';
  }).join('');
}

function elementList(els) {
  return '<ul class="f2s-tmpl-list">' + els.map(function (el) {
    var role = st.roles[el.id];
    var tags = el.type === 'text' ? TEXT_TAGS : IMAGE_TAGS;
    var name = (role ? '[[' + role + ']] ' : '') + el.name;
    return '<li class="f2s-log-entry"><button type="button" class="f2s-log-entry-clickarea" data-el="' + el.id + '" data-key="el-' + el.id + '" title="' + esc(name) + '">' +
      '<span class="f2s-log-entry-text"><strong class="f2s-log-entry-name">' + esc(name) + '</strong></span></button>' +
      '<select class="f2s-font-dropdown f2s-log-entry-role" data-role="' + el.id + '" data-key="role-' + el.id + '" title="Assign this layer to a Slides template placeholder role" aria-label="Placeholder role for ' + esc(el.name) + '">' +
      '<option value="">No role</option>' + tags.map(function (t) {
        return '<option value="' + t + '"' + (t === role ? ' selected' : '') + '>[[' + t + ']]</option>';
      }).join('') + '</select></li>';
  }).join('') + '</ul>';
}

function roleSuggestions(i) {
  if (i < 0) return [];
  var used = {};
  FRAMES[i].els.forEach(function (el) { if (st.roles[el.id]) used[st.roles[el.id]] = true; });
  return FRAMES[i].els.filter(function (el) { return el.suggest && !st.roles[el.id] && !used[el.suggest]; });
}

function colorSuggestions() {
  var taken = {};
  COLORS.forEach(function (c) { if (st.colorRoles[c]) taken[st.colorRoles[c]] = true; });
  return COLORS.filter(function (c) { return !st.colorRoles[c] && !taken[COLOR_SUGGESTIONS[c]]; });
}

function mainHtml() {
  var deck = st.mode === 'deck';
  var r = curRail();
  if (!r.length) {
    return '<div class="f2s-demo" role="img" aria-label="Select frames on the Figma canvas, click Add, then ' + (deck ? 'Export to create the presentation' : 'Create template to build it') + ' in Google Slides.">' +
      '<div class="f2s-demo-canvas"></div><div class="f2s-demo-frame f2s-demo-frame--1"></div><div class="f2s-demo-frame f2s-demo-frame--2"></div><div class="f2s-demo-frame f2s-demo-frame--3"></div>' +
      '<div class="f2s-demo-window"></div><div class="f2s-demo-btn f2s-demo-btn--add">Add</div><div class="f2s-demo-thumb f2s-demo-thumb--1"></div><div class="f2s-demo-thumb f2s-demo-thumb--2"></div>' +
      '<div class="f2s-demo-btn f2s-demo-btn--primary">' + (deck ? 'Export' : 'Create template') + '</div>' +
      '<svg class="f2s-demo-cursor" viewBox="0 0 16 20" width="16" height="20"><path d="M1 1 L1 16 L5 12.5 L8 19 L10.5 18 L7.5 11.5 L12.5 11.5 Z"/></svg></div>';
  }
  var i = st.active[st.mode];
  if (deck) {
    return '<div class="f2s-deck-column">' +
      '<div class="f2s-canvas-preview">' + slideHtml(i) + '</div>' +
      '<div class="f2s-logs"><div class="f2s-logs-header"><h3 class="f2s-tmpl-heading">Content</h3><span class="f2s-toolbar-muted f2s-tabular">' + FRAMES[i].native + ' native &middot; 0 rasterized</span></div>' +
      '<p class="f2s-toolbar-muted">No issues detected on this frame.</p></div></div>';
  }
  var tagged = FRAMES[i].els.filter(function (el) { return st.roles[el.id]; });
  var untagged = FRAMES[i].els.filter(function (el) { return !st.roles[el.id]; });
  var canSuggest = roleSuggestions(i).length > 0;
  return '<div class="f2s-tmpl-report">' +
    '<div class="f2s-canvas-preview f2s-tmpl-preview">' + slideHtml(i) + '</div>' +
    '<div class="f2s-tmpl-panel"><section class="f2s-tmpl-section"><div class="f2s-section-head"><h3 class="f2s-tmpl-heading">Composition</h3>' +
    '<button type="button" class="f2s-btn f2s-btn--ghost" data-act="suggest-roles" data-key="suggest-roles"' + (canSuggest ? '' : ' disabled') +
    ' title="' + (canSuggest ? 'Tag the title, subtitle and body of this layout from the size and length of its texts.' : 'Nothing left to suggest in this layout: its title, subtitle and body are set, or no other text fits them.') + '">Suggest roles</button></div>' +
    (tagged.length ? elementList(tagged) : '<p class="f2s-toolbar-muted">No placeholder yet. Pick a role for a layer in Content.</p>') + '</section>' +
    '<section class="f2s-tmpl-section"><h3 class="f2s-tmpl-heading">Content</h3>' +
    (untagged.length ? elementList(untagged) : '<p class="f2s-toolbar-muted">Every layer has a role.</p>') + '</section></div></div>';
}

function asideHtml() {
  var r = curRail();
  var master = r.length >= 2 ? r[0] : -1;
  var html = '<div class="f2s-style-panel"><section class="f2s-tmpl-section"><h3 class="f2s-tmpl-heading f2s-style-heading">Master content</h3>';
  if (master < 0) {
    html += '<p class="f2s-toolbar-muted">The first layout becomes the master once you add a second one. What it holds appears on every slide.</p>';
  } else {
    html += '<ul class="f2s-style-list">' + FRAMES[master].els.map(function (el) {
      return '<li><button type="button" class="f2s-tmpl-chip" data-el="' + el.id + '" data-key="chip-' + el.id + '" title="Select &quot;' + esc(el.name) + '&quot; in Figma"><span class="f2s-tmpl-chip-label">' + esc(el.name) + '</span></button></li>';
    }).join('') + '</ul>';
  }
  html += '</section><section class="f2s-tmpl-section"><div class="f2s-section-head"><h3 class="f2s-tmpl-heading f2s-style-heading">Colors</h3>';
  if (!r.length) {
    html += '</div><p class="f2s-toolbar-muted">The colors of your layouts will appear here, ready to map to the Slides theme.</p></section>';
  } else {
    var canSuggest = colorSuggestions().length > 0;
    html += '<button type="button" class="f2s-btn f2s-btn--ghost" data-act="suggest-colors" data-key="suggest-colors"' + (canSuggest ? '' : ' disabled') +
      ' title="' + (canSuggest ? 'Fill the free roles from how each color is used: text, background, links, then vivid colors as accents.' : 'Nothing left to suggest: every role or color is already assigned.') + '">Suggest roles</button></div>' +
      '<ul class="f2s-style-list">' + COLORS.map(function (c) {
        var hex = DECK[c].toUpperCase();
        var mine = st.colorRoles[c] || '';
        return '<li class="f2s-style-row"><div class="f2s-style-row-main"><span class="f2s-style-swatch" style="background-color:' + hex + '"></span>' +
          '<span class="f2s-style-label" title="' + hex + '">' + hex + '</span>' +
          '<select class="f2s-font-dropdown f2s-style-role-select" data-color="' + c + '" data-key="color-' + c + '" aria-label="Theme role for ' + hex + '"><option value="">No role</option>' +
          THEME_ROLES.map(function (t) {
            var other = COLORS.some(function (k) { return k !== c && st.colorRoles[k] === t[0]; });
            return '<option value="' + t[0] + '"' + (t[0] === mine ? ' selected' : '') + '>' + t[1] + (other ? ' (in use)' : '') + '</option>';
          }).join('') + '</select></div></li>';
      }).join('') + '</ul></section>';
  }
  html += '<section class="f2s-tmpl-section"><h3 class="f2s-tmpl-heading f2s-style-heading">Typography</h3>';
  html += r.length ? '<ul class="f2s-style-list"><li class="f2s-style-row"><div class="f2s-style-row-main"><span class="f2s-style-font-swatch">Aa</span>' +
    '<span class="f2s-style-font-info"><span class="f2s-tmpl-font-family" title="Arial">Arial</span><span class="f2s-toolbar-muted">400, 700</span></span></div>' +
    '<div class="f2s-style-font-replace"><span class="f2s-font-arrow">&rarr;</span>' + comboHtml('aside') + '</div></li></ul>'
    : '<p class="f2s-toolbar-muted">The fonts of your layouts will appear here, ready to replace.</p>';
  return html + '</section></div>';
}

function renderBody() {
  closeCombo();
  var deck = st.mode === 'deck';
  var r = curRail();
  keepFocus(function () {
    rail.hidden = !r.length;
    rail.innerHTML = railHtml();
    main.className = 'f2s-canvas' + (r.length ? (deck ? ' f2s-canvas--deck' : ' f2s-canvas--template') : '');
    main.style.setProperty('--f2s-frame-ratio', '1.7778');
    main.innerHTML = mainHtml();
    aside.hidden = deck;
    aside.innerHTML = deck ? '' : asideHtml();
  });
}

function renderAll() {
  renderTabs();
  renderCanvas();
  renderActions();
  renderFonts();
  renderBody();
}

/* ---------- Toast (Toast de StatusIcon.tsx) ---------- */
function showToast(message, tone) {
  var old = body.querySelector('.f2s-toast');
  if (old) old.remove();
  var el = document.createElement('div');
  el.className = 'f2s-toast f2s-toast--' + tone;
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  el.innerHTML = '<svg class="f2s-status-icon f2s-status-icon--' + tone + '" width="16" height="16" viewBox="0 0 66 66" fill="none" aria-hidden="true"><rect class="f2s-status-icon-disc" width="66" height="66" rx="33"/>' + STATUS[tone] + '</svg>' +
    '<span class="f2s-toast-text">' + esc(message) + '</span>' +
    '<button type="button" class="f2s-icon-btn f2s-toast-close" title="Dismiss" aria-label="Dismiss notification" data-toast-close>' + CLOSE + '</button>' +
    '<span class="f2s-toast-timer" style="animation-duration:' + Math.max(3000, message.length * 60) + 'ms" aria-hidden="true"></span>';
  el.querySelector('.f2s-toast-timer').addEventListener('animationend', function () { el.remove(); });
  body.appendChild(el);
}

/* ---------- Réordonnancement du rail (useRailReorder du plugin) ---------- */
var drag = null;
var press = null;
var suppressClick = false;
function scale() { return parseFloat(demo.style.getPropertyValue('--dm-scale')) || 1; }
function dragBegin(id) {
  var items = Array.prototype.slice.call(rail.querySelectorAll('.f2s-sidebar-item'));
  var from = curRail().indexOf(id);
  if (from < 0) return;
  var el = items[from];
  var slot = items.length > 1 ? items[1].offsetTop - items[0].offsetTop : el.offsetHeight;
  drag = { id: id, from: from, to: from, items: items, el: el, slot: slot };
  el.classList.add('is-dragging');
}
function dragMove(dy) {
  if (!drag) return;
  var n = drag.items.length;
  var min = -drag.from * drag.slot;
  var max = (n - 1 - drag.from) * drag.slot;
  dy = Math.max(min - 12, Math.min(max + 12, dy));
  var to = Math.max(0, Math.min(n - 1, drag.from + Math.round(dy / drag.slot)));
  drag.to = to;
  drag.el.style.transform = 'translateY(' + dy + 'px)';
  drag.items.forEach(function (it, k) {
    if (k === drag.from) return;
    var shift = 0;
    if (drag.from < to && k > drag.from && k <= to) shift = -drag.slot;
    if (drag.from > to && k >= to && k < drag.from) shift = drag.slot;
    it.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
  });
}
function dragEnd() {
  var d = drag;
  drag = null;
  if (!d) return;
  if (d.to !== d.from) moveInRail(d.from, d.to);
  else renderBody();
}
function moveInRail(from, to) {
  var r = curRail();
  var id = r.splice(from, 1)[0];
  r.splice(to, 0, id);
  srStatus.textContent = (st.mode === 'deck' ? FRAMES[id].name : layoutName(id)) + ', position ' + (to + 1) + ' of ' + r.length;
  renderActions();
  renderBody();
}
rail.addEventListener('pointerdown', function (e) {
  var t = e.target.closest('[data-pick]');
  if (!t || e.button !== 0 || e.pointerType === 'touch') return;
  press = { id: Number(t.getAttribute('data-pick')), y: e.clientY, pointer: e.pointerId, moved: false };
  t.setPointerCapture(e.pointerId);
});
rail.addEventListener('pointermove', function (e) {
  if (!press || e.pointerId !== press.pointer) return;
  var dy = (e.clientY - press.y) / scale();
  if (!press.moved && Math.abs(dy) > 4) {
    press.moved = true;
    dragBegin(press.id);
  }
  if (press.moved) dragMove(dy);
});
function release(e) {
  if (!press || e.pointerId !== press.pointer) return;
  var moved = press.moved;
  press = null;
  if (moved) {
    suppressClick = true;
    window.setTimeout(function () { suppressClick = false; }, 0);
    dragEnd();
  }
}
rail.addEventListener('pointerup', release);
rail.addEventListener('pointercancel', release);

/* ---------- Actions ---------- */
function toggleFrame(i) {
  var at = st.selected.indexOf(i);
  if (at > -1) st.selected.splice(at, 1); else st.selected.push(i);
  renderCanvas();
  renderActions();
}

function setMode(mode) {
  if (st.mode === mode) return;
  st.mode = mode;
  renderTabs();
  renderActions();
  renderFonts();
  renderBody();
}

function act(name) {
  var deck = st.mode === 'deck';
  if (name === 'add') {
    var fresh = st.selected.filter(function (i) { return curRail().indexOf(i) === -1; });
    fresh.forEach(function (i) { curRail().push(i); });
    if (st.active[st.mode] < 0 && curRail().length) st.active[st.mode] = curRail()[0];
      st.selected = [];
    renderCanvas();
    renderActions();
    renderFonts();
    renderBody();
  } else if (name === 'prepare') {
    showToast('In Figma, Prepare for Slides duplicates each ' + (deck ? 'frame' : 'layout') + ' and reformats the copy for Slides.', 'info');
  } else if (name === 'export') {
    showToast((deck ? 'Export' : 'Create template') + ' runs in the real plugin. Try it on Figma.', 'info');
  } else if (name === 'settings') {
    showToast('In the plugin, Settings switches the skin and your Google account.', 'info');
  } else if (name === 'suggest-roles') {
    var picks = roleSuggestions(st.active.template);
    picks.forEach(function (el) { st.roles[el.id] = el.suggest; });
    renderBody();
    showToast(picks.length + (picks.length === 1 ? ' role' : ' roles') + ' suggested. Change any of them in Composition.', 'info');
  } else if (name === 'suggest-colors') {
    var colors = colorSuggestions();
    colors.forEach(function (c) { st.colorRoles[c] = COLOR_SUGGESTIONS[c]; });
    renderBody();
    showToast(colors.length + (colors.length === 1 ? ' role' : ' roles') + ' suggested. Change any of them below.', 'info');
  }
}

demo.addEventListener('click', function (e) {
  if (e.target === canvas) { st.selected = []; renderCanvas(); renderActions(); return; }
  var t = e.target.closest('button');
  if (!t || !demo.contains(t) || t.disabled) return;
  if (t.hasAttribute('data-frame')) toggleFrame(Number(t.getAttribute('data-frame')));
  else if (t.hasAttribute('data-file')) setMode(t.getAttribute('data-file'));
  else if (t.hasAttribute('data-mode')) setMode(t.getAttribute('data-mode'));
  else if (t.hasAttribute('data-pick')) {
    if (suppressClick) return;
    st.active[st.mode] = Number(t.getAttribute('data-pick'));
    renderBody();
  } else if (t.hasAttribute('data-remove')) {
    var id = Number(t.getAttribute('data-remove'));
    st.rails[st.mode] = curRail().filter(function (i) { return i !== id; });
    if (st.active[st.mode] === id) st.active[st.mode] = curRail().length ? curRail()[0] : -1;
      renderActions(); renderFonts(); renderBody();
  } else if (t.hasAttribute('data-el')) {
    var elId = t.getAttribute('data-el');
    st.selected = FRAMES.map(function (f, i) { return f.els.some(function (el) { return el.id === elId; }) ? i : -1; }).filter(function (i) { return i > -1; });
    renderCanvas(); renderActions();
  } else if (t.hasAttribute('data-toast-close')) {
    t.closest('.f2s-toast').remove();
  } else if (t.hasAttribute('data-act')) act(t.getAttribute('data-act'));
});

demo.addEventListener('change', function (e) {
  var t = e.target;
  if (t.hasAttribute('data-role')) {
    st.roles[t.getAttribute('data-role')] = t.value;
    renderBody();
  } else if (t.hasAttribute('data-color')) {
    var key = t.getAttribute('data-color');
    var role = t.value;
    if (role) {
      var prev = COLORS.filter(function (c) { return c !== key && st.colorRoles[c] === role; })[0];
      if (prev) {
        delete st.colorRoles[prev];
        var label = THEME_ROLES.filter(function (r) { return r[0] === role; })[0][1];
        showToast('"' + label + '" moved from ' + DECK[prev].toUpperCase() + ' to this color.', 'info');
      }
      st.colorRoles[key] = role;
    } else {
      delete st.colorRoles[key];
    }
    renderBody();
  } else if (t.hasAttribute('data-rename')) {
    st.names[Number(t.getAttribute('data-rename'))] = t.value;
  }
});

demo.addEventListener('input', function (e) {
  var t = e.target;
  if (t === titleInput) st.titles[st.mode] = t.value;
  else if (combo && t === combo.input) { combo.typed = true; combo.highlight = 0; renderCombo(); }
});

demo.addEventListener('focusin', function (e) {
  if (e.target.classList && e.target.classList.contains('f2s-font-combobox-input')) openCombo(e.target);
});
demo.addEventListener('focusout', function (e) {
  if (combo && e.target === combo.input) closeCombo();
});
demo.addEventListener('mousedown', function (e) {
  var opt = e.target.closest('.f2s-font-combobox-option');
  if (opt) { e.preventDefault(); commitFont(opt.getAttribute('data-font')); return; }
  var box = e.target.closest('.f2s-font-combobox');
  if (box && !e.target.classList.contains('f2s-font-combobox-input')) {
    e.preventDefault();
    box.querySelector('input').focus();
  }
});

demo.addEventListener('keydown', function (e) {
  var t = e.target;
  if (combo && t === combo.input) {
    var opts = comboOptions();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (opts.length) combo.highlight = (combo.highlight + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      renderCombo();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (opts[combo.highlight]) commitFont(opts[combo.highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCombo();
      t.select();
    }
    return;
  }
  /* Entrée dans un nom de layout : on valide. */
  if (e.key === 'Enter' && t.hasAttribute && t.hasAttribute('data-rename')) {
    e.preventDefault();
    t.blur();
    return;
  }
  /* Alt + flèches sur une vignette : le réordonnancement au clavier du plugin. */
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && t.hasAttribute && t.hasAttribute('data-pick')) {
    e.preventDefault();
    var from = curRail().indexOf(Number(t.getAttribute('data-pick')));
    var to = from + (e.key === 'ArrowUp' ? -1 : 1);
    if (to >= 0 && to < curRail().length) moveInRail(from, to);
  }
});

/* ---------- Mise à l'échelle ---------- */
var fit = function () {
  var w = demo.clientWidth;
  if (w) demo.style.setProperty('--dm-scale', String(w / 1440));
};
fit();
if (window.ResizeObserver) new ResizeObserver(fit).observe(demo); else window.addEventListener('resize', fit);

/* ---------- Lecture automatique ---------- */
var playing = false;
var visible = false;

/* Attente qui ne compte que le temps où la démo se voit, et s'arrête net si
   le visiteur a pris la main. */
function wait(ms, run) {
  return new Promise(function (resolve, reject) {
    var left = ms;
    var tick = function () {
      if (run !== st.run) { reject(new Error('cancelled')); return; }
      if (visible) left -= 100;
      if (left <= 0) resolve(); else window.setTimeout(tick, 100);
    };
    window.setTimeout(tick, 100);
  });
}
function pointAt(el) {
  var s = scale();
  var r = el.getBoundingClientRect();
  var o = stage.getBoundingClientRect();
  return { x: (r.left - o.left + r.width * 0.55) / s, y: (r.top - o.top + r.height * 0.55) / s };
}
function placeCursor(p) { cursor.style.transform = 'translate(' + p.x + 'px, ' + p.y + 'px)'; }

function moveTo(sel, run) {
  var el = typeof sel === 'string' ? demo.querySelector(sel) : sel;
  if (!el) return Promise.resolve();
  cursor.hidden = false;
  placeCursor(pointAt(el));
  return wait(750, run);
}

function click(sel, run) {
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

/* Glisse une vignette du rail d'une position à une autre, curseur compris. */
function dragThumb(id, toPos, run) {
  var sel = '[data-pick="' + id + '"]';
  var start;
  return moveTo(sel, run).then(function () {
    cursor.classList.add('dm-cursor--down');
    return wait(200, run);
  }).then(function () {
    start = pointAt(demo.querySelector(sel));
    dragBegin(id);
    cursor.classList.add('dm-cursor--drag');
    var target = (toPos - drag.from) * drag.slot;
    return new Promise(function (resolve, reject) {
      var t0 = performance.now();
      var frame = function (now) {
        if (run !== st.run) { reject(new Error('cancelled')); return; }
        var k = Math.min(1, (now - t0) / 900);
        var eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        dragMove(target * eased);
        placeCursor({ x: start.x, y: start.y + target * eased });
        if (k < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
  }).then(function () {
    return wait(150, run);
  }).then(function () {
    cursor.classList.remove('dm-cursor--down', 'dm-cursor--drag');
    dragEnd();
    return wait(400, run);
  });
}

function script(run) {
  return wait(700, run)
    .then(function () { return click('[data-frame="0"]', run); })
    .then(function () { return click('[data-frame="1"]', run); })
    .then(function () { return click('[data-frame="2"]', run); })
    .then(function () { return click('[data-act="add"]', run); })
    .then(function () { return wait(400, run); })
    .then(function () { return dragThumb(2, 1, run); })
    .then(function () { return click('[data-pick="2"]', run); })
    .then(function () { return wait(900, run); })
    .then(function () { return click('[data-file="template"]', run); })
    .then(function () { return click('[data-frame="0"]', run); })
    .then(function () { return click('[data-frame="1"]', run); })
    .then(function () { return click('[data-frame="2"]', run); })
    .then(function () { return click('[data-act="add"]', run); })
    .then(function () { return wait(500, run); })
    .then(function () { return click('[data-pick="1"]', run); })
    .then(function () { return wait(500, run); })
    .then(function () { return click('[data-act="suggest-roles"]', run); })
    .then(function () { return wait(900, run); })
    .then(function () { return click('[data-act="suggest-colors"]', run); })
    .then(function () { return wait(600, run); });
}

function setPlaying(on) {
  playing = on;
  shield.hidden = !on;
  if (!on) {
    cursor.hidden = true;
    cursor.classList.remove('dm-cursor--down', 'dm-cursor--drag');
  }
}

function autoplay() {
  st = freshState();
  renderAll();
  var run = st.run;
  setPlaying(true);
  script(run).then(function () {
    if (run === st.run) setPlaying(false);
  }, function () {});
}

/* Le visiteur prend la main : la lecture s'arrête, la démo reste dans son
   état du moment, sans curseur. */
function takeOver() {
  if (!playing) return;
  st.run += 1;
  if (drag) dragEnd();
  setPlaying(false);
}
/* Clic (souris ou doigt) sur le calque : un défilement tactile ne déclenche
   pas de click, donc faire défiler la page par-dessus la démo ne l'arrête pas. */
shield.addEventListener('click', function (e) {
  takeOver();
  demo.classList.add('is-engaged');
  var el = document.elementFromPoint(e.clientX, e.clientY);
  var target = el && el.closest('button, a, input, select');
  if (!target || !demo.contains(target)) return;
  if (target.tagName === 'BUTTON' || target.tagName === 'A') target.click(); else target.focus();
});
demo.addEventListener('keydown', takeOver, true);
/* Premier geste du visiteur dans la démo : les panneaux du plugin peuvent
   défiler (voir .is-engaged dans le CSS). */
var engage = function () { demo.classList.add('is-engaged'); };
demo.addEventListener('pointerdown', engage);
demo.addEventListener('focusin', function () { if (!playing) engage(); });

if ('IntersectionObserver' in window) {
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
  }, { threshold: 0.3 }).observe(demo);
} else {
  visible = true;
}

if (reduceMotion) {
  /* Rien ne bouge seul : la démo s'ouvre avec les frames déjà ajoutées. */
  st = freshState();
  st.rails.deck = [0, 1, 2];
  st.active.deck = 0;
  renderAll();
} else {
  autoplay();
}
`;

export const HERO_DEMO_JS = `(function () {
var HILLS = ${JSON.stringify(HILLS)};
var DECK = ${JSON.stringify(DECK)};
var CLOSE = ${JSON.stringify(ICONS.close)};
var STATUS = ${JSON.stringify(STATUS_ICONS)};
${DEMO_JS}
})();`;
