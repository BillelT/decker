/**
 * Easter egg du footer (docs/roadmap/08-site-easter-egg-jeu.md), version 2 :
 * le flow du jeu de Luc sur smoo.link. Le logo du footer mène à une page à
 * part, /game, fond encre, avec une fenêtre façon Windows 95 au centre et un
 * Asteroids dedans. Sous la fenêtre, les touches, la police et une ligne sur
 * Decker.
 *
 * Dans notre DA : la fenêtre reprend les gris chauds de la marque (biseaux
 * Win95 en tokens `--b-*`), la barre de titre passe à l'orange de marque avec
 * le titre à l'encre, comme nos boutons pleins. Le vaisseau est un curseur
 * (on est dans un plugin Figma), les astéroïdes sont des images plates :
 * ce que Decker évite à tes slides. Le canvas est un vrai écran pixel de
 * 320 x 180, agrandi d'un facteur entier, dessiné pixel par pixel (pas de
 * trait antialiasé) sur une grille de points façon canvas Figma.
 *
 * Page autonome : ni header ni footer du site, pas de Cabinet Grotesk, une
 * police pixel (Pixelify Sans, OFL) inlinée seulement ici. Pas indexée.
 *
 * Le JS est écrit en ES2017 sans framework, comme le reste du site, et gardé
 * en `String.raw` : pas de backtick ni de `${` dedans.
 */
import { DESIGN_TOKENS_CSS } from '../generated/designTokens.js';
import { DECKER_FAVICON, DECKER_MARK_SVG } from './brand.js';
import { PIXELIFY_SANS_BASE64 } from './gameFontData.js';

