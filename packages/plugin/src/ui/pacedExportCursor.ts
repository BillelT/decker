import { useEffect, useRef, useState } from 'preact/hooks';
import { MIN_REVEAL_MS, REVEAL_MS } from './RetroExportPreview.js';
import type { ExportCursor } from './exportCursor.js';

/** Curseur rythmé, avec la durée de révélation que l'aperçu doit tenir pour suivre le backend. */
export interface PacedExportCursor extends ExportCursor {
  revealMs: number;
}

/**
 * Durée d'une révélation quand l'aperçu a `lag` slides de retard sur le
 * backend : `REVEAL_MS` à jour, plus court en retard, jamais sous
 * `MIN_REVEAL_MS`. L'aperçu rattrape donc le backend au lieu de le traîner.
 */
export function revealMsForLag(lag: number): number {
  return lag <= 1 ? REVEAL_MS : Math.max(MIN_REVEAL_MS, Math.round(REVEAL_MS / lag));
}

/**
 * Fait avancer l'aperçu d'export UNE frame à la fois au lieu de suivre tel
 * quel l'index "premier lot pending" issu du polling
 * (`exportCursorFromBatches`), qui saute de N à N+2 quand le backend applique
 * plusieurs lots entre deux polls : l'aperçu "brûlait" alors des slides.
 *
 * L'aperçu ne doit jamais ralentir l'export : en retard, chaque slide se
 * révèle plus vite (`revealMsForLag`), et dès que le job est conclu la
 * séquence s'arrête net, pour que le succès (ou l'erreur) s'affiche sans
 * attendre la fin de l'animation.
 */
export function usePacedExportCursor(
  /** Identifie une tentative d'export (incrémenté à chaque lancement/retry) : remet la séquence à zéro. */
  attempt: number | undefined,
  order: string[],
  rawCursor: ExportCursor | undefined,
  concluded: boolean,
): PacedExportCursor | undefined {
  const total = order.length;
  const [displayIndex, setDisplayIndex] = useState(0);
  const attemptRef = useRef(attempt);
  const rawIndexRef = useRef(rawCursor?.index);
  rawIndexRef.current = rawCursor?.index;

  useEffect(() => {
    if (attempt === attemptRef.current) return;
    attemptRef.current = attempt;
    setDisplayIndex(Math.min(rawIndexRef.current ?? 0, Math.max(0, total - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, total]);

  const rawIndex = rawCursor?.index;
  const target = total === 0 || rawIndex === undefined ? displayIndex : Math.min(rawIndex, total - 1);
  const lag = target - displayIndex;

  useEffect(() => {
    if (attempt === undefined || total === 0 || concluded || lag <= 0) return;
    const t = setTimeout(() => setDisplayIndex((i) => Math.min(i + 1, target)), revealMsForLag(lag));
    return () => clearTimeout(t);
  }, [attempt, total, concluded, lag, target]);

  if (attempt === undefined || total === 0 || concluded) return undefined;
  const frameId = order[displayIndex];
  if (!frameId) return undefined;
  return { frameId, index: displayIndex, total, revealMs: revealMsForLag(lag) };
}
