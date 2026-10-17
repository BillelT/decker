/**
 * Easter egg du footer (docs/roadmap/08-site-easter-egg-jeu.md) : notre jeu
 * des pop-ups, présenté avec le flow du jeu de Luc sur smoo.link. Le logo du
 * footer mène à une page à part, /game, fond encre, avec une fenêtre
 * « Decker 95 » au centre. Dedans, un bureau qui se remplit de fausses pop-ups
 * façon années 2000 ; le méchant est `SCREENSHOT.EXE`, qui veut aplatir le
 * deck en une image : l'inverse de la promesse de Decker. Sous la fenêtre,
 * les touches, la police et une ligne sur Decker.
 *
 * Dans notre DA, en pixel Win95 : biseaux en gris de marque (tokens `--b-*`),
 * barre de titre orange pour la fenêtre active, grise pour les autres,
 * police pixel (Pixelify Sans, OFL) inlinée sur cette page seulement.
 *
 * Page autonome : ni header ni footer du site, pas indexée. Rien ne sort de
 * la page : pas de `window.open`, pas d'`alert()`.
 *
 * Le JS est écrit en ES2017 sans framework, comme le reste du site, et gardé
 * en `String.raw` : pas de backtick ni de `${` dedans, les valeurs venant de
 * TypeScript passent par `JSON.stringify` en tête du script.
 */
import { DESIGN_TOKENS_CSS } from '../generated/designTokens.js';
import { DECKER_FAVICON, DECKER_MARK_SVG } from './brand.js';
import { PIXELIFY_SANS_BASE64 } from './gameFontData.js';

