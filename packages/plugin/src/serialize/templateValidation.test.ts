import { describe, expect, it } from 'vitest';
import type { IRWarning } from '@figma-to-slides/shared';
import { enforceTemplateStrictness, hasBlockingWarnings } from './templateValidation.js';

function warning(code: IRWarning['code'], severity: IRWarning['severity']): IRWarning {
  return { code, severity, sourceNodeId: 'n1', nodeName: 'Node', message: 'msg' };
}

describe('enforceTemplateStrictness', () => {
  it('upgrades a raster-causing warning to blocking regardless of its original severity', () => {
    const [result] = enforceTemplateStrictness([warning('GRADIENT_RASTERIZED', 'warning')]);
    expect(result.severity).toBe('blocking');
  });

  it('leaves FONT_SUBSTITUTED (still native) at its original severity', () => {
    const [result] = enforceTemplateStrictness([warning('FONT_SUBSTITUTED', 'info')]);
    expect(result.severity).toBe('info');
  });

  it('leaves RADIUS_APPROXIMATED (still native) at its original severity', () => {
    const [result] = enforceTemplateStrictness([warning('RADIUS_APPROXIMATED', 'info')]);
    expect(result.severity).toBe('info');
  });

  it('keeps an already-blocking warning blocking', () => {
    const [result] = enforceTemplateStrictness([warning('FONT_MISSING', 'blocking')]);
    expect(result.severity).toBe('blocking');
  });

  it('upgrades an unknown placeholder tag to blocking (a typo means a missing placeholder in the delivered template)', () => {
    const [result] = enforceTemplateStrictness([warning('PLACEHOLDER_TAG_UNKNOWN', 'warning')]);
    expect(result.severity).toBe('blocking');
  });
});

describe('hasBlockingWarnings', () => {
  it('returns false when there are no warnings', () => {
    expect(hasBlockingWarnings([])).toBe(false);
  });

  it('returns false when all warnings are info/warning', () => {
    expect(hasBlockingWarnings([warning('FONT_SUBSTITUTED', 'info'), warning('RADIUS_APPROXIMATED', 'info')])).toBe(false);
  });

  it('returns true when at least one warning is blocking', () => {
    expect(hasBlockingWarnings([warning('FONT_SUBSTITUTED', 'info'), warning('FONT_MISSING', 'blocking')])).toBe(true);
  });
});
