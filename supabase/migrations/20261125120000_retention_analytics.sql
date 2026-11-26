-- Retention and growth-direction views (docs/analytics.md, "Deciding retention and growth"). Read-only views over
-- public.analytics_events in the owner-only `analytics` schema, like 20261108120000_analytics.sql: nothing here is
-- reachable from a browser. They read the events added in November 2026: visit history on editor_session_started,
-- editor_session_summary, furniture_category_opened / furniture_room_filtered, the category on furniture_piece_added,
-- and no_plan_reason on auto_design_proposals_generated.

-- Use the latest summary per tab. Browser-supplied properties can be missing or malformed.
create view analytics.visits with (security_invoker = true) as
select distinct on (anonymous_id, coalesce(client_session_id, id::text))
  anonymous_id, client_session_id, occurred_at as ended_at, viewport, entry_source, country, is_anonymous,
  (case when pg_input_is_valid(properties->>'visit_number', 'integer') then (properties->>'visit_number')::int end) as visit_number,
  (case when pg_input_is_valid(properties->>'duration_s', 'integer') then (properties->>'duration_s')::int end) as duration_s,
  properties->>'stage' as stage, (properties->'edited' = 'true'::jsonb) as edited,
  (case when pg_input_is_valid(properties->>'pieces_added', 'integer') then (properties->>'pieces_added')::int end) as pieces_added,
  (properties->'used_make' = 'true'::jsonb) as used_make, (properties->'used_auto_design' = 'true'::jsonb) as used_auto_design,
  (properties->'used_ai_image' = 'true'::jsonb) as used_ai_image, (properties->'used_drawings' = 'true'::jsonb) as used_drawings,
  (properties->'used_studio' = 'true'::jsonb) as used_studio, (properties->'used_catalog' = 'true'::jsonb) as used_catalog,
  (properties->'used_library' = 'true'::jsonb) as used_library, (properties->'used_share' = 'true'::jsonb) as used_share,
  (properties->'used_account' = 'true'::jsonb) as used_account,
  (case when pg_input_is_valid(properties->>'low_pieces', 'integer') then (properties->>'low_pieces')::int end) as low_pieces,
  (case when pg_input_is_valid(properties->>'mid_pieces', 'integer') then (properties->>'mid_pieces')::int end) as mid_pieces,
  (case when pg_input_is_valid(properties->>'tall_pieces', 'integer') then (properties->>'tall_pieces')::int end) as tall_pieces,
  (case when pg_input_is_valid(properties->>'kitchen_units', 'integer') then (properties->>'kitchen_units')::int end) as kitchen_units,
  (case when pg_input_is_valid(properties->>'shaped_pieces', 'integer') then (properties->>'shaped_pieces')::int end) as shaped_pieces
from public.analytics_events
where event = 'editor_session_summary'
order by anonymous_id, coalesce(client_session_id, id::text), occurred_at desc, received_at desc, id desc;

-- Return, guests included: by the week a browser first came, how many came back, within a day, a week, a month.
create view analytics.browser_return with (security_invoker = true) as
with starts as (
  select anonymous_id, occurred_at,
    (case when pg_input_is_valid(properties->>'visit_number', 'integer') then (properties->>'visit_number')::int end) as visit_number,
    (case when pg_input_is_valid(properties->>'days_since_first_visit', 'integer') then (properties->>'days_since_first_visit')::int end) as days_since_first
  from public.analytics_events where event = 'editor_session_started' and properties ? 'visit_number'
), browsers as (
  select anonymous_id, min(occurred_at) filter (where visit_number = 1) as first_seen, max(visit_number) as visits,
    min(days_since_first) filter (where visit_number > 1) as first_return_day
  from starts group by anonymous_id having bool_or(visit_number = 1)
)
select date_trunc('week', first_seen) as cohort_week, count(*) as browsers,
  count(*) filter (where visits > 1) as returned,
  count(*) filter (where first_return_day <= 1) as returned_within_1d,
  count(*) filter (where first_return_day <= 7) as returned_within_7d,
  count(*) filter (where first_return_day <= 30) as returned_within_30d,
  round(100.0 * count(*) filter (where visits > 1) / nullif(count(*), 0), 1) as return_pct
from browsers group by 1;

