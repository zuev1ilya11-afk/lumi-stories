import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const source = join(root, 'scripts/configure-telegram-menu.ts');
const out = mkdtempSync(join(tmpdir(), 'lumi-menu-test-'));

try {
  execFileSync('tsc', [source, '--target', 'ES2022', '--module', 'ES2022', '--lib', 'ES2022,DOM', '--skipLibCheck', '--outDir', out], { stdio: 'inherit' });
  const mod = await import(pathToFileURL(join(out, 'configure-telegram-menu.js')).href + `?v=${Date.now()}`);
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, async json() { return { ok: true }; } };
  };
  await mod.configureTelegramMenu('token-123', 'https://lumi.example/app');
  if (captured.url !== 'https://api.telegram.org/bottoken-123/setChatMenuButton') throw new Error('wrong Bot API URL');
  const body = JSON.parse(captured.options.body);
  if (body.menu_button?.type !== 'web_app' || body.menu_button?.text !== 'Играть в LUMI') throw new Error('wrong menu button payload');
  if (body.menu_button?.web_app?.url !== 'https://lumi.example/app') throw new Error('wrong mini app URL');
  console.log('PASS: Telegram menu configuration request');
} finally {
  rmSync(out, { recursive: true, force: true });
}