const GAME_CSS = String.raw`
:root {
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

/* ---------- Fenêtre ---------- */
.w95 { padding: 3px; background: var(--w95-face); box-shadow: var(--w95-out); color: var(--b-ink); }
.w95__bar {
  display: flex; align-items: center; gap: var(--b-space-6); min-height: 24px;
  padding: 2px 2px 2px var(--b-space-4);
  background: linear-gradient(90deg in oklab, var(--b-accent), var(--b-accent-hover)); color: var(--b-ink);
}
/* Fenêtre en arrière-plan pendant un dialogue, comme sous Windows : la barre
   passe au gris, le titre reste lisible (blanc sur gris 600). */
.w95[data-inactive] > .w95__bar { background: var(--b-gray-600); color: var(--b-white); }
.w95__icon { flex: none; width: 16px; height: 16px; display: block; }
.w95__title {
  flex: 1 1 auto; min-width: 0; margin: 0; font: inherit; font-size: 14px; font-weight: 700; line-height: 1.2;
  letter-spacing: 0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.w95__x {
  position: relative; flex: none; display: grid; place-items: center; width: 24px; height: 22px;
  background: var(--w95-face); box-shadow: var(--w95-out); color: var(--b-ink);
  touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
}
.w95__x::before { content: ""; position: absolute; inset: -6px -2px; }
.w95__x:active { box-shadow: var(--w95-pressed); }
.w95__x svg { width: 8px; height: 7px; display: block; }
.w95__x:focus-visible { outline: 2px dotted var(--b-ink); outline-offset: -5px; }

.w95__well { position: relative; margin-top: 3px; padding: 2px; background: var(--b-white); box-shadow: var(--w95-in); }
.w95__well:focus { outline: none; }
.w95__canvas {
  display: block; width: 320px; height: 180px;
  image-rendering: crisp-edges; image-rendering: pixelated; touch-action: none;
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
.btn95:active { box-shadow: var(--w95-pressed); transform: scale(0.97); }
/* Bouton par défaut : le liseré noir de Windows, plein à l'orange de marque. */
.btn95--default { background: var(--b-accent); box-shadow: 0 0 0 1px var(--b-ink), var(--w95-out); font-weight: 700; }
.btn95--default:active { box-shadow: 0 0 0 1px var(--b-ink), var(--w95-pressed); }
.btn95:focus-visible { outline: 2px dotted var(--b-ink); outline-offset: -6px; }
@media (hover: hover) and (pointer: fine) {
  .btn95:hover { background: var(--w95-light); }
  .btn95--default:hover { background: var(--b-accent-hover); }
}

/* ---------- Dialogue (pause, fin de partie) ---------- */
.dlg {
  position: absolute; left: 50%; top: 50%; translate: -50% -50%;
  box-sizing: border-box; width: min(300px, calc(100% - 16px)); padding: 3px;
  background: var(--w95-face); color: var(--b-ink);
  box-shadow: var(--w95-out), 4px 4px 0 color-mix(in oklab, var(--b-ink) 30%, transparent);
}
.dlg[hidden] { display: none; }
.dlg__body { padding: var(--b-space-12); text-align: center; }
.dlg__lead { margin: 0 0 var(--b-space-12); font-size: 14px; line-height: 1.4; text-wrap: balance; }
.dlg__lead:empty { display: none; }
.dlg__scores { display: flex; justify-content: center; gap: var(--b-space-48); margin: 0 0 var(--b-space-16); }
.dlg__scores dt { font-size: 12px; line-height: 1.2; letter-spacing: 0.05em; text-transform: uppercase; }
.dlg__scores dd { margin: 0; font-size: 32px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.dlg__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--b-space-12); }
@media (prefers-reduced-motion: no-preference) {
  @keyframes dlg-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: none; } }
  .dlg:not([hidden]) { animation: dlg-in 150ms var(--b-ease-out) both; }
}

/* ---------- Commandes tactiles ---------- */
.pad { display: none; justify-content: center; gap: var(--b-space-12); }
.pad__btn { min-width: 0; flex: 1 1 0; min-height: 48px; padding: var(--b-space-8); }
.pad__btn svg { width: 14px; height: 14px; display: block; }
@media (pointer: coarse) {
  .pad { display: flex; }
}

/* ---------- Sous la fenêtre ---------- */
.g-info {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--b-space-16) var(--b-space-32);
  font-size: 14px; line-height: 1.5;
}
.g-info p { margin: 0; text-wrap: pretty; }
.g-info__brand { max-width: 30ch; text-align: end; }
.g-info a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.g-info a:focus-visible { outline: 2px solid var(--b-white); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .g-info a:hover { color: var(--b-white); }
}
.keys { display: grid; grid-template-columns: auto auto; justify-content: start; align-items: center; gap: var(--b-space-6) var(--b-space-12); margin: 0; }
.keys dd { margin: 0; }
.keys dt { display: flex; gap: var(--b-space-4); }
.kbd {
  display: inline-grid; place-items: center; box-sizing: border-box; min-width: 22px; height: 20px; padding: 0 var(--b-space-4);
  background: var(--b-gray-800); color: var(--b-gray-100); font: inherit; font-size: 12px; line-height: 1;
  box-shadow: inset -1px -1px var(--b-black), inset 1px 1px var(--b-gray-600);
}
.kbd svg { width: 8px; height: 8px; display: block; }
/* Sur un écran tactile sans clavier, la légende des touches ne sert à rien. */
@media (pointer: coarse) and (hover: none) {
  .keys { display: none; }
}
@media (max-width: 600px) {
  .g-info { flex-direction: column; }
  .g-info__brand { text-align: start; }
}
`;

