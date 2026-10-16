/**
 * Easter egg du footer (docs/roadmap/08-site-easter-egg-jeu.md) : un jeu de
 * fausses pop-ups façon années 2000, déclenché par un clic sur le logo du
 * footer. Le méchant est `SCREENSHOT.EXE`, qui veut aplatir le deck en une
 * image : l'inverse de la promesse de Decker.
 *
 * Servi en /easter-egg.js par pages.ts et chargé seulement au clic : il ne
 * coûte rien à qui ne le trouve pas. Le script injecte son propre CSS, qui
 * s'appuie sur les tokens `--b-*` et les biseaux `--hyb-*` déjà posés par la
 * page. Rien ne sort de la page : pas de `window.open`, pas d'`alert()`.
 *
 * Le JS est écrit en ES2017 sans framework, comme le reste du site. Il est
 * gardé en `String.raw` : pas de backtick ni de `${` dedans, les valeurs
 * venant de TypeScript passent par `JSON.stringify` en tête du script.
 */

/** Incrémenter à chaque changement du jeu : l'URL change, le cache d'un an saute. */
export const EASTER_EGG_VERSION = '1';

const EGG_CSS = String.raw`
.egg {
  position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  font-family: var(--b-font-sans); color: var(--b-ink);
  background: color-mix(in oklab, var(--b-ink) 28%, transparent);
  overscroll-behavior: contain; touch-action: manipulation;
  -webkit-user-select: none; user-select: none;
}
.egg-sr {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}

/* ---------- HUD ---------- */
.egg-hud {
  position: relative; z-index: 2; display: flex; align-items: center; flex-wrap: wrap;
  gap: var(--b-space-12) var(--b-space-24); padding: var(--b-space-12) var(--b-space-16);
  background: var(--b-surface); box-shadow: var(--hyb-out);
  font-size: var(--b-text-sm); font-weight: var(--b-font-medium); line-height: var(--b-leading-tight);
}
.egg-hud__meter { display: flex; align-items: center; gap: var(--b-space-8); white-space: nowrap; }
.egg-hud__stats { display: flex; gap: var(--b-space-16); white-space: nowrap; font-variant-numeric: tabular-nums; }
.egg-hud__value { font-weight: var(--b-font-bold); font-variant-numeric: tabular-nums; }
.egg-hud__actions { display: flex; gap: var(--b-space-8); margin-inline-start: auto; }
.egg-meter {
  position: relative; width: 140px; height: 14px; overflow: hidden;
  background: var(--b-surface-muted); box-shadow: var(--hyb-in);
}
.egg-meter__fill {
  position: absolute; inset: 3px; background: var(--b-accent);
  transform-origin: left center; transition: transform var(--b-duration) linear;
}
/* L'alerte rouge est un graphisme d'état, doublé du pourcentage écrit à côté. */
.egg-meter--low .egg-meter__fill { background: var(--b-accent-red); }

/* ---------- Buttons ---------- */
.egg-btn {
  display: inline-flex; align-items: center; justify-content: center; min-height: 32px;
  padding: var(--b-space-6) var(--b-space-12); border: 0; border-radius: 0; cursor: pointer;
  font: inherit; font-size: var(--b-text-sm); font-weight: var(--b-font-bold); line-height: var(--b-leading-tight);
  color: var(--b-ink); background: var(--b-surface-muted); box-shadow: var(--hyb-out);
  white-space: nowrap; text-decoration: none; touch-action: manipulation;
  transition: background-color var(--b-duration) var(--b-ease-default), transform var(--b-duration) var(--b-ease-out);
}
.egg-btn:active:not(:disabled) { box-shadow: var(--hyb-pressed); transform: scale(0.97); }
.egg-btn:disabled { color: var(--b-gray-400); cursor: default; }
.egg-btn--cta { background: var(--b-accent); }
.egg-btn:focus-visible, .egg-win__x:focus-visible {
  outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset);
}
@media (hover: hover) and (pointer: fine) {
  .egg-btn:hover:not(:disabled) { background: var(--b-gray-200); }
  .egg-btn--cta:hover:not(:disabled) { background: var(--b-accent-hover); }
}

/* ---------- Field and windows ---------- */
.egg-field { position: relative; z-index: 1; flex: 1 1 auto; overflow: hidden; }
.egg-win {
  position: absolute; width: min(320px, calc(100% - 32px)); padding: 3px;
  background: var(--b-surface);
  box-shadow: var(--hyb-out), 0 12px 32px color-mix(in oklab, var(--b-ink) 20%, transparent);
}
.egg-win--wide { width: min(420px, calc(100% - 32px)); }
/* Les écrans de début, de pause et de fin restent centrés. translate et non
   transform : l'animation d'entrée pose déjà un transform. */
.egg-win--modal { left: 50%; top: 50%; translate: -50% -50%; width: min(400px, calc(100% - 32px)); }
.egg-win__bar {
  display: flex; align-items: center; gap: var(--b-space-8); min-height: 30px;
  padding: 3px 3px 3px var(--b-space-8); background: var(--b-ink); color: var(--b-white);
  font-size: var(--b-text-xs); font-weight: var(--b-font-bold); line-height: var(--b-leading-tight);
}
.egg-win__title { flex: 1 1 auto; min-width: 0; margin: 0; font: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.egg-win__x {
  flex: none; display: grid; place-items: center; width: 24px; height: 24px; padding: 0;
  border: 0; border-radius: 0; cursor: pointer; color: var(--b-ink);
  background: var(--b-surface-muted); box-shadow: var(--hyb-out); touch-action: manipulation;
}
.egg-win__x:active { box-shadow: var(--hyb-pressed); }
.egg-win__x svg { width: 10px; height: 10px; display: block; }
/* La fausse pub cache sa croix : petite et grise, mais la cible reste à 24px. */
.egg-win__x--tiny { background: transparent; box-shadow: none; color: var(--b-gray-400); }
.egg-win__x--tiny svg { width: 7px; height: 7px; }
.egg-win__body { padding: var(--b-space-16); font-size: var(--b-text-sm); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); }
.egg-win__body p { margin: 0 0 var(--b-space-8); text-wrap: pretty; }
.egg-win__body p:last-child { margin-bottom: 0; }
.egg-win__lead { color: var(--b-ink); font-weight: var(--b-font-bold); text-wrap: balance; }
.egg-win__row { display: flex; gap: var(--b-space-12); align-items: flex-start; }
.egg-win__icon { flex: none; width: 32px; height: 32px; }
.egg-win__actions {
  display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--b-space-8);
  padding: 0 var(--b-space-16) var(--b-space-16);
}
.egg-win__share { margin-top: var(--b-space-8); color: var(--b-text-faint); font-size: var(--b-text-xs); -webkit-user-select: text; user-select: text; }

.egg-slide { display: block; width: 100%; aspect-ratio: 16 / 9; margin-bottom: var(--b-space-12); box-shadow: var(--hyb-in); }
.egg-slide__bg { fill: var(--b-surface-muted); }
.egg-slide__ink { fill: var(--b-ink); }
.egg-slide__muted { fill: var(--b-gray-400); }
.egg-slide__accent { fill: var(--b-accent); }
.egg-icon__shape { fill: var(--b-accent-red); }
.egg-icon__mark { fill: var(--b-white); }

.egg-progress { position: relative; height: 18px; margin-top: var(--b-space-12); overflow: hidden; background: var(--b-surface-muted); box-shadow: var(--hyb-in); }
.egg-progress__fill { position: absolute; inset: 3px; background: var(--b-accent); transform-origin: left center; transform: scaleX(0); }
.egg-progress--danger .egg-progress__fill { background: var(--b-accent-red); }
.egg-progress--scan .egg-progress__fill { transition: transform 1200ms linear; }

/* ---------- Défaite : plein écran à l'encre ---------- */
.egg-over {
  position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--b-space-24); padding: var(--b-space-24); text-align: center;
  background: var(--b-ink); color: var(--b-white);
}
.egg-over__title { max-width: 18ch; margin: 0; font-size: var(--b-text-3xl); font-weight: var(--b-font-bold); line-height: var(--b-leading-tight); letter-spacing: var(--b-tracking-tight); text-wrap: balance; }
.egg-over__meta { margin: 0; font-size: var(--b-text-base); color: var(--b-dark-text-muted); font-variant-numeric: tabular-nums; }
.egg-over__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--b-space-12); }
.egg-over .egg-btn:focus-visible { outline-color: var(--b-white); }

/* Entrée d'une pop-up : un pop sec, comme une vraie fenêtre qui s'ouvre. En
   mouvement réduit, un simple fondu. */
@media (prefers-reduced-motion: no-preference) {
  @keyframes egg-pop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: none; } }
  .egg-win { animation: egg-pop 150ms var(--b-ease-out) both; }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes egg-fade { from { opacity: 0; } to { opacity: 1; } }
  .egg-win, .egg-over { animation: egg-fade 200ms var(--b-ease-out) both; }
  .egg-meter__fill, .egg-progress--scan .egg-progress__fill { transition: none; }
}

/* Mobile : fenêtres plus grandes, cibles à 44px. */
@media (max-width: 600px), (pointer: coarse) {
  .egg-win__bar { min-height: 44px; }
  .egg-win__x { width: 44px; height: 44px; }
  .egg-btn { min-height: 44px; }
}
@media (max-width: 600px) {
  .egg-hud { gap: var(--b-space-8) var(--b-space-16); padding: var(--b-space-8) var(--b-space-12); }
  .egg-meter { width: 88px; }
  .egg-win, .egg-win--wide { width: calc(100% - 32px); }
}
`;

