-- Relational access metadata + versioned, registry-independent design payloads.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.design_sessions (
  id text primary key check (length(id) between 1 and 128),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document jsonb not null,
  name text generated always as (document->>'name') stored,
  schema_version integer generated always as ((document->>'schemaVersion')::integer) stored,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint design_envelope check (
    jsonb_typeof(document) = 'object'
    and document ?& array['id', 'name', 'schemaVersion', 'units', 'wardrobes']
    and jsonb_typeof(document->'id') = 'string' and document->>'id' = id
    and jsonb_typeof(document->'name') = 'string'
    and length(btrim(document->>'name')) between 1 and 120
    and jsonb_typeof(document->'schemaVersion') = 'number' and schema_version > 0
    and document->>'units' = 'cm'
    and jsonb_typeof(document->'wardrobes') = 'array'
    and octet_length(document::text) <= 2097152
  )
);
create index design_sessions_owner_updated on public.design_sessions(owner_id, updated_at desc, id);
create index design_sessions_public_updated on public.design_sessions(updated_at desc, id)
  where visibility = 'public' and deleted_at is null;

create table public.session_revisions (
  session_id text not null references public.design_sessions(id) on delete cascade,
  revision integer not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, revision)
);
create table public.session_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null references public.design_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, session_id)
);
create index session_follows_session on public.session_follows(session_id);
create table public.creator_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);
create index creator_follows_creator on public.creator_follows(creator_id);

alter table public.design_sessions enable row level security;
alter table public.session_revisions enable row level security;
alter table public.session_follows enable row level security;
alter table public.creator_follows enable row level security;

create policy session_read on public.design_sessions for select to anon, authenticated
  using (owner_id = (select auth.uid()) or (visibility = 'public' and deleted_at is null));
create policy session_create on public.design_sessions for insert to authenticated
  with check (owner_id = (select auth.uid()) and visibility = 'private' and deleted_at is null);
create policy session_update on public.design_sessions for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy revision_read on public.session_revisions for select to authenticated
  using (exists (select 1 from public.design_sessions s
    where s.id = session_id and s.owner_id = (select auth.uid())));
create policy follow_read on public.session_follows for select to authenticated
  using (follower_id = (select auth.uid()));
create policy follow_create on public.session_follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and exists (
    select 1 from public.design_sessions s where s.id = session_id
      and s.visibility = 'public' and s.deleted_at is null and s.owner_id <> (select auth.uid())
  ));
create policy follow_remove on public.session_follows for delete to authenticated
  using (follower_id = (select auth.uid()));
create policy creator_follow_read on public.creator_follows for select to authenticated
  using (follower_id = (select auth.uid()));
create policy creator_follow_create on public.creator_follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and exists (
    select 1 from public.design_sessions s where s.owner_id = creator_id
      and s.visibility = 'public' and s.deleted_at is null
  ));
create policy creator_follow_remove on public.creator_follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- Replace Supabase's default table grants with the exact client API.
revoke all on public.design_sessions, public.session_revisions,
  public.session_follows, public.creator_follows from anon, authenticated;
grant select on public.design_sessions to anon, authenticated;
grant insert (id, owner_id, document) on public.design_sessions to authenticated;
grant update (document, visibility, deleted_at) on public.design_sessions to authenticated;
grant select on public.session_revisions to authenticated;
grant select, delete on public.session_follows, public.creator_follows to authenticated;
grant insert (follower_id, session_id) on public.session_follows to authenticated;
grant insert (follower_id, creator_id) on public.creator_follows to authenticated;

create function private.version_session() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
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

-- A trigger alone can append history. Clients cannot mutate previous snapshots.
create function private.capture_session_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() <> new.owner_id then
    raise exception 'An authenticated owner is required' using errcode = '42501';
  end if;
  insert into public.session_revisions (session_id, revision, document, created_at)
    values (new.id, new.revision, new.document, new.updated_at);
  return new;
end;
$$;
revoke all on function private.version_session() from public, anon, authenticated;
revoke all on function private.capture_session_revision() from public, anon, authenticated;
create trigger version_session before insert or update on public.design_sessions
  for each row execute function private.version_session();
create trigger capture_session_revision after insert or update on public.design_sessions
  for each row execute function private.capture_session_revision();
