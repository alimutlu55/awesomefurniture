-- Disposable integration fixtures for moving a guest's designs and credits into an account, rolled back at the end.
begin;
insert into auth.users (id, email, is_anonymous) values
  ('55555555-5555-4555-8555-555555555555', null, true),
  ('66666666-6666-4666-8666-666666666666', 'account@wardrobe-test.invalid', false),
  ('77777777-7777-4777-8777-777777777777', 'stranger@wardrobe-test.invalid', false);

-- The guest owns two designs (one deleted) and has credits; the account owns one design.
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
set local role authenticated;
insert into public.design_sessions (id, owner_id, document) values
  ('merge-guest-a', '55555555-5555-4555-8555-555555555555', '{"schemaVersion":1,"id":"merge-guest-a","name":"Guest A","units":"cm","wardrobes":[]}'),
  ('merge-guest-b', '55555555-5555-4555-8555-555555555555', '{"schemaVersion":1,"id":"merge-guest-b","name":"Guest B","units":"cm","wardrobes":[]}');
update public.design_sessions set document = '{"schemaVersion":1,"id":"merge-guest-a","name":"Guest A edited","units":"cm","wardrobes":[]}'
  where id = 'merge-guest-a';
update public.design_sessions set deleted_at = now() where id = 'merge-guest-b';
reset role;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
set local role authenticated;
insert into public.design_sessions (id, owner_id, document) values
  ('merge-account-a', '66666666-6666-4666-8666-666666666666', '{"schemaVersion":1,"id":"merge-account-a","name":"Account A","units":"cm","wardrobes":[]}');
reset role;
select public.credits_grant('55555555-5555-4555-8555-555555555555', 12, 'merge-test', 'Test credits');
select public.credits_grant('66666666-6666-4666-8666-666666666666', 30, 'merge-test', 'Test credits');
select public.credits_spend('55555555-5555-4555-8555-555555555555', 'technical-drawings', 'drawings-merge-0001', 10, 1, 24, 'merge-guest-a', true);

-- Only the server may merge, and only a guest into a permanent account.
do $$ begin
  begin
    perform public.account_merge('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666');
    raise exception 'An account was merged as if it were a guest';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.account_merge('55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555');
    raise exception 'A guest was merged into itself';
  exception when invalid_parameter_value then null; end;
end $$;
set local role authenticated;
do $$ begin
  perform public.account_merge('55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666');
  raise exception 'A browser could call account_merge';
exception when insufficient_privilege then null; end $$;
reset role;

do $$
declare result jsonb; again jsonb; before_revision integer; before_updated timestamptz;
begin
  select revision, updated_at into before_revision, before_updated from public.design_sessions where id = 'merge-guest-a';
  result := public.account_merge('55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666');
  if (result->>'designs')::int <> 1 or (result->>'credits')::int <> 12 then raise exception 'Merge reported %', result; end if;
  if exists (select 1 from public.design_sessions where owner_id = '55555555-5555-4555-8555-555555555555') then
    raise exception 'A design stayed with the guest';
  end if;
  if (select count(*) from public.design_sessions where owner_id = '66666666-6666-4666-8666-666666666666') <> 3 then
    raise exception 'The account does not own every design';
  end if;
  if (select revision from public.design_sessions where id = 'merge-guest-a') <> before_revision
    or (select updated_at from public.design_sessions where id = 'merge-guest-a') <> before_updated then
    raise exception 'A transfer changed the revision or the date';
  end if;
  if (select count(*) from public.session_revisions where session_id = 'merge-guest-a') <> 2 then
    raise exception 'A transfer added or lost a snapshot';
  end if;
  if (select balance from public.credit_accounts where user_id = '55555555-5555-4555-8555-555555555555') <> 0
    or (select balance from public.credit_accounts where user_id = '66666666-6666-4666-8666-666666666666') <> 42 then
    raise exception 'Credits did not move';
  end if;
  if exists (select 1 from public.credits_audit()) then raise exception 'A balance differs from its ledger'; end if;
  -- The free drawing set and its pass follow the design.
  if (public.credits_spend('66666666-6666-4666-8666-666666666666', 'technical-drawings', 'drawings-merge-0002', 10, 1, 24, 'merge-guest-a', true)->>'charge') <> 'pass' then
    raise exception 'The guest''s pass did not follow the design';
  end if;
  again := public.account_merge('55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666');
  if (again->>'designs')::int <> 0 or (again->>'credits')::int <> 0 then raise exception 'A second merge moved more: %', again; end if;
end $$;

-- The account keeps saving the moved design against the same revision; a stranger still cannot see it.
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
set local role authenticated;
do $$ begin
  update public.design_sessions set document = '{"schemaVersion":1,"id":"merge-guest-a","name":"Saved by the account","units":"cm","wardrobes":[]}'
    where id = 'merge-guest-a' and revision = 2;
  if not found then raise exception 'The account could not save the moved design'; end if;
  begin
    update public.design_sessions set owner_id = '77777777-7777-4777-8777-777777777777' where id = 'merge-guest-a';
    raise exception 'A client changed the owner';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.design_sessions where id like 'merge-%') then raise exception 'A stranger can see moved designs'; end if;
end $$;
reset role;
select 'account merge checks passed' as result;
rollback;