const EGG_JS = String.raw`
var doc = document;
var DURATION = 60000;
var BOSS_AT = 32000;
var BEST_KEY = 'decker-egg-best';
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var root = null;
var field = null;
var hud = null;
var statusEl = null;
var trigger = null;
var inerted = [];
var s = null;

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
function isMobile() { return window.matchMedia('(max-width: 600px)').matches; }
function readBest() {
  try { return parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; }
}
function writeBest(v) {
  try { window.localStorage.setItem(BEST_KEY, String(v)); } catch (e) {}
}

var ICON_X = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1 9 9M9 1 1 9" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>';
var ICON_WARN = '<svg class="egg-win__icon" viewBox="0 0 32 32" aria-hidden="true"><path class="egg-icon__shape" d="M16 2 31 29H1Z"/><rect class="egg-icon__mark" x="14.5" y="11" width="3" height="10"/><rect class="egg-icon__mark" x="14.5" y="23" width="3" height="3"/></svg>';

function slideSvg() {
  var layouts = [
    '<rect x="12" y="14" width="80" height="10" class="egg-slide__ink"/><rect x="12" y="32" width="56" height="5" class="egg-slide__muted"/><rect x="12" y="42" width="64" height="5" class="egg-slide__muted"/><rect x="104" y="14" width="44" height="62" class="egg-slide__accent"/>',
    '<rect x="30" y="30" width="100" height="12" class="egg-slide__ink"/><rect x="50" y="50" width="60" height="5" class="egg-slide__muted"/><rect x="74" y="64" width="12" height="12" class="egg-slide__accent"/>',
    '<rect x="12" y="12" width="60" height="8" class="egg-slide__ink"/><rect x="12" y="30" width="40" height="46" class="egg-slide__accent"/><rect x="60" y="30" width="40" height="46" class="egg-slide__muted"/><rect x="108" y="30" width="40" height="46" class="egg-slide__muted"/>'
  ];
  return '<svg class="egg-slide" viewBox="0 0 160 90" aria-hidden="true"><rect width="160" height="90" class="egg-slide__bg"/>' + pick(layouts) + '</svg>';
}

/* ---------- Annonces ---------- */
var announceTimer = 0;
function say(text) {
  if (!statusEl) return;
  statusEl.textContent = '';
  window.setTimeout(function () { if (statusEl) statusEl.textContent = text; }, 50);
}
function announceCount() {
  window.clearTimeout(announceTimer);
  announceTimer = window.setTimeout(function () {
    if (!s || s.phase !== 'play') return;
    var n = s.wins.length;
    say(n === 0 ? 'No pop-ups open.' : n === 1 ? '1 pop-up open.' : n + ' pop-ups open.');
  }, 1200);
}

/* ---------- Fenêtres ---------- */
var zTop = 10;
var winId = 0;

function makeWin(o) {
  var win = el('section', 'egg-win' + (o.cls ? ' ' + o.cls : ''));
  var id = 'egg-win-' + (++winId);
  win.setAttribute('role', 'group');
  win.setAttribute('aria-labelledby', id);
  var bar = el('div', 'egg-win__bar');
  var title = el('h2', 'egg-win__title', o.title);
  title.id = id;
  title.title = o.title;
  bar.appendChild(title);
  if (o.onX) {
    var x = el('button', 'egg-win__x' + (o.tinyX ? ' egg-win__x--tiny' : ''));
    x.type = 'button';
    x.innerHTML = ICON_X;
    x.setAttribute('aria-label', o.xLabel || 'Close ' + o.title);
    x.addEventListener('click', function () { o.onX(win, x); });
    bar.appendChild(x);
    win._x = x;
  }
  win.appendChild(bar);
  var body = el('div', 'egg-win__body');
  if (o.html) body.innerHTML = o.html;
  win.appendChild(body);
  win._body = body;
  if (o.buttons && o.buttons.length) {
    var actions = el('div', 'egg-win__actions');
    o.buttons.forEach(function (b) {
      var btn = el(b.href ? 'a' : 'button', 'egg-btn' + (b.cta ? ' egg-btn--cta' : ''), b.label);
      if (b.href) {
        btn.href = b.href;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
      } else {
        btn.type = 'button';
        btn.addEventListener('click', function () { b.onClick(win, btn); });
      }
      actions.appendChild(btn);
      if (b.ref) win[b.ref] = btn;
    });
    win.appendChild(actions);
  }
  win.addEventListener('pointerdown', function () { win.style.zIndex = String(++zTop); });
  return win;
}

function placeRandom(win, near) {
  var fw = field.clientWidth;
  var fh = field.clientHeight;
  var ww = win.offsetWidth;
  var wh = win.offsetHeight;
  var x;
  var y;
  if (near) {
    x = Math.min(Math.max(0, near.offsetLeft + 28), Math.max(0, fw - ww));
    y = Math.min(Math.max(0, near.offsetTop + 28), Math.max(0, fh - wh));
  } else {
    x = rand(0, Math.max(0, fw - ww));
    y = rand(0, Math.max(0, fh - wh));
  }
  win.style.left = Math.round(x) + 'px';
  win.style.top = Math.round(y) + 'px';
}

function addWin(win, near) {
  win.style.visibility = 'hidden';
  win.style.zIndex = String(++zTop);
  field.appendChild(win);
  placeRandom(win, near);
  win.style.visibility = '';
  s.wins.push(win);
  announceCount();
  return win;
}

function frontWin() {
  var best = null;
  s.wins.forEach(function (w) {
    if (!best || Number(w.style.zIndex) > Number(best.style.zIndex)) best = w;
  });
  return best;
}

function removeWin(win) {
  var i = s.wins.indexOf(win);
  if (i === -1) return false;
  var hadFocus = win.contains(doc.activeElement);
  s.wins.splice(i, 1);
  win.remove();
  if (hadFocus) {
    var next = frontWin();
    var target = next && next.querySelector('button');
    (target || s.pauseBtn).focus();
  }
  announceCount();
  return true;
}

/* Fermer une pop-up rapporte des points, multipliés par le combo quand on
   enchaîne les fermetures à moins de 0.9 s d'écart. */
function closeWin(win, points) {
  if (!removeWin(win)) return;
  var now = s.elapsed;
  s.combo = now - s.lastClose < 900 ? Math.min(s.combo + 1, 5) : 1;
  s.lastClose = now;
  s.score += (points || 10) * s.combo;
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

function spawnDeck() {
  addWin(makeWin({
    title: pick(DECK_NAMES),
    html: slideSvg() + '<p>' + pick(DECK_LINES) + '</p>',
    onX: function (w) { closeWin(w, 10); }
  }));
}

function spawnAd() {
  addWin(makeWin({
    title: 'You won!!!',
    tinyX: true,
    xLabel: 'Close the free font ad',
    html: '<p class="egg-win__lead">Congratulations! You are the 1,000,000th designer.</p><p>Claim your free font now. Totally not a virus.</p>',
    onX: function (w) { closeWin(w, 20); },
    buttons: [{
      label: 'Claim my free font', cta: true,
      onClick: function (w) { spawnRandom(true); spawnRandom(true); }
    }]
  }));
}

function spawnAlert() {
  addWin(makeWin({
    title: 'Decker Security 2000',
    html: '<div class="egg-win__row">' + ICON_WARN + '<div><p class="egg-win__lead">Warning: 99+ gradients detected.</p><p>Rasterize now?</p></div></div>',
    buttons: [
      { label: 'Rasterize', onClick: function (w) {
        if (!removeWin(w)) return;
        s.integrity = Math.max(0, s.integrity - 15);
        s.score = Math.max(0, s.score - 50);
        s.combo = 1;
        say('Rasterized. Deck integrity down.');
        renderHud();
      } },
      { label: 'Keep editable', cta: true, onClick: function (w) { closeWin(w, 15); } }
    ]
  }));
}

/* La croix se dérobe une fois : au survol à la souris, ou au premier clic
   (tactile, clavier). Le deuxième clic ferme. */
function spawnRunaway() {
  var moved = false;
  var win = makeWin({
    title: 'Untitled_presentation (1).pptx',
    html: slideSvg() + '<p>You can’t close me. Probably.</p>',
    onX: function (w) {
      if (!moved) { dodge(); return; }
      closeWin(w, 20);
    }
  });
  function dodge() {
    if (moved) return;
    moved = true;
    placeRandom(win);
  }
  win._x.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') dodge(); });
  addWin(win);
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
    if (!last) {
      var next = spawnChain(step + 1, w);
      var btn = next.querySelector('.egg-btn');
      if (w._hadFocus && btn) btn.focus();
    }
  };
  var win = makeWin({
    title: c.title,
    html: '<p>' + c.text + '</p>',
    onX: function (w) { w._hadFocus = true; advance(w); },
    buttons: [{ label: 'Yes, close it', cta: true, onClick: function (w) { w._hadFocus = true; advance(w); } }]
  });
  return addWin(win, near);
}

function spawnBonus() {
  addWin(makeWin({
    title: 'Decker Antivirus',
    html: '<p class="egg-win__lead">Threats found: way too many.</p><p>One click cleans every pop-up. Except the boss.</p>',
    onX: function (w) { closeWin(w, 10); },
    buttons: [{ label: 'Clean everything', cta: true, onClick: function (w) {
      var targets = s.wins.filter(function (x) { return !x._boss; });
      targets.forEach(function (x) { removeWin(x); });
      s.score += targets.length * 15;
      s.closed += targets.length;
      say('Cleaned ' + targets.length + ' pop-ups.');
      renderHud();
      s.pauseBtn.focus();
    } }]
  }));
}

/* Le boss : SCREENSHOT.EXE aplatit le deck. Dix clics sur Stop avant 100%. */
function spawnBoss() {
  var left = 10;
  var win = makeWin({
    title: 'SCREENSHOT.EXE',
    cls: 'egg-win--wide',
    html: '<div class="egg-win__row">' + ICON_WARN + '<div><p class="egg-win__lead">Flattening your deck into one image…</p><p class="egg-boss__pct">12%</p></div></div>' +
      '<div class="egg-progress egg-progress--danger" aria-hidden="true"><div class="egg-progress__fill"></div></div>',
    buttons: [{ label: 'Stop (10)', cta: true, ref: '_stop', onClick: function (w, btn) {
      left -= 1;
      if (left > 0) {
        btn.textContent = 'Stop (' + left + ')';
        return;
      }
      s.boss = null;
      removeWin(w);
      s.score += 200;
      s.closed += 1;
      say('SCREENSHOT.EXE stopped. Plus 200.');
      renderHud();
    } }]
  });
  win._boss = true;
  win._pct = 12;
  win._pctEl = win.querySelector('.egg-boss__pct');
  win._fill = win.querySelector('.egg-progress__fill');
  s.boss = win;
  addWin(win);
  say('Boss: SCREENSHOT.EXE is flattening your deck. Press Stop ten times.');
}

function spawnRandom(fromAd) {
  var r = Math.random() * 100;
  if (r < 34) return spawnDeck();
  if (r < 49 && !fromAd) return spawnAd();
  if (r < 67) return spawnAlert();
  if (r < 81) return spawnRunaway();
  if (r < 92 && !fromAd) return spawnChain(0);
  if (s.wins.length >= 4 && !fromAd) return spawnBonus();
  return spawnDeck();
}

/* ---------- Boucle ---------- */
function spawnInterval() {
  var t = Math.min(1, s.elapsed / DURATION);
  var ms = 1500 - (1500 - 420) * t;
  if (isMobile()) ms *= 1.5;
  if (reduceMotion) ms *= 1.3;
  return ms;
}

function tick() {
  if (!s || s.phase !== 'play') return;
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
  var drainPer = isMobile() ? 1.8 : 1.2;
  var delta = 2.5 - Math.max(0, s.wins.length - 1) * drainPer;
  s.integrity = Math.min(100, s.integrity + delta * dt / 1000);

  if (s.boss) {
    s.boss._pct = Math.min(100, s.boss._pct + (88 / 9000) * dt);
    s.boss._pctEl.textContent = Math.floor(s.boss._pct) + '%';
    s.boss._fill.style.transform = 'scaleX(' + (s.boss._pct / 100) + ')';
    if (s.boss._pct >= 100) s.integrity = 0;
  }

  renderHud();
  if (s.integrity <= 0) return lose();
  if (s.elapsed >= DURATION) return victory();
}

function renderHud() {
  if (!s) return;
  var pct = Math.max(0, Math.round(s.integrity));
  s.meterFill.style.transform = 'scaleX(' + Math.max(0, s.integrity) / 100 + ')';
  s.meter.classList.toggle('egg-meter--low', pct <= 30);
  s.meter.setAttribute('aria-valuenow', String(pct));
  s.meterText.textContent = pct + '%';
  s.timeText.textContent = fmtTime(DURATION - s.elapsed);
  s.scoreText.textContent = fmtScore(s.score);
  s.comboText.textContent = 'x' + s.combo;
}

/* ---------- Écrans ---------- */
function clearField() {
  s.wins = [];
  s.boss = null;
  field.textContent = '';
  var over = root.querySelector('.egg-over');
  if (over) over.remove();
}

function showModal(o) {
  var win = makeWin(Object.assign({ cls: 'egg-win--modal' }, o));
  win.style.zIndex = String(++zTop);
  field.appendChild(win);
  var first = win.querySelector(o.focus || '.egg-btn--cta') || win.querySelector('button');
  if (first) first.focus();
  return win;
}

function startScreen() {
  s.phase = 'intro';
  s.pauseBtn.disabled = true;
  clearField();
  var best = readBest();
  var win = showModal({
    title: 'Decker Security 2000',
    html: '<p class="egg-win__lead egg-scan__text">Scanning your deck…</p>' +
      '<div class="egg-progress egg-progress--scan" aria-hidden="true"><div class="egg-progress__fill"></div></div>',
    onX: quit,
    xLabel: 'Quit the game'
  });
  var fill = win.querySelector('.egg-progress__fill');
  var reveal = function () {
    if (!s || s.phase !== 'intro') return;
    win._body.innerHTML = '<div class="egg-win__row">' + ICON_WARN + '<div>' +
      '<p class="egg-win__lead">Threat found: SCREENSHOT.EXE</p>' +
      '<p>It wants to flatten your deck into a single image. Close the pop-ups as fast as they open, for 60 seconds.</p>' +
      (best ? '<p>Your best: ' + fmtScore(best) + '</p>' : '') + '</div></div>';
    var actions = el('div', 'egg-win__actions');
    var start = el('button', 'egg-btn egg-btn--cta', 'Start');
    start.type = 'button';
    start.addEventListener('click', play);
    actions.appendChild(start);
    win.appendChild(actions);
    start.focus();
    say('Threat found. Press Start to play.');
  };
  if (reduceMotion) {
    reveal();
  } else {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { fill.style.transform = 'scaleX(1)'; });
    });
    s.introTimer = window.setTimeout(reveal, 1300);
  }
}

function play() {
  clearField();
  hud.inert = false;
  s.phase = 'play';
  s.integrity = 100;
  s.score = 0;
  s.combo = 1;
  s.closed = 0;
  s.elapsed = 0;
  s.lastClose = -9999;
  s.untilSpawn = 300;
  s.bossDone = false;
  s.last = performance.now();
  s.pauseBtn.disabled = false;
  s.pauseBtn.textContent = 'Pause';
  renderHud();
  window.clearInterval(s.timer);
  s.timer = window.setInterval(tick, 100);
  s.pauseBtn.focus();
  say('Game started. Close the pop-ups.');
}

function pause() {
  if (!s || s.phase !== 'play') return;
  s.phase = 'paused';
  field.inert = true;
  s.pauseBtn.textContent = 'Resume';
  s.pauseWin = makeWin({
    title: 'Paused',
    cls: 'egg-win--modal',
    html: '<p class="egg-win__lead">Your deck is waiting.</p><p>' + fmtTime(DURATION - s.elapsed) + ' left, ' + s.wins.length + ' pop-ups open.</p>',
    buttons: [
      { label: 'Quit', onClick: quit },
      { label: 'Resume', cta: true, onClick: resume }
    ]
  });
  s.pauseWin.style.zIndex = String(++zTop);
  root.appendChild(s.pauseWin);
  s.pauseWin.style.position = 'fixed';
  s.pauseWin.querySelector('.egg-btn--cta').focus();
  say('Paused.');
}

function resume() {
  if (!s || s.phase !== 'paused') return;
  if (s.pauseWin) s.pauseWin.remove();
  s.pauseWin = null;
  field.inert = false;
  s.phase = 'play';
  s.last = performance.now();
  s.pauseBtn.textContent = 'Pause';
  s.pauseBtn.focus();
  say('Resumed.');
}

function endRound() {
  window.clearInterval(s.timer);
  s.pauseBtn.disabled = true;
  var best = readBest();
  var score = Math.round(s.score);
  var isBest = score > best;
  if (isBest) writeBest(score);
  return { score: score, best: Math.max(best, score), isBest: isBest };
}

function lose() {
  s.phase = 'over';
  var r = endRound();
  clearField();
  hud.inert = true;
  var over = el('div', 'egg-over');
  over.setAttribute('role', 'group');
  over.setAttribute('aria-labelledby', 'egg-over-title');
  var title = el('h2', 'egg-over__title', 'Your deck was flattened into a screenshot.');
  title.id = 'egg-over-title';
  over.appendChild(title);
  over.appendChild(el('p', 'egg-over__meta', 'You held on for ' + fmtTime(s.elapsed).replace(/^0:/, '') + ' s. Score ' + fmtScore(r.score) + (r.isBest ? ', a new best.' : '.')));
  var actions = el('div', 'egg-over__actions');
  var again = el('button', 'egg-btn egg-btn--cta', 'Try again');
  again.type = 'button';
  again.addEventListener('click', play);
  var leave = el('button', 'egg-btn', 'Quit');
  leave.type = 'button';
  leave.addEventListener('click', quit);
  actions.appendChild(leave);
  actions.appendChild(again);
  over.appendChild(actions);
  root.appendChild(over);
  again.focus();
  say('Game over. Your deck was flattened into a screenshot.');
}

function victory() {
  s.phase = 'over';
  var r = endRound();
  var closed = s.closed;
  clearField();
  var share = 'I saved my deck from ' + closed + ' pop-ups on decker.billeltighidet.fr';
  var w = showModal({
    title: 'Decker Security 2000',
    html: '<p class="egg-win__lead">Deck saved. 100% editable.</p>' +
      '<p>' + closed + ' pop-ups closed. Score ' + fmtScore(r.score) + (r.isBest ? ', a new best.' : '. Best ' + fmtScore(r.best) + '.') + '</p>' +
      '<p class="egg-win__share">' + share + '</p>',
    onX: quit,
    xLabel: 'Quit the game',
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
    focus: '.egg-btn'
  });
  say('You win. Deck saved, 100% editable.');
  return w;
}

/* ---------- Ouverture et sortie ---------- */
function onKey(e) {
  if (e.key !== 'Escape' || !s) return;
  e.preventDefault();
  if (s.phase === 'play') pause();
  else quit();
}
function onVisibility() {
  if (doc.hidden) pause();
}

function buildHud() {
  hud = el('div', 'egg-hud');
  var meterWrap = el('div', 'egg-hud__meter');
  var label = el('span', null, 'Deck integrity');
  label.id = 'egg-meter-label';
  var meter = el('div', 'egg-meter');
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-labelledby', 'egg-meter-label');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  var fill = el('div', 'egg-meter__fill');
  meter.appendChild(fill);
  var meterText = el('span', 'egg-hud__value', '100%');
  meterWrap.appendChild(label);
  meterWrap.appendChild(meter);
  meterWrap.appendChild(meterText);

  var stats = el('div', 'egg-hud__stats');
  var stat = function (name, value) {
    var wrap = el('span', null, name + ' ');
    var v = el('span', 'egg-hud__value', value);
    wrap.appendChild(v);
    stats.appendChild(wrap);
    return v;
  };
  var timeText = stat('Time', '1:00');
  var scoreText = stat('Score', '0');
  var comboText = stat('Combo', 'x1');

  var actions = el('div', 'egg-hud__actions');
  var pauseBtn = el('button', 'egg-btn', 'Pause');
  pauseBtn.type = 'button';
  pauseBtn.addEventListener('click', function () {
    if (s.phase === 'play') pause(); else resume();
  });
  var quitBtn = el('button', 'egg-btn', 'Quit');
  quitBtn.type = 'button';
  quitBtn.addEventListener('click', quit);
  actions.appendChild(pauseBtn);
  actions.appendChild(quitBtn);

  hud.appendChild(meterWrap);
  hud.appendChild(stats);
  hud.appendChild(actions);

  s.meter = meter;
  s.meterFill = fill;
  s.meterText = meterText;
  s.timeText = timeText;
  s.scoreText = scoreText;
  s.comboText = comboText;
  s.pauseBtn = pauseBtn;
}

function open(from) {
  if (root) return;
  trigger = from || null;
  s = { phase: 'intro', wins: [], timer: 0, boss: null, integrity: 100, score: 0, combo: 1, closed: 0, elapsed: 0 };

  if (!doc.getElementById('egg-style')) {
    var style = el('style');
    style.id = 'egg-style';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  root = el('div', 'egg');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Pop-up game');
  buildHud();
  field = el('div', 'egg-field');
  statusEl = el('div', 'egg-sr');
  statusEl.setAttribute('role', 'status');
  root.appendChild(hud);
  root.appendChild(field);
  root.appendChild(statusEl);

  inerted = Array.prototype.filter.call(doc.body.children, function (n) { return !n.inert && n.tagName !== 'SCRIPT'; });
  inerted.forEach(function (n) { n.inert = true; });
  doc.documentElement.style.overflow = 'hidden';
  doc.body.appendChild(root);
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('visibilitychange', onVisibility);
  startScreen();
}

function quit() {
  if (!root) return;
  window.clearInterval(s.timer);
  window.clearTimeout(s.introTimer);
  window.clearTimeout(announceTimer);
  doc.removeEventListener('keydown', onKey);
  doc.removeEventListener('visibilitychange', onVisibility);
  root.remove();
  root = null;
  field = null;
  hud = null;
  statusEl = null;
  s = null;
  inerted.forEach(function (n) { n.inert = false; });
  inerted = [];
  doc.documentElement.style.overflow = '';
  if (trigger) trigger.focus();
}

window.DeckerEgg = { open: open };
`;

export function easterEggScript(pluginUrl: string): string {
  return `(function () {\n'use strict';\nvar CSS = ${JSON.stringify(EGG_CSS)};\nvar PLUGIN_URL = ${JSON.stringify(pluginUrl)};\n${EGG_JS}\n})();\n`;
}