const GAME_CSS = String.raw`
:root {
  /* Teintes secondaires de Decker : celles du logo (DECKER_MARK_SVG, brand.ts).
     Le jeu les prend plutôt que l'orange de marque, trop présent partout
     (17 octobre). Exception à la DA listée dans docs/roadmap/README.md, comme
     la palette du skin Windows 95 du plugin. */
  --logo-brown: #7a3b12;
  --logo-clay: #c1651c;
  --logo-amber: #ffb238;
  --logo-cream: #fff4d6;
  /* Les cinq tons du biseau Win95, pris dans la rampe de gris de la marque. */
  --w95-face: var(--b-gray-200);
  --w95-light: var(--b-gray-100);
  --w95-hi: var(--b-white);
  --w95-shadow: var(--b-gray-500);
  --w95-dark: var(--b-ink);
  --w95-out: inset -1px -1px var(--w95-dark), inset 1px 1px var(--w95-light), inset -2px -2px var(--w95-shadow),
    inset 2px 2px var(--w95-hi);
  --w95-in: inset -1px -1px var(--w95-hi), inset 1px 1px var(--w95-shadow), inset -2px -2px var(--w95-light),
    inset 2px 2px var(--w95-dark);
  --w95-pressed: inset -1px -1px var(--w95-hi), inset 1px 1px var(--w95-dark), inset -2px -2px var(--w95-light),
    inset 2px 2px var(--w95-shadow);
  /* Champ de barre d'état : creux d'un seul pixel. */
  --w95-field: inset -1px -1px var(--w95-hi), inset 1px 1px var(--w95-shadow);
  /* Ombre portée dure, sans flou : un décalage de pixels. */
  --w95-drop: 4px 4px 0 color-mix(in oklab, var(--b-ink) 30%, transparent);
  --g-font: "Pixelify Sans", var(--b-font-mono);
}

html {
  background: var(--b-ink); color-scheme: dark;
  -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; overscroll-behavior: none;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
body {
  margin: 0; background: var(--b-ink); color: var(--b-gray-400);
  font-family: var(--g-font); font-size: 16px; line-height: 1.5;
}
.g-sr {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}

/* Une colonne centrée, aussi large que la fenêtre : le texte dessous s'y cale. */
.g {
  box-sizing: border-box; display: flex; justify-content: center; align-items: center;
  min-height: 100vh; min-height: 100dvh;
  padding: calc(var(--b-space-24) + env(safe-area-inset-top)) max(var(--b-space-16), env(safe-area-inset-right))
    calc(var(--b-space-24) + env(safe-area-inset-bottom)) max(var(--b-space-16), env(safe-area-inset-left));
}
.g__col { display: flex; flex-direction: column; gap: var(--b-space-24); width: min-content; max-width: 100%; }

/* ---------- Fenêtres ---------- */
.w95 { padding: 3px; background: var(--w95-face); box-shadow: var(--w95-out); color: var(--b-ink); }
.w95__bar {
  display: flex; align-items: center; gap: var(--b-space-6); min-height: 24px;
  padding: 2px 2px 2px var(--b-space-6);
  /* Barre active pleine, comme le bleu marine de Windows 95, en brun du logo. */
  background: var(--logo-brown); color: var(--logo-cream);
}
/* Fenêtre inactive, comme sous Windows : la barre passe au gris, le titre
   reste lisible (blanc sur gris 600). */
.w95[data-inactive] > .w95__bar, .pop:not(.is-active) > .w95__bar { background: var(--b-gray-600); color: var(--b-white); }
.w95__icon { flex: none; width: 16px; height: 16px; display: block; }
.w95__title {
  flex: 1 1 auto; min-width: 0; margin: 0; font: inherit; font-size: 14px; font-weight: 700; line-height: 1.2;
  letter-spacing: 0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.w95__x {
  position: relative; flex: none; display: grid; place-items: center; width: 24px; height: 22px; padding: 0;
  border: 0; border-radius: 0; background: var(--w95-face); box-shadow: var(--w95-out); color: var(--b-ink); cursor: pointer;
  touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.w95__x::before { content: ""; position: absolute; inset: -6px -2px; }
.w95__x:active { box-shadow: var(--w95-pressed); }
.w95__x svg { width: 8px; height: 7px; display: block; }
.w95__x:focus-visible { outline: 2px dotted var(--b-ink); outline-offset: -5px; }
/* La fausse pub cache sa croix : petite et grise, mais la cible reste à 24px. */
.w95__x--tiny { background: transparent; box-shadow: none; color: inherit; opacity: 0.55; }
.w95__x--tiny svg { width: 6px; height: 5px; }

/* Barre d'outils : Pause et Sound à gauche, jauge à droite. */
.w95__tools {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--b-space-8) var(--b-space-16);
  margin-top: 3px; padding: var(--b-space-4);
  box-shadow: inset 0 -1px var(--w95-shadow), inset 0 -2px var(--w95-hi);
}
.w95__group { display: flex; align-items: center; gap: var(--b-space-16); }
/* Case à cocher Win95 : un puits blanc creusé, la coche en pixels. La vraie
   case reste dans le DOM (focus, clavier, lecteur d'écran), invisible. */
.chk95 { position: relative; display: inline-flex; align-items: center; gap: var(--b-space-6); font-size: 14px; line-height: 1.2; cursor: pointer; -webkit-user-select: none; user-select: none; }
.chk95__input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }
.chk95__box { flex: none; display: grid; place-items: center; width: 16px; height: 16px; background: var(--b-white); box-shadow: var(--w95-in); color: var(--b-ink); }
.chk95__box svg { width: 8px; height: 7px; display: block; visibility: hidden; }
.chk95__input:checked + .chk95__box svg { visibility: visible; }
.chk95__input:disabled + .chk95__box { background: var(--w95-face); }
.chk95:has(.chk95__input:disabled) { color: var(--b-gray-600); cursor: default; }
.chk95__input:focus-visible ~ .chk95__label { outline: 2px dotted var(--b-ink); outline-offset: 2px; }
.meter-wrap { display: flex; align-items: center; gap: var(--b-space-8); font-size: 14px; line-height: 1.2; white-space: nowrap; }
.meter-wrap__value { min-width: 4ch; text-align: end; font-variant-numeric: tabular-nums; }
/* Barre de progression Win95 : des blocs, rognés par clip-path plutôt
   qu'étirés, pour que chaque bloc garde sa taille. */
.meter, .bar95 { position: relative; height: 18px; background: var(--b-white); box-shadow: var(--w95-field); }
.meter { width: 160px; }
.meter__fill, .bar95__fill {
  position: absolute; inset: 3px;
  background: repeating-linear-gradient(90deg, var(--logo-clay) 0 8px, transparent 8px 10px);
  clip-path: inset(0 100% 0 0);
}
/* L'alerte rouge est un graphisme d'état, doublé du pourcentage écrit à côté. */
.meter--low .meter__fill, .bar95--danger .bar95__fill {
  background: repeating-linear-gradient(90deg, var(--b-accent-red) 0 8px, transparent 8px 10px);
}
.bar95 { margin-top: var(--b-space-12); }

.w95__well { position: relative; margin-top: 3px; padding: 2px; box-shadow: var(--w95-in); background: var(--b-white); }
/* Le bureau : un fond crème uni, les pop-ups font tout le décor. */
.desk {
  position: relative; overflow: hidden; width: 640px; height: 400px;
  background-color: var(--logo-cream);
  -webkit-user-select: none; user-select: none; touch-action: manipulation;
}
.g-noscript { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; font-size: 16px; color: var(--b-ink); }

.w95__status { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
.w95__field {
  flex: 1 1 auto; margin: 0; padding: 2px var(--b-space-8); box-shadow: var(--w95-field);
  font-size: 14px; line-height: 1.4; white-space: nowrap; font-variant-numeric: tabular-nums;
}
.w95__field--end { text-align: end; }

/* ---------- Boutons ---------- */
.btn95 {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--b-space-6);
  box-sizing: border-box; min-width: 88px; min-height: 30px; padding: var(--b-space-4) var(--b-space-12);
  border: 0; border-radius: 0; background: var(--w95-face); box-shadow: var(--w95-out); color: var(--b-ink);
  font: inherit; font-size: 14px; line-height: 1.2; text-decoration: none; white-space: nowrap; cursor: pointer;
  touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  transition: transform var(--b-duration) var(--b-ease-out);
}
.btn95:active:not(:disabled) { box-shadow: var(--w95-pressed); transform: scale(0.97); }
.btn95:disabled { color: var(--b-gray-500); cursor: default; }
/* Bouton par défaut : le liseré noir de Windows, plein à l'ambre du logo. */
.btn95--default { background: var(--logo-amber); box-shadow: 0 0 0 1px var(--b-ink), var(--w95-out); font-weight: 700; }
.btn95--default:active:not(:disabled) { box-shadow: 0 0 0 1px var(--b-ink), var(--w95-pressed); }
.btn95:focus-visible { outline: 2px dotted var(--b-ink); outline-offset: -6px; }
@media (hover: hover) and (pointer: fine) {
  .btn95:hover:not(:disabled) { background: var(--w95-light); }
  .btn95--default:hover:not(:disabled) { background: color-mix(in oklab, var(--logo-amber), var(--logo-cream) 45%); }
}

/* ---------- Pop-ups ---------- */
/* Trois tailles pour varier : grande (80 % du bureau), moyenne (50 %),
   petite (15 %). Des minimums gardent texte et boutons lisibles ; sur un
   petit bureau, 56px de marge laissent la place au décalage de la pile. */
.pop { position: absolute; box-sizing: border-box; max-width: calc(100% - 56px); box-shadow: var(--w95-out), var(--w95-drop); }
.pop--l { width: 80%; }
.pop--m { width: max(50%, 260px); }
.pop--s { width: max(15%, 170px); }
.pop--s .pop__body { padding: var(--b-space-12); }
.pop--s .pop__actions { padding: 0 var(--b-space-12) var(--b-space-12); }
.pop--s .btn95 { min-width: 0; }
.pop--s .pop__icon { width: 24px; height: 24px; }
.slides { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--b-space-12); margin-bottom: var(--b-space-12); }
.slides .slide { margin: 0; }
/* Écrans de début, de pause et de fin : centrés. translate et non transform :
   l'animation d'entrée pose déjà un transform. */
.pop--modal { left: 50%; top: 50%; translate: -50% -50%; width: min(440px, calc(100% - 16px)); max-width: none; }
.pop__body { padding: var(--b-space-16); font-size: 14px; line-height: 1.45; }
.pop__body p { margin: 0 0 var(--b-space-8); text-wrap: pretty; }
.pop__body p:last-child { margin-bottom: 0; }
.pop__lead { font-weight: 700; text-wrap: balance; }
.pop__row { display: flex; gap: var(--b-space-12); align-items: flex-start; }
.pop__icon { flex: none; width: 32px; height: 32px; display: block; }
.pop__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--b-space-8); padding: 0 var(--b-space-16) var(--b-space-16); }
.pop--modal .pop__actions { justify-content: center; }
.pop__share { margin-top: var(--b-space-8); color: var(--b-gray-600); -webkit-user-select: text; user-select: text; }
.pop__pct { font-variant-numeric: tabular-nums; }

.scores { display: flex; justify-content: center; gap: var(--b-space-48); margin: var(--b-space-12) 0 0; text-align: center; }
.scores dt { font-size: 12px; line-height: 1.2; letter-spacing: 0.05em; text-transform: uppercase; }
.scores dd { margin: 0; font-size: 32px; line-height: 1.1; font-variant-numeric: tabular-nums; }

.slide { display: block; width: 100%; aspect-ratio: 16 / 9; margin-bottom: var(--b-space-12); box-shadow: var(--w95-field); }
.slide__bg { fill: var(--b-gray-100); }
.slide__ink { fill: var(--b-ink); }
.slide__muted { fill: var(--b-gray-400); }
.slide__accent { fill: var(--logo-clay); }
.icon__shape { fill: var(--b-accent-red); }
.icon__mark { fill: var(--b-white); }
.icon__line { fill: var(--b-ink); }

/* Entrée d'une pop-up : un pop sec, comme une vraie fenêtre qui s'ouvre. En
   mouvement réduit, un simple fondu. */
@media (prefers-reduced-motion: no-preference) {
  @keyframes pop-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: none; } }
  .pop { animation: pop-in 150ms var(--b-ease-out) both; }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes pop-fade { from { opacity: 0; } to { opacity: 1; } }
  .pop { animation: pop-fade 200ms var(--b-ease-out) both; }
}

/* Tactile : cibles à 44px. */
@media (pointer: coarse) {
  .w95__x { width: 44px; height: 40px; }
  .pop .w95__bar { min-height: 44px; }
  .btn95 { min-height: 44px; }
}

/* ---------- Autour de la fenêtre ---------- */
.g-head { display: flex; align-items: center; gap: var(--b-space-12); }
.g-head__mark { flex: none; width: 32px; height: 32px; display: block; }
.g-head__name { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.2; color: var(--b-white); }
.g-head__tag { margin: 0; font-size: 14px; line-height: 1.4; color: var(--b-gray-400); text-wrap: balance; }
.g-links { display: flex; flex-wrap: wrap; gap: var(--b-space-8) var(--b-space-24); font-size: 14px; line-height: 1.5; }
.g-links a { color: var(--b-gray-400); text-decoration-thickness: 1px; text-underline-offset: 3px; }
.g-links a:focus-visible { outline: 2px solid var(--b-white); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .g-links a:hover { color: var(--b-white); }
}
`;

