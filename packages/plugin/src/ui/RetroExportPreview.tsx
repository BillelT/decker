import { useEffect, useRef, useState } from 'preact/hooks';
import { ditherToVgaPalette } from './retroDither.js';

/**
 * Aperçu de la frame en cours d'export, "généré" bande par bande façon
 * Windows 95 : fenêtre à bordures biseautées, écran fond turquoise du
 * bureau 95, et l'image qui se peint en deux passes comme un GIF entrelacé
 * sur un modem 90s —
 *
 *   1. passe grossière entrelacée : une bande sur quatre, tramée en 16
 *      couleurs VGA (retroDither.ts) et étirée sur ses voisines encore
 *      vides — c'est ce qui donne l'effet "l'image se devine avant d'être
 *      chargée" ;
 *   2. passe finale : chaque bande repeinte en vraies couleurs, de haut en
 *      bas.
 *
 * L'animation est temporelle (pas branchée sur une progression serveur, qui
 * n'existe pas à l'intérieur d'une slide) : elle se rejoue à chaque
 * changement de frame, puis tient l'image complète jusqu'à ce que le lot
 * suivant démarre. La barre de progression, elle, reste honnête : elle
 * reflète la position réelle dans le deck (`index` vient des lots appliqués
 * côté backend).
 */

/** Durée d'une "génération" complète, les deux passes comprises — exportée
 *  pour que ui.tsx cale dessus le rythme de sa simulation multi-frames
 *  (beginExportPacing) : sans ce partage, les deux durées divergeraient au
 *  premier ajustement de l'une des deux. */
export const REVEAL_MS = 2600;
/** Nombre de bandes visé — la hauteur d'une bande s'en déduit. */
const TARGET_BANDS = 56;
/** Entrelacement de la passe grossière : une bande dessinée sur quatre. */
const INTERLACE_STRIDE = 4;
/** Part de l'animation consacrée à la passe grossière. */
const COARSE_PHASE = 0.5;
/** Au-delà, on rééchantillonne : inutile de tramer 2000 px de large. */
const MAX_CANVAS_WIDTH = 720;
/** Le turquoise du bureau Windows 95, pour la zone pas encore "chargée". */
const DESKTOP_TEAL = '#008080';

export interface RetroExportPreviewProps {
  /** PNG d'aperçu de la frame (data URL produite par le sandbox). */
  src: string | undefined;
  frameName: string;
  /** Position 0-based de la frame dans le deck en cours d'export. */
  index: number;
  total: number;
}

/**
 * Version demi-résolution et tramée VGA de l'image, source de la passe
 * grossière. `undefined` si le canvas 2D n'est pas disponible.
 */
function buildCoarseCanvas(image: HTMLImageElement, width: number, height: number): HTMLCanvasElement | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width / 2));
  canvas.height = Math.max(1, Math.ceil(height / 2));
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  try {
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ditherToVgaPalette(frame.data, canvas.width);
    ctx.putImageData(frame, 0, 0);
  } catch {
    // `getImageData` sur un canvas "tainted" — impossible avec le data URL
    // du sandbox, mais on garde la version simplement pixelisée plutôt que
    // de casser l'aperçu si l'aperçu venait un jour d'ailleurs.
  }
  return canvas;
}

export function RetroExportPreview({ src, frameName, index, total }: RetroExportPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    let raf = 0;
    let cancelled = false;
    setReveal(0);

    const image = new Image();
    image.onload = () => {
      if (cancelled) return;

      const scale = Math.min(1, MAX_CANVAS_WIDTH / image.naturalWidth);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = DESKTOP_TEAL;
      ctx.fillRect(0, 0, width, height);

      const coarse = buildCoarseCanvas(image, width, height);
      const bandHeight = Math.max(2, Math.round(height / TARGET_BANDS));
      const bandCount = Math.ceil(height / bandHeight);
      const blockCount = Math.ceil(bandCount / INTERLACE_STRIDE);

      /** Bloc entrelacé n° `block` : une bande étirée sur tout son groupe. */
      const drawCoarseBlock = (block: number) => {
        const top = block * INTERLACE_STRIDE * bandHeight;
        const destHeight = Math.min(bandHeight * INTERLACE_STRIDE, height - top);
        if (destHeight <= 0) return;
        if (coarse) {
          const sourceTop = Math.min(coarse.height - 1, Math.floor(top / 2));
          const sourceHeight = Math.max(1, Math.min(Math.round(bandHeight / 2), coarse.height - sourceTop));
          ctx.drawImage(coarse, 0, sourceTop, coarse.width, sourceHeight, 0, top, width, destHeight);
        } else {
          ctx.drawImage(image, 0, top, width, bandHeight, 0, top, width, destHeight);
        }
      };

      /** Bande n° `band` de l'image finale, en vraies couleurs. */
      const drawFinalBand = (band: number) => {
        const top = band * bandHeight;
        const destHeight = Math.min(bandHeight, height - top);
        if (destHeight <= 0) return;
        ctx.drawImage(
          image,
          0,
          (top / height) * image.naturalHeight,
          image.naturalWidth,
          (destHeight / height) * image.naturalHeight,
          0,
          top,
          width,
          destHeight,
        );
      };

      let drawnBlocks = 0;
      let drawnBands = 0;
      const start = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / REVEAL_MS);

        const wantedBlocks = Math.round(blockCount * Math.min(1, progress / COARSE_PHASE));
        while (drawnBlocks < wantedBlocks) drawCoarseBlock(drawnBlocks++);

        const wantedBands =
          progress <= COARSE_PHASE ? 0 : Math.round(bandCount * ((progress - COARSE_PHASE) / (1 - COARSE_PHASE)));
        while (drawnBands < wantedBands) drawFinalBand(drawnBands++);

        // Un setState par frame d'animation serait du rendu Preact pour rien :
        // la barre et la ligne de balayage n'ont pas besoin de cette finesse.
        setReveal((prev) => (progress === 1 || progress - prev >= 0.02 ? progress : prev));
        if (progress < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    image.src = src;

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src]);

  // Progression réelle dans le deck (lots appliqués) + avancement de la
  // frame courante, pour que la barre bouge en continu au lieu de sauter.
  const deckProgress = total > 0 ? Math.min(1, (index + reveal) / total) : 0;

  return (
    <div className={`f2s-retro${src ? '' : ' f2s-retro--no-signal'}`}>
      <div className="f2s-retro-titlebar">
        <span className="f2s-retro-title">Exporting - {frameName}</span>
        <span className="f2s-retro-window-buttons" aria-hidden="true">
          <i>_</i>
          <i>□</i>
          <i>✕</i>
        </span>
      </div>

      <div className="f2s-retro-screen">
        <canvas ref={canvasRef} className="f2s-retro-canvas" role="img" aria-label={`Export preview of ${frameName}`} />
        {!src && <p className="f2s-retro-noise">NO SIGNAL</p>}
        <div className="f2s-retro-scanlines" aria-hidden="true" />
        {reveal < 1 && <div className="f2s-retro-beam" style={{ top: `${reveal * 100}%` }} aria-hidden="true" />}
      </div>

      <div className="f2s-retro-status">
        <span className="f2s-retro-status-text">
          Generating slide {index + 1} of {total}
          <span className="f2s-retro-ellipsis">...</span>
        </span>
        <div className="f2s-retro-bar">
          <div className="f2s-retro-bar-fill" style={{ width: `${Math.round(deckProgress * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