const GAME_JS = String.raw`
var W = 320;
var H = 180;
var HIGH_KEY = 'decker-game-high';
var doc = document;
var canvas = doc.querySelector('[data-canvas]');
var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
if (!ctx) return;
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var win = doc.querySelector('[data-win]');
var well = doc.querySelector('[data-well]');
var pad = doc.querySelector('[data-pad]');
var col = doc.querySelector('[data-col]');
var dlg = doc.querySelector('[data-dialog]');
var dlgTitle = doc.querySelector('[data-dialog-title]');
var dlgLead = doc.querySelector('[data-dialog-lead]');
var dlgScore = doc.querySelector('[data-dialog-score]');
var dlgHigh = doc.querySelector('[data-dialog-high]');
var dlgGo = doc.querySelector('[data-dialog-go]');
var statusEl = doc.querySelector('[data-status]');
var out = {
  score: doc.querySelector('[data-score]'),
  wave: doc.querySelector('[data-wave]'),
  lives: doc.querySelector('[data-lives]'),
  high: doc.querySelector('[data-high]')
};

/* Couleurs lues dans les tokens de la page : rien en dur ici. */
var css = getComputedStyle(doc.documentElement);
function tok(name) { return css.getPropertyValue(name).trim(); }
var C = {
  bg: tok('--b-white'),
  dot: tok('--b-gray-200'),
  ink: tok('--b-ink'),
  accent: tok('--b-accent'),
  red: tok('--b-accent-red'),
  muted: tok('--b-gray-500')
};

/* ---------- Mise à l'échelle : facteur entier, pour des pixels nets ----------
   Le plus grand facteur (4 au plus) où tout tient dans l'écran : fenêtre,
   commandes tactiles et texte du dessous, dont la hauteur dépend de la
   largeur. Sous le facteur 2 (un téléphone), on remplit la place en
   facteur fractionnaire : sur un écran à 3x, l'écart entre pixels ne se voit
   pas, et un jeu à 320px de large y serait trop petit. */
function size(s) {
  canvas.style.width = Math.round(W * s) + 'px';
  canvas.style.height = Math.round(H * s) + 'px';
}
function fit() {
  /* Mesure prise au plus petit : un canvas trop large élargit le viewport
     d'un mobile, et la mesure avec (d'où aussi le plafond à la largeur de
     l'écran). */
  size(1);
  var vw = Math.min(doc.documentElement.clientWidth, window.screen.width || Infinity);
  var vh = Math.min(window.innerHeight, window.screen.height || Infinity);
  var chromeW = win.offsetWidth - canvas.offsetWidth;
  for (var s = 4; s > 1; s--) {
    size(s);
    if (W * s + chromeW <= vw - 32 && col.offsetHeight <= vh - 48) return;
  }
  size(1);
  var room = (vh - 48 - col.offsetHeight + H) / H;
  size(Math.min((vw - 32 - chromeW) / W, Math.max(1, Math.min(2, room))));
}
fit();
window.addEventListener('resize', fit);

/* ---------- Pixels ---------- */
var dither = false;
function px(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (dither && ((x + y) & 1)) return;
  x = ((x % W) + W) % W;
  y = ((y % H) + H) % H;
  ctx.fillRect(x, y, 1, 1);
}
function line(x0, y0, x1, y1) {
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
  var dx = Math.abs(x1 - x0);
  var dy = -Math.abs(y1 - y0);
  var sx = x0 < x1 ? 1 : -1;
  var sy = y0 < y1 ? 1 : -1;
  var err = dx + dy;
  for (;;) {
    px(x0, y0);
    if (x0 === x1 && y0 === y1) return;
    var e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function outline(pts) {
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i];
    var b = pts[(i + 1) % pts.length];
    line(a[0], a[1], b[0], b[1]);
  }
}
/* Remplissage par balayage : un pixel est dedans si son centre l'est. */
function fill(pts) {
  var minY = Infinity;
  var maxY = -Infinity;
  pts.forEach(function (p) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
  for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    var yc = y + 0.5;
    var xs = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort(function (p, q) { return p - q; });
    for (var k = 0; k + 1 < xs.length; k += 2) {
      for (var x = Math.ceil(xs[k] - 0.5); x < Math.ceil(xs[k + 1] - 0.5); x++) px(x, y);
    }
  }
}
function place(local, x, y, r) {
  var c = Math.cos(r);
  var s = Math.sin(r);
  return local.map(function (p) { return [x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c]; });
}

/* ---------- Formes ---------- */
/* Le vaisseau est la flèche d'un curseur : pointe, bord gauche, encoche,
   queue, aile. Recentré sur son centre de gravité. */
var CURSOR = [[0, 0], [0, 12], [3, 9], [5, 13], [7, 12], [5, 8], [9, 8]];
var cx0 = 0;
var cy0 = 0;
CURSOR.forEach(function (p) { cx0 += p[0] / CURSOR.length; cy0 += p[1] / CURSOR.length; });
var SHIP = CURSOR.map(function (p) { return [p[0] - cx0, p[1] - cy0]; });
/* Direction de la pointe vue du centre : à ce cap, le curseur est droit. */
var TIP_ANGLE = Math.atan2(SHIP[0][1], SHIP[0][0]);
var TIP_DIST = Math.hypot(SHIP[0][0], SHIP[0][1]);
var SHIP_R = 4;

/* Trois tailles d'image plate : demi-côté, vitesse, points. */
var SIZES = [null, { a: 3.5, speed: [34, 52], points: 100 }, { a: 6, speed: [22, 36], points: 50 }, { a: 11, speed: [11, 22], points: 20 }];

/* ---------- État ---------- */
var state = 'play';
var ship = null;
var rocks = [];
var bullets = [];
var sparks = [];
var shards = [];
var keys = { left: false, right: false, up: false, down: false };
/* Tir au coup par coup, comme l'original : un appui, une balle. Tenir la
   touche en rafale rendait le jeu trop facile en tournant sur place. */
var shot = false;
var score = 0;
var wave = 0;
var lives = 3;
var high = readHigh();
var respawnIn = 0;
var waveIn = 0;
var cooldown = 0;
var thrusting = false;

function readHigh() {
  try { return parseInt(window.localStorage.getItem(HIGH_KEY) || '0', 10) || 0; } catch (e) { return 0; }
}
function writeHigh(v) {
  try { window.localStorage.setItem(HIGH_KEY, String(v)); } catch (e) {}
}
function rand(min, max) { return min + Math.random() * (max - min); }
function fmt(v) { return v.toLocaleString('en-US'); }
function wrapX(x) { return ((x % W) + W) % W; }
function wrapY(y) { return ((y % H) + H) % H; }
/* Distance sur le tore : ce qui sort d'un bord revient par l'autre. */
function dist(ax, ay, bx, by) {
  var dx = Math.abs(ax - bx);
  var dy = Math.abs(ay - by);
  return Math.hypot(Math.min(dx, W - dx), Math.min(dy, H - dy));
}

var announceTimer = 0;
function say(text) {
  statusEl.textContent = '';
  window.clearTimeout(announceTimer);
  announceTimer = window.setTimeout(function () { statusEl.textContent = text; }, 50);
}
function hud() {
  out.score.textContent = fmt(score);
  out.wave.textContent = String(wave);
  out.lives.textContent = String(lives);
  out.high.textContent = fmt(Math.max(high, score));
}

function newShip() {
  ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: TIP_ANGLE, shield: 2.5 };
}
function addRock(size, x, y) {
  var spec = SIZES[size];
  var dir = rand(0, Math.PI * 2);
  var v = rand(spec.speed[0], spec.speed[1]) * (1 + Math.min(wave - 1, 8) * 0.06);
  rocks.push({
    size: size, a: spec.a, r: spec.a * 1.3, x: x, y: y,
    vx: Math.cos(dir) * v, vy: Math.sin(dir) * v,
    rot: rand(0, Math.PI * 2), spin: rand(-1.2, 1.2)
  });
}
function nextWave() {
  wave += 1;
  var n = Math.min(2 + wave, 9);
  for (var i = 0; i < n; i++) {
    var x;
    var y;
    var tries = 0;
    do {
      x = rand(0, W);
      y = rand(0, H);
      tries++;
    } while (ship && dist(x, y, ship.x, ship.y) < 70 && tries < 30);
    addRock(3, x, y);
  }
  hud();
  if (wave > 1) say('Wave ' + wave + '.');
}
function reset() {
  score = 0;
  wave = 0;
  lives = 3;
  rocks = [];
  bullets = [];
  sparks = [];
  shards = [];
  respawnIn = 0;
  waveIn = 0;
  newShip();
  nextWave();
}

function burst(x, y, n, colors) {
  for (var i = 0; i < n; i++) {
    var d = rand(0, Math.PI * 2);
    var v = rand(15, 60);
    sparks.push({ x: x, y: y, vx: Math.cos(d) * v, vy: Math.sin(d) * v, life: rand(0.3, 0.7), color: colors[i % colors.length] });
  }
}
function hitRock(i) {
  var r = rocks[i];
  rocks.splice(i, 1);
  score += SIZES[r.size].points;
  if (score > high) out.high.textContent = fmt(score);
  burst(r.x, r.y, 4 + r.size * 3, [C.ink, C.ink, C.accent]);
  if (r.size > 1) {
    addRock(r.size - 1, r.x, r.y);
    addRock(r.size - 1, r.x, r.y);
  }
  out.score.textContent = fmt(score);
}
/* Mort façon Asteroids : chaque bord du curseur part de son côté. */
function crash() {
  var pts = place(SHIP, ship.x, ship.y, ship.angle - TIP_ANGLE);
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i];
    var b = pts[(i + 1) % pts.length];
    var d = rand(0, Math.PI * 2);
    var v = rand(8, 30);
    shards.push({
      x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2,
      len: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
      vx: ship.vx * 0.3 + Math.cos(d) * v, vy: ship.vy * 0.3 + Math.sin(d) * v,
      spin: rand(-3, 3), life: rand(0.9, 1.4)
    });
  }
  burst(ship.x, ship.y, 10, [C.accent, C.red, C.ink]);
  ship = null;
  thrusting = false;
  lives -= 1;
  hud();
  if (lives > 0) {
    respawnIn = 1.6;
    say(lives === 1 ? '1 life left.' : lives + ' lives left.');
  } else {
    window.setTimeout(gameOver, 900);
  }
}

/* ---------- Mise à jour ---------- */
function drift(o, dt) {
  o.x = wrapX(o.x + o.vx * dt);
  o.y = wrapY(o.y + o.vy * dt);
}
function updateWorld(dt) {
  rocks.forEach(function (r) { drift(r, dt); r.rot += r.spin * dt; });
  sparks = sparks.filter(function (p) { drift(p, dt); p.life -= dt; return p.life > 0; });
  shards = shards.filter(function (s) { drift(s, dt); s.ang += s.spin * dt; s.life -= dt; return s.life > 0; });
}
function update(dt) {
  if (ship) {
    if (keys.left) ship.angle -= 4.2 * dt;
    if (keys.right) ship.angle += 4.2 * dt;
    thrusting = keys.up;
    if (keys.up) {
      ship.vx += Math.cos(ship.angle) * 150 * dt;
      ship.vy += Math.sin(ship.angle) * 150 * dt;
    }
    var drag = Math.pow(keys.down ? 0.03 : 0.7, dt);
    ship.vx *= drag;
    ship.vy *= drag;
    var sp = Math.hypot(ship.vx, ship.vy);
    if (sp > 150) { ship.vx *= 150 / sp; ship.vy *= 150 / sp; }
    drift(ship, dt);
    ship.shield = Math.max(0, ship.shield - dt);

    cooldown -= dt;
    if (shot && cooldown <= 0 && bullets.length < 4) {
      cooldown = 0.1;
      var c = Math.cos(ship.angle);
      var s = Math.sin(ship.angle);
      bullets.push({ x: ship.x + c * TIP_DIST, y: ship.y + s * TIP_DIST, vx: ship.vx + c * 230, vy: ship.vy + s * 230, life: 0.75 });
    }
    shot = false;
  } else if (lives > 0) {
    respawnIn -= dt;
    var clear = rocks.every(function (r) { return dist(r.x, r.y, W / 2, H / 2) > r.r + 30; });
    if (respawnIn <= 0 && (clear || respawnIn < -2)) newShip();
  }

  bullets = bullets.filter(function (b) { drift(b, dt); b.life -= dt; return b.life > 0; });
  updateWorld(dt);

  for (var i = bullets.length - 1; i >= 0; i--) {
    for (var j = rocks.length - 1; j >= 0; j--) {
      if (dist(bullets[i].x, bullets[i].y, rocks[j].x, rocks[j].y) < rocks[j].r) {
        bullets.splice(i, 1);
        hitRock(j);
        break;
      }
    }
  }
  if (ship && ship.shield <= 0) {
    for (var k = 0; k < rocks.length; k++) {
      if (dist(ship.x, ship.y, rocks[k].x, rocks[k].y) < rocks[k].r + SHIP_R) { crash(); break; }
    }
  }
  if (!rocks.length && lives > 0) {
    if (waveIn <= 0) waveIn = 1.2;
    waveIn -= dt;
    if (waveIn <= 0) nextWave();
  }
}

/* ---------- Dessin ---------- */
function drawRock(r) {
  var a = r.a;
  var frame = place([[-a, -a], [a, -a], [a, a], [-a, a]], r.x, r.y, r.rot);
  ctx.fillStyle = C.bg;
  fill(frame);
  ctx.fillStyle = C.ink;
  outline(frame);
  if (r.size > 1) {
    var hill = place([[-a, 0.6 * a], [-0.3 * a, -0.1 * a], [0.15 * a, 0.35 * a], [0.45 * a, 0.05 * a], [a, 0.6 * a]], r.x, r.y, r.rot);
    for (var i = 0; i + 1 < hill.length; i++) line(hill[i][0], hill[i][1], hill[i + 1][0], hill[i + 1][1]);
  }
  var sun = place([[0.45 * a, -0.45 * a]], r.x, r.y, r.rot)[0];
  ctx.fillStyle = C.accent;
  px(sun[0], sun[1]);
  if (r.size === 3) { px(sun[0] + 1, sun[1]); px(sun[0], sun[1] + 1); px(sun[0] + 1, sun[1] + 1); }
}
function drawShip() {
  var pts = place(SHIP, ship.x, ship.y, ship.angle - TIP_ANGLE);
  /* Bouclier de réapparition : une trame fixe d'un pixel sur deux, pas un
     clignotement. */
  dither = ship.shield > 0;
  if (thrusting) {
    var c = Math.cos(ship.angle);
    var s = Math.sin(ship.angle);
    var len = 2 + Math.floor(Math.random() * 3);
    for (var i = 0; i < len; i++) {
      ctx.fillStyle = i < 2 ? C.accent : C.red;
      px(ship.x - c * (6 + i), ship.y - s * (6 + i));
    }
  }
  ctx.fillStyle = C.accent;
  fill(pts);
  ctx.fillStyle = C.ink;
  outline(pts);
  dither = false;
}
function draw() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.dot;
  for (var y = 5; y < H; y += 10) for (var x = 5; x < W; x += 10) ctx.fillRect(x, y, 1, 1);
  rocks.forEach(drawRock);
  ctx.fillStyle = C.ink;
  bullets.forEach(function (b) { px(b.x, b.y); px(b.x + 1, b.y); px(b.x, b.y + 1); px(b.x + 1, b.y + 1); });
  shards.forEach(function (s) {
    var dx = Math.cos(s.ang) * s.len;
    var dy = Math.sin(s.ang) * s.len;
    line(s.x - dx, s.y - dy, s.x + dx, s.y + dy);
  });
  sparks.forEach(function (p) { ctx.fillStyle = p.color; px(p.x, p.y); });
  if (ship) drawShip();
}

/* ---------- Boucle ---------- */
var raf = 0;
var last = 0;
function frame(t) {
  var dt = last ? Math.min((t - last) / 1000, 1 / 30) : 0;
  last = t;
  if (state === 'play') update(dt);
  else if (state === 'over' && !reduceMotion) updateWorld(dt);
  draw();
  raf = state === 'paused' || state === 'ready' || (state === 'over' && reduceMotion) ? 0 : window.requestAnimationFrame(frame);
}
function run() {
  if (raf) return;
  last = 0;
  raf = window.requestAnimationFrame(frame);
}

/* ---------- Dialogues ---------- */
var dlgKind = '';
function showDialog(kind) {
  dlgKind = kind;
  var titles = { ready: 'Ready', paused: 'Paused', over: 'Game over' };
  var leads = { ready: 'Shoot the flat images before they hit your cursor.', paused: '', over: '' };
  var go = { ready: 'Start', paused: 'Resume', over: 'Play again' };
  dlgTitle.textContent = titles[kind];
  dlgLead.textContent = leads[kind];
  dlgScore.textContent = fmt(score);
  dlgHigh.textContent = fmt(Math.max(high, score));
  dlgGo.textContent = go[kind];
  dlg.hidden = false;
  win.setAttribute('data-inactive', '');
  dlgGo.focus();
}
function hideDialog() {
  dlg.hidden = true;
  win.removeAttribute('data-inactive');
  well.focus({ preventScroll: true });
}
function clearKeys() {
  Object.keys(keys).forEach(function (k) { keys[k] = false; });
  shot = false;
}

function pause() {
  if (state !== 'play') return;
  state = 'paused';
  clearKeys();
  showDialog('paused');
  say('Paused.');
}
function resume() {
  if (state !== 'paused' && state !== 'ready') return;
  state = 'play';
  hideDialog();
  run();
}
function gameOver() {
  state = 'over';
  clearKeys();
  thrusting = false;
  var best = score > high;
  if (best) { high = score; writeHigh(high); }
  hud();
  showDialog('over');
  say('Game over. Score ' + fmt(score) + (best ? ', new high score.' : '.'));
  run();
}
function restart() {
  window.cancelAnimationFrame(raf);
  raf = 0;
  reset();
  state = 'play';
  hideDialog();
  say('New game. Wave 1.');
  run();
}
dlgGo.addEventListener('click', function () {
  if (dlgKind === 'over') restart(); else resume();
});

/* ---------- Clavier ---------- */
var CODES = {
  ArrowLeft: 'left', a: 'left', A: 'left', q: 'left', Q: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up', z: 'up', Z: 'up',
  ArrowDown: 'down', s: 'down', S: 'down'
};
doc.addEventListener('keydown', function (e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state === 'play') { pause(); e.preventDefault(); }
    else if (state === 'paused') { resume(); e.preventDefault(); }
    return;
  }
  if (state !== 'play') return;
  var t = e.target;
  if (t && t.closest && t.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.key === ' ') {
    if (!e.repeat) shot = true;
    e.preventDefault();
    return;
  }
  var c = CODES[e.key];
  if (c) { keys[c] = true; e.preventDefault(); }
});
doc.addEventListener('keyup', function (e) {
  var c = CODES[e.key];
  if (c) keys[c] = false;
});
window.addEventListener('blur', function () { clearKeys(); pause(); });
doc.addEventListener('visibilitychange', function () { if (doc.hidden) pause(); });

/* ---------- Tactile : chaque bouton suit son propre doigt ---------- */
pad.querySelectorAll('[data-hold]').forEach(function (btn) {
  var key = btn.getAttribute('data-hold');
  var up = function () { if (key !== 'fire') keys[key] = false; };
  btn.addEventListener('pointerdown', function (e) {
    if (state !== 'play') return;
    if (key === 'fire') shot = true; else keys[key] = true;
    btn.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
});

/* ---------- Départ ---------- */
reset();
hud();
if (reduceMotion) {
  state = 'ready';
  draw();
  showDialog('ready');
} else {
  well.focus({ preventScroll: true });
  run();
}
`;

