import { useEffect, useRef, useState } from 'preact/hooks';
import { REVEAL_MS } from './RetroExportPreview.js';
import type { ExportCursor } from './exportCursor.js';

/**
 * Fait avancer l'aperçu d'export UNE frame à la fois, à un rythme borné par
 * `REVEAL_MS`, au lieu de suivre tel quel l'index "premier lot pending" issu
 * du polling (`exportCursorFromBatches`).
 *
 * Deux bugs venaient de ce suivi brut :
 *  - le backend applique parfois plusieurs lots entre deux polls (1 lot par
 *    slide simple peut prendre bien moins qu'un cycle de `POLL_INTERVAL_MS`) :
 *    l'index "premier pending" saute alors direct de N à N+2 ou plus, et
 *    l'aperçu d'export "brûle" les slides intermédiaires sans jamais les
 *    montrer ;
 *  - dès que le DERNIER lot passe `applied`, `exportCursorFromBatches` ne
 *    trouve plus rien de `pending` et redevient `undefined` : l'aperçu de la
 *    toute dernière slide disparaît donc au milieu de sa révélation (voire
 *    avant d'avoir commencé), ce qui se lit comme "l'anim s'arrête à
 *    l'avant-dernière slide".
 *
 * Ici, `displayIndex` ne peut avancer que d'un cran par cycle de
 * `REVEAL_MS`, et ne dépasse jamais `target` (dérivé du polling réel) : un
 * backend plus rapide que l'anim la fait simplement patienter au lieu de la
 * faire sauter des slides ; un backend plus lent la ralentit déjà (cf.
 * RetroExportPreview). Une fois le job conclu, `target` devient le DERNIER
 * index du deck : la séquence continue de défiler jusque-là puis tient un
 * cycle de plus (pour laisser la révélation de la dernière slide finir)
 * avant de disparaître.
 */
export function usePacedExportCursor(
  /** Identifie une tentative d'export (incrémenté à chaque lancement/retry) — remet la séquence à zéro. */
  attempt: number | undefined,
  order: string[],
  rawCursor: ExportCursor | undefined,
  concluded: boolean,
): ExportCursor | undefined {
  const total = order.length;
  const [displayIndex, setDisplayIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const attemptRef = useRef(attempt);
  const rawIndexRef = useRef(rawCursor?.index);
  rawIndexRef.current = rawCursor?.index;
  // A-t-on vu au moins un poll avec un lot réel pour CETTE tentative ? Sans
  // ça, une conclusion (`concluded`) précoce — ex. échec réseau avant même
  // la création du job côté backend — ferait quand même défiler l'anim
  // jusqu'au bout pour un export qui n'a jamais commencé.
  const sawBatchesRef = useRef(false);
  if (rawCursor) sawBatchesRef.current = true;

  useEffect(() => {
    if (attempt === attemptRef.current) return;
    attemptRef.current = attempt;
    sawBatchesRef.current = rawIndexRef.current !== undefined;
    setDisplayIndex(Math.min(rawIndexRef.current ?? 0, Math.max(0, total - 1)));
    setFinished(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, total]);

  const rawIndex = rawCursor?.index;
  const concludedWithProgress = concluded && sawBatchesRef.current;
  const target =
    total === 0 ? 0 : concludedWithProgress ? total - 1 : rawIndex === undefined ? displayIndex : Math.min(rawIndex, total - 1);

  useEffect(() => {
    if (attempt === undefined || total === 0 || finished) return;
    if (displayIndex < target) {
      const t = setTimeout(() => setDisplayIndex((i) => Math.min(i + 1, target)), REVEAL_MS);
      return () => clearTimeout(t);
    }
    if (concludedWithProgress && displayIndex >= total - 1) {
      const t = setTimeout(() => setFinished(true), REVEAL_MS);
      return () => clearTimeout(t);
    }
  }, [attempt, total, finished, displayIndex, target, concludedWithProgress]);

  if (attempt === undefined || total === 0 || finished) return undefined;
  // Job conclu (succès ou échec) sans qu'aucun lot n'ait jamais été vu —
  // ex. échec avant la création du job côté backend : rien à montrer.
  if (concluded && !sawBatchesRef.current) return undefined;
  const frameId = order[displayIndex];
  if (!frameId) return undefined;
  return { frameId, index: displayIndex, total };
}
