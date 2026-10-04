import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const source = join(root, 'src/telegram/telegram.ts');
const out = mkdtempSync(join(tmpdir(), 'lumi-telegram-test-'));

try {
  execFileSync('tsc', [source, '--target', 'ES2022', '--module', 'ES2022', '--lib', 'ES2022,DOM', '--skipLibCheck', '--outDir', out], { stdio: 'inherit' });
  const mod = await import(pathToFileURL(join(out, 'telegram.js')).href + `?v=${Date.now()}`);

  const exact = 'query_id=abc&user=%7B%22id%22%3A42%7D&hash=signed';
  const context = mod.resolveTelegramContext(
    { initData: exact, initDataUnsafe: { user: { id: 42, first_name: 'Лера' } } },
    { production: true },
  );
  if (context.initData !== exact) throw new Error('initData was not preserved exactly');
  if (context.userDisplayName !== 'Лера') throw new Error('display name mismatch');
  if ('userId' in context) throw new Error('unsafe user id leaked into trusted context');

  const fullName = mod.resolveTelegramContext(
    { initData: 'signed', initDataUnsafe: { user: { id: 777, first_name: 'Анна', last_name: 'Ким' } } },
    { production: true },
  );
  if (fullName.userDisplayName !== 'Анна Ким') throw new Error('full display name mismatch');

  let productionError;
  try { mod.resolveTelegramContext(undefined, { production: true }); } catch (error) { productionError = error; }
  if (productionError?.code !== 'TELEGRAM_CONTEXT_REQUIRED') throw new Error('production did not reject missing Telegram context');

  const dev = mod.resolveTelegramContext(undefined, {
    production: false,
    developmentMock: { initData: 'explicit-dev-init-data', userDisplayName: 'Dev' },
  });
  if (dev.initData !== 'explicit-dev-init-data') throw new Error('explicit dev mock not accepted');

  let readyCount = 0;
  let expandCount = 0;
  mod.readyTelegramApp({ ready: () => readyCount++, expand: () => expandCount++ });
  if (readyCount !== 1 || expandCount !== 1) throw new Error('Telegram ready/expand not called once');

  globalThis.window = {
    Telegram: {
      WebApp: {
        initData: 'exact-window-init-data',
        initDataUnsafe: { user: { id: 9, username: 'lumi_reader' } },
      },
    },
  };
  const fromWindow = mod.getTelegramContext({ production: true });
  if (fromWindow.initData !== 'exact-window-init-data' || fromWindow.userDisplayName !== '@lumi_reader') {
    throw new Error('getTelegramContext did not read Telegram window context');
  }

  console.log('PASS: Telegram adapter contract');
} finally {
  rmSync(out, { recursive: true, force: true });
}
