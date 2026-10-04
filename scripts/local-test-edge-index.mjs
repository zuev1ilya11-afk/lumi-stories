import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = mkdtempSync(join(tmpdir(), 'lumi-edge-index-'));
const BOT_TOKEN = '123456789:test_token_for_lumi';
const NOW = Math.floor(Date.now() / 1000);

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
  const denoTypes = join(out, 'deno-sandbox.d.ts');
  writeFileSync(denoTypes, `declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): unknown; };\n`);
  const sources = [
    denoTypes,
    join(root, 'supabase/functions/_shared/http.ts'),
    join(root, 'supabase/functions/_shared/telegram.ts'),
    join(root, 'supabase/functions/_shared/repository.ts'),
    join(root, 'supabase/functions/lumi-api/routes/analytics.ts'),
    join(root, 'supabase/functions/lumi-api/routes/bootstrap.ts'),
    join(root, 'supabase/functions/lumi-api/routes/progress.ts'),
    join(root, 'supabase/functions/lumi-api/index.ts'),
  ];
  execFileSync('tsc', [...sources, '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck', '--outDir', out, '--rewriteRelativeImportExtensions'], { stdio: 'inherit' });

  const env = new Map([
    ['TELEGRAM_BOT_TOKEN', BOT_TOKEN],
    ['SUPABASE_URL', 'https://lumi.supabase.test'],
    ['SUPABASE_SECRET_KEYS', JSON.stringify({ default: 'sb_secret_lumi' })],
  ]);
  let capturedHandler;
  globalThis.Deno = {
    env: { get: (name) => env.get(name) },
    serve(handler) { capturedHandler = handler; },
  };

  const players = new Map();
  const progressRows = new Map();
  const analyticsRows = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    if (headers.get('apikey') !== 'sb_secret_lumi') throw new Error('backend secret missing from apikey');
    if (headers.has('Authorization')) throw new Error('backend secret sent in Authorization');
    if (url.pathname.endsWith('/players')) {
      const body = JSON.parse(String(init.body));
      if (!players.has(body.telegram_user_id)) players.set(body.telegram_user_id, { id: `p-${body.telegram_user_id}`, telegram_user_id: body.telegram_user_id, season_1_owned: false, created_at: '2026-10-02T00:00:00Z' });
      return Response.json([players.get(body.telegram_user_id)]);
    }
    if (url.pathname.endsWith('/progress') && init.method === 'POST') {
      const body = JSON.parse(String(init.body));
      progressRows.set(`${body.player_id}:${body.story_id}:${body.season_id}`, body);
      return Response.json([body]);
    }
    if (url.pathname.endsWith('/analytics_events') && init.method === 'POST') { analyticsRows.push(JSON.parse(String(init.body))); return new Response(null,{status:201}); }
    if (url.pathname.endsWith('/progress')) {
      const playerId = url.searchParams.get('player_id')?.replace(/^eq\./, '');
      const storyId = url.searchParams.get('story_id')?.replace(/^eq\./, '');
      const seasonId = url.searchParams.get('season_id')?.replace(/^eq\./, '');
      const row = progressRows.get(`${playerId}:${storyId}:${seasonId}`);
      return Response.json(row ? [row] : []);
    }
    throw new Error(`unexpected backend URL ${url}`);
  };

  await import(pathToFileURL(join(out, 'lumi-api/index.js')).href + `?v=${Date.now()}`);
  if (typeof capturedHandler !== 'function') throw new Error('Deno.serve handler not registered');
  const initData = await sign({ auth_date: String(NOW - 30), user: JSON.stringify({ id: 555111, first_name: 'Лера' }) });
  const bootstrap = await capturedHandler(new Request('https://fn.test/lumi-api/bootstrap', { method: 'POST', headers: { 'X-Telegram-Init-Data': initData } }));
  if (bootstrap.status !== 200) throw new Error(`bootstrap status ${bootstrap.status}`);
  const bootstrapBody = await bootstrap.json();
  if (bootstrapBody.telegramUserId !== 555111 || bootstrapBody.playerId !== 'p-555111') throw new Error('bootstrap did not use database repository');

  const getEmpty = await capturedHandler(new Request('https://fn.test/lumi-api/progress?storyId=last-online&seasonId=season-1', { headers: { 'X-Telegram-Init-Data': initData } }));
  if (getEmpty.status !== 200 || (await getEmpty.json()).progress !== null) throw new Error('progress GET integration failed');

  const state = { storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 's2', junhoScore: 1, taeyunScore: 0, truthScore: 1, riskScore: 0, flags: {} };
  const put = await capturedHandler(new Request('https://fn.test/lumi-api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify(state) }));
  if (put.status !== 200) throw new Error(`progress PUT status ${put.status}`);
  const analytics = await capturedHandler(new Request('https://fn.test/lumi-api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify({eventName:'scene_reached',sceneId:'s2',episodeId:'ep1',metadata:{source:'smoke'}}) }));
  if (analytics.status !== 204 || analyticsRows.length !== 1 || analyticsRows[0].player_id !== 'p-555111') throw new Error('analytics integration failed');
  console.log('PASS: Edge index routes use verified database repository');
} finally {
  rmSync(out, { recursive: true, force: true });
}
