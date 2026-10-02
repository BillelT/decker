import { useRef } from 'preact/hooks';
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
 */
export function ResizeGrip() {
  const offsetRef = useRef<{ x: number; y: number } | undefined>();
  const lastSizeRef = useRef<{ width: number; height: number } | undefined>();
  const frameRef = useRef(0);

  function sizeFrom(e: PointerEvent) {
    const offset = offsetRef.current!;
    return { width: Math.round(e.clientX + offset.x), height: Math.round(e.clientY + offset.y) };
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
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        offsetRef.current = { x: window.innerWidth - e.clientX, y: window.innerHeight - e.clientY };
      }}
      onPointerMove={(e) => {
        if (!offsetRef.current) return;
        lastSizeRef.current = sizeFrom(e);
        // Un message par frame d'affichage au plus : pointermove peut tirer
        // bien plus souvent, et chaque resize relance la mise en page.
        if (frameRef.current) return;
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = 0;
          if (lastSizeRef.current) postToPlugin({ type: 'resize-ui', ...lastSizeRef.current });
        });
      }}
      onPointerUp={(e) => {
        if (!offsetRef.current) return;
        // Simple clic (ou chacun des deux clics d'un double clic) : rien n'a
        // bougé, rien à appliquer ni à persister.
        const moved = lastSizeRef.current !== undefined;
        const size = sizeFrom(e);
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
        offsetRef.current = undefined;
        lastSizeRef.current = undefined;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (!moved) return;
        postToPlugin({ type: 'resize-ui', ...size });
        postToPlugin({ type: 'save-ui-size', ...size });
      }}
      onDblClick={() => postToPlugin({ type: 'reset-ui-size' })}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path className="f2s-grip-hi" d="M3 13 13 3M7 13l6-6M11 13l2-2" strokeWidth="1" />
        <path className="f2s-grip-lo" d="M4 13 13 4M8 13l5-5M12 13l1-1" strokeWidth="1" />
      </svg>
    </button>
  );
}
