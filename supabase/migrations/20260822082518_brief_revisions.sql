drop policy "Customers can start a paid vehicle brief draft"
  on public.brief_drafts;
drop policy "Customers can update their paid vehicle brief draft"
  on public.brief_drafts;

create policy "Customers can start an editable paid vehicle brief draft"
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
      and engagements.workflow_status in ('awaiting_brief', 'brief_submitted')
  )
);

create policy "Customers can update their editable paid vehicle brief draft"
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
      and engagements.workflow_status in ('awaiting_brief', 'brief_submitted')
  )
)
with check (
  exists (
    select 1
    from public.engagements
    where engagements.id = brief_drafts.engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
      and engagements.workflow_status in ('awaiting_brief', 'brief_submitted')
  )
);

insert into public.brief_drafts (
  engagement_id,
  answers,
  current_question_id,
  created_at,
  updated_at
)
select
  briefs.engagement_id,
  pg_catalog.jsonb_build_object(
    'condition', briefs.condition,
    'make', briefs.make,
    'model', briefs.model,
    'yearMin', briefs.year_min,
    'yearMax', briefs.year_max,
    'trim', briefs.trim,
    'colors', briefs.colors,
    'options', briefs.options,
    'dealBreakers', briefs.deal_breakers,
    'budgetCents', briefs.budget_cents,
    'city', briefs.city,
    'state', briefs.state,
    'postalCode', briefs.postal_code,
    'searchRadiusMiles', briefs.search_radius_miles,
    'timeline', briefs.timeline,
    'hasTradeIn', briefs.has_trade_in,
    'tradeInDetails', briefs.trade_in_details,
    'financingPreference', briefs.financing_preference,
    'notes', briefs.notes,
    'consent', briefs.consent
  ),
  null,
  briefs.created_at,
  briefs.updated_at
from public.vehicle_briefs as briefs
join public.engagements
  on engagements.id = briefs.engagement_id
where engagements.payment_status = 'paid'
  and engagements.workflow_status = 'brief_submitted'
on conflict (engagement_id) do nothing;

create or replace function public.save_brief_answer(
  p_engagement_id uuid,
  p_question_id text,
  p_value jsonb,
  p_current_question_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_answers jsonb;
begin
  if p_engagement_id is null then
    raise exception 'An engagement is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_engagement_id::text, 0)
  );

  if p_question_id is null or p_question_id not in (
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
  ) then
    raise exception 'That intake question is not recognized'
      using errcode = '22023';
  end if;

  if p_current_question_id is not null and p_current_question_id not in (
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
  ) then
    raise exception 'The next intake question is not recognized'
      using errcode = '22023';
  end if;

  begin
    insert into public.brief_drafts (
      engagement_id,
      answers,
      current_question_id
    )
    select
      p_engagement_id,
      pg_catalog.jsonb_build_object(p_question_id, p_value),
      p_current_question_id
    from public.engagements
    where engagements.id = p_engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
      and engagements.workflow_status in ('awaiting_brief', 'brief_submitted')
    on conflict (engagement_id) do update
    set
      answers = brief_drafts.answers || pg_catalog.jsonb_build_object(
        p_question_id,
        p_value
      ),
      current_question_id = excluded.current_question_id,
      updated_at = pg_catalog.now()
    returning answers into saved_answers;
  exception
    when check_violation then
      if p_question_id in ('yearMin', 'yearMax') then
        raise exception 'Minimum year cannot be later than maximum year'
          using errcode = '22023';
      end if;
      raise;
  end;

  if saved_answers is null then
    raise exception 'Saving requires an owned paid engagement with an editable brief'
      using errcode = '42501';
  end if;

  return saved_answers;
end;
$$;

revoke all on function public.save_brief_answer(uuid, text, jsonb, text)
  from public, anon;
grant execute on function public.save_brief_answer(uuid, text, jsonb, text)
  to authenticated;

create or replace function public.finalize_vehicle_brief(
  p_engagement_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_engagement public.engagements%rowtype;
  v_draft public.brief_drafts%rowtype;
begin
  if p_engagement_id is null or p_user_id is null then
    raise exception 'An engagement and authenticated user are required'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_engagement_id::text, 0)
  );

  select engagements.*
  into target_engagement
  from public.engagements
  where engagements.id = p_engagement_id
    and engagements.user_id = p_user_id
    and engagements.payment_status = 'paid'
    and engagements.workflow_status in ('awaiting_brief', 'brief_submitted')
  for update;

  if not found then
    raise exception 'Finalization requires an owned paid engagement with an editable brief'
      using errcode = '42501';
  end if;

  select brief_drafts.*
  into v_draft
  from public.brief_drafts
  where brief_drafts.engagement_id = p_engagement_id
  for update;

  if not found
    or v_draft.current_question_id is not null
    or not (
      v_draft.answers ?& array[
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
        'financingPreference',
        'notes',
        'consent'
      ]
    )
    or v_draft.answers -> 'consent' <> 'true'::jsonb
    or (
      v_draft.answers -> 'hasTradeIn' = 'true'::jsonb
      and not (v_draft.answers ? 'tradeInDetails')
    )
  then
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
    v_draft.answers ->> 'condition',
    v_draft.answers ->> 'make',
    v_draft.answers ->> 'model',
    (v_draft.answers ->> 'yearMin')::integer,
    (v_draft.answers ->> 'yearMax')::integer,
    v_draft.answers ->> 'trim',
    array(
      select value
      from pg_catalog.jsonb_array_elements_text(
        v_draft.answers -> 'colors'
      ) as item(value)
    ),
    array(
      select value
      from pg_catalog.jsonb_array_elements_text(
        v_draft.answers -> 'options'
      ) as item(value)
    ),
    array(
      select value
      from pg_catalog.jsonb_array_elements_text(
        v_draft.answers -> 'dealBreakers'
      ) as item(value)
    ),
    (v_draft.answers ->> 'budgetCents')::bigint,
    v_draft.answers ->> 'city',
    v_draft.answers ->> 'state',
    v_draft.answers ->> 'postalCode',
    (v_draft.answers ->> 'searchRadiusMiles')::integer,
    v_draft.answers ->> 'timeline',
    (v_draft.answers ->> 'hasTradeIn')::boolean,
    case
      when (v_draft.answers ->> 'hasTradeIn')::boolean
      then v_draft.answers ->> 'tradeInDetails'
      else null
    end,
    v_draft.answers ->> 'financingPreference',
    v_draft.answers ->> 'notes',
    (v_draft.answers ->> 'consent')::boolean
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
    onboarding_completed_at = coalesce(
      onboarding_completed_at,
      pg_catalog.now()
    ),
    updated_at = pg_catalog.now()
  where id = p_engagement_id
    and user_id = p_user_id
    and payment_status = 'paid'
    and workflow_status in ('awaiting_brief', 'brief_submitted');

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
    case
      when target_engagement.workflow_status = 'brief_submitted'
        then 'Brief updated'
      else 'Brief submitted'
    end,
    case
      when target_engagement.workflow_status = 'brief_submitted'
        then 'We have your revised vehicle brief and will review the changes.'
      else 'We have your vehicle brief and will review it before the search begins.'
    end,
    true
  );

  return true;
end;
$$;

revoke all on function public.finalize_vehicle_brief(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_vehicle_brief(uuid, uuid)
  to service_role;
