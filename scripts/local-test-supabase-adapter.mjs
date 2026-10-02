import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = mkdtempSync(join(tmpdir(), 'lumi-supabase-adapter-'));
try {
  const source = join(root, 'supabase/functions/_shared/repository.ts');
  execFileSync('tsc', [source, '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'bundler', '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck', '--outDir', out], { stdio: 'inherit' });
  const module = await import(pathToFileURL(join(out, 'repository.js')).href + `?v=${Date.now()}`);
  if (typeof module.createSupabaseRestDatabaseAdapter !== 'function') throw new Error('createSupabaseRestDatabaseAdapter missing');
  if (typeof module.readSupabaseServerSecret !== 'function') throw new Error('readSupabaseServerSecret missing');

  const secret = module.readSupabaseServerSecret((name) => name === 'SUPABASE_SECRET_KEYS' ? JSON.stringify({ default: 'sb_secret_lumi' }) : undefined);
  if (secret !== 'sb_secret_lumi') throw new Error('modern Supabase secret key not resolved');
  const legacy = module.readSupabaseServerSecret((name) => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'legacy-service-role' : undefined);
  if (legacy !== 'legacy-service-role') throw new Error('legacy fallback not resolved');

  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/players')) {
      return Response.json([{ id: 'p1', telegram_user_id: 77, season_1_owned: false, created_at: '2026-10-02T00:00:00Z' }]);
    }
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      return Response.json([{ ...body, updated_at: body.updated_at }]);
    }
    return Response.json([]);
  };
  const db = module.createSupabaseRestDatabaseAdapter('https://abc.supabase.co/', 'sb_secret_lumi', fetcher);
  const player = await db.upsertPlayerByTelegramId(77);
  if (player.id !== 'p1' || player.telegramUserId !== 77) throw new Error('player mapping failed');
  const headers = new Headers(calls[0].init.headers);
  if (headers.get('apikey') !== 'sb_secret_lumi') throw new Error('secret key missing from apikey header');
  if (headers.has('Authorization')) throw new Error('sb_secret must not be sent as Authorization bearer');
  if (!calls[0].url.includes('on_conflict=telegram_user_id')) throw new Error('player upsert conflict key missing');
  console.log('PASS: Supabase server adapter + secret-key contract');
} finally {
  rmSync(out, { recursive: true, force: true });
}
