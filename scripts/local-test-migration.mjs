import { readFileSync } from 'node:fs';

const path = 'supabase/migrations/20261002_lumi_prototype.sql';
const sql = readFileSync(path, 'utf8').toLowerCase();
const required = [
  'create table public.players',
  'telegram_user_id bigint unique not null',
  'season_1_owned boolean not null default false',
  'create table public.progress',
  'unique (player_id, story_id, season_id)',
  "flags jsonb not null default '{}'::jsonb",
  'create table public.analytics_events',
  'alter table public.players enable row level security',
  'alter table public.progress enable row level security',
  'alter table public.analytics_events enable row level security',
  'revoke all on table public.players from anon, authenticated',
  'revoke all on table public.progress from anon, authenticated',
  'revoke all on table public.analytics_events from anon, authenticated',
  'grant select, insert, update, delete on table public.players to service_role',
  'grant select, insert, update, delete on table public.progress to service_role',
  'grant select, insert, update, delete on table public.analytics_events to service_role',
];
for (const fragment of required) {
  if (!sql.includes(fragment)) throw new Error(`missing migration security/schema fragment: ${fragment}`);
}
console.log('PASS: migration schema + RLS/grant contract');
