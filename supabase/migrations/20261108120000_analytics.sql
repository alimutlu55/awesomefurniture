-- Product analytics (docs/analytics.md). One append-only event table written only by the Worker (service_role), and
-- an `analytics` schema of views for the owner, read in Supabase Studio. Nothing here is reachable from a browser:
-- the table has row level security with no policies, and the schema is not granted to anon or authenticated.

create table public.analytics_events (
  id uuid primary key,
  event text not null check (event ~ '^[a-z][a-z0-9_]{2,63}$'),
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  source text not null default 'browser' check (source in ('browser', 'server')),
  anonymous_id text not null check (length(anonymous_id) between 8 and 128),
  user_id uuid references auth.users(id) on delete set null,
  is_anonymous boolean not null default true,
  client_session_id text check (length(client_session_id) between 8 and 128),
  design_id text check (length(design_id) between 1 and 128),
  locale text check (length(locale) between 2 and 16),
  country text check (length(country) = 2),
  currency text check (currency in ('pln', 'eur', 'usd')),
  viewport text check (viewport in ('phone', 'tablet', 'desktop')),
  entry_source text check (entry_source in ('direct', 'marketing_page', 'shared_session', 'design_link', 'spec_link', 'external')),
  referrer_path text check (length(referrer_path) <= 200),
  properties jsonb not null default '{}'
    check (jsonb_typeof(properties) = 'object' and octet_length(properties::text) <= 8192)
);
create index analytics_events_event_time on public.analytics_events(event, occurred_at desc);
create index analytics_events_time on public.analytics_events(occurred_at);
create index analytics_events_anonymous_time on public.analytics_events(anonymous_id, occurred_at);
create index analytics_events_user_time on public.analytics_events(user_id, occurred_at desc) where user_id is not null;
create index analytics_events_design_time on public.analytics_events(design_id, occurred_at desc) where design_id is not null;

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from public, anon, authenticated;
grant select, insert on public.analytics_events to service_role;

-- Events are kept for 13 months, then removed by the Worker's schedule (src/app/api-router.ts, sweepCredits).
create function public.analytics_prune() returns integer
language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from public.analytics_events where occurred_at < now() - interval '13 months';
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke all on function public.analytics_prune() from public, anon, authenticated;
grant execute on function public.analytics_prune() to service_role;

create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;
grant usage on schema analytics to service_role;

-- Checkouts, payments, refunds and disputes per day, currency and pack. Amounts are in major units of that currency.
create view analytics.daily_revenue_funnel as
select
  date_trunc('day', created_at) as day, currency, pack_id,
  count(*) as checkouts_started,
  count(*) filter (where status in ('paid', 'partially_refunded', 'refunded', 'disputed')) as orders_paid,
  count(*) filter (where status = 'expired') as orders_expired,
  count(*) filter (where status = 'rejected') as orders_rejected_mismatch,
  count(*) filter (where status in ('refunded', 'partially_refunded')) as orders_refunded,
  count(*) filter (where status = 'disputed') as orders_disputed,
  round(100.0 * count(*) filter (where status in ('paid', 'partially_refunded', 'refunded', 'disputed')) / nullif(count(*), 0), 2)
    as checkout_conversion_pct,
  coalesce(sum(amount) filter (where status in ('paid', 'partially_refunded', 'refunded', 'disputed')), 0) / 100.0 as gross_revenue,
  coalesce(sum(amount - refunded_amount) filter (where status in ('paid', 'partially_refunded')), 0) / 100.0 as net_revenue_before_fees,
  sum(credited) as net_credits_issued
from public.payment_orders
group by 1, 2, 3;

