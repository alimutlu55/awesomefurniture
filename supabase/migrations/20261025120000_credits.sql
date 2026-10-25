-- Credits: in-app coins people buy and spend on paid features (AI images, technical drawings, later more).
--
-- Every change to a balance is one row in an append-only ledger, written in the same transaction that changes
-- the account row, under that row's lock. Every write takes an idempotency key, so a retried request, a replayed
-- webhook or a crashed worker can never charge or credit twice. Only the server (service_role) calls the
-- functions below; people can read their own account, ledger, spends and orders and change nothing.
-- See docs/credits.md.

create table public.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Can go below zero only when a refund or chargeback takes back credits that were already spent.
  balance integer not null default 0,
  purchased_total integer not null default 0 check (purchased_total >= 0),
  spent_total integer not null default 0 check (spent_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  balance_after integer not null,
  kind text not null check (kind in ('purchase', 'spend', 'refund', 'reversal', 'restore', 'grant')),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  feature text,
  order_id uuid,
  spend_id uuid,
  description text not null check (length(description) between 1 and 200),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index credit_ledger_user_created on public.credit_ledger(user_id, created_at desc, id desc);

-- One row per use of a paid feature. A reservation takes the credits at once; settling captures it (the
-- result was delivered) or releases it (refunds the credits). Passes and free uses are spends that cost nothing.
create table public.credit_spends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature ~ '^[a-z][a-z0-9-]{1,47}$'),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  scope_key text check (length(scope_key) between 1 and 200),
  cost integer not null check (cost >= 0),
  charge text not null check (charge in ('paid', 'free', 'pass')),
  status text not null check (status in ('reserved', 'captured', 'released')),
  pass_expires_at timestamptz,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, idempotency_key),
  check ((charge = 'paid') = (cost > 0))
);
create index credit_spends_passes on public.credit_spends(user_id, feature, scope_key, pass_expires_at desc)
  where status <> 'released' and pass_expires_at is not null;
create index credit_spends_reserved on public.credit_spends(created_at) where status = 'reserved';
create index credit_spends_user_created on public.credit_spends(user_id, created_at desc);

-- A credit pack someone started to buy. Credits come only from a paid order, with the amount checked against it.
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  pack_id text not null check (pack_id ~ '^[a-z][a-z0-9-]{1,47}$'),
  credits integer not null check (credits > 0),
  amount integer not null check (amount > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  provider text not null check (provider ~ '^[a-z][a-z0-9-]{1,31}$'),
  provider_ref text check (length(provider_ref) between 1 and 255),
  provider_payment_ref text check (length(provider_payment_ref) between 1 and 255),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'refunded', 'partially_refunded', 'disputed', 'rejected')),
  credited integer not null default 0 check (credited >= 0),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  customer_email text check (length(customer_email) <= 320),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref),
  unique (provider, provider_payment_ref)
);
create index payment_orders_user_created on public.payment_orders(user_id, created_at desc);

-- Every provider event once: a replayed webhook is recognised and skipped.
create table public.payment_events (
  provider text not null,
  event_id text not null check (length(event_id) between 1 and 255),
  type text not null check (length(type) between 1 and 100),
  order_id uuid references public.payment_orders(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, event_id)
);

alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_spends enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_events enable row level security;

create policy credit_account_read on public.credit_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy credit_ledger_read on public.credit_ledger for select to authenticated using (user_id = (select auth.uid()));
create policy credit_spend_read on public.credit_spends for select to authenticated using (user_id = (select auth.uid()));
create policy payment_order_read on public.payment_orders for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.credit_accounts, public.credit_ledger, public.credit_spends, public.payment_orders, public.payment_events
  from anon, authenticated;
grant select on public.credit_accounts, public.credit_ledger, public.credit_spends, public.payment_orders to authenticated;

-- The ledger is history: no row is ever changed, and rows go only with the person (account deletion).
create function private.keep_ledger() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then return old; end if;
  raise exception 'The credit ledger is append-only' using errcode = '42501';
