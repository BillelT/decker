import { useEffect, useRef, useState } from 'preact/hooks';
import { moveToIndex } from './reorderFrames.js';

/** En dessous de ce mouvement, un pointerdown reste un simple clic de sélection. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Fraction (de 0 à 1) d'un slot qu'il reste à parcourir, avant un recouvrement
 * complet avec la vignette voisine, pour que le réordonnancement se
 * déclenche déjà, plutôt que d'attendre d'être quasiment empilé dessus.
 */
const DRAG_SWAP_MARGIN = 0.32;

/**
 * Réordonnancement du rail de vignettes, commun à DeckPanel et TemplatePanel
 * (les deux en portaient chacun une copie). L'essentiel : `order` ne change
 * qu'UNE fois, au relâchement, pendant que les autres vignettes se décalent
 * d'un cran entier via un transform CSS animé.
 *
 * Les écouteurs du drag sont posés DANS le pointerdown, avec
 * `setPointerCapture`, et non plus dans un effet : l'effet ne tournait
 * qu'après le rendu suivant, si bien qu'un clic très bref (tap de trackpad)
 * relâchait le bouton avant que `pointerup` soit écouté, et qu'un relâchement
 * hors de la fenêtre du plugin n'arrivait jamais. Dans les deux cas la
 * vignette restait collée au curseur.
 *
 * Alt+↑ / Alt+↓ sur une vignette focalisée la déplacent d'un cran : le
 * glisser-déposer a ainsi un équivalent au clavier (WCAG 2.5.7).
 */
