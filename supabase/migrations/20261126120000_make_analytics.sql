-- How Make and Assembly Studio are used (docs/analytics.md, "Make"). Read-only views over public.analytics_events,
-- like those in 20261108120000_analytics.sql: only service_role may read them.

-- One row per visit to Make (a make_closed): how long, how it ended, what was used. A visit the page hid part-way
-- through is two rows, the second `resumed`.
create view analytics.make_visits as
select
  occurred_at, anonymous_id, user_id, is_anonymous, design_id, viewport, country,
  (properties->>'duration_ms')::numeric / 1000 as seconds,
  properties->>'exit' as exit,
  (properties->>'resumed')::boolean as resumed,
  (properties->>'part_count')::int as part_count,
  array(select jsonb_array_elements_text(coalesce(properties->'tools_used', '[]'))) as tools_used,
  array(select jsonb_array_elements_text(coalesce(properties->'tabs_viewed', '[]'))) as tabs_viewed,
  (properties->>'tool_uses')::int as tool_uses,
  (properties->>'panel_opened')::boolean as panel_opened,
  (properties->>'parts_picked')::int as parts_picked,
  (properties->>'canvas_touches')::int as canvas_touches,
  (properties->>'zoomed')::boolean as zoomed,
  (properties->>'findings_opened')::int as findings_opened,
  (properties->>'hardware_rows_opened')::int as hardware_rows_opened,
  (properties->>'construction_changes')::int as construction_changes,
  (properties->>'edge_band_changed')::boolean as edge_band_changed,
  (properties->>'assembly_opens')::int as assembly_opens,
  (properties->>'assembly_ms')::numeric / 1000 as assembly_seconds,
  (properties->>'gate_blocks')::int as gate_blocks,
  (properties->>'price_opened')::boolean as price_opened,
  (properties->>'drawings_opened')::boolean as drawings_opened,
  (properties->>'exports_requested')::int as exports_requested,
  (properties->>'exports_saved')::int as exports_saved,
  properties->>'last_action' as last_action
from public.analytics_events
where event = 'make_closed';

-- By week: of the visits to Make, how many went how far.
create view analytics.weekly_make_funnel as
select
  date_trunc('week', occurred_at) as week,
  count(*) as visits,
  count(distinct anonymous_id) as browsers,
  round(percentile_cont(.5) within group (order by seconds)::numeric, 1) as median_seconds,
  count(*) filter (where tool_uses = 0 and parts_picked = 0 and not panel_opened and canvas_touches = 0) as untouched,
  count(*) filter (where canvas_touches > 0 or zoomed) as turned_3d,
  count(*) filter (where tool_uses > 0) as used_a_tool,
  count(*) filter (where parts_picked > 0) as picked_a_part,
  count(*) filter (where panel_opened) as opened_panel,
  count(*) filter (where tabs_viewed && array['hardware', 'cutting']) as viewed_hardware_or_cutting,
  count(*) filter (where construction_changes > 0) as changed_construction,
  count(*) filter (where gate_blocks > 0) as gate_blocked,
  count(*) filter (where assembly_opens > 0) as opened_assembly,
  count(*) filter (where price_opened) as opened_price,
  count(*) filter (where exports_requested > 0) as asked_to_save,
  count(*) filter (where exports_saved > 0) as saved
from analytics.make_visits
group by 1;

-- Which of Make's tools and tabs are used, as a share of visits (the tools never used do not appear: compare with
-- makeActions and makeViewActions in src/domain/wardrobe/contextual-actions.js).
create view analytics.make_feature_use as
with visits as (select count(*)::numeric as n from analytics.make_visits),
uses as (
  select 'tool' as kind, tool as feature, anonymous_id from analytics.make_visits, unnest(tools_used) as tool
  union all select 'tab', tab, anonymous_id from analytics.make_visits, unnest(tabs_viewed) as tab
  union all select 'panel', 'picked a part', anonymous_id from analytics.make_visits where parts_picked > 0
  union all select 'panel', 'drilling finding', anonymous_id from analytics.make_visits where findings_opened > 0
  union all select 'panel', 'hardware row', anonymous_id from analytics.make_visits where hardware_rows_opened > 0
  union all select 'panel', 'edge banding', anonymous_id from analytics.make_visits where edge_band_changed
  union all select 'panel', 'joints or back', anonymous_id from analytics.make_visits where construction_changes > 0
  union all select 'panel', 'price', anonymous_id from analytics.make_visits where price_opened
  union all select 'panel', 'full drawing set', anonymous_id from analytics.make_visits where drawings_opened
  union all select 'view', 'turned or tapped 3D', anonymous_id from analytics.make_visits where canvas_touches > 0
  union all select 'view', 'zoomed', anonymous_id from analytics.make_visits where zoomed
)
select kind, feature, count(*) as visits, count(distinct anonymous_id) as browsers,
  round(100 * count(*) / nullif((select n from visits), 0), 1) as pct_of_visits
from uses group by kind, feature;

-- The last thing done in Make before leaving it, and how it was left: where people stop.
create view analytics.make_exits as
select exit, last_action, count(*) as visits, count(distinct anonymous_id) as browsers,
  round(percentile_cont(.5) within group (order by seconds)::numeric, 1) as median_seconds
from analytics.make_visits where not resumed
group by exit, last_action;

-- One row per visit to Assembly Studio: where it was opened from, how far the film got, what was used.
create view analytics.assembly_visits as
select
  occurred_at, anonymous_id, design_id, viewport,
  (properties->>'duration_ms')::numeric / 1000 as seconds,
  properties->>'entry' as entry, properties->>'exit' as exit,
  (properties->>'steps_total')::int as steps_total,
  (properties->>'furthest_step')::int as furthest_step,
  (properties->>'finished')::boolean as finished,
  (properties->>'watched_ratio')::numeric as watched_ratio,
  (properties->>'play_presses')::int as play_presses,
  (properties->>'steps_stepped')::int as steps_stepped,
  (properties->>'chapters_jumped')::int as chapters_jumped,
  (properties->>'scrubbed')::boolean as scrubbed,
  (properties->>'explore_used')::boolean as explore_used,
  (properties->>'parts_inspected')::int as parts_inspected,
  (properties->>'guide_opened')::boolean as guide_opened,
  (properties->>'chapter_list_opened')::boolean as chapter_list_opened
from public.analytics_events
where event = 'assembly_studio_closed';

-- What closes the gate into assembly and onto paper: each rule, and how often a Retry then got through.
create view analytics.make_gate_blockers as
select
  properties->>'wanted' as wanted, rule, count(*) as times_blocked, count(distinct anonymous_id) as browsers,
  count(distinct design_id) as designs
from public.analytics_events, jsonb_array_elements_text(coalesce(properties->'blocking_rules', '[]')) as rule
where event = 'make_gate_blocked'
group by 1, 2;

-- Saving from Make: every format, saved or what stopped it (the gate, not paying, the piece changing, an error).
create view analytics.make_exports as
select
  date_trunc('week', occurred_at) as week, properties->>'format' as format,
  case when event = 'make_export_saved' then 'saved' else properties->>'reason' end as outcome,
  count(*) as attempts, count(distinct anonymous_id) as browsers
from public.analytics_events
where event in ('make_export_saved', 'make_export_stopped')
group by 1, 2, 3;

revoke all on all tables in schema analytics from public, anon, authenticated;
grant select on all tables in schema analytics to service_role;
