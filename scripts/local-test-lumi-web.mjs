import fs from 'node:fs';
const path = 'supabase/functions/lumi-web/index.ts';
if (!fs.existsSync(path)) throw new Error('lumi-web function is missing');
const s = fs.readFileSync(path, 'utf8');
for (const needle of [
  'Telegram.WebApp',
  "location.origin + '/functions/v1/lumi-api'",
  "api('/bootstrap'",
  "api('/progress'",
  'X-Telegram-Init-Data',
  'Демо-режим',
  'Интеграция LUMI работает',
]) {
  if (!s.includes(needle)) throw new Error(`missing smoke contract: ${needle}`);
}
if (s.includes('TELEGRAM_BOT_TOKEN')) throw new Error('frontend must not contain bot token');
console.log('lumi-web smoke contract: PASS');
