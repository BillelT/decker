import { describe, expect, it } from 'vitest';
import { aspectRatioLabel, countLabel, displayFrameName, frameSizeCaption } from './frameLabels.js';

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

describe('aspectRatioLabel', () => {
  it('nomme les formats courants', () => {
    expect(aspectRatioLabel(1920, 1080)).toBe('16:9');
    expect(aspectRatioLabel(1024, 768)).toBe('4:3');
    expect(aspectRatioLabel(1080, 1080)).toBe('1:1');
    expect(aspectRatioLabel(1080, 1920)).toBe('9:16');
    expect(aspectRatioLabel(1440, 900)).toBe('16:10');
  });

  it('tolère les arrondis de taille (1366 × 768)', () => {
    expect(aspectRatioLabel(1366, 768)).toBe('16:9');
  });

  it('réduit une fraction hors liste, ou passe en décimal si elle est illisible', () => {
    expect(aspectRatioLabel(1400, 1000)).toBe('7:5');
    expect(aspectRatioLabel(1440, 1024)).toBe('1.41:1');
  });

  it('ne renvoie rien pour une taille nulle', () => {
    expect(aspectRatioLabel(0, 1080)).toBe('');
    expect(aspectRatioLabel(1920, 0)).toBe('');
  });
});

describe('frameSizeCaption', () => {
  it('arrondit les dimensions et ajoute le ratio', () => {
    expect(frameSizeCaption(1920.4, 1079.6)).toBe('1920 × 1080 px · 16:9');
  });
});

describe('countLabel', () => {
  it('accorde le nom', () => {
    expect(countLabel(0, 'slide')).toBe('0 slides');
    expect(countLabel(1, 'slide')).toBe('1 slide');
    expect(countLabel(3, 'slide')).toBe('3 slides');
  });
});
