import { useEffect, useRef } from 'preact/hooks';
import { postToPlugin } from './types.js';

/**
 * Poignée de redimensionnement du coin bas droit. Figma ne propose aucun
 * bord redimensionnable pour la fenêtre d'un plugin : seul
 * `figma.ui.resize()` existe, côté sandbox (code.ts, `resize-ui`). La
 * taille finale y est persistée au relâchement (`save-ui-size`) et
 * réappliquée à la prochaine ouverture ; un double clic revient à la taille
 * par défaut (`reset-ui-size`).
 *
 * La nouvelle taille se déduit de la position du pointeur DANS l'iframe
 * plutôt que d'un delta écran : l'iframe grandit sous le pointeur, et la
 * distance pointeur/coin mesurée au pointerdown suffit à garder le coin
 * collé au curseur.
 *
 * Les écouteurs du drag sont posés sur `window` dans le pointerdown (comme
 * le rail, voir useRailReorder.ts), pas sur le bouton. Quand Figma est lent
 * à répondre, l'iframe est en retard sur la souris : le pointeur sort de
 * l'iframe, la capture peut se perdre et le `pointerup` n'arrive jamais. Avec
 * des écouteurs sur le bouton, le drag restait alors "actif" et le moindre
 * survol de la poignée redimensionnait la fenêtre avec une position périmée
 * (décalage de 10 à 20 px). Ici, un `pointermove` sans bouton enfoncé, un
 * `pointercancel` ou un `pointerup` terminent toujours le drag, et un drag
 * dont le bouton est resté enfoncé reprend dès que le pointeur revient.
 */
export function ResizeGrip() {
  // Retire les écouteurs du drag en cours : appelé à sa fin, ou au démontage.
  const detachRef = useRef<(() => void) | undefined>();

  useEffect(() => () => detachRef.current?.(), []);

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    detachRef.current?.();

    const pointerId = e.pointerId;
    const grip = e.currentTarget as HTMLElement;
    const offset = { x: window.innerWidth - e.clientX, y: window.innerHeight - e.clientY };
    let lastSize: { width: number; height: number } | undefined;
    let frame = 0;

    // La capture garde le flux d'événements sur la poignée quand le pointeur
    // dépasse l'iframe ; les écouteurs sur `window` prennent le relais si elle
    // se perd.
    try {
      grip.setPointerCapture(pointerId);
    } catch {
      // Pointeur déjà relâché : le garde `buttons === 0` ci-dessous prend le relais.
    }

    function sizeFrom(ev: PointerEvent) {
      return { width: Math.round(ev.clientX + offset.x), height: Math.round(ev.clientY + offset.y) };
    }
    function finish(size: { width: number; height: number } | undefined) {
      detach();
      cancelAnimationFrame(frame);
      frame = 0;
      try {
        grip.releasePointerCapture(pointerId);
      } catch {
        // Capture déjà perdue.
      }
      // Simple clic (ou chacun des deux clics d'un double clic) : rien n'a
      // bougé, rien à appliquer ni à persister.
      if (!size) return;
      postToPlugin({ type: 'resize-ui', ...size });
      postToPlugin({ type: 'save-ui-size', ...size });
    }
    function onPointerMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      // Plus aucun bouton enfoncé alors qu'aucun pointerup n'est arrivé : le
      // relâchement a eu lieu hors de l'iframe. On garde la dernière taille
      // suivie, sans recalculer depuis une position qui n'est plus celle du drag.
      if (ev.buttons === 0) {
        finish(lastSize);
        return;
      }
      lastSize = sizeFrom(ev);
      // Un message par frame d'affichage au plus : pointermove peut tirer
      // bien plus souvent, et chaque resize relance la mise en page.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (lastSize) postToPlugin({ type: 'resize-ui', ...lastSize });
      });
    }
    function onPointerUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      finish(lastSize && sizeFrom(ev));
    }
    function onPointerCancel(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      finish(lastSize);
    }
    function detach() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      detachRef.current = undefined;
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    detachRef.current = detach;
  }

  return (
    <button
      type="button"
      className="f2s-resize-grip"
      // Souris uniquement (aucun redimensionnement au clavier) : pas d'arrêt
      // de tabulation inutile.
      tabIndex={-1}
      title="Drag to resize the plugin. Double-click to reset its size."
      aria-label="Resize the plugin window"
      onPointerDown={onPointerDown}
      onDblClick={() => postToPlugin({ type: 'reset-ui-size' })}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path className="f2s-grip-hi" d="M3 13 13 3M7 13l6-6M11 13l2-2" stroke-width="1" />
        <path className="f2s-grip-lo" d="M4 13 13 4M8 13l5-5M12 13l1-1" stroke-width="1" />
      </svg>
    </button>
  );
}
