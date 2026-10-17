/**
 * Débogueur local de l'animation de survol du logo du footer (la carte du
 * fond, `egg-back` dans marketingStyles.ts). Injecté par shell() (pages.ts)
 * seulement quand le serveur tourne en local, jamais sur Vercel.
 *
 * Un panneau en `position: absolute` posé au-dessus du logo : aperçu zoomé,
 * bande de toutes les images, lecture, pause, image par image, vitesse,
 * boucle, et les valeurs de la carte du fond à régler. Le vrai logo du
 * footer rejoue les mêmes valeurs au survol. Le `@keyframes` à recopier dans
 * marketingStyles.ts s'écrit en bas du panneau.
 *
 * L'animation est rejouée en Web Animations API, keyframes recopiées de
 * marketingStyles.ts pour l'avant et le milieu (à garder alignées). Le JS est
 * en `String.raw` : pas de backtick ni de `${` dedans.
 */

const DEBUGGER_CSS = String.raw`
.egg-debug .footer__egg .egg-card { animation: none !important; }
.ldbg {
  position: absolute; left: 0; bottom: calc(100% + 48px); z-index: 50; width: 400px; max-width: calc(100vw - 32px);
  box-sizing: border-box; padding: 12px; background: var(--b-surface); color: var(--b-ink);
  box-shadow: var(--hyb-out), 0 12px 32px rgba(0, 0, 0, 0.12);
  font: 13px/1.4 var(--b-font-sans); text-align: start;
}
.ldbg[data-collapsed] .ldbg__body { display: none; }
.ldbg__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ldbg__title { margin: 0; font-size: 13px; font-weight: 700; }
.ldbg__body { display: grid; gap: 10px; margin-top: 10px; }
.ldbg__stage { display: flex; align-items: end; gap: 16px; padding: 12px; background: var(--b-surface-muted); box-shadow: var(--hyb-in); }
.ldbg__zoom { width: 160px; height: 160px; display: block; overflow: visible; }
.ldbg__real { width: 24px; height: 24px; display: block; overflow: visible; }
.ldbg__strip { display: flex; flex-wrap: wrap; gap: 4px; }
.ldbg__cell { display: grid; justify-items: center; gap: 2px; padding: 3px; background: var(--b-surface-muted); cursor: pointer; font: 10px/1 var(--b-font-mono); color: var(--b-text-faint); }
.ldbg__cell[aria-current] { outline: 2px solid var(--b-accent); }
.ldbg__cell svg { width: 32px; height: 32px; display: block; overflow: visible; }
.ldbg__row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.ldbg__row input[type="range"] { flex: 1 1 120px; min-width: 0; }
.ldbg__time { font: 12px/1.2 var(--b-font-mono); font-variant-numeric: tabular-nums; }
.ldbg button { padding: 4px 8px; border: 0; background: var(--b-surface-muted); box-shadow: var(--hyb-out); font: inherit; cursor: pointer; }
.ldbg button:active { box-shadow: var(--hyb-pressed); }
.ldbg fieldset { display: grid; grid-template-columns: 96px 1fr 64px; align-items: center; gap: 6px 8px; margin: 0; padding: 8px; border: 1px solid var(--b-border); }
.ldbg legend { padding: 0 4px; font-weight: 700; }
.ldbg label { white-space: nowrap; }
.ldbg input[type="number"], .ldbg select { box-sizing: border-box; font: 12px var(--b-font-mono); }
.ldbg fieldset input[type="number"] { width: 100%; }
.ldbg fieldset select { grid-column: 2 / 4; width: 100%; }
.ldbg textarea { width: 100%; box-sizing: border-box; height: 120px; font: 11px/1.4 var(--b-font-mono); resize: vertical; }
`;

