import fs from 'node:fs';
const p='netlify-smoke/index.html';
if (!fs.existsSync(p)) throw new Error('netlify smoke index missing');
const s=fs.readFileSync(p,'utf8');
if (!s.startsWith('<!doctype html>')) throw new Error('not html');
if (!s.includes("const API = 'https://ctgvfjubgxdmhbmhubes.supabase.co/functions/v1/lumi-api'")) throw new Error('absolute LUMI API missing');
if (s.includes("location.origin + '/functions/v1/lumi-api'")) throw new Error('still coupled to Supabase origin');
if (!s.includes('telegram-web-app.js')) throw new Error('Telegram bridge missing');
console.log('netlify smoke structure ok');
