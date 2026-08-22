create or replace function private.is_valid_draft_year_range(candidate jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  year_min numeric;
  year_max numeric;
begin
  if candidate is null or pg_catalog.jsonb_typeof(candidate) <> 'object' then
    return false;
  end if;

  if candidate ? 'yearMin' and candidate -> 'yearMin' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(candidate -> 'yearMin') <> 'number' then
      return false;
    end if;
    year_min := (candidate ->> 'yearMin')::numeric;
    if year_min <> pg_catalog.trunc(year_min)
      or year_min not between 1900 and 2100
    then
      return false;
    end if;
  end if;

  if candidate ? 'yearMax' and candidate -> 'yearMax' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(candidate -> 'yearMax') <> 'number' then
      return false;
    end if;
    year_max := (candidate ->> 'yearMax')::numeric;
    if year_max <> pg_catalog.trunc(year_max)
      or year_max not between 1900 and 2100
    then
      return false;
    end if;
  end if;

  return year_min is null or year_max is null or year_min <= year_max;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

revoke all on function private.is_valid_draft_year_range(jsonb) from public;
grant execute on function private.is_valid_draft_year_range(jsonb)
  to authenticated, service_role;

alter table public.brief_drafts
  add constraint brief_drafts_year_range_check
  check (private.is_valid_draft_year_range(answers))
  not valid;

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
      and engagements.workflow_status = 'awaiting_brief'
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
    raise exception 'Saving requires an owned paid engagement awaiting a brief'
      using errcode = '42501';
  end if;

  return saved_answers;
end;
$$;

revoke all on function public.save_brief_answer(uuid, text, jsonb, text)
  from public, anon;
grant execute on function public.save_brief_answer(uuid, text, jsonb, text)
  to authenticated;

revoke insert, update on table public.vehicle_briefs from authenticated;
drop policy if exists "Customers can create vehicle briefs for paid engagements"
  on public.vehicle_briefs;
drop policy if exists "Customers can update vehicle briefs for paid engagements"
  on public.vehicle_briefs;

drop function public.finalize_vehicle_brief(uuid, uuid, jsonb);

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
    and engagements.workflow_status = 'awaiting_brief'
  for update;

  if not found then
    raise exception 'Finalization requires an owned paid engagement awaiting a brief'
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

revoke all on function public.finalize_vehicle_brief(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_vehicle_brief(uuid, uuid)
  to service_role;