const DEBUGGER_JS = String.raw`
(function () {
  var egg = document.querySelector('.footer__egg');
  var host = egg && egg.parentElement;
  var svg = egg && egg.querySelector('svg');
  if (!host || !svg) return;
  document.documentElement.classList.add('egg-debug');
  host.style.position = 'relative';

  var css = getComputedStyle(document.documentElement);
  var EASE_OUT = css.getPropertyValue('--b-ease-out').trim() || 'cubic-bezier(0.23, 1, 0.32, 1)';
  var EASE_IN_OUT = css.getPropertyValue('--b-ease-in-out').trim() || 'cubic-bezier(0.77, 0, 0.175, 1)';
  var EASINGS = {
    'steps(1, end)': { js: 'steps(1, end)', css: 'steps(1, end)' },
    'linear': { js: 'linear', css: 'linear' },
    '--b-ease-out': { js: EASE_OUT, css: 'var(--b-ease-out)' },
    '--b-ease-in-out': { js: EASE_IN_OUT, css: 'var(--b-ease-in-out)' }
  };
  /* Valeurs en ligne (marketingStyles.ts, egg-back) au chargement. */
  var DEFAULTS = { sx: 1.02, sy: 0.98, blur: 1, peak: 43, rest: 59, jump: 'steps(1, end)', settle: '--b-ease-out', origin: 'center', duration: 360 };
  var p = Object.assign({}, DEFAULTS);
  var FRAME = 1000 / 60;

  function frontFrames() {
    return [
      { offset: 0, opacity: 1, easing: 'steps(1, end)' },
      { offset: 0.13, opacity: 0, easing: 'steps(1, end)' },
      { offset: 0.78, opacity: 0, transform: 'scale(0.92, 0.84)', filter: 'blur(1px)', easing: EASE_OUT },
      { offset: 1, opacity: 1, transform: 'none', filter: 'none' }
    ];
  }
  function midFrames() {
    return [
      { offset: 0, opacity: 1, easing: 'steps(1, end)' },
      { offset: 0.27, opacity: 0, easing: 'steps(1, end)' },
      { offset: 0.59, opacity: 0, transform: 'scale(0.92, 0.84)', filter: 'blur(1px)', easing: EASE_OUT },
      { offset: 0.78, opacity: 1, transform: 'none', filter: 'none' },
      { offset: 1, opacity: 1, transform: 'none', filter: 'none' }
    ];
  }
  function backFrames() {
    var peak = Math.min(p.peak, p.rest - 1) / 100;
    var rest = Math.min(p.rest, 100) / 100;
    var frames = [
      { offset: 0, transform: 'none', filter: 'none', easing: EASINGS[p.jump].js },
      { offset: peak, transform: 'scale(' + p.sx + ', ' + p.sy + ')', filter: p.blur > 0 ? 'blur(' + p.blur + 'px)' : 'none', easing: EASINGS[p.settle].js },
      { offset: rest, transform: 'none', filter: 'none' }
    ];
    if (rest < 1) frames.push({ offset: 1, transform: 'none', filter: 'none' });
    return frames;
  }

  /* Un jeu d'animations par logo (zoom, vrai logo, chaque case de la bande). */
  function animate(root) {
    var opts = { duration: p.duration, fill: 'both' };
    var get = function (c) { return root.querySelector('.egg-card--' + c); };
    get('back').style.transformOrigin = p.origin;
    return [
      get('front').animate(frontFrames(), opts),
      get('mid').animate(midFrames(), opts),
      get('back').animate(backFrames(), opts)
    ];
  }
  function cloneMark(cls) {
    var c = svg.cloneNode(true);
    c.setAttribute('class', cls);
    c.querySelectorAll('.egg-card').forEach(function (g) { g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center'; });
    return c;
  }

  /* ---------- Panneau ---------- */
  var panel = document.createElement('section');
  panel.className = 'ldbg';
  panel.setAttribute('aria-label', 'Logo animation debugger');
  panel.innerHTML =
    '<div class="ldbg__head"><p class="ldbg__title">Logo hover: back card</p><button type="button" data-toggle>Hide</button></div>' +
    '<div class="ldbg__body">' +
      '<div class="ldbg__stage" data-stage></div>' +
      '<div class="ldbg__strip" data-strip></div>' +
      '<div class="ldbg__row"><button type="button" data-play>Play</button><button type="button" data-prev>Prev frame</button><button type="button" data-next>Next frame</button>' +
        '<select data-speed aria-label="Speed"><option value="1">1x</option><option value="0.5">0.5x</option><option value="0.25">0.25x</option><option value="0.1" selected>0.1x</option></select>' +
        '<label><input type="checkbox" data-loop checked> Loop</label></div>' +
      '<div class="ldbg__row"><input type="range" min="0" step="1" value="0" data-scrub aria-label="Frame"><span class="ldbg__time" data-time></span></div>' +
      '<fieldset><legend>Back card</legend>' +
        num('Scale X', 'sx', 0.9, 1.15, 0.005) + num('Scale Y', 'sy', 0.8, 1.1, 0.005) + num('Blur (px)', 'blur', 0, 4, 0.25) +
        num('Peak at %', 'peak', 1, 99, 1) + num('Rest at %', 'rest', 2, 100, 1) + num('Duration (ms)', 'duration', 100, 1500, 10) +
        sel('Jump curve', 'jump', Object.keys(EASINGS)) + sel('Settle curve', 'settle', Object.keys(EASINGS)) +
        sel('Origin', 'origin', ['center', 'bottom', 'top', 'left bottom', 'right bottom', 'left top']) +
      '</fieldset>' +
      '<div class="ldbg__row"><button type="button" data-copy>Copy CSS</button><button type="button" data-reset>Reset</button></div>' +
      '<textarea readonly data-out aria-label="CSS to paste in marketingStyles.ts"></textarea>' +
    '</div>';
  host.appendChild(panel);

  function num(label, key, min, max, step) {
    return '<label for="ldbg-' + key + '">' + label + '</label>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" data-key="' + key + '" aria-label="' + label + '">' +
      '<input type="number" id="ldbg-' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" data-key="' + key + '">';
  }
  function sel(label, key, options) {
    return '<label for="ldbg-' + key + '">' + label + '</label><select id="ldbg-' + key + '" data-key="' + key + '">' +
      options.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select>';
  }
  var q = function (s) { return panel.querySelector(s); };
  var stage = q('[data-stage]');
  var strip = q('[data-strip]');
  var scrub = q('[data-scrub]');
  var timeEl = q('[data-time]');
  var playBtn = q('[data-play]');
  var out = q('[data-out]');

  var zoom = cloneMark('ldbg__zoom');
  var real = cloneMark('ldbg__real');
  stage.appendChild(zoom);
  stage.appendChild(real);

  var live = [];
  var hover = [];
  var frames = 0;
  var current = 0;
  var playing = false;

  function frameCount() { return Math.ceil(p.duration / FRAME); }
  function setTime(t) {
    live.forEach(function (a) { a.pause(); a.currentTime = t; });
  }
  function showFrame(i) {
    current = Math.max(0, Math.min(frames, i));
    setTime(current * FRAME);
    scrub.value = String(current);
    timeEl.textContent = 'frame ' + current + ' / ' + frames + ', ' + Math.round(current * FRAME) + ' ms / ' + p.duration + ' ms';
    strip.querySelectorAll('.ldbg__cell').forEach(function (c, k) {
      if (k === current) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
  }

  function rebuild() {
    live.concat(hover).forEach(function (a) { a.cancel(); });
    frames = frameCount();
    scrub.max = String(frames);
    live = animate(zoom).concat(animate(real));
    hover = animate(svg);
    hover.forEach(function (a) { a.finish(); });
    strip.textContent = '';
    for (var i = 0; i <= frames; i++) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'ldbg__cell';
      cell.setAttribute('aria-label', 'Frame ' + i);
      var mark = cloneMark('');
      cell.appendChild(mark);
      cell.appendChild(document.createTextNode(String(i)));
      animate(mark).forEach(function (a) { a.pause(); a.currentTime = i * FRAME; });
      (function (k) { cell.addEventListener('click', function () { stop(); showFrame(k); }); })(i);
      strip.appendChild(cell);
    }
    showFrame(Math.min(current, frames));
    out.value = cssOut();
  }

  /* ---------- Lecture ---------- */
  var raf = 0;
  function tickPlay() {
    var t = live[0].currentTime || 0;
    var i = Math.min(frames, Math.floor(t / FRAME));
    if (i !== current) {
      current = i;
      scrub.value = String(i);
      timeEl.textContent = 'frame ' + i + ' / ' + frames + ', ' + Math.round(t) + ' ms / ' + p.duration + ' ms';
    }
    if (live[0].playState === 'finished') {
      if (q('[data-loop]').checked) { live.forEach(function (a) { a.currentTime = 0; a.play(); }); }
      else { stop(); showFrame(frames); return; }
    }
    raf = requestAnimationFrame(tickPlay);
  }
  function play() {
    var rate = Number(q('[data-speed]').value);
    if (current >= frames) setTime(0);
    live.forEach(function (a) { a.playbackRate = rate; a.play(); });
    playing = true;
    playBtn.textContent = 'Pause';
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tickPlay);
  }
  function stop() {
    playing = false;
    playBtn.textContent = 'Play';
    cancelAnimationFrame(raf);
    live.forEach(function (a) { a.pause(); });
  }
  playBtn.addEventListener('click', function () { if (playing) stop(); else play(); });
  q('[data-prev]').addEventListener('click', function () { stop(); showFrame(current - 1); });
  q('[data-next]').addEventListener('click', function () { stop(); showFrame(current + 1); });
  scrub.addEventListener('input', function () { stop(); showFrame(Number(scrub.value)); });
  q('[data-speed]').addEventListener('change', function () { if (playing) play(); });
  q('[data-toggle]').addEventListener('click', function (e) {
    var collapsed = panel.toggleAttribute('data-collapsed');
    e.currentTarget.textContent = collapsed ? 'Show' : 'Hide';
  });

  /* Le vrai logo rejoue les valeurs réglées, à vitesse réelle. */
  egg.addEventListener('mouseenter', function () {
    hover.forEach(function (a) { a.playbackRate = 1; a.currentTime = 0; a.play(); });
  });

  /* ---------- Réglages ---------- */
  function syncInputs() {
    panel.querySelectorAll('[data-key]').forEach(function (el) { el.value = String(p[el.getAttribute('data-key')]); });
  }
  panel.querySelectorAll('[data-key]').forEach(function (el) {
    el.addEventListener('input', function () {
      var key = el.getAttribute('data-key');
      p[key] = el.tagName === 'SELECT' ? el.value : Number(el.value);
      panel.querySelectorAll('[data-key="' + key + '"]').forEach(function (o) { if (o !== el) o.value = el.value; });
      var was = playing;
      stop();
      rebuild();
      if (was) play();
    });
  });
  q('[data-reset]').addEventListener('click', function () { p = Object.assign({}, DEFAULTS); syncInputs(); stop(); rebuild(); });
  q('[data-copy]').addEventListener('click', function (e) {
    var btn = e.currentTarget;
    out.select();
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy CSS'; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(out.value).then(done, done); else { document.execCommand('copy'); done(); }
  });

  function cssOut() {
    var peak = Math.min(p.peak, p.rest - 1);
    var rest = Math.min(p.rest, 100);
    var lines = [
      '@keyframes egg-back {',
      '  0% { animation-timing-function: ' + EASINGS[p.jump].css + '; }',
      '  ' + peak + '% { transform: scale(' + p.sx + ', ' + p.sy + '); filter: ' + (p.blur > 0 ? 'blur(' + p.blur + 'px)' : 'none') + '; animation-timing-function: ' + EASINGS[p.settle].css + '; }',
      '  ' + (rest < 100 ? rest + '%, 100%' : '100%') + ' { transform: none; filter: none; }',
      '}'
    ];
    if (p.origin !== 'center') lines.push('.footer__egg .egg-card--back { transform-origin: ' + p.origin + '; }');
    if (p.duration !== 360) lines.push('/* Duration: ' + p.duration + 'ms (.footer__egg:hover .egg-card { animation: ' + (p.duration / 1000) + 's 1; }), front and mid follow. */');
    return lines.join('\n');
  }

  syncInputs();
  rebuild();
})();
`;

export const LOGO_DEBUGGER_HTML = `<style>${DEBUGGER_CSS}</style>\n<script>${DEBUGGER_JS}</script>\n`;
