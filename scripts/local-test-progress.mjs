import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = mkdtempSync(join(tmpdir(), 'lumi-progress-'));
const BOT_TOKEN = '123456789:test_token_for_lumi';
const NOW = 1_800_000_000;

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
}
async function sign(fields) {
  const params = new URLSearchParams(fields);
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(new TextEncoder().encode('WebAppData'), BOT_TOKEN);
  const hash = await hmac(secret, check);
  params.set('hash', [...hash].map((b) => b.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

try {
  const sources = [
    'supabase/functions/_shared/telegram.ts',
    'supabase/functions/_shared/http.ts',
    'supabase/functions/_shared/repository.ts',
    'supabase/functions/lumi-api/routes/progress.ts',
  ].map((p) => join(root, p));
  execFileSync('tsc', [...sources, '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck', '--outDir', out, '--rewriteRelativeImportExtensions'], { stdio: 'inherit' });
  const repoModule = await import(pathToFileURL(join(out, '_shared/repository.js')).href + `?v=${Date.now()}`);
  const routeModule = await import(pathToFileURL(join(out, 'lumi-api/routes/progress.js')).href + `?v=${Date.now()}`);

  const players = new Map();
  const rows = new Map();
  const db = {
    async upsertPlayerByTelegramId(id) {
      if (!players.has(id)) players.set(id, { id: `player-${id}`, telegramUserId: id, season1Owned: false, createdAt: '2026-10-02T00:00:00.000Z' });
      return players.get(id);
    },
    async findProgress(playerId, storyId, seasonId) { return rows.get(`${playerId}:${storyId}:${seasonId}`) ?? null; },
    async upsertProgress(row) { rows.set(`${row.playerId}:${row.storyId}:${row.seasonId}`, row); return row; },
  };
  const repository = repoModule.createRepository(db);
  const p1 = await repository.getOrCreatePlayer(77);
  const p2 = await repository.getOrCreatePlayer(77);
  if (p1.id !== p2.id || players.size !== 1) throw new Error('duplicate player created');
  await repository.saveProgress(p1.id, { storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 's1', junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} });
  await repository.saveProgress(p1.id, { storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 's2', junhoScore: 1, taeyunScore: 0, truthScore: 1, riskScore: 0, flags: { x: true } });
  if (rows.size !== 1 || (await repository.getProgress(p1.id, 'last-online', 'season-1'))?.sceneId !== 's2') throw new Error('progress upsert contract failed');

  const initData = await sign({ auth_date: String(NOW - 30), user: JSON.stringify({ id: 555111, first_name: 'Лера' }) });
  const emptyRows = new Map();
  let saves = 0;
  const routeRepo = {
    async getOrCreatePlayer(id) { return { id: `player-${id}`, telegramUserId: id, season1Owned: false, createdAt: 'x' }; },
    async getProgress(playerId, storyId, seasonId) { return emptyRows.get(`${playerId}:${storyId}:${seasonId}`) ?? null; },
    async saveProgress(playerId, input) { saves += 1; const row = { playerId, ...input, updatedAt: 'x' }; emptyRows.set(`${playerId}:${input.storyId}:${input.seasonId}`, row); return row; },
  };
  const getEmpty = await routeModule.handleProgress(new Request('https://x/progress?storyId=last-online&seasonId=season-1', { headers: { 'X-Telegram-Init-Data': initData } }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository: routeRepo });
  if (getEmpty.status !== 200 || (await getEmpty.json()).progress !== null) throw new Error('empty GET failed');
  const input = { storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 's2', junhoScore: 1, taeyunScore: 0, truthScore: 1, riskScore: 0, flags: {} };
  const put = await routeModule.handleProgress(new Request('https://x/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify(input) }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository: routeRepo });
  if (put.status !== 200 || (await put.json()).progress.playerId !== 'player-555111') throw new Error('PUT failed');
  const tamper = await routeModule.handleProgress(new Request('https://x/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify({ ...input, playerId: 'evil' }) }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository: routeRepo });
  if (tamper.status !== 400 || saves !== 1) throw new Error('identity tampering was not rejected');
  const invalid = await routeModule.handleProgress(new Request('https://x/progress?storyId=last-online&seasonId=season-1', { headers: { 'X-Telegram-Init-Data': 'auth_date=1&hash=bad' } }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository: routeRepo });
  if (invalid.status !== 401) throw new Error('invalid initData not rejected');
  console.log('PASS: repository + progress route contracts');
} finally {
  rmSync(out, { recursive: true, force: true });
}
