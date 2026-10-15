-- Disposable integration fixtures, rolled back at the end. Run on development.
begin;
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'owner@wardrobe-test.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'viewer@wardrobe-test.invalid');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
insert into public.design_sessions (id, owner_id, document) values
  ('session-access-fixture', '11111111-1111-4111-8111-111111111111',
   '{"schemaVersion":1,"id":"session-access-fixture","name":"Test design","units":"cm","wardrobes":[]}');
do $$ begin
  if (select count(*) from public.session_revisions where session_id = 'session-access-fixture') <> 1 then
    raise exception 'Initial revision missing';
  end if;
  begin
    update public.design_sessions set owner_id = '22222222-2222-4222-8222-222222222222'
      where id = 'session-access-fixture';
    raise exception 'Ownership mutation should have failed';
  exception when insufficient_privilege then null; end;
  begin
    update public.design_sessions set revision = 99 where id = 'session-access-fixture';
    raise exception 'Client revision mutation should have failed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.design_sessions where id = 'session-access-fixture') then
    raise exception 'Another account can see a private session';
  end if;
  begin
    insert into public.session_follows(follower_id, session_id) values
      ('22222222-2222-4222-8222-222222222222', 'session-access-fixture');
    raise exception 'Private session was followable';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.design_sessions(id, owner_id, document) values
      ('spoofed-owner', '11111111-1111-4111-8111-111111111111',
      '{"schemaVersion":1,"id":"spoofed-owner","name":"Bad","units":"cm","wardrobes":[]}');
    raise exception 'Owner spoofing was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
update public.design_sessions set visibility = 'public' where id = 'session-access-fixture' and revision = 1;
do $$ declare affected integer; begin
  update public.design_sessions set document = document || '{"name":"Stale write"}'
    where id = 'session-access-fixture' and revision = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale revision overwrote the design'; end if;
  if (select revision from public.design_sessions where id = 'session-access-fixture') <> 2 then
    raise exception 'Revision did not advance';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$ begin
  if not exists(select 1 from public.design_sessions where id = 'session-access-fixture') then
    raise exception 'Public session cannot be read anonymously';
  end if;
  begin
    perform 1 from public.session_revisions;
    raise exception 'Anonymous users can read history';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
insert into public.session_follows(follower_id, session_id) values
  ('22222222-2222-4222-8222-222222222222', 'session-access-fixture');
insert into public.creator_follows(follower_id, creator_id) values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');
do $$ declare affected integer; begin
  if exists(select 1 from public.session_revisions where session_id = 'session-access-fixture') then
    raise exception 'Viewer can read history';
  end if;
  update public.design_sessions set document = document || '{"name":"Attacker"}' where id = 'session-access-fixture';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Viewer can edit public design'; end if;
  begin
    insert into public.session_revisions(session_id, revision, document)
      values ('session-access-fixture', 99, '{}');
    raise exception 'Viewer can write history';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.session_follows where session_id = 'session-access-fixture') then
    raise exception 'Owner can see private subscriptions';
  end if;
end $$;
update public.design_sessions set visibility = 'private' where id = 'session-access-fixture' and revision = 2;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$ begin
  if exists(select 1 from public.design_sessions where id = 'session-access-fixture') then
    raise exception 'Sharing revocation did not remove access';
  end if;
end $$;
reset role;
rollback;
select 'PASS: ownership, public reads, history, following, CAS, and revocation' as result;
