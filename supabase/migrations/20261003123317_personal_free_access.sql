-- A server-managed entitlement, independent of public promotions and purchases.
alter table public.players add column free_access boolean not null default false;
comment on column public.players.free_access is 'Personal free access to published stories and episode rewinds. Managed only by the service role.';

-- Existing RLS and table grants already restrict this table to the service role.
-- Grant personal access separately to a verified account; never hardcode its ID here.
