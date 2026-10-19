import { describe, expect, it } from 'vitest';
import { finishRevealMs, revealMsForLag } from './pacedExportCursor.js';
import { MIN_REVEAL_MS, REVEAL_MS } from './RetroExportPreview.js';

describe('finishRevealMs', () => {
  it('plafonne la révélation d’une slide quand il n’en reste qu’une', () => {
    expect(finishRevealMs(1)).toBe(1200);
    expect(finishRevealMs(1)).toBeLessThan(REVEAL_MS);
  });

  it('partage le budget entre les slides restantes', () => {
    expect(finishRevealMs(4)).toBe(1125);
    expect(finishRevealMs(8)).toBe(563);
  });

  it('ne descend jamais sous le plancher, même sur un gros deck', () => {
    expect(finishRevealMs(60)).toBe(MIN_REVEAL_MS);
  });

  it('tolère 0 slide restante', () => {
    expect(finishRevealMs(0)).toBe(1200);
  });
});

describe('revealMsForLag', () => {
  it('prend toute la durée quand l’aperçu est à jour, raccourcit en retard', () => {
    expect(revealMsForLag(0)).toBe(REVEAL_MS);
    expect(revealMsForLag(2)).toBe(REVEAL_MS / 2);
    expect(revealMsForLag(50)).toBe(MIN_REVEAL_MS);
  });
});
