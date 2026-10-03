create table public.star_payments (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  product_id text not null,
  currency text not null check (currency = 'XTR'),
  amount integer not null check (amount > 0),
  invoice_payload text unique not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'refunded')),
  pre_checkout_query_id text unique,
  telegram_payment_charge_id text unique,
  provider_payment_charge_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);

create index star_payments_player_status_idx
  on public.star_payments (player_id, status);

create table public.payment_support_requests (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  message_text text not null check (char_length(message_text) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.star_payments enable row level security;
alter table public.payment_support_requests enable row level security;

revoke all on table public.star_payments from anon, authenticated;
revoke all on table public.payment_support_requests from anon, authenticated;

grant select, insert, update, delete on table public.star_payments to service_role;
grant select, insert, update, delete on table public.payment_support_requests to service_role;
