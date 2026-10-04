import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = mkdtempSync(join(tmpdir(), 'lumi-api-client-'));
try {
  execFileSync('tsc', [join(root, 'src/api/client.ts'), join(root, 'src/api/types.ts'), '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck', '--outDir', out], { stdio: 'inherit' });
  const compiledClient = join(out, 'client.js');
  writeFileSync(compiledClient, readFileSync(compiledClient, 'utf8').replace("from './types'", "from './types.js'"));
  const { createApiClient } = await import(pathToFileURL(join(out, 'client.js')).href + `?v=${Date.now()}`);
  const calls = [];
  const fetcher = async (input, init) => {
    calls.push({ url: String(input), init });
    const body = String(input).endsWith('/bootstrap')
      ? { playerId: 'p1', telegramUserId: 1, season1Owned: false, progress: null }
      : init?.method === 'PUT'
        ? { progress: JSON.parse(String(init.body)) }
        : { progress: null };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const api = createApiClient({ baseUrl: 'https://api.example.test/', fetcher });
  await api.bootstrap('signed-init');
  await api.loadProgress('signed-init');
  await api.saveProgress('signed-init', { storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 's1', junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {}, updatedAt: 'server-only' });
  if (calls.length !== 3) throw new Error(`expected 3 calls, got ${calls.length}`);
  if (calls.some((c) => new Headers(c.init?.headers).get('X-Telegram-Init-Data') !== 'signed-init')) throw new Error('initData header missing');
  if (calls[0].init.method !== 'POST') throw new Error('bootstrap must POST');
  if (!calls[1].url.includes('storyId=last-online') || !calls[1].url.includes('seasonId=season-1')) throw new Error('progress load query missing');
  const saved = JSON.parse(calls[2].init.body);
  if ('updatedAt' in saved || 'playerId' in saved) throw new Error('server-owned fields leaked into save body');
  console.log('PASS: frontend API client contract');
} finally {
  rmSync(out, { recursive: true, force: true });
}