-- AI images per day: delivered, failed and why, and Google's token counts (the field names Google reports).
create view analytics.ai_image_unit_economics as
with spends as (
  select created_at, status, metadata->>'reason' as reason,
    coalesce(metadata->>'total_input_tokens', metadata->>'input_tokens')::numeric as input_tokens,
    coalesce(metadata->>'total_output_tokens', metadata->>'output_tokens')::numeric as output_tokens,
    coalesce(metadata->>'total_thought_tokens', metadata->>'thought_tokens')::numeric as thought_tokens,
    (metadata->>'total_tokens')::numeric as total_tokens
  from public.credit_spends where feature = 'ai-image'
)
select
  date_trunc('day', created_at) as day,
  count(*) as total_attempts,
  count(*) filter (where status = 'captured') as delivered_images,
  count(*) filter (where status = 'released') as failed_or_cancelled,
  count(*) filter (where status = 'reserved') as still_reserved,
  count(*) filter (where reason = 'cancelled') as user_cancelled,
  count(*) filter (where reason = 'timeout') as timed_out,
  count(*) filter (where reason = 'stale') as worker_stale_released,
  count(*) filter (where status = 'released' and reason not in ('cancelled', 'timeout', 'stale', 'mock')) as provider_failures,
  round(100.0 * count(*) filter (where status = 'captured') / nullif(count(*), 0), 2) as delivery_success_pct,
  round(avg(input_tokens) filter (where status = 'captured'), 0) as avg_input_tokens,
  round(avg(output_tokens) filter (where status = 'captured'), 0) as avg_output_tokens,
  round(avg(thought_tokens) filter (where status = 'captured'), 0) as avg_thought_tokens,
  round(avg(total_tokens) filter (where status = 'captured'), 0) as avg_total_tokens,
  max(total_tokens) filter (where status = 'captured') as max_total_tokens
from spends
group by 1;

-- How the free first set of technical drawings turns into buying credits, by the week of that free set.
create view analytics.drawing_trial_conversion as
with trial as (
  select user_id, min(created_at) as first_free_drawing_at from public.credit_spends
  where feature = 'technical-drawings' and charge = 'free' and status = 'captured'
  group by user_id
)
select
  date_trunc('week', t.first_free_drawing_at) as cohort_week,
  count(*) as users_used_free_drawing,
  count(*) filter (where exists (select 1 from public.payment_orders p where p.user_id = t.user_id
    and p.status in ('paid', 'partially_refunded') and p.paid_at >= t.first_free_drawing_at)) as users_later_purchased_credits,
  count(*) filter (where exists (select 1 from public.credit_spends s where s.user_id = t.user_id
    and s.charge = 'paid' and s.status = 'captured' and s.created_at > t.first_free_drawing_at)) as users_later_spent_paid_credits,
  round(100.0 * count(*) filter (where exists (select 1 from public.payment_orders p where p.user_id = t.user_id
    and p.status in ('paid', 'partially_refunded') and p.paid_at >= t.first_free_drawing_at)) / nullif(count(*), 0), 2) as trial_to_purchase_pct
from trial t
group by 1;

-- What saved designs contain: wardrobes and kitchens, pieces, edit depth and sharing, by the day they were made.
create view analytics.design_portfolio_stats as
with designs as (
  select s.*, jsonb_array_length(s.document->'wardrobes') as pieces, u.is_anonymous
  from public.design_sessions s left join auth.users u on u.id = s.owner_id
  where s.deleted_at is null
)
select
  date_trunc('day', created_at) as created_day,
  count(*) as total_sessions,
  count(*) filter (where pieces > 0) as sessions_with_furniture,
  count(*) filter (where revision > 1) as multi_revision_sessions,
  count(*) filter (where visibility = 'public') as shared_sessions,
  count(*) filter (where is_anonymous is false) as owned_by_registered_account,
  round(avg(pieces) filter (where pieces > 0), 2) as avg_pieces_per_active_design,
  round(avg(revision) filter (where pieces > 0), 1) as avg_revisions_per_active_design,
  count(*) filter (where exists (select 1 from jsonb_array_elements(document->'wardrobes') w
    where coalesce(w->>'product', 'wardrobe') = 'wardrobe')) as designs_with_wardrobe,
  count(*) filter (where exists (select 1 from jsonb_array_elements(document->'wardrobes') w
    where w->>'product' = 'kitchen')) as designs_with_kitchen
from designs
group by 1;

-- The North Star: designs a week that reached something a person can make, show or share. The events are the ones
-- marked `realizes` in src/domain/analytics/analytics-events.ts (tests/architecture/analytics.test.ts keeps them equal).
create view analytics.weekly_realized_designs as
select
  date_trunc('week', occurred_at) as week,
  count(distinct design_id) as realized_designs,
  count(distinct design_id) filter (where event = 'drawings_opened') as with_manufacturable_drawings,
  count(distinct design_id) filter (where event = 'drawings_pdf_exported') as with_drawings_pdf,
  count(distinct design_id) filter (where event = 'make_export_saved') as with_make_export,
  count(distinct design_id) filter (where event = 'ai_image_generation_completed') as with_ai_image,
  count(distinct design_id) filter (where event = 'design_shared') as shared,
  count(distinct anonymous_id) as people
from public.analytics_events
where design_id is not null
  and (event in ('drawings_pdf_exported', 'make_export_saved', 'ai_image_generation_completed', 'design_shared')
    or (event = 'drawings_opened' and properties->>'ready_for_manufacture' = 'true'))