-- The retention question: which first-visit behaviour goes with coming back. For each thing a first visit can do,
-- how many first visits did it and how many of those browsers returned, against those that did not.
create view analytics.first_visit_drivers with (security_invoker = true) as
with firsts as (
  select v.*, exists (select 1 from public.analytics_events s where s.anonymous_id = v.anonymous_id
    and s.event = 'editor_session_started'
    and (case when pg_input_is_valid(s.properties->>'visit_number', 'integer') then (s.properties->>'visit_number')::int end) > 1) as returned
  from analytics.visits v where v.visit_number = 1
), behaviours as (
  select returned, b.behaviour, b.did from firsts, lateral (values
    ('edited', edited), ('explored a deep feature', stage in ('explored', 'realized')),
    ('realized (export, image, share)', stage = 'realized'), ('added 2+ pieces', pieces_added >= 2),
    ('make', used_make), ('auto design', used_auto_design), ('ai image', used_ai_image), ('drawings', used_drawings),
    ('studio room', used_studio), ('catalog', used_catalog), ('design library', used_library), ('share', used_share),
    ('account sheet', used_account), ('built a low piece', low_pieces > 0), ('built a shaped piece', shaped_pieces > 0),
    ('built kitchen units', kitchen_units > 0), ('stayed 5+ min', duration_s >= 300)) as b(behaviour, did)
)
select behaviour,
  count(*) filter (where did) as first_visits_did, count(*) filter (where did and returned) as returned_did,
  round(100.0 * count(*) filter (where did and returned) / nullif(count(*) filter (where did), 0), 1) as return_pct_did,
  count(*) filter (where not did) as first_visits_did_not,
  round(100.0 * count(*) filter (where not did and returned) / nullif(count(*) filter (where not did), 0), 1) as return_pct_did_not
from behaviours group by behaviour;

-- Where a visit stops: how far visits get, by visit number (first visits apart from returns) and device.
create view analytics.visit_depth with (security_invoker = true) as
select case when visit_number = 1 then 'first visit' else 'return visit' end as visit, viewport, stage,
  count(*) as visits, round(avg(duration_s)) as avg_duration_s, round(avg(pieces_added), 2) as avg_pieces_added
from analytics.visits group by 1, 2, 3;

-- Growth direction: what kinds of furniture people look for, against what they add, and the rooms they shop for.
create view analytics.furniture_demand with (security_invoker = true) as
with browser_categories as (
  select coalesce(properties->>'category', properties->>'product') as category, anonymous_id,
    count(*) filter (where event = 'furniture_category_opened') as opens,
    count(*) filter (where event = 'furniture_piece_added') as adds,
    min(occurred_at) filter (where event = 'furniture_category_opened') as first_open,
    max(occurred_at) filter (where event = 'furniture_piece_added') as last_add
  from public.analytics_events
  where event in ('furniture_category_opened', 'furniture_piece_added')
    and coalesce(properties->>'category', properties->>'product') is not null
  group by 1, 2
)
select category, sum(opens) as opens, count(*) filter (where opens > 0) as browsers_opened,
  sum(adds) as pieces_added, count(*) filter (where adds > 0) as browsers_added,
  round(100.0 * count(*) filter (where last_add >= first_open)
    / nullif(count(*) filter (where opens > 0), 0), 1) as added_after_opening_pct
from browser_categories group by category;

create view analytics.room_interest with (security_invoker = true) as
select properties->>'room' as room, count(*) as filters, count(distinct anonymous_id) as browsers
from public.analytics_events where event = 'furniture_room_filtered' group by 1;

-- Growth direction: what people ask Auto design for that it cannot plan yet, and what they build, by size class.
create view analytics.auto_design_gaps with (security_invoker = true) as
select properties->>'no_plan_reason' as reason, count(*) as runs, count(distinct anonymous_id) as browsers
from public.analytics_events
where event = 'auto_design_proposals_generated'
  and (case when pg_input_is_valid(properties->>'proposal_count', 'integer') then (properties->>'proposal_count')::int end) = 0
group by 1;

create view analytics.built_furniture_mix with (security_invoker = true) as
select date_trunc('week', ended_at) as week, count(*) as visits,
  sum(low_pieces) as low_pieces, sum(mid_pieces) as mid_pieces, sum(tall_pieces) as tall_pieces,
  sum(kitchen_units) as kitchen_units, sum(shaped_pieces) as shaped_pieces
from analytics.visits group by 1;

grant select on analytics.visits, analytics.browser_return, analytics.first_visit_drivers, analytics.visit_depth,
  analytics.furniture_demand, analytics.room_interest, analytics.auto_design_gaps, analytics.built_furniture_mix
  to service_role;
