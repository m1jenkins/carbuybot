create table public.brief_drafts (
  engagement_id uuid primary key
    references public.engagements (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  current_question_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint brief_drafts_answers_object_check
    check (pg_catalog.jsonb_typeof(answers) = 'object'),
  constraint brief_drafts_current_question_check
    check (
      current_question_id is null
      or current_question_id in (
        'condition',
        'make',
        'model',
        'yearMin',
        'yearMax',
        'trim',
        'colors',
        'options',
        'dealBreakers',
        'budgetCents',
        'city',
        'state',
        'postalCode',
        'searchRadiusMiles',
        'timeline',
        'hasTradeIn',
        'tradeInDetails',
        'financingPreference',
        'notes',
        'consent'
      )
    )
);

create index brief_drafts_updated_at_idx
  on public.brief_drafts (updated_at desc);

alter table public.brief_drafts enable row level security;

revoke all on table public.brief_drafts from anon, authenticated;
grant all privileges on table public.brief_drafts to service_role;
grant select, insert on table public.brief_drafts to authenticated;
grant update (answers, current_question_id, updated_at)
  on table public.brief_drafts to authenticated;

create policy "Customers can view their vehicle brief draft"
on public.brief_drafts
for select
to authenticated
using (
  exists (
    select 1
    from public.engagements
    where engagements.id = brief_drafts.engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
  )
);

create policy "Customers can start a paid vehicle brief draft"
on public.brief_drafts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.engagements
    where engagements.id = brief_drafts.engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
      and engagements.workflow_status = 'awaiting_brief'
  )
);

create policy "Customers can update their paid vehicle brief draft"
on public.brief_drafts
for update
to authenticated
using (
  exists (
    select 1
    from public.engagements
    where engagements.id = brief_drafts.engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
      and engagements.workflow_status = 'awaiting_brief'
  )
)
with check (
  exists (
    select 1
    from public.engagements
    where engagements.id = brief_drafts.engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
      and engagements.workflow_status = 'awaiting_brief'
  )
);

create or replace function public.finalize_vehicle_brief(
  p_engagement_id uuid,
  p_user_id uuid,
  p_brief jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_engagement public.engagements%rowtype;
begin
  if p_engagement_id is null or p_user_id is null then
    raise exception 'An engagement and authenticated user are required'
      using errcode = '22023';
  end if;

  if p_brief is null or pg_catalog.jsonb_typeof(p_brief) <> 'object' then
    raise exception 'A normalized vehicle brief is required'
      using errcode = '22023';
  end if;

  select engagements.*
  into target_engagement
  from public.engagements
  where engagements.id = p_engagement_id
    and engagements.user_id = p_user_id
    and engagements.payment_status = 'paid'
    and engagements.workflow_status = 'awaiting_brief'
  for update;

  if not found then
    raise exception 'Finalization requires an owned paid engagement awaiting a brief'
      using errcode = '42501';
  end if;

  perform 1
  from public.brief_drafts
  where brief_drafts.engagement_id = p_engagement_id
    and brief_drafts.current_question_id is null
    and brief_drafts.answers @> '{"consent":true}'::jsonb
  for update;

  if not found then
    raise exception 'A complete saved vehicle brief draft is required'
      using errcode = '22023';
  end if;

  insert into public.vehicle_briefs (
    engagement_id,
    condition,
    make,
    model,
    year_min,
    year_max,
    trim,
    colors,
    options,
    deal_breakers,
    budget_cents,
    city,
    state,
    postal_code,
    search_radius_miles,
    timeline,
    has_trade_in,
    trade_in_details,
    financing_preference,
    notes,
    consent
  )
  values (
    p_engagement_id,
    p_brief ->> 'condition',
    p_brief ->> 'make',
    p_brief ->> 'model',
    (p_brief ->> 'year_min')::integer,
    (p_brief ->> 'year_max')::integer,
    p_brief ->> 'trim',
    array(
      select value
      from pg_catalog.jsonb_array_elements_text(p_brief -> 'colors')
        as item(value)
    ),
    array(
      select value
      from pg_catalog.jsonb_array_elements_text(p_brief -> 'options')
        as item(value)
    ),
    array(
      select value
      from pg_catalog.jsonb_array_elements_text(p_brief -> 'deal_breakers')
        as item(value)
    ),
    (p_brief ->> 'budget_cents')::bigint,
    p_brief ->> 'city',
    p_brief ->> 'state',
    p_brief ->> 'postal_code',
    (p_brief ->> 'search_radius_miles')::integer,
    p_brief ->> 'timeline',
    (p_brief ->> 'has_trade_in')::boolean,
    p_brief ->> 'trade_in_details',
    p_brief ->> 'financing_preference',
    p_brief ->> 'notes',
    (p_brief ->> 'consent')::boolean
  )
  on conflict (engagement_id) do update
  set
    condition = excluded.condition,
    make = excluded.make,
    model = excluded.model,
    year_min = excluded.year_min,
    year_max = excluded.year_max,
    trim = excluded.trim,
    colors = excluded.colors,
    options = excluded.options,
    deal_breakers = excluded.deal_breakers,
    budget_cents = excluded.budget_cents,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code,
    search_radius_miles = excluded.search_radius_miles,
    timeline = excluded.timeline,
    has_trade_in = excluded.has_trade_in,
    trade_in_details = excluded.trade_in_details,
    financing_preference = excluded.financing_preference,
    notes = excluded.notes,
    consent = excluded.consent,
    updated_at = pg_catalog.now();

  update public.engagements
  set
    workflow_status = 'brief_submitted',
    onboarding_completed_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where id = p_engagement_id
    and user_id = p_user_id
    and payment_status = 'paid'
    and workflow_status = 'awaiting_brief';

  if not found then
    raise exception 'The engagement changed before finalization'
      using errcode = '40001';
  end if;

  insert into public.status_updates (
    engagement_id,
    author_id,
    status,
    title,
    note,
    customer_visible
  )
  values (
    p_engagement_id,
    p_user_id,
    'brief_submitted',
    'Brief submitted',
    'We have your vehicle brief and will review it before the search begins.',
    true
  );

  delete from public.brief_drafts
  where engagement_id = p_engagement_id;

  return true;
end;
$$;

revoke all on function public.finalize_vehicle_brief(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_vehicle_brief(uuid, uuid, jsonb)
  to service_role;
