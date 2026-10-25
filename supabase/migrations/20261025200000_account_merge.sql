-- Signing in keeps what a person made as a guest in this browser. Their designs, credits, passes, open orders and
-- follows move from the guest identity to the account in one transaction. Only the server (service_role) calls
-- account_merge, after proving the person holds both identities (src/infrastructure/account). See docs/accounts.md.

-- The ledger records a move of credits as a pair of rows: out of the guest, into the account.
alter table public.credit_ledger drop constraint credit_ledger_kind_check;
alter table public.credit_ledger add constraint credit_ledger_kind_check
  check (kind in ('purchase', 'spend', 'refund', 'reversal', 'restore', 'grant', 'transfer'));

-- A design's owner still never changes, except inside account_merge: it sets a transaction-local flag that a client
-- cannot set through the API, and it runs as the function's owner, never as anon or authenticated. The design, its
-- revision and its dates stay as they were, so open editors keep saving against the same revision.
create or replace function private.version_session() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and current_setting('app.session_transfer', true) = 'on'
    and current_user not in ('anon', 'authenticated') then
    if new.id is distinct from old.id or new.document is distinct from old.document then
      raise exception 'A transfer changes only the owner' using errcode = '42501';
    end if;
    new.revision := old.revision;
    new.created_at := old.created_at;
    new.updated_at := old.updated_at;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.created_at := now();
  else
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
      raise exception 'Session ownership and ID are immutable' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- Every other update raises the revision (version_session), so an unchanged revision is a transfer: no new snapshot.
create or replace function private.capture_session_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.revision = old.revision then return new; end if;
  if auth.uid() is null or auth.uid() <> new.owner_id then
    raise exception 'An authenticated owner is required' using errcode = '42501';
  end if;
  insert into public.session_revisions (session_id, revision, document, created_at)
    values (new.id, new.revision, new.document, new.updated_at);
  return new;
end;
$$;

-- Moves everything a guest owns to a permanent account. Merging the same guest again moves nothing more.
-- Returns {designs, credits}: the designs (not deleted) and the credit balance that moved, for the welcome message.
create function public.account_merge(p_guest uuid, p_account uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  designs integer := 0;
  moved integer := 0;
  guest_balance integer;
  transfer uuid := gen_random_uuid();
begin
  if p_guest is null or p_account is null or p_guest = p_account then
    raise exception 'A merge needs two different identities' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_guest and is_anonymous) then
    raise exception 'Only a guest identity can be merged' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_account and not is_anonymous) then
    raise exception 'Designs move only into a permanent account' using errcode = '22023';
  end if;

  perform set_config('app.session_transfer', 'on', true);
  with moved_designs as (
    update public.design_sessions set owner_id = p_account where owner_id = p_guest returning deleted_at
  ) select count(*) filter (where deleted_at is null) into designs from moved_designs;
  perform set_config('app.session_transfer', 'off', true);

  -- Follows come along, except following one's own design or oneself.
  insert into public.session_follows (follower_id, session_id, created_at)
    select p_account, f.session_id, f.created_at from public.session_follows f
    where f.follower_id = p_guest
      and not exists (select 1 from public.design_sessions s where s.id = f.session_id and s.owner_id = p_account)
    on conflict do nothing;
  delete from public.session_follows where follower_id = p_guest;
  insert into public.creator_follows (follower_id, creator_id, created_at)
    select p_account, creator_id, created_at from public.creator_follows where follower_id = p_guest and creator_id <> p_account
    on conflict do nothing;
  insert into public.creator_follows (follower_id, creator_id, created_at)
    select follower_id, p_account, created_at from public.creator_follows where creator_id = p_guest and follower_id <> p_account
    on conflict do nothing;
  delete from public.creator_follows where follower_id = p_guest or creator_id = p_guest;

  -- Credits: the balance moves as two ledger rows. Both accounts are locked in a fixed order, so two merges never
  -- wait on each other, and the guest's balance is then zero, so merging again moves nothing.
  if exists (select 1 from public.credit_accounts where user_id = p_guest) then
    perform private.credit_lock(least(p_guest, p_account));
    perform private.credit_lock(greatest(p_guest, p_account));
    select balance into guest_balance from public.credit_accounts where user_id = p_guest;
    if guest_balance <> 0 then
      perform private.credit_post(p_guest, -guest_balance, 'transfer', 'transfer:' || transfer, 'Moved to your account',
        null, null, null, jsonb_build_object('to', p_account));
      perform private.credit_post(p_account, guest_balance, 'transfer', 'transfer:' || transfer, 'Credits from this browser',
        null, null, null, jsonb_build_object('from', p_guest));
      moved := guest_balance;
    end if;
  end if;
  -- Passes and free uses keep counting for the account; an order still being paid credits the account.
  update public.credit_spends s set user_id = p_account where s.user_id = p_guest
    and not exists (select 1 from public.credit_spends a where a.user_id = p_account and a.idempotency_key = s.idempotency_key);
  update public.payment_orders set user_id = p_account where user_id = p_guest;

  return jsonb_build_object('designs', designs, 'credits', moved);
end;
$$;
revoke all on function public.account_merge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_merge(uuid, uuid) to service_role;
