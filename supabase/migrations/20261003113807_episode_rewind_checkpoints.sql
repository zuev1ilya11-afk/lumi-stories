create table public.episode_checkpoints (
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
  unique (player_id, story_id, season_id, episode_id)
);

create index episode_checkpoints_player_story_idx
  on public.episode_checkpoints (player_id, story_id, season_id);

alter table public.episode_checkpoints enable row level security;
revoke all on table public.episode_checkpoints from anon, authenticated;
grant select, insert, update, delete on table public.episode_checkpoints to service_role;

insert into public.episode_checkpoints (
  player_id,
  story_id,
  season_id,
  episode_id,
  scene_id,
  junho_score,
  taeyun_score,
  truth_score,
  risk_score,
  flags,
  updated_at
)
select
  p.player_id,
  p.story_id,
  p.season_id,
  'last-online-s1-e2',
  'ep2_morning',
  (case when p.flags->>'first_impression' = 'warm' then 1 else 0 end)
    + (case when coalesce((p.flags->>'avoided_gossip')::boolean, false) then 1 else 0 end)
    + (case when coalesce((p.flags->>'told_junho_soa')::boolean, false) then 2 else 0 end)
    + (case when coalesce((p.flags->>'trusted_junho_warning')::boolean, false) then 2 else 0 end)
    + (case when coalesce((p.flags->>'photo_called_junho')::boolean, false) then 1 else 0 end),
  0,
  (case when p.flags->>'first_impression' = 'guarded' then 1 else 0 end)
    + (case when coalesce((p.flags->>'deep_scandal_search')::boolean, false) then 2 else 0 end)
    + (case when coalesce((p.flags->>'basic_scandal_search')::boolean, false) then 1 else 0 end)
    + (case when coalesce((p.flags->>'hid_soa_message')::boolean, false) then 1 else 0 end)
    + (case when coalesce((p.flags->>'replied_soa')::boolean, false) then 2 else 0 end)
    + (case when coalesce((p.flags->>'evaded_junho')::boolean, false) then 1 else 0 end)
    + (case when coalesce((p.flags->>'photo_saved')::boolean, false) then 1 else 0 end),
  (case when p.flags->>'first_impression' = 'cold' then 1 else 0 end)
    + (case when coalesce((p.flags->>'deep_scandal_search')::boolean, false) then 1 else 0 end)
    + (case when coalesce((p.flags->>'hid_soa_message')::boolean, false) then 1 else 0 end)
    + (case when coalesce((p.flags->>'replied_soa')::boolean, false) then 1 else 0 end)
    + (case when coalesce((p.flags->>'evaded_junho')::boolean, false) then 1 else 0 end)
    + (case when coalesce((p.flags->>'photo_replied_soa')::boolean, false) then 1 else 0 end),
  coalesce((
    select jsonb_object_agg(entry.key, entry.value)
    from jsonb_each(p.flags) as entry
    where entry.key = any (array[
      'first_impression',
      'deep_scandal_search',
      'basic_scandal_search',
      'avoided_gossip',
      'told_junho_soa',
      'hid_soa_message',
      'replied_soa',
      'trusted_junho_warning',
      'evaded_junho',
      'photo_called_junho',
      'photo_saved',
      'photo_replied_soa'
    ])
  ), '{}'::jsonb),
  now()
from public.progress p
where p.story_id = 'last-online'
  and p.season_id = 'season-1'
  and p.episode_id = 'last-online-s1-e2'
on conflict (player_id, story_id, season_id, episode_id) do nothing;
