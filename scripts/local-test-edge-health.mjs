import fs from 'node:fs';

const source = fs.readFileSync('supabase/functions/lumi-api/index.ts', 'utf8');
if (!source.includes("url.pathname.endsWith('/health')")) {
  throw new Error('lumi-api /health route is missing');
}
if (!source.includes('telegramConfigured')) {
  throw new Error('/health must expose only configuration state');
}
if (source.includes('TELEGRAM_BOT_TOKEN:')) {
  throw new Error('/health must never expose token value');
}
console.log('lumi-api health contract: PASS');