end;
$$;
revoke all on function private.keep_ledger() from public, anon, authenticated;
create trigger keep_ledger before update or delete on public.credit_ledger
  for each row execute function private.keep_ledger();

-- Adds one ledger row and moves the (already locked) balance with it. Returns the new balance.
create function private.credit_post(
  p_user uuid, p_delta integer, p_kind text, p_key text, p_description text,
  p_feature text default null, p_order uuid default null, p_spend uuid default null, p_metadata jsonb default '{}'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare next_balance integer;
begin
  update public.credit_accounts set balance = balance + p_delta,
    purchased_total = purchased_total + case when p_kind = 'purchase' then p_delta else 0 end,
    spent_total = greatest(0, spent_total + case when p_kind = 'spend' then -p_delta when p_kind = 'refund' then -p_delta else 0 end),
    updated_at = now()
  where user_id = p_user returning balance into next_balance;
  if next_balance is null then raise exception 'Credit account % is missing', p_user using errcode = 'P0002'; end if;
  insert into public.credit_ledger (user_id, delta, balance_after, kind, idempotency_key, feature, order_id, spend_id, description, metadata)
    values (p_user, p_delta, next_balance, p_kind, p_key, p_feature, p_order, p_spend, p_description, coalesce(p_metadata, '{}'));
  return next_balance;
end;
$$;

-- Creates the account if needed and locks it for this transaction. Every balance change starts here.
create function private.credit_lock(p_user uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare current_balance integer;
begin
  insert into public.credit_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  select balance into current_balance from public.credit_accounts where user_id = p_user for update;
  return current_balance;
end;
$$;
revoke all on function private.credit_post(uuid, integer, text, text, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.credit_lock(uuid) from public, anon, authenticated;

create function private.spend_result(s public.credit_spends, p_balance integer, p_replay boolean) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('status', s.status, 'spend_id', s.id, 'charge', s.charge, 'cost', s.cost,
    'balance', p_balance, 'pass_expires_at', s.pass_expires_at, 'replay', p_replay);
$$;
revoke all on function private.spend_result(public.credit_spends, integer, boolean) from public, anon, authenticated;

-- Uses a feature once. The server passes the catalog's price (src/domain/credits/credit-catalog.ts):
--   p_cost        credits a paid use takes
--   p_free_uses   uses that cost nothing, per person and feature (the first technical drawings)
--   p_pass_hours  a paid use opens a pass: more uses for the same p_scope_key (a design) cost nothing until it ends
--   p_capture     true: final at once; false: reserved until credits_settle captures or releases it
-- The same p_key returns the first result again instead of charging twice.
-- Returns {status: reserved|captured|insufficient, spend_id, charge: paid|free|pass, cost, balance, pass_expires_at, replay}.
create function public.credits_spend(
  p_user uuid, p_feature text, p_key text, p_cost integer, p_free_uses integer, p_pass_hours integer,
  p_scope_key text, p_capture boolean, p_metadata jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_balance integer;
  existing public.credit_spends;
  pass public.credit_spends;
  spend public.credit_spends;
  free_used integer;
  charge_kind text := 'paid';
  amount integer := p_cost;
  expires timestamptz;
begin
  if p_cost is null or p_cost < 1 or p_free_uses is null or p_free_uses < 0 or p_pass_hours is null or p_pass_hours < 0 then
    raise exception 'Invalid feature price' using errcode = '22023';
  end if;
  if p_pass_hours > 0 and p_scope_key is null then raise exception 'A pass needs a scope' using errcode = '22023'; end if;
  current_balance := private.credit_lock(p_user);
  select * into existing from public.credit_spends where user_id = p_user and idempotency_key = p_key;
  if found then
    if existing.feature <> p_feature then raise exception 'Idempotency key reused for another feature' using errcode = '22023'; end if;
    return private.spend_result(existing, current_balance, true);
  end if;
  if p_pass_hours > 0 then
    select * into pass from public.credit_spends
      where user_id = p_user and feature = p_feature and scope_key = p_scope_key and status <> 'released' and pass_expires_at > now()
      order by pass_expires_at desc limit 1;
    if found then charge_kind := 'pass'; amount := 0; expires := pass.pass_expires_at; end if;
  end if;
  if charge_kind = 'paid' then
    select count(*) into free_used from public.credit_spends
      where user_id = p_user and feature = p_feature and charge = 'free' and status <> 'released';
    if free_used < p_free_uses then charge_kind := 'free'; amount := 0; end if;
    if p_pass_hours > 0 then expires := now() + make_interval(hours => p_pass_hours); end if;
  end if;
  if amount > current_balance then
    return jsonb_build_object('status', 'insufficient', 'cost', amount, 'balance', current_balance, 'replay', false);
  end if;
  insert into public.credit_spends (user_id, feature, idempotency_key, scope_key, cost, charge, status, pass_expires_at, metadata, settled_at)
    values (p_user, p_feature, p_key, p_scope_key, amount, charge_kind, case when p_capture then 'captured' else 'reserved' end,
      expires, coalesce(p_metadata, '{}'), case when p_capture then now() end)
    returning * into spend;
  if amount > 0 then
    current_balance := private.credit_post(p_user, -amount, 'spend', 'spend:' || spend.id, p_feature, p_feature, null, spend.id);
  end if;
  return private.spend_result(spend, current_balance, false);
end;
$$;

-- Finishes a reservation: 'captured' keeps the credits, 'released' gives them back. Settling twice changes nothing.
create function public.credits_settle(p_spend uuid, p_outcome text, p_metadata jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  spend public.credit_spends;
  current_balance integer;
begin
  if p_outcome not in ('captured', 'released') then raise exception 'Unknown outcome %', p_outcome using errcode = '22023'; end if;
  select user_id into owner from public.credit_spends where id = p_spend;
  if owner is null then raise exception 'Unknown spend %', p_spend using errcode = 'P0002'; end if;
  current_balance := private.credit_lock(owner);
  select * into spend from public.credit_spends where id = p_spend for update;
  if spend.status <> 'reserved' then return private.spend_result(spend, current_balance, true); end if;
  update public.credit_spends set status = p_outcome, settled_at = now(), metadata = metadata || coalesce(p_metadata, '{}')
    where id = p_spend returning * into spend;
  if p_outcome = 'released' and spend.cost > 0 then
    current_balance := private.credit_post(owner, spend.cost, 'refund', 'refund:' || spend.id, spend.feature, spend.feature, null, spend.id);
  end if;
  return private.spend_result(spend, current_balance, false);
end;
$$;

-- Gives back reservations a crashed or timed-out request never settled. Runs from the Worker's schedule.
create function public.credits_release_stale(p_older_than_minutes integer default 15) returns integer
language plpgsql security definer set search_path = '' as $$
declare stale uuid; released integer := 0;
begin
  for stale in select id from public.credit_spends
    where status = 'reserved' and created_at < now() - make_interval(mins => greatest(p_older_than_minutes, 5)) limit 500
  loop
    if (public.credits_settle(stale, 'released', '{"reason":"stale"}') ->> 'replay')::boolean is false then released := released + 1; end if;
  end loop;
  return released;
end;
$$;

-- Starts buying a pack. The amount and credits come from the server's catalog, never from the browser.
create function public.credits_create_order(
  p_user uuid, p_pack text, p_credits integer, p_amount integer, p_currency text, p_provider text, p_email text default null
) returns public.payment_orders
language plpgsql security definer set search_path = '' as $$
declare created public.payment_orders;
begin
  if (select count(*) from public.payment_orders where user_id = p_user and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many checkouts started' using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;
  insert into public.payment_orders (user_id, pack_id, credits, amount, currency, provider, customer_email)
    values (p_user, p_pack, p_credits, p_amount, lower(p_currency), p_provider, p_email) returning * into created;
  return created;
end;
$$;

create function public.credits_attach_order(p_order uuid, p_provider_ref text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.payment_orders set provider_ref = p_provider_ref, updated_at = now()
    where id = p_order and (provider_ref is null or provider_ref = p_provider_ref);
  if not found then raise exception 'Order % already has another checkout', p_order using errcode = '22023'; end if;
end;
$$;

-- A provider confirmed payment: credit the order once. The paid amount and currency must equal the order's.
-- Returns {result: credited|already|mismatch|unknown, balance}.
create function public.credits_complete_order(
  p_order uuid, p_provider text, p_provider_ref text, p_payment_ref text, p_amount integer, p_currency text, p_email text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ord public.payment_orders;
  current_balance integer;
begin
  select * into ord from public.payment_orders where id = p_order for update;
  if not found or ord.provider <> p_provider or (ord.provider_ref is not null and ord.provider_ref <> p_provider_ref) then
    return jsonb_build_object('result', 'unknown');
  end if;
  if ord.status not in ('pending', 'expired') then return jsonb_build_object('result', 'already', 'status', ord.status); end if;
  if p_amount is distinct from ord.amount or lower(p_currency) is distinct from ord.currency then
    update public.payment_orders set status = 'rejected', updated_at = now(), provider_ref = coalesce(provider_ref, p_provider_ref),
      provider_payment_ref = p_payment_ref, note = format('Paid %s %s, expected %s %s', p_amount, p_currency, ord.amount, ord.currency)
      where id = p_order;
    return jsonb_build_object('result', 'mismatch');
  end if;
  if ord.user_id is null then return jsonb_build_object('result', 'unknown'); end if;
  current_balance := private.credit_lock(ord.user_id);
  current_balance := private.credit_post(ord.user_id, ord.credits, 'purchase', 'order:' || ord.id, 'Credit pack', null, ord.id, null,
    jsonb_build_object('pack', ord.pack_id, 'amount', ord.amount, 'currency', ord.currency, 'provider', ord.provider));
  update public.payment_orders set status = 'paid', credited = ord.credits, paid_at = now(), updated_at = now(),
    provider_ref = coalesce(provider_ref, p_provider_ref), provider_payment_ref = p_payment_ref,
    customer_email = coalesce(p_email, customer_email)
    where id = p_order;
  return jsonb_build_object('result', 'credited', 'balance', current_balance);
end;
$$;

-- A refund, chargeback or won dispute changes what an order is worth: its credits follow.
--   refunded / partially_refunded: credits in proportion to the amount kept
--   disputed: no credits while the chargeback stands; dispute_won: back to the amount kept
-- The balance may go below zero when the credits were already spent; spending then waits until it is positive.
create function public.credits_adjust_order(p_order uuid, p_event text, p_status text, p_refunded_amount integer default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ord public.payment_orders;
  refunded integer;
  target integer;
  next_status text;
  current_balance integer;
begin
  if p_status not in ('refunded', 'disputed', 'dispute_won') then raise exception 'Unknown order status %', p_status using errcode = '22023'; end if;
  select * into ord from public.payment_orders where id = p_order for update;
  if not found or ord.status not in ('paid', 'refunded', 'partially_refunded', 'disputed') then
    return jsonb_build_object('result', 'unknown');
  end if;
  refunded := least(ord.amount, greatest(ord.refunded_amount, coalesce(p_refunded_amount, 0)));
  target := case when p_status = 'disputed' then 0 else floor(ord.credits::numeric * (ord.amount - refunded) / ord.amount)::integer end;
  next_status := case when p_status = 'disputed' then 'disputed' when refunded >= ord.amount then 'refunded'
    when refunded > 0 then 'partially_refunded' else 'paid' end;
  if target <> ord.credited and ord.user_id is not null then
    current_balance := private.credit_lock(ord.user_id);
    current_balance := private.credit_post(ord.user_id, target - ord.credited, case when target < ord.credited then 'reversal' else 'restore' end,
      'order:' || ord.id || ':' || p_event, case when target < ord.credited then 'Payment refunded' else 'Payment restored' end,
      null, ord.id, null, jsonb_build_object('status', next_status, 'refunded_amount', refunded));
  end if;
  update public.payment_orders set status = next_status, refunded_amount = refunded, credited = target, updated_at = now() where id = p_order;
  return jsonb_build_object('result', 'adjusted', 'status', next_status, 'credited', target);
end;
$$;

create function public.credits_expire_order(p_order uuid) returns void
language sql security definer set search_path = '' as $$
  update public.payment_orders set status = 'expired', updated_at = now() where id = p_order and status = 'pending';
$$;

-- Records a provider event; false when it was already processed (a replay to skip).
create function public.credits_record_event(p_provider text, p_event text, p_type text, p_order uuid default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare done timestamptz;
begin
  insert into public.payment_events (provider, event_id, type, order_id) values (p_provider, p_event, p_type, p_order)
    on conflict (provider, event_id) do nothing;
  select processed_at into done from public.payment_events where provider = p_provider and event_id = p_event;
  return done is null;
end;
$$;

create function public.credits_event_processed(p_provider text, p_event text) returns void
language sql security definer set search_path = '' as $$
  update public.payment_events set processed_at = now() where provider = p_provider and event_id = p_event;
$$;

-- Support: give or take credits by hand, once per key (for example a ticket number).
create function public.credits_grant(p_user uuid, p_credits integer, p_key text, p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if p_credits = 0 then raise exception 'Grant a non-zero amount' using errcode = '22023'; end if;
  perform private.credit_lock(p_user);
  if exists (select 1 from public.credit_ledger where user_id = p_user and idempotency_key = 'grant:' || p_key) then
    return (select balance from public.credit_accounts where user_id = p_user);
  end if;
  return private.credit_post(p_user, p_credits, 'grant', 'grant:' || p_key, p_reason);
end;
$$;

-- What the wallet shows: balance, free uses taken, open passes and the latest ledger rows.
create function public.credits_summary(p_user uuid, p_history integer default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'balance', coalesce((select balance from public.credit_accounts where user_id = p_user), 0),
    'free_used', coalesce((select jsonb_object_agg(feature, used) from (select feature, count(*) used from public.credit_spends
      where user_id = p_user and charge = 'free' and status <> 'released' group by feature) f), '{}'),
    'passes', coalesce((select jsonb_agg(jsonb_build_object('feature', feature, 'scope', scope_key, 'expires_at', expires)) from (
      select feature, scope_key, max(pass_expires_at) expires from public.credit_spends
      where user_id = p_user and status <> 'released' and pass_expires_at > now() group by feature, scope_key) p), '[]'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'delta', delta, 'balance_after', balance_after, 'kind', kind,
      'feature', feature, 'description', description, 'created_at', created_at) order by created_at desc, id desc) from (
      select * from public.credit_ledger where user_id = p_user order by created_at desc, id desc limit least(greatest(p_history, 0), 100)) h), '[]'));
$$;

-- Operations: accounts whose balance is not the sum of their ledger. Must always be empty.
create function public.credits_audit() returns table (user_id uuid, balance integer, ledger_sum bigint)
language sql stable security definer set search_path = '' as $$
  select a.user_id, a.balance, coalesce(sum(l.delta), 0) from public.credit_accounts a
    left join public.credit_ledger l on l.user_id = a.user_id
    group by a.user_id, a.balance having a.balance <> coalesce(sum(l.delta), 0);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.credits_spend(uuid, text, text, integer, integer, integer, text, boolean, jsonb)',
    'public.credits_settle(uuid, text, jsonb)', 'public.credits_release_stale(integer)',
    'public.credits_create_order(uuid, text, integer, integer, text, text, text)', 'public.credits_attach_order(uuid, text)',
    'public.credits_complete_order(uuid, text, text, text, integer, text, text)', 'public.credits_adjust_order(uuid, text, text, integer)',
    'public.credits_expire_order(uuid)', 'public.credits_record_event(text, text, text, uuid)', 'public.credits_event_processed(text, text)',
    'public.credits_grant(uuid, integer, text, text)', 'public.credits_summary(uuid, integer)', 'public.credits_audit()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
