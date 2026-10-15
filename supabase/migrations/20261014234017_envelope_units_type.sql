-- SQL CHECK must reject JSON null, rather than treating it as an unknown result.
alter table public.design_sessions add constraint design_units_type
  check (jsonb_typeof(document->'units') = 'string');
