import { describe, expect, it } from 'vitest';
import { publicAsset } from './publicAsset';

describe('publicAsset', () => {
  it('uses the GitHub Pages base path without duplicating slashes', () => {
    expect(publicAsset('/assets/last-online/cover.webp', '/lumi-stories/'))
      .toBe('/lumi-stories/assets/last-online/cover.webp');
  });

  it('keeps root hosting compatible for Netlify', () => {
    expect(publicAsset('assets/last-online/cover.webp', '/'))
      .toBe('/assets/last-online/cover.webp');
  });
});
