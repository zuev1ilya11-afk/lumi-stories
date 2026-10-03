// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Telegram Mini App bootstrap script', () => {
  it('loads telegram-web-app.js in head before the Vite entrypoint', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const telegramScript = html.indexOf('https://telegram.org/js/telegram-web-app.js');
    const viteEntrypoint = html.indexOf('/src/main.tsx');

    expect(telegramScript).toBeGreaterThan(-1);
    expect(telegramScript).toBeLessThan(viteEntrypoint);
    expect(html.slice(0, html.indexOf('</head>'))).toContain(
      'https://telegram.org/js/telegram-web-app.js',
    );
  });
});
