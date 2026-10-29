import { describe, expect, it } from 'vitest';
import { exportDownloadUrl } from './exportFormats.js';

describe('exportDownloadUrl', () => {
  const url = 'https://docs.google.com/presentation/d/abc_123-X/edit';

  it('builds the Google export link for downloadable formats', () => {
    expect(exportDownloadUrl(url, 'pptx')).toBe('https://docs.google.com/presentation/d/abc_123-X/export/pptx');
    expect(exportDownloadUrl(url, 'odp')).toBe('https://docs.google.com/presentation/d/abc_123-X/export/odp');
  });

  it('has nothing to download for Slides or an unknown URL', () => {
    expect(exportDownloadUrl(url, 'slides')).toBeUndefined();
    expect(exportDownloadUrl('https://example.com', 'pptx')).toBeUndefined();
    expect(exportDownloadUrl(undefined, 'pptx')).toBeUndefined();
  });
});