group by 1;

-- Events a day, with how many browsers sent them: the quickest look at what is used.
create view analytics.daily_events as
select date_trunc('day', occurred_at) as day, event, count(*) as events, count(distinct anonymous_id) as browsers,
  count(distinct anonymous_id) filter (where is_anonymous) as guest_browsers
from public.analytics_events group by 1, 2;

-- The funnel by the week a browser first opened the editor: started → real edit → realized → account → paid.
create view analytics.weekly_activation_funnel as
with firsts as (
  select anonymous_id, min(occurred_at) as first_seen from public.analytics_events
  where event = 'editor_session_started' group by anonymous_id
), reached as (
  select f.anonymous_id, f.first_seen,
    bool_or(e.event = 'design_first_work_committed') as worked,
    bool_or(e.event in ('drawings_pdf_exported', 'make_export_saved', 'ai_image_generation_completed', 'design_shared')
      or (e.event = 'drawings_opened' and e.properties->>'ready_for_manufacture' = 'true')) as realized,
    bool_or(e.event = 'credit_gate_triggered') as hit_gate,
    bool_or(e.is_anonymous is false) as signed_in,
    bool_or(e.event = 'wallet_pack_selected') as chose_pack,
    array_remove(array_agg(distinct e.user_id), null) as users
  from firsts f join public.analytics_events e on e.anonymous_id = f.anonymous_id and e.source = 'browser'
  group by 1, 2
)
select
  date_trunc('week', first_seen) as cohort_week,
  count(*) as opened_editor,
  count(*) filter (where worked) as made_real_edit,
  count(*) filter (where realized) as realized_design,
  count(*) filter (where hit_gate) as hit_credit_gate,
  count(*) filter (where signed_in) as signed_in,
  count(*) filter (where chose_pack) as chose_pack,
  count(*) filter (where exists (select 1 from public.analytics_events p
    where p.event = 'payment_settled' and p.user_id = any(r.users))) as paid,
  round(100.0 * count(*) filter (where worked) / nullif(count(*), 0), 2) as meaningful_design_pct
from reached r
group by 1;

-- Day 1, 7 and 30 return of browsers, by the day they first opened the editor and whether they were a guest then.
create view analytics.retention_cohorts as
with sessions as (
  select anonymous_id, occurred_at, is_anonymous from public.analytics_events where event = 'editor_session_started'
), firsts as (
  select distinct on (anonymous_id) anonymous_id, occurred_at as first_seen, is_anonymous as guest_at_start
  from sessions order by anonymous_id, occurred_at
)
select
  date_trunc('day', f.first_seen) as cohort_day, f.guest_at_start,
  count(*) as browsers,
  count(*) filter (where exists (select 1 from sessions s where s.anonymous_id = f.anonymous_id
    and s.occurred_at >= f.first_seen + interval '1 day' and s.occurred_at < f.first_seen + interval '2 days')) as returned_d1,
  count(*) filter (where exists (select 1 from sessions s where s.anonymous_id = f.anonymous_id
    and s.occurred_at >= f.first_seen + interval '7 days' and s.occurred_at < f.first_seen + interval '8 days')) as returned_d7,
  count(*) filter (where exists (select 1 from sessions s where s.anonymous_id = f.anonymous_id
    and s.occurred_at >= f.first_seen + interval '30 days' and s.occurred_at < f.first_seen + interval '31 days')) as returned_d30
from firsts f
group by 1, 2;

-- Which manufacturing rules stop drawing sets from being issued, a week.
create view analytics.manufacturing_check as
select
  date_trunc('week', occurred_at) as week,
  count(*) as drawing_opens,
  count(*) filter (where properties->>'ready_for_manufacture' = 'true') as ready_for_manufacture,
  round(100.0 * count(*) filter (where properties->>'ready_for_manufacture' = 'true') / nullif(count(*), 0), 2) as pass_rate_pct
from public.analytics_events where event = 'drawings_opened'
group by 1;
create view analytics.blocking_rules as
select date_trunc('week', e.occurred_at) as week, rule.value as rule_id, count(*) as drawing_opens_blocked
from public.analytics_events e, jsonb_array_elements_text(e.properties->'blocking_rule_ids') rule
where e.event = 'drawings_opened' and jsonb_typeof(e.properties->'blocking_rule_ids') = 'array'
group by 1, 2;

revoke all on all tables in schema analytics from public, anon, authenticated;
grant select on all tables in schema analytics to service_role;
