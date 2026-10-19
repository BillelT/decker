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

/** Budget visé pour dérouler les slides restantes une fois le job réussi. */
const FINISH_BUDGET_MS = 4500;
/** Plafond par slide pendant ce déroulé : il reste plus vif qu'une révélation à jour. */
const MAX_FINISH_REVEAL_MS = 1200;

/**
 * Durée de révélation de chaque slide quand le job est déjà réussi mais que
 * l'aperçu n'a pas fini de défiler : `remaining` slides (celle affichée
 * comprise) se partagent `FINISH_BUDGET_MS`, entre `MIN_REVEAL_MS` et
 * `MAX_FINISH_REVEAL_MS`. Un deck de 30 slides défile donc à la vitesse
 * plancher, un de 4 prend ~1,1 s par slide.
 */
export function finishRevealMs(remaining: number): number {
  const share = Math.round(FINISH_BUDGET_MS / Math.max(1, remaining));
  return Math.min(MAX_FINISH_REVEAL_MS, Math.max(MIN_REVEAL_MS, share));
}

/**
 * Fait avancer l'aperçu d'export UNE frame à la fois au lieu de suivre tel
 * quel l'index "premier lot pending" issu du polling
 * (`exportCursorFromBatches`), qui saute de N à N+2 quand le backend applique
 * plusieurs lots entre deux polls : l'aperçu "brûlait" alors des slides.
 *
 * L'aperçu ne doit jamais ralentir l'export : en retard, chaque slide se
 * révèle plus vite (`revealMsForLag`). Job échoué : la séquence s'arrête net,
 * pour que l'erreur s'affiche tout de suite. Job réussi (`succeeded`) : le
 * backend a pu finir bien avant l'aperçu, qui ne saute alors pas d'un coup à
 * la fin. Il déroule les slides restantes une à une, vite (`finishRevealMs`),
 * et seulement après la dernière la séquence se termine, donc le succès
 * s'annonce. L'export, lui, n'attend rien : il est déjà fini.
 */
export function usePacedExportCursor(
  /** Identifie une tentative d'export (incrémenté à chaque lancement/retry) : remet la séquence à zéro. */
  attempt: number | undefined,
  order: string[],
  rawCursor: ExportCursor | undefined,
  concluded: boolean,
  /** Le job conclu est réussi : l'aperçu déroule ce qui lui reste au lieu de s'arrêter net. */
  succeeded = false,
): PacedExportCursor | undefined {
  const total = order.length;
  const [displayIndex, setDisplayIndex] = useState(0);
  // Dernière slide révélée jusqu'au bout après un job réussi : plus rien à montrer.
  const [rolledOut, setRolledOut] = useState(false);
  const attemptRef = useRef(attempt);
  const rawIndexRef = useRef(rawCursor?.index);
  rawIndexRef.current = rawCursor?.index;

  useEffect(() => {
    if (attempt === attemptRef.current) return;
    attemptRef.current = attempt;
    setDisplayIndex(Math.min(rawIndexRef.current ?? 0, Math.max(0, total - 1)));
    setRolledOut(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, total]);

  const finishing = concluded && succeeded;
  const rawIndex = rawCursor?.index;
  // Job réussi : les lots sont tous appliqués (le curseur brut a disparu),
  // l'aperçu doit encore rejoindre la dernière slide.
  const target = finishing
    ? Math.max(0, total - 1)
    : total === 0 || rawIndex === undefined
      ? displayIndex
      : Math.min(rawIndex, total - 1);
  const lag = target - displayIndex;
  const revealMs = finishing ? finishRevealMs(total - displayIndex) : revealMsForLag(lag);

  // Instant et durée de révélation de la slide affichée : à la bascule en
  // "job réussi", celle qui est en cours va jusqu'au bout avant d'accélérer.
  const shownRef = useRef({ key: '', at: 0, ms: 0 });
  const shownKey = `${attempt}:${displayIndex}`;
  if (shownRef.current.key !== shownKey) shownRef.current = { key: shownKey, at: Date.now(), ms: revealMs };

  useEffect(() => {
    if (attempt === undefined || total === 0 || (concluded && !succeeded) || rolledOut) return;
    if (finishing) {
      const left = Math.max(0, shownRef.current.at + shownRef.current.ms - Date.now());
      const t = setTimeout(() => (lag > 0 ? setDisplayIndex((i) => Math.min(i + 1, target)) : setRolledOut(true)), left);
      return () => clearTimeout(t);
    }
    if (lag <= 0) return;
    const t = setTimeout(() => setDisplayIndex((i) => Math.min(i + 1, target)), revealMsForLag(lag));
    return () => clearTimeout(t);
  }, [attempt, total, concluded, succeeded, finishing, rolledOut, lag, target, displayIndex]);

  if (attempt === undefined || total === 0 || (concluded && !succeeded) || rolledOut) return undefined;
  const frameId = order[displayIndex];
  if (!frameId) return undefined;
  return { frameId, index: displayIndex, total, revealMs };
}