const GAME_JS = String.raw`
var doc = document;
var DURATION = 60000;
var BOSS_AT = 32000;
var HIGH_KEY = 'decker-egg-best';
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var SOUND_KEY = 'decker-game-sound';

var col = doc.querySelector('[data-col]');
var win = doc.querySelector('[data-win]');
var desk = doc.querySelector('[data-desk]');
var statusEl = doc.querySelector('[data-status]');
var pauseBtn = doc.querySelector('[data-pause]');
var meter = doc.querySelector('[data-meter]');
var meterFill = doc.querySelector('[data-meter-fill]');
var meterText = doc.querySelector('[data-meter-text]');
var out = {
  time: doc.querySelector('[data-time]'),
  score: doc.querySelector('[data-score]'),
  combo: doc.querySelector('[data-combo]'),
  high: doc.querySelector('[data-high]')
};
var s = { phase: 'intro', wins: [], timer: 0, boss: null, integrity: 100, score: 0, combo: 1, closed: 0, elapsed: 0 };

function el(tag, cls, text) {
  var n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function rand(min, max) { return min + Math.random() * (max - min); }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function fmtScore(v) { return Math.max(0, Math.round(v)).toLocaleString('en-US'); }
function fmtTime(ms) {
  var sec = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
function isSmall() { return desk.clientWidth < 520; }
function readBest() {
  try { return parseInt(window.localStorage.getItem(HIGH_KEY) || '0', 10) || 0; } catch (e) { return 0; }
}
function writeBest(v) {
  try { window.localStorage.setItem(HIGH_KEY, String(v)); } catch (e) {}
}

/* ---------- Taille du bureau ----------
   Aussi grand que l'écran le permet (960 x 600 au plus), le texte du dessous
   compris. Mesuré au plus petit d'abord : un bureau trop large élargirait le
   viewport d'un mobile, et la mesure avec. */
function fit() {
  desk.style.width = '280px';
  desk.style.height = '320px';
  var vw = Math.min(doc.documentElement.clientWidth, window.screen.width || Infinity);
  var vh = Math.min(window.innerHeight, window.screen.height || Infinity);
  var chromeW = win.offsetWidth - desk.offsetWidth;
  var w = Math.max(280, Math.min(960, vw - 32 - chromeW));
  desk.style.width = w + 'px';
  var others = col.offsetHeight - desk.offsetHeight;
  var h = Math.max(360, Math.min(600, vh - 48 - others));
  desk.style.height = Math.round(h) + 'px';
  s.wins.forEach(clampWin);
}

/* ---------- Bruitages ----------
   Dérogation à la DA (le son y est réservé aux outils), demandée pour le jeu
   le 17 octobre. Reprend les règles de ui-audio : case « Sound » visible,
   cochée par défaut, décochée et grisée en mouvement réduit ; aucun son
   avant le premier geste (l'AudioContext ne démarre qu'à ce moment) ; gains
   bas (0.06 à 0.2, plus bas pour les sons fréquents) ; un son par événement
   qui compte, pas sur Pause. Synthé Web Audio en ondes carrées et triangle,
   façon 8-bit : aucun fichier, aucune lib. */
var sound = { ctx: null, out: null, on: false };
var soundBox = doc.querySelector('[data-sound]');
(function () {
  var saved = null;
  try { saved = window.localStorage.getItem(SOUND_KEY); } catch (e) {}
  sound.on = !reduceMotion && saved !== 'off';
  soundBox.checked = sound.on;
  soundBox.disabled = reduceMotion;
  soundBox.addEventListener('change', function () {
    sound.on = soundBox.checked && !reduceMotion;
    try { window.localStorage.setItem(SOUND_KEY, sound.on ? 'on' : 'off'); } catch (e) {}
    unlockSound();
    if (sound.on) sfx.toggle();
  });
})();
function unlockSound() {
  if (!sound.on) return;
  if (!sound.ctx) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    sound.ctx = new Ctx();
    sound.out = sound.ctx.createGain();
    sound.out.gain.value = 0.8;
    sound.out.connect(sound.ctx.destination);
  }
  if (sound.ctx.state === 'suspended') sound.ctx.resume();
}
doc.addEventListener('pointerdown', unlockSound, true);
doc.addEventListener('keydown', unlockSound, true);

/* Une note : forme, fréquence (ou [début, fin] pour un glissando), départ
   en secondes, durée, gain. Attaque de 3 ms, extinction exponentielle. */
function tone(o) {
  var c = sound.ctx;
  if (!sound.on || !c || c.state !== 'running') return;
  var t = c.currentTime + 0.01 + (o.at || 0);
  var osc = c.createOscillator();
  var g = c.createGain();
  var sweep = Array.isArray(o.f);
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(sweep ? o.f[0] : o.f, t);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(o.f[1], t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g);
  g.connect(sound.out);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}
function notes(list, type, step, dur, gain) {
  list.forEach(function (f, i) { tone({ type: type, f: f, at: i * step, dur: dur, gain: gain }); });
}
var OPEN_NOTES = [523, 587, 659, 784, 880];
var COMBO_NOTES = [659, 784, 880, 1047, 1319];
var sfx = {
  /* Une pop-up s'ouvre : petit blip triangle, note au hasard dans une gamme
     pentatonique, très bas (c'est le son le plus fréquent). */
  open: function () { tone({ type: 'triangle', f: OPEN_NOTES[Math.floor(Math.random() * OPEN_NOTES.length)], dur: 0.06, gain: 0.07 }); },
  /* Fermée : un clic carré qui monte d'une note à chaque cran de combo. */
  close: function (combo) { tone({ type: 'square', f: COMBO_NOTES[Math.min(combo, 5) - 1], dur: 0.05, gain: 0.06 }); },
  /* Bonne réponse (Keep editable, dernière fenêtre de la chaîne). */
  good: function () { notes([784, 1175], 'square', 0.06, 0.06, 0.06); },
  /* Rasterize : la note qui s'écrase. */
  bad: function () { tone({ type: 'square', f: [440, 90], dur: 0.32, gain: 0.08 }); },
  /* La fausse pub : un bourdon grave, puis ses deux pop-ups. */
  scam: function () { tone({ type: 'square', f: [180, 140], dur: 0.18, gain: 0.07 }); },
  /* La croix qui esquive : un boing qui monte. */
  dodge: function () { tone({ type: 'triangle', f: [300, 900], dur: 0.12, gain: 0.12 }); },
  /* Le boss arrive : sirène à deux tons, trois fois. */
  alarm: function () {
    for (var i = 0; i < 3; i++) {
      tone({ type: 'square', f: 494, at: i * 0.36, dur: 0.16, gain: 0.07 });
      tone({ type: 'square', f: 392, at: i * 0.36 + 0.18, dur: 0.16, gain: 0.07 });
    }
  },
  /* Chaque Stop sur le boss : une note qui monte à mesure qu'il cède. */
  hit: function (left) { tone({ type: 'square', f: 330 * Math.pow(1.09, 10 - left), dur: 0.05, gain: 0.07 }); },
  /* Boss vaincu, ou l'antivirus qui nettoie : arpège montant. */
  win: function () { notes([523, 659, 784, 1047], 'square', 0.07, 0.08, 0.07); },
  clean: function () {
    tone({ type: 'triangle', f: [400, 1600], dur: 0.25, gain: 0.12 });
    notes([784, 1047], 'square', 0.08, 0.07, 0.05);
  },
  /* Approche de la mort : un battement de cœur grave (deux coups), plus
     rapide quand la jauge passe sous 15 %. */
  beat: function () {
    tone({ type: 'triangle', f: [120, 60], dur: 0.12, gain: 0.2 });
    tone({ type: 'triangle', f: [110, 55], at: 0.16, dur: 0.1, gain: 0.14 });
  },
  /* Fin de partie, perdue : la descente classique. */
  lose: function () { notes([523, 440, 349, 262], 'square', 0.16, 0.18, 0.08); tone({ type: 'triangle', f: [262, 65], at: 0.64, dur: 0.6, gain: 0.14 }); },
  /* Fin de partie, gagnée : petite fanfare. */
  victory: function () { notes([523, 659, 784, 1047, 784, 1047], 'square', 0.1, 0.12, 0.07); },
  /* Le son vient d'être rallumé : un blip de confirmation. */
  toggle: function () { tone({ type: 'triangle', f: 880, dur: 0.06, gain: 0.12 }); }
};

/* ---------- Annonces ---------- */
var announceTimer = 0;
function say(text) {
  statusEl.textContent = '';
  window.setTimeout(function () { statusEl.textContent = text; }, 50);
}
function announceCount() {
  window.clearTimeout(announceTimer);
  announceTimer = window.setTimeout(function () {
    if (s.phase !== 'play') return;
    var n = s.wins.length;
    say(n === 0 ? 'No pop-ups open.' : n === 1 ? '1 pop-up open.' : n + ' pop-ups open.');
  }, 1200);
}

function slideSvg() {
  var layouts = [
    '<rect x="12" y="14" width="80" height="10" class="slide__ink"/><rect x="12" y="32" width="56" height="5" class="slide__muted"/><rect x="12" y="42" width="64" height="5" class="slide__muted"/><rect x="104" y="14" width="44" height="62" class="slide__accent"/>',
    '<rect x="30" y="30" width="100" height="12" class="slide__ink"/><rect x="50" y="50" width="60" height="5" class="slide__muted"/><rect x="74" y="64" width="12" height="12" class="slide__accent"/>',
    '<rect x="12" y="12" width="60" height="8" class="slide__ink"/><rect x="12" y="30" width="40" height="46" class="slide__accent"/><rect x="60" y="30" width="40" height="46" class="slide__muted"/><rect x="108" y="30" width="40" height="46" class="slide__muted"/>'
  ];
  return '<svg class="slide" viewBox="0 0 160 90" shape-rendering="crispEdges" aria-hidden="true"><rect width="160" height="90" class="slide__bg"/>' + pick(layouts) + '</svg>';
}

/* ---------- Fenêtres ---------- */
var zTop = 10;
var winId = 0;

function makeWin(o) {
  var w = el('section', 'w95 pop pop--' + (o.size || 'm') + (o.cls ? ' ' + o.cls : ''));
  var id = 'pop-' + (++winId);
  w.setAttribute('role', 'group');
  w.setAttribute('aria-labelledby', id);
  var bar = el('div', 'w95__bar');
  var title = el('h2', 'w95__title', o.title);
  title.id = id;
  title.title = o.title;
  bar.appendChild(title);
  if (o.onX) {
    var x = el('button', 'w95__x' + (o.tinyX ? ' w95__x--tiny' : ''));
    x.type = 'button';
    x.innerHTML = ICON_X;
    x.setAttribute('aria-label', o.xLabel || 'Close ' + o.title);
    x.addEventListener('click', function () { o.onX(w, x); });
    x.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse' && s.phase === 'play' && Math.random() < 0.03) nudge(w);
    });
    bar.appendChild(x);
    w._x = x;
  }
  w.appendChild(bar);
  var body = el('div', 'pop__body');
  if (o.html) body.innerHTML = o.html;
  w.appendChild(body);
  w._body = body;
  if (o.buttons && o.buttons.length) {
    var actions = el('div', 'pop__actions');
    o.buttons.forEach(function (b) {
      var btn = el(b.href ? 'a' : 'button', 'btn95' + (b.cta ? ' btn95--default' : ''), b.label);
      if (b.href) {
        btn.href = b.href;
        if (!b.self) {
          btn.target = '_blank';
          btn.rel = 'noopener noreferrer';
        }
      } else {
        btn.type = 'button';
        btn.addEventListener('click', function () { b.onClick(w, btn); });
      }
      actions.appendChild(btn);
      if (b.ref) w[b.ref] = btn;
    });
    w.appendChild(actions);
  }
  w.addEventListener('pointerdown', function () { toFront(w); });
  w.addEventListener('focusin', function () { toFront(w); });
  return w;
}

/* Une seule fenêtre active à la fois, comme sous Windows : celle du dessus
   garde sa barre orange, les autres passent au gris. */
function toFront(w) {
  if (Number(w.style.zIndex) !== zTop) w.style.zIndex = String(++zTop);
  markActive();
}
function markActive() {
  var front = frontWin();
  desk.querySelectorAll('.pop').forEach(function (p) {
    var modal = p.classList.contains('pop--modal');
    p.classList.toggle('is-active', modal || p === front);
  });
}

function rectOf(w) {
  return { x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight };
}
function overlap(a, b) {
  var ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  var oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

/* Placement en pile décalée, comme les cartes du logo Decker : chaque
   nouvelle pop-up se pose un cran à droite et un cran plus haut que la
   précédente, la plus récente devant, les anciennes qui dépassent en bas à
   gauche. Quand la pile sort du bureau, une nouvelle démarre ailleurs, dans
   la moitié basse. Jamais un coin à moins de 24px du coin d'une autre : deux
   fenêtres identiques posées pile l'une sur l'autre n'en laissaient voir
   qu'une. */
var STEP_X = 40;
var STEP_Y = 48;
var stack = null;
function tooClose(x, y, others) {
  return others.some(function (o) { return Math.abs(o.x - x) < 24 && Math.abs(o.y - y) < 24; });
}
function placeRandom(w, near) {
  var maxX = Math.max(0, desk.clientWidth - w.offsetWidth);
  var maxY = Math.max(0, desk.clientHeight - w.offsetHeight);
  var others = s.wins.filter(function (o) { return o !== w; }).map(rectOf);
  var from = near ? { x: near.offsetLeft, y: near.offsetTop } : stack;
  var x = from ? from.x + STEP_X : -1;
  var y = from ? from.y - STEP_Y : -1;
  if (!from || x > maxX || y < 0 || tooClose(x, y, others)) {
    for (var i = 0; i < 24; i++) {
      x = rand(0, maxX * 0.7);
      y = rand(maxY * 0.5, maxY);
      if (!tooClose(x, y, others)) break;
    }
  }
  x = Math.round(Math.min(maxX, Math.max(0, x)));
  y = Math.round(Math.min(maxY, Math.max(0, y)));
  stack = { x: x, y: y };
  w.style.left = x + 'px';
  w.style.top = y + 'px';
}
/* Une fois sur trente-trois, une pop-up esquive la souris qui arrive sur sa
   croix : un petit saut, pas loin de sa place. */
function nudge(w) {
  var maxX = Math.max(0, desk.clientWidth - w.offsetWidth);
  var maxY = Math.max(0, desk.clientHeight - w.offsetHeight);
  var dx = (Math.random() < 0.5 ? -1 : 1) * rand(16, 40);
  var dy = (Math.random() < 0.5 ? -1 : 1) * rand(8, 24);
  w.style.left = Math.round(Math.min(maxX, Math.max(0, w.offsetLeft + dx))) + 'px';
  w.style.top = Math.round(Math.min(maxY, Math.max(0, w.offsetTop + dy))) + 'px';
  sfx.dodge();
}
function clampWin(w) {
  if (w.classList.contains('pop--modal')) return;
  var x = Math.min(w.offsetLeft, Math.max(0, desk.clientWidth - w.offsetWidth));
  var y = Math.min(w.offsetTop, Math.max(0, desk.clientHeight - w.offsetHeight));
  w.style.left = Math.max(0, x) + 'px';
  w.style.top = Math.max(0, y) + 'px';
}

function addWin(w, near) {
  w.style.visibility = 'hidden';
  w.style.zIndex = String(++zTop);
  desk.appendChild(w);
  placeRandom(w, near);
  w.style.visibility = '';
  s.wins.push(w);
  markActive();
  announceCount();
  sfx.open();
  return w;
}

function frontWin() {
  var best = null;
  s.wins.forEach(function (w) {
    if (!best || Number(w.style.zIndex) > Number(best.style.zIndex)) best = w;
  });
  return best;
}

function removeWin(w) {
  var i = s.wins.indexOf(w);
  if (i === -1) return false;
  var hadFocus = w.contains(doc.activeElement);
  s.wins.splice(i, 1);
  w.remove();
  markActive();
  if (hadFocus) {
    var next = frontWin();
    var target = next && next.querySelector('button');
    (target || pauseBtn).focus();
  }
  announceCount();
  return true;
}

/* Fermer une pop-up rapporte des points, multipliés par le combo quand on
   enchaîne les fermetures à moins de 0.9 s d'écart. */
function closeWin(w, points) {
  if (!removeWin(w)) return;
  var now = s.elapsed;
  s.combo = now - s.lastClose < 900 ? Math.min(s.combo + 1, 5) : 1;
  s.lastClose = now;
  s.score += (points || 10) * s.combo;
  sfx.close(s.combo);
  s.closed += 1;
  renderHud();
}

/* ---------- Types de pop-ups ---------- */
var DECK_NAMES = [
  'Q3_Review_FINAL_v7_REALLYFINAL.pptx',
  'Pitch_deck_COPY_(3).pptx',
  'Brand_guidelines_OLD_DO_NOT_USE.key',
  'All_hands_v12_final_final.pptx',
  'Moodboard_ideas_v2_JPEG.pdf'
];
var DECK_LINES = [
  'This deck opened itself. Again.',
  'Nobody asked for this deck.',
  'Autosaved 48 times. Still not final.',
  'Slide 1 of 214.'
];

/* Un grand deck montre trois slides, les autres une seule. */
function deckHtml(size) {
  return size === 'l' ? '<div class="slides">' + slideSvg() + slideSvg() + slideSvg() + '</div>' : slideSvg();
}
function spawnDeck() {
  var size = pick(['s', 'm', 'l']);
  addWin(makeWin({
    title: pick(DECK_NAMES),
    size: size,
    html: deckHtml(size) + '<p>' + pick(DECK_LINES) + '</p>',
    onX: function (w) { closeWin(w, 10); }
  }));
}

function spawnAd() {
  addWin(makeWin({
    title: 'You won!!!',
    size: pick(['m', 'l']),
    tinyX: true,
    xLabel: 'Close the free font ad',
    html: '<p class="pop__lead">Congratulations! You are the 1,000,000th designer.</p><p>Claim your free font now. Totally not a virus.</p>',
    onX: function (w) { closeWin(w, 20); },
    buttons: [{
      label: 'Claim my free font', cta: true,
      onClick: function () { sfx.scam(); spawnRandom(true); spawnRandom(true); }
    }]
  }));
}

function spawnAlert() {
  addWin(makeWin({
    title: 'Decker Security 2000',
    html: '<div class="pop__row">' + ICON_WARN + '<div><p class="pop__lead">Warning: 99+ gradients detected.</p><p>Rasterize now?</p></div></div>',
    buttons: [
      { label: 'Rasterize', onClick: function (w) {
        if (!removeWin(w)) return;
        s.integrity = Math.max(0, s.integrity - 15);
        s.score = Math.max(0, s.score - 50);
        s.combo = 1;
        sfx.bad();
        say('Rasterized. Deck integrity down.');
        renderHud();
      } },
      { label: 'Keep editable', cta: true, onClick: function (w) { closeWin(w, 15); sfx.good(); } }
    ]
  }));
}

function spawnStubborn() {
  addWin(makeWin({
    title: 'Untitled_presentation (1).pptx',
    size: pick(['s', 'm']),
    html: slideSvg() + '<p>You can’t close me. Probably.</p>',
    onX: function (w) { closeWin(w, 20); }
  }));
}

var CHAIN = [
  { title: 'Close deck?', text: 'Are you sure you want to close this deck?' },
  { title: 'Close deck??', text: 'Really sure? It has 48 unsaved slides.' },
  { title: 'Close deck???', text: 'Really, really sure?' }
];
function spawnChain(step, near) {
  step = step || 0;
  var c = CHAIN[step];
  var advance = function (w) {
    var last = step === CHAIN.length - 1;
    closeWin(w, last ? 40 : 5);
    if (last) sfx.good();
    if (!last) {
      var next = spawnChain(step + 1, w);
      var btn = next.querySelector('.btn95');
      if (w._hadFocus && btn) btn.focus();
    }
  };
  var w = makeWin({
    title: c.title,
    size: pick(['s', 'm']),
    html: '<div class="pop__row">' + ICON_ASK + '<p class="pop__lead">' + c.text + '</p></div>',
    onX: function (p) { p._hadFocus = true; advance(p); },
    buttons: [{ label: 'Yes, close it', cta: true, onClick: function (p) { p._hadFocus = true; advance(p); } }]
  });
  return addWin(w, near);
}

function spawnBonus() {
  addWin(makeWin({
    title: 'Decker Antivirus',
    html: '<p class="pop__lead">Threats found: way too many.</p><p>One click cleans every pop-up. Except the boss.</p>',
    onX: function (w) { closeWin(w, 10); },
    buttons: [{ label: 'Clean everything', cta: true, onClick: function () {
      var targets = s.wins.filter(function (x) { return !x._boss; });
      targets.forEach(function (x) { removeWin(x); });
      s.score += targets.length * 15;
      s.closed += targets.length;
      sfx.clean();
      say('Cleaned ' + targets.length + ' pop-ups.');
      renderHud();
      pauseBtn.focus();
    } }]
  }));
}

/* Le boss : SCREENSHOT.EXE aplatit le deck. Dix clics sur Stop avant 100%. */
function spawnBoss() {
  var left = 10;
  var w = makeWin({
    title: 'SCREENSHOT.EXE',
    size: 'l',
    html: '<div class="pop__row">' + ICON_WARN + '<div><p class="pop__lead">Flattening your deck into one image…</p><p class="pop__pct">12%</p></div></div>' +
      '<div class="bar95 bar95--danger" aria-hidden="true"><div class="bar95__fill"></div></div>',
    buttons: [{ label: 'Stop (10)', cta: true, ref: '_stop', onClick: function (p, btn) {
      left -= 1;
      if (left > 0) {
        btn.textContent = 'Stop (' + left + ')';
        sfx.hit(left);
        return;
      }
      s.boss = null;
      removeWin(p);
      s.score += 200;
      s.closed += 1;
      sfx.win();
      say('SCREENSHOT.EXE stopped. Plus 200.');
      renderHud();
    } }]
  });
  w._boss = true;
  w._pct = 12;
  w._pctEl = w.querySelector('.pop__pct');
  w._fill = w.querySelector('.bar95__fill');
  s.boss = w;
  addWin(w);
  sfx.alarm();
  say('Boss: SCREENSHOT.EXE is flattening your deck. Press Stop ten times.');
}

function spawnRandom(fromAd) {
  var r = Math.random() * 100;
  if (r < 34) return spawnDeck();
  if (r < 49 && !fromAd) return spawnAd();
  if (r < 67) return spawnAlert();
  if (r < 81) return spawnStubborn();
  if (r < 92 && !fromAd) return spawnChain(0);
  if (s.wins.length >= 4 && !fromAd) return spawnBonus();
  return spawnDeck();
}

/* ---------- Boucle ---------- */
/* Rythme régulier : une pop-up toutes les 1.1 s au départ, l'écart se
   resserre en ligne droite jusqu'à 0.55 s à la fin. Pas de palier ni
   d'emballement : ça monte petit à petit. */
function spawnInterval() {
  var t = Math.min(1, s.elapsed / DURATION);
  var ms = 1100 - 550 * t;
  if (isSmall()) ms *= 1.5;
  if (reduceMotion) ms *= 1.3;
  return ms;
}

function tick() {
  if (s.phase !== 'play') return;
  var now = performance.now();
  var dt = Math.min(250, now - s.last);
  s.last = now;
  s.elapsed += dt;

  s.untilSpawn -= dt;
  if (s.untilSpawn <= 0 && s.wins.length < 40) {
    spawnRandom(false);
    s.untilSpawn = spawnInterval();
  }
  if (!s.bossDone && s.elapsed >= BOSS_AT) {
    s.bossDone = true;
    spawnBoss();
  }

  /* L'intégrité remonte doucement tant qu'il reste peu de pop-ups, et fond
     d'autant plus vite qu'elles s'empilent. */
  var drainPer = isSmall() ? 1.8 : 1.2;
  var delta = 2.5 - Math.max(0, s.wins.length - 1) * drainPer;
  s.integrity = Math.min(100, s.integrity + delta * dt / 1000);

  /* Sous 30 %, le cœur bat ; sous 15 %, il s'emballe. */
  if (s.integrity < 30) {
    s.beatIn -= dt;
    if (s.beatIn <= 0) {
      sfx.beat();
      s.beatIn = s.integrity < 15 ? 520 : 850;
    }
  } else {
    s.beatIn = 0;
  }

  if (s.boss) {
    s.boss._pct = Math.min(100, s.boss._pct + (88 / 9000) * dt);
    s.boss._pctEl.textContent = Math.floor(s.boss._pct) + '%';
    s.boss._fill.style.clipPath = 'inset(0 ' + (100 - s.boss._pct) + '% 0 0)';
    if (s.boss._pct >= 100) s.integrity = 0;
  }

  renderHud();
  if (s.integrity <= 0) return lose();
  if (s.elapsed >= DURATION) return victory();
}

function renderHud() {
  var pct = Math.max(0, Math.round(s.integrity));
  meterFill.style.clipPath = 'inset(0 ' + (100 - Math.max(0, s.integrity)) + '% 0 0)';
  meter.classList.toggle('meter--low', pct <= 30);
  meter.setAttribute('aria-valuenow', String(pct));
  meterText.textContent = pct + '%';
  out.time.textContent = fmtTime(DURATION - s.elapsed);
  out.score.textContent = fmtScore(s.score);
  out.combo.textContent = 'x' + s.combo;
  out.high.textContent = fmtScore(Math.max(readBest(), s.score));
}

/* ---------- Écrans ---------- */
function clearDesk() {
  stack = null;
  s.wins = [];
  s.boss = null;
  desk.textContent = '';
}

function scoresHtml(score, best) {
  return '<dl class="scores"><div><dt>Score</dt><dd>' + fmtScore(score) + '</dd></div><div><dt>High</dt><dd>' + fmtScore(best) + '</dd></div></dl>';
}

function showModal(o) {
  var w = makeWin(Object.assign({ cls: 'pop--modal' }, o));
  w.style.zIndex = String(++zTop);
  w.classList.add('is-active');
  desk.appendChild(w);
  win.setAttribute('data-inactive', '');
  var first = w.querySelector(o.focus || '.btn95--default') || w.querySelector('button');
  if (first) first.focus();
  return w;
}
function closeModals() {
  desk.querySelectorAll('.pop--modal').forEach(function (m) { m.remove(); });
  win.removeAttribute('data-inactive');
}

function play() {
  var fromDialog = desk.contains(doc.activeElement);
  closeModals();
  clearDesk();
  s.phase = 'play';
  s.integrity = 100;
  s.score = 0;
  s.combo = 1;
  s.closed = 0;
  s.elapsed = 0;
  s.lastClose = -9999;
  s.beatIn = 0;
  s.untilSpawn = 400;
  s.bossDone = false;
  s.last = performance.now();
  pauseBtn.disabled = false;
  pauseBtn.textContent = 'Pause';
  renderHud();
  window.clearInterval(s.timer);
  s.timer = window.setInterval(tick, 100);
  /* Au chargement, le focus reste où il est ; après « Try again », il
     quitte le dialogue qui vient de disparaître. */
  if (fromDialog) pauseBtn.focus();
  say('Game started. Close the pop-ups.');
}

function pause() {
  if (s.phase !== 'play') return;
  s.phase = 'paused';
  s.wins.forEach(function (w) { w.inert = true; });
  pauseBtn.textContent = 'Resume';
  showModal({
    title: 'Paused',
    html: '<p class="pop__lead">Your deck is waiting.</p><p>' + fmtTime(DURATION - s.elapsed) + ' left, ' + s.wins.length + ' pop-ups open.</p>',
    buttons: [
      { label: 'Quit', href: '/', self: true },
      { label: 'Resume', cta: true, onClick: resume }
    ]
  });
  say('Paused.');
}

function resume() {
  if (s.phase !== 'paused') return;
  closeModals();
  s.wins.forEach(function (w) { w.inert = false; });
  s.phase = 'play';
  s.last = performance.now();
  pauseBtn.textContent = 'Pause';
  pauseBtn.focus();
  say('Resumed.');
}
pauseBtn.addEventListener('click', function () {
  if (s.phase === 'play') pause(); else resume();
});

function endRound() {
  window.clearInterval(s.timer);
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pause';
  var best = readBest();
  var score = Math.round(s.score);
  var isBest = score > best;
  if (isBest) writeBest(score);
  renderHud();
  return { score: score, best: Math.max(best, score), isBest: isBest };
}

function lose() {
  s.phase = 'over';
  var r = endRound();
  var held = Math.round(s.elapsed / 1000);
  clearDesk();
  sfx.lose();
  showModal({
    title: 'SCREENSHOT.EXE',
    html: '<div class="pop__row">' + ICON_WARN + '<div><p class="pop__lead">Your deck was flattened into a screenshot.</p>' +
      '<p>You held on for ' + held + ' s.' + (r.isBest ? ' New high score.' : '') + '</p></div></div>' + scoresHtml(r.score, r.best),
    buttons: [
      { label: 'Quit', href: '/', self: true },
      { label: 'Try again', cta: true, onClick: play }
    ]
  });
  say('Game over. Your deck was flattened into a screenshot. Score ' + fmtScore(r.score) + '.');
}

function victory() {
  s.phase = 'over';
  var r = endRound();
  var closed = s.closed;
  clearDesk();
  sfx.victory();
  var share = 'I saved my deck from ' + closed + ' pop-ups on decker.billeltighidet.fr';
  showModal({
    title: 'Decker Security 2000',
    html: '<p class="pop__lead">Deck saved. 100% editable.</p>' +
      '<p>' + closed + ' pop-ups closed.' + (r.isBest ? ' New high score.' : '') + '</p>' + scoresHtml(r.score, r.best) +
      '<p class="pop__share">' + share + '</p>',
    buttons: [
      { label: 'Copy score', onClick: function (_w, btn) {
        var done = function () { btn.textContent = 'Copied'; say('Score copied.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(share).then(done, function () { btn.textContent = 'Select the text above'; });
        } else {
          btn.textContent = 'Select the text above';
        }
      } },
      { label: 'Play again', onClick: play },
      { label: 'Try Decker on Figma', cta: true, href: PLUGIN_URL }
    ],
    focus: '.btn95'
  });
  say('You win. Deck saved, 100% editable.');
}

/* ---------- Clavier et onglet ---------- */
doc.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (s.phase === 'play') { e.preventDefault(); pause(); }
  else if (s.phase === 'paused') { e.preventDefault(); resume(); }
});
doc.addEventListener('visibilitychange', function () { if (doc.hidden) pause(); });

fit();
window.addEventListener('resize', fit);
play();
`;

