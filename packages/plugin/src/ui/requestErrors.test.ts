import { describe, expect, it } from 'vitest';
import { describeHttpFailure, describeJobFailure, describeNetworkFailure, describeSlideFailure } from './requestErrors.js';

describe('describeHttpFailure', () => {
  it('ne montre jamais le code brut du backend', () => {
    for (const status of [400, 403, 404, 409, 413, 415, 429, 500, 502, 503]) {
      const message = describeHttpFailure('export', status);
      expect(message).not.toMatch(/internal_error|rejected \(|Backend responded/);
      expect(message).toMatch(/\.$/);
    }
  });

  it('donne un conseil propre à chaque cas courant', () => {
    expect(describeHttpFailure('upload', 413)).toMatch(/too large/);
    expect(describeHttpFailure('export', 429)).toMatch(/Wait a minute/);
    expect(describeHttpFailure('export', 500)).toMatch(/^The export server ran into a problem/);
    expect(describeHttpFailure('export', 503)).toMatch(/unavailable right now/);
    expect(describeHttpFailure('sign-in', 500)).toMatch(/^The sign-in service/);
    expect(describeHttpFailure('retry', 409)).toMatch(/Export again/);
  });

  it('garde le code en dernier recours, pour un statut imprévu', () => {
    expect(describeHttpFailure('export', 418)).toContain('error 418');
  });
});

describe('describeNetworkFailure', () => {
  it('nomme le service injoignable', () => {
    expect(describeNetworkFailure('export')).toMatch(/^Can't reach the export server/);
    expect(describeNetworkFailure('sign-in')).toMatch(/^Can't reach the sign-in service/);
  });
});

describe('describeSlideFailure', () => {
  it('traduit une image refusée par Google', () => {
    const raw = 'Slides API 400 on /presentations/abc:batchUpdate: Invalid requests[3].createImage: The provided image is too large.';
    expect(describeSlideFailure(raw, 'slide')).toMatch(/^Google Slides rejected an image on this slide/);
  });

  it('distingue les erreurs temporaires de Google', () => {
    expect(describeSlideFailure('Slides API 503 on /presentations/abc:batchUpdate', 'layout')).toMatch(/temporary problem with this layout/);
    expect(describeSlideFailure('Slides API 429 on /presentations/abc:batchUpdate', 'slide')).toMatch(/Wait a minute/);
  });

  it('retombe sur un conseil général sans code reconnaissable', () => {
    expect(describeSlideFailure('socket hang up', 'slide')).toMatch(/^This slide couldn't be written/);
  });
});

describe('describeJobFailure', () => {
  it('parle du template en mode template', () => {
    expect(describeJobFailure('layout')).toMatch(/^The template/);
    expect(describeJobFailure('slide')).toMatch(/^The presentation/);
  });
});
