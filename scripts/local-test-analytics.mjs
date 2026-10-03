import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=resolve(new URL('..',import.meta.url).pathname); const out=mkdtempSync(join(tmpdir(),'lumi-analytics-'));
const BOT='123456789:test_token_for_lumi'; const NOW=1_800_000_000;
async function hmac(key,value){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value)))}
async function sign(){const p=new URLSearchParams({auth_date:String(NOW-30),user:JSON.stringify({id:555111,first_name:'Лера'})});const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');const secret=await hmac(new TextEncoder().encode('WebAppData'),BOT);const hash=await hmac(secret,check);p.set('hash',[...hash].map(b=>b.toString(16).padStart(2,'0')).join(''));return p.toString()}
try{
  execFileSync('tsc',[join(root,'supabase/functions/_shared/http.ts'),join(root,'supabase/functions/_shared/telegram.ts'),join(root,'supabase/functions/_shared/repository.ts'),join(root,'supabase/functions/lumi-api/routes/analytics.ts'),'--target','ES2022','--module','ES2022','--moduleResolution','bundler','--lib','ES2022,DOM,DOM.Iterable','--skipLibCheck','--outDir',out,'--rewriteRelativeImportExtensions'],{stdio:'inherit'});
  const {handleAnalytics}=await import(pathToFileURL(join(out,'lumi-api/routes/analytics.js')).href+`?v=${Date.now()}`);
  const events=[]; const repo={async getOrCreatePlayer(id){return{id:`player-${id}`,telegramUserId:id,season1Owned:false,createdAt:'x'}},async recordAnalytics(playerId,input){events.push({playerId,...input})}};
  let r=await handleAnalytics(new Request('https://x/analytics',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':'auth_date=1&hash=bad'},body:JSON.stringify({eventName:'app_opened'})}),{botToken:BOT,nowSeconds:NOW,repository:repo}); if(r.status!==401) throw new Error(`invalid auth ${r.status}`);
  const init=await sign();
  r=await handleAnalytics(new Request('https://x/analytics',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':init},body:JSON.stringify({eventName:'made_up',metadata:{}})}),{botToken:BOT,nowSeconds:NOW,repository:repo}); if(r.status!==400) throw new Error(`unknown ${r.status}`);
  r=await handleAnalytics(new Request('https://x/analytics',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':init},body:JSON.stringify({eventName:'scene_reached',metadata:{blob:'x'.repeat(5000)}})}),{botToken:BOT,nowSeconds:NOW,repository:repo}); if(r.status!==400) throw new Error(`oversize ${r.status}`);
  r=await handleAnalytics(new Request('https://x/analytics',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Init-Data':init},body:JSON.stringify({eventName:'choice_selected',episodeId:'ep1',sceneId:'s1',metadata:{choiceId:'hide'}})}),{botToken:BOT,nowSeconds:NOW,repository:repo}); if(r.status!==204||events[0]?.playerId!=='player-555111') throw new Error('verified player not used');
  console.log('PASS: analytics auth, allowlist, metadata limit, verified player');
}finally{rmSync(out,{recursive:true,force:true})}