const ICON_CLOSE = `<svg viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3zM2 4h4v1H2zM1 5h2v1H1zM5 5h2v1H5zM0 6h2v1H0zM6 6h2v1H6z"/></svg>`;

/** Triangle d'alerte en pixels (grille 16, affiché à 32px : un pixel = 2px). */
const ICON_WARN = (() => {
  let rows = '';
  for (let r = 0; r < 13; r++) {
    const w = 2 * (Math.floor(r / 2) + 1);
    rows += `M${8 - w / 2} ${2 + r}h${w}v1h-${w}z`;
  }
  return `<svg class="pop__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path class="icon__shape" d="${rows}"/><path class="icon__mark" d="M7 6h2v4H7zM7 11h2v2H7z"/></svg>`;
})();

/** Bulle de question en pixels, pour la chaîne « Are you sure? ». */
const ICON_ASK = `<svg class="pop__icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path class="icon__mark" d="M3 2h10v9H3zM2 3h12v7H2z"/><path class="icon__line" d="M3 1h10v1H3zM2 2h1v1H2zM13 2h1v1h-1zM1 3h1v7H1zM14 3h1v7h-1zM2 10h1v1H2zM13 10h1v1h-1zM3 11h10v1H3zM4 12h2v1H4zM4 13h1v1H4zM6 3h4v1H6zM10 4h1v2h-1zM8 6h2v1H8zM7 7h2v1H7zM7 9h2v1H7z"/></svg>`;

