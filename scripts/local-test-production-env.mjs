import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const envPath = resolve(root, '.env.production');
let text = '';
try { text = readFileSync(envPath, 'utf8'); } catch {}
const expected = 'VITE_LUMI_API_URL=https://ctgvfjubgxdmhbmhubes.supabase.co/functions/v1/lumi-api';
if (!text.split(/\r?\n/).includes(expected)) {
  throw new Error('production API URL is not pinned for Vite build');
}
if (/TELEGRAM_BOT_TOKEN\s*=/.test(text)) {
  throw new Error('server secret must not be present in .env.production');
}
console.log('PASS: production env pins public LUMI API only');
