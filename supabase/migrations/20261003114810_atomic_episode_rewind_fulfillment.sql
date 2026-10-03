create or replace function public.fulfill_episode_rewind(
  p_payment_id uuid,
  p_player_id uuid,
  p_episode_id text,
  p_scene_id text,
  p_junho_score integer,
  p_taeyun_score integer,
  p_truth_score integer,
  p_risk_score integer,
  p_flags jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed boolean;
begin
  update public.star_payments
  set fulfilled_at = now()
  where id = p_payment_id
    and player_id = p_player_id
    and product_id = 'episode-rewind:' || p_episode_id
    and status = 'paid'
    and fulfilled_at is null
  returning true into claimed;

  if not coalesce(claimed, false) then
    return false;
  end if;

  insert into public.progress (
    player_id, story_id, season_id, episode_id, scene_id,
    junho_score, taeyun_score, truth_score, risk_score, flags, updated_at
  )
  values (
    p_player_id, 'last-online', 'season-1', p_episode_id, p_scene_id,
    p_junho_score, p_taeyun_score, p_truth_score, p_risk_score,
    coalesce(p_flags, '{}'::jsonb), now()
  )
  on conflict (player_id, story_id, season_id)
  do update set
    episode_id = excluded.episode_id,
    scene_id = excluded.scene_id,
    junho_score = excluded.junho_score,
    taeyun_score = excluded.taeyun_score,
    truth_score = excluded.truth_score,
    risk_score = excluded.risk_score,
    flags = excluded.flags,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke execute on function public.fulfill_episode_rewind(
  uuid, uuid, text, text, integer, integer, integer, integer, jsonb
) from public, anon, authenticated;

grant execute on function public.fulfill_episode_rewind(
  uuid, uuid, text, text, integer, integer, integer, integer, jsonb
) to service_role;
