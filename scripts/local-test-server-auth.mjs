import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = mkdtempSync(join(tmpdir(), 'lumi-server-auth-'));
const telegramSource = join(root, 'supabase/functions/_shared/telegram.ts');
const bootstrapSource = join(root, 'supabase/functions/lumi-api/routes/bootstrap.ts');
const BOT_TOKEN = '123456789:test_token_for_lumi';
const NOW = 1_800_000_000;

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
}

async function sign(fields) {
  const params = new URLSearchParams(fields);
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(new TextEncoder().encode('WebAppData'), BOT_TOKEN);
  const hash = await hmac(secret, dataCheck);
  params.set('hash', [...hash].map((b) => b.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

try {
  execFileSync('tsc', [telegramSource, bootstrapSource, '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck', '--outDir', out, '--rewriteRelativeImportExtensions'], { stdio: 'inherit' });
  const telegram = await import(pathToFileURL(join(out, '_shared/telegram.js')).href + `?v=${Date.now()}`);
  const bootstrap = await import(pathToFileURL(join(out, 'lumi-api/routes/bootstrap.js')).href + `?v=${Date.now()}`);

  const valid = await sign({ auth_date: String(NOW - 60), query_id: 'AAEAAAE', user: JSON.stringify({ id: 100200300, first_name: 'Лера', username: 'lera' }) });
  const user = await telegram.verifyTelegramInitData(valid, BOT_TOKEN, NOW);
  if (user.id !== 100200300 || user.firstName !== 'Лера' || user.authDate !== NOW - 60) throw new Error('valid payload rejected or parsed incorrectly');

  const mutated = new URLSearchParams(valid);
  mutated.set('user', JSON.stringify({ id: 100200300, first_name: 'Лера!' }));
  let mutationError;
  try { await telegram.verifyTelegramInitData(mutated.toString(), BOT_TOKEN, NOW); } catch (error) { mutationError = error; }
  if (mutationError?.code !== 'INVALID_SIGNATURE') throw new Error('mutated user was not rejected');

  const badHash = new URLSearchParams(valid);
  badHash.set('hash', '00'.repeat(32));
  let hashError;
  try { await telegram.verifyTelegramInitData(badHash.toString(), BOT_TOKEN, NOW); } catch (error) { hashError = error; }
  if (hashError?.code !== 'INVALID_SIGNATURE') throw new Error('bad hash was not rejected');

  const expired = await sign({ auth_date: String(NOW - 86_401), user: JSON.stringify({ id: 100200300 }) });
  let expiredError;
  try { await telegram.verifyTelegramInitData(expired, BOT_TOKEN, NOW); } catch (error) { expiredError = error; }
  if (expiredError?.code !== 'EXPIRED') throw new Error('expired initData was not rejected');

  const missingId = await sign({ auth_date: String(NOW - 60), user: JSON.stringify({ first_name: 'Лера' }) });
  let userError;
  try { await telegram.verifyTelegramInitData(missingId, BOT_TOKEN, NOW); } catch (error) { userError = error; }
  if (userError?.code !== 'INVALID_USER') throw new Error('user without id was not rejected');

  let repoCalls = 0;
  const invalidResponse = await bootstrap.handleBootstrap(
    new Request('https://example.test/bootstrap', { method: 'POST', headers: { 'X-Telegram-Init-Data': 'auth_date=1&hash=bad' } }),
    { botToken: BOT_TOKEN, nowSeconds: NOW, repository: { async bootstrapPlayer() { repoCalls += 1; throw new Error('unexpected'); } } },
  );
  if (invalidResponse.status !== 401 || repoCalls !== 0) throw new Error('bootstrap invalid-auth contract failed');

  const routeValid = await sign({ auth_date: String(NOW - 30), user: JSON.stringify({ id: 555111, first_name: 'Лера' }) });
  const validResponse = await bootstrap.handleBootstrap(
    new Request('https://example.test/bootstrap', { method: 'POST', headers: { 'X-Telegram-Init-Data': routeValid } }),
    { botToken: BOT_TOKEN, nowSeconds: NOW, repository: { async bootstrapPlayer(verified) { return { playerId: 'player-1', telegramUserId: verified.id, season1Owned: false, progress: null }; } } },
  );
  const payload = await validResponse.json();
  if (validResponse.status !== 200 || payload.telegramUserId !== 555111 || payload.playerId !== 'player-1') throw new Error('bootstrap valid-auth contract failed');

  console.log('PASS: Telegram server auth + bootstrap contract');
} finally {
  rmSync(out, { recursive: true, force: true });
}