const ICON_CLOSE = `<svg viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3zM2 4h4v1H2zM1 5h2v1H1zM5 5h2v1H5zM0 6h2v1H0zM6 6h2v1H6z"/></svg>`;

/** Flèches pixel des touches et des commandes tactiles, une seule forme tournée. */
function arrow(rotate: number): string {
  return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" transform="rotate(${rotate} 4 4)" d="M3 0h2v1H3zM2 1h4v1H2zM1 2h6v1H1zM0 3h8v1H0zM3 4h2v4H3z"/></svg>`;
}

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
    <section class="w95" aria-labelledby="g-title" data-win>
      <div class="w95__bar">
        <svg class="w95__icon" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">${DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>
        <h1 class="w95__title" id="g-title">Decker 95</h1>
        <a class="w95__x" href="/" aria-label="Close the game and go back to Decker">${ICON_CLOSE}</a>
      </div>
      <div class="w95__well" tabindex="-1" data-well>
        <canvas class="w95__canvas" width="320" height="180" role="img" aria-label="Game area: steer the cursor and shoot the flat images" data-canvas></canvas>
        <noscript><p class="g-noscript">Turn on JavaScript to play.</p></noscript>
        <div class="dlg" role="dialog" aria-labelledby="dlg-title" hidden data-dialog>
          <div class="w95__bar"><h2 class="w95__title" id="dlg-title" data-dialog-title>Paused</h2></div>
          <div class="dlg__body">
            <p class="dlg__lead" data-dialog-lead></p>
            <dl class="dlg__scores">
              <div><dt>Score</dt><dd data-dialog-score>0</dd></div>
              <div><dt>High</dt><dd data-dialog-high>0</dd></div>
            </dl>
            <div class="dlg__actions">
              <a class="btn95" href="/">Quit</a>
              <button type="button" class="btn95 btn95--default" data-dialog-go>Resume</button>
            </div>
          </div>
        </div>
      </div>
      <div class="w95__status">
        <p class="w95__field">Score <span data-score>0</span></p>
        <p class="w95__field">Wave <span data-wave>1</span></p>
        <p class="w95__field">Lives <span data-lives>3</span></p>
        <p class="w95__field w95__field--end">High <span data-high>0</span></p>
      </div>
    </section>
    <div class="pad" data-pad>
      <button type="button" class="btn95 pad__btn" data-hold="left" aria-label="Rotate left">${arrow(-90)}</button>
      <button type="button" class="btn95 pad__btn" data-hold="up" aria-label="Thrust">${arrow(0)}</button>
      <button type="button" class="btn95 pad__btn" data-hold="right" aria-label="Rotate right">${arrow(90)}</button>
      <button type="button" class="btn95 pad__btn" data-hold="fire">Fire</button>
    </div>
    <div class="g-info">
      <dl class="keys">
        <dt><kbd class="kbd">${arrow(-90)}<span class="g-sr">Left arrow</span></kbd><kbd class="kbd">${arrow(90)}<span class="g-sr">Right arrow</span></kbd></dt><dd>Rotate</dd>
        <dt><kbd class="kbd">${arrow(0)}<span class="g-sr">Up arrow</span></kbd></dt><dd>Thrust</dd>
        <dt><kbd class="kbd">${arrow(180)}<span class="g-sr">Down arrow</span></kbd></dt><dd>Brake</dd>
        <dt><kbd class="kbd">Space</kbd></dt><dd>Fire</dd>
        <dt><kbd class="kbd">Esc</kbd></dt><dd>Pause</dd>
      </dl>
      <p>Font: Pixelify Sans<br>by Stefie Justprince</p>
      <p class="g-info__brand">Decker exports editable, pixel perfect decks from Figma to Google Slides.<br>
        <a href="${opts.pluginUrl}" target="_blank" rel="noopener noreferrer">Try it on Figma</a> · <a href="/">Back to the site</a></p>
    </div>
  </div>
  <div class="g-sr" role="status" data-status></div>
</main>
<script>
(function () {
'use strict';
${GAME_JS}
})();
</script>
</body>
</html>`;
}
