import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir='supabase/migrations';
const sql=fs.readdirSync(dir).filter((name)=>name.endsWith('.sql')).map((name)=>fs.readFileSync(path.join(dir,name),'utf8')).join('\n');
assert.match(sql, /create\s+index(?:\s+if\s+not\s+exists)?\s+analytics_events_player_id_idx\s+on\s+public\.analytics_events\s*\(player_id\)/i);
console.log('migration index contract: pass');
