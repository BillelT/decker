import { describe, expect, it } from 'vitest';
import { displayFrameName } from './frameLabels.js';

describe('displayFrameName', () => {
  it('retire le préfixe des copies préparées', () => {
    expect(displayFrameName('[Slides Ready] Cover')).toBe('Cover');
    expect(displayFrameName('[Template Ready] Title slide')).toBe('Title slide');
  });

  it('laisse les autres noms tels quels, crochets compris', () => {
    expect(displayFrameName('Cover')).toBe('Cover');
    expect(displayFrameName('[[title]] Intro')).toBe('[[title]] Intro');
    expect(displayFrameName('')).toBe('');
  });
});