export function useRailReorder(order: string[], setOrder: (updater: (prev: string[]) => string[]) => void, locked: boolean) {
  const [dragId, setDragId] = useState<string | undefined>();
  const [dragOffsetY, setDragOffsetY] = useState(0);
  // Le retour visuel "grab" ne doit apparaître qu'une fois un vrai
  // déplacement détecté (pas au simple hover ni au clic de sélection).
  const [dragActive, setDragActive] = useState(false);
  // Index (dans `order`, figé pendant tout le drag) où la vignette
  // atterrirait si on relâchait maintenant : pilote le décalage visuel des
  // autres vignettes.
  const [dragTargetIndex, setDragTargetIndex] = useState(0);
  // Au relâchement, `order` se réorganise ET les transforms repassent à zéro
  // dans le MÊME rendu ; la transition CSS animerait ce retour à zéro
  // par-dessus une position de flux qui a déjà sauté. On coupe donc la
  // transition pour cet unique rendu de relâchement.
  const [suppressShiftTransition, setSuppressShiftTransition] = useState(false);
  // Annonce du dernier déplacement au clavier, lue par la région `status` du panneau.
  const [announcement, setAnnouncement] = useState('');
  const dragStartIndexRef = useRef(0);
  // Hauteur d'un "pas" (slot + gap), mesurée une seule fois au pointerdown.
  const slotHeightRef = useRef(0);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Retire les écouteurs du drag en cours : appelé à sa fin, ou au démontage.
  const detachRef = useRef<(() => void) | undefined>();
  // Vignette déplacée au clavier, à refocaliser une fois le rail re-rendu.
  const pendingFocusIdRef = useRef<string | undefined>();

  useEffect(() => () => detachRef.current?.(), []);

  // Réactive la transition juste après que le rendu "instantané" du
  // relâchement a été peint.
  useEffect(() => {
    if (!suppressShiftTransition) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSuppressShiftTransition(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [suppressShiftTransition]);

  // Preact déplace le nœud de la vignette dans le DOM pour suivre `order` ;
  // le focus peut s'y perdre, on le rend à la vignette déplacée.
  useEffect(() => {
    const id = pendingFocusIdRef.current;
    if (!id) return;
    pendingFocusIdRef.current = undefined;
    itemRefs.current.get(id)?.querySelector<HTMLElement>('.f2s-frame-preview')?.focus();
  }, [order]);

  /**
   * Index (dans l'`order` FIGÉ du début de drag) où la vignette atterrirait,
   * calculé à partir du déplacement du POINTEUR (`offsetY`, relatif au point
   * de saisie) : un pas se déclenche dès que `offsetY` dépasse
   * `slotHeight * (1 - DRAG_SWAP_MARGIN)`.
   */
  function targetIndexFromOffset(offsetY: number, lastIndex: number): number {
    const slotHeight = slotHeightRef.current;
    if (slotHeight <= 0) return dragStartIndexRef.current;
    const steps = Math.sign(offsetY) * Math.floor(Math.abs(offsetY) / slotHeight + DRAG_SWAP_MARGIN);
    return Math.max(0, Math.min(lastIndex, dragStartIndexRef.current + steps));
  }

  function onThumbPointerDown(e: PointerEvent, id: string) {
    if (locked || e.button !== 0) return;
    detachRef.current?.();

    const pointerId = e.pointerId;
    const startY = e.clientY;
    const startIndex = order.indexOf(id);
    const lastIndex = order.length - 1;
    dragStartIndexRef.current = startIndex;
    setDragOffsetY(0);
    setDragActive(false);
    setDragTargetIndex(startIndex);
    setDragId(id);

    const firstTop = itemRefs.current.get(order[0])?.getBoundingClientRect().top;
    const secondTop = order.length > 1 ? itemRefs.current.get(order[1])?.getBoundingClientRect().top : undefined;
    slotHeightRef.current =
      firstTop !== undefined && secondTop !== undefined
        ? secondTop - firstTop
        : (itemRefs.current.get(id)?.getBoundingClientRect().height ?? 0);

    // La capture garde le flux d'événements sur la vignette même quand le
    // pointeur sort de l'iframe du plugin.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(pointerId);
    } catch {
      // Pointeur déjà relâché : le garde `buttons === 0` ci-dessous prend le relais.
    }

    let moved = false;
    let target = startIndex;

    function finish(commit: boolean) {
      detach();
      setSuppressShiftTransition(true);
      if (commit && moved) setOrder((prev) => moveToIndex(prev, id, target));
      setDragId(undefined);
      setDragOffsetY(0);
      setDragActive(false);
    }
    function track(clientY: number) {
      const offset = clientY - startY;
      setDragOffsetY(offset);
      if (Math.abs(offset) > DRAG_THRESHOLD_PX) moved = true;
      if (!moved) return;
      target = targetIndexFromOffset(offset, lastIndex);
      setDragActive(true);
      setDragTargetIndex(target);
    }
    function onPointerMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      // Plus aucun bouton enfoncé alors qu'aucun pointerup n'est arrivé :
      // le relâchement a eu lieu ailleurs. La vignette se pose là où elle
      // était, au lieu de suivre le curseur.
      if (ev.buttons === 0) {
        finish(true);
        return;
      }
      track(ev.clientY);
    }
    function onPointerUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      if (moved) target = targetIndexFromOffset(ev.clientY - startY, lastIndex);
      finish(true);
    }
    function onPointerCancel(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      finish(false);
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

  function onThumbKeyDown(e: KeyboardEvent, id: string) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    if (locked) return;
    const index = order.indexOf(id);
    const next = index + (e.key === 'ArrowUp' ? -1 : 1);
    if (index === -1 || next < 0 || next > order.length - 1) return;
    pendingFocusIdRef.current = id;
    setOrder((prev) => moveToIndex(prev, id, next));
    setAnnouncement(`Moved to position ${next + 1} of ${order.length}.`);
  }

  /**
   * Transform et classes d'une vignette du rail : celle qu'on traîne suit le
   * pointeur, les autres se décalent d'un cran entier pour ouvrir/refermer la
   * place, selon que leur index d'origine se trouve entre le départ et la
   * cible du drag.
   */
  function itemState(id: string, index: number): { className: string; style: { transform: string } | undefined } {
    const isDragging = dragId === id && dragActive;
    let ghostShift = 0;
    if (dragId && dragActive && !isDragging) {
      const start = dragStartIndexRef.current;
      if (start < dragTargetIndex && index > start && index <= dragTargetIndex) {
        ghostShift = -slotHeightRef.current;
      } else if (start > dragTargetIndex && index >= dragTargetIndex && index < start) {
        ghostShift = slotHeightRef.current;
      }
    }
    return {
      className: `f2s-sidebar-item${isDragging ? ' is-dragging' : ''}${suppressShiftTransition ? ' is-releasing' : ''}`,
      style: isDragging
        ? { transform: `translateY(${dragOffsetY}px)` }
        : ghostShift !== 0
          ? { transform: `translateY(${ghostShift}px)` }
          : undefined,
    };
  }

  /** Ref callback d'un élément du rail (mesure du pas, défilement vers la vignette surlignée). */
  function registerItem(id: string) {
    return (el: HTMLDivElement | null) => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    };
  }

  return { itemRefs, itemState, registerItem, onThumbPointerDown, onThumbKeyDown, announcement };
}