const CHECK = `<svg viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M7 0h1v2H7zM6 1h1v2H6zM5 2h1v2H5zM0 2h1v2H0zM1 3h1v2H1zM4 3h1v2H4zM2 4h2v3H2z"/></svg>`;

const MARK = DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

export function gamePage(opts: { pluginUrl: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="dark" />
<meta name="theme-color" content="#110f0e" />
<meta name="robots" content="noindex" />
<title>Decker 95</title>
<link rel="icon" type="image/svg+xml" href="${DECKER_FAVICON}" />
<style>
@font-face {
  font-family: "Pixelify Sans";
  src: url("data:font/woff2;base64,${PIXELIFY_SANS_BASE64}") format("woff2-variations");
  font-weight: 400 700;
  font-style: normal;
  font-display: block;
}
${DESIGN_TOKENS_CSS}
${GAME_CSS}
</style>
</head>
<body>
<main class="g">
  <div class="g__col" data-col>
    <header class="g-head">
      <svg class="g-head__mark" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">${MARK}</svg>
      <div>
        <h1 class="g-head__name">Decker</h1>
        <p class="g-head__tag">Google Slides deck with Figma comfort</p>
      </div>
    </header>
    <section class="w95" aria-labelledby="g-title" data-win>
      <div class="w95__bar">
        <svg class="w95__icon" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">${MARK}</svg>
        <p class="w95__title" id="g-title">Decker 95</p>
        <a class="w95__x" href="/" aria-label="Close the game and go back to Decker">${ICON_CLOSE}</a>
      </div>
      <div class="w95__tools">
        <div class="w95__group">
          <button type="button" class="btn95" data-pause disabled>Pause</button>
          <label class="chk95"><input type="checkbox" class="chk95__input" data-sound><span class="chk95__box" aria-hidden="true">${CHECK}</span><span class="chk95__label">Sound</span></label>
        </div>
        <div class="meter-wrap">
          <span id="meter-label">Deck integrity</span>
          <div class="meter" role="progressbar" aria-labelledby="meter-label" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" data-meter><div class="meter__fill" data-meter-fill></div></div>
          <span class="meter-wrap__value" data-meter-text>100%</span>
        </div>
      </div>
      <div class="w95__well">
        <div class="desk" data-desk>
          <noscript><p class="g-noscript">Turn on JavaScript to play.</p></noscript>
        </div>
      </div>
      <div class="w95__status">
        <p class="w95__field">Time <span data-time>1:00</span></p>
        <p class="w95__field">Score <span data-score>0</span></p>
        <p class="w95__field">Combo <span data-combo>x1</span></p>
        <p class="w95__field w95__field--end">High <span data-high>0</span></p>
      </div>
    </section>
    <nav class="g-links" aria-label="Decker">
      <a href="${opts.pluginUrl}" target="_blank" rel="noopener noreferrer">Try it on Figma</a>
      <a href="/">Back to the site</a>
    </nav>
  </div>
  <div class="g-sr" role="status" data-status></div>
</main>
<script>
(function () {
'use strict';
var PLUGIN_URL = ${JSON.stringify(opts.pluginUrl)};
var ICON_X = ${JSON.stringify(ICON_CLOSE)};
var ICON_WARN = ${JSON.stringify(ICON_WARN)};
var ICON_ASK = ${JSON.stringify(ICON_ASK)};
${GAME_JS}
})();
</script>
</body>
</html>`;
}
