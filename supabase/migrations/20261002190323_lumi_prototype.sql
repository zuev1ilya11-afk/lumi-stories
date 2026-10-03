create table public.players (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique not null,
  season_1_owned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.progress (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  story_id text not null,
  season_id text not null,
  episode_id text not null,
  scene_id text not null,
  junho_score integer not null default 0,
  taeyun_score integer not null default 0,
  truth_score integer not null default 0,
  risk_score integer not null default 0,
  flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (player_id, story_id, season_id)
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete set null,
  event_name text not null,
  episode_id text,
  scene_id text,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

alter table public.players enable row level security;
alter table public.progress enable row level security;
alter table public.analytics_events enable row level security;

revoke all on table public.players from anon, authenticated;
revoke all on table public.progress from anon, authenticated;
revoke all on table public.analytics_events from anon, authenticated;

grant select, insert, update, delete on table public.players to service_role;
grant select, insert, update, delete on table public.progress to service_role;
grant select, insert, update, delete on table public.analytics_events to service_role;
