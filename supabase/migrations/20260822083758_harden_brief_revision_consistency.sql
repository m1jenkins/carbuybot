alter table public.brief_drafts
  add column baseline_answers jsonb,
  add column progress_index smallint not null default -1;

create or replace function private.brief_question_index(candidate text)
returns smallint
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select (
    case candidate
      when 'condition' then 0
      when 'make' then 1
      when 'model' then 2
      when 'yearMin' then 3
      when 'yearMax' then 4
      when 'trim' then 5
      when 'colors' then 6
      when 'options' then 7
      when 'dealBreakers' then 8
      when 'budgetCents' then 9
      when 'city' then 10
      when 'state' then 11
      when 'postalCode' then 12
      when 'searchRadiusMiles' then 13
      when 'timeline' then 14
      when 'hasTradeIn' then 15
      when 'tradeInDetails' then 16
      when 'financingPreference' then 17
      when 'notes' then 18
      when 'consent' then 19
      else null
    end
  )::smallint
$$;

create or replace function private.brief_draft_answer_progress(candidate jsonb)
returns smallint
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    pg_catalog.max(private.brief_question_index(answer.key)),
    -1
  )::smallint
  from pg_catalog.jsonb_object_keys(candidate) as answer(key)
$$;

revoke all on function private.brief_question_index(text) from public;
revoke all on function private.brief_draft_answer_progress(jsonb) from public;
grant execute on function private.brief_question_index(text)
  to authenticated, service_role;
grant execute on function private.brief_draft_answer_progress(jsonb)
  to authenticated, service_role;

update public.brief_drafts
set progress_index = private.brief_draft_answer_progress(answers);

update public.brief_drafts as drafts
set baseline_answers = pg_catalog.jsonb_build_object(
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
)
from public.vehicle_briefs as briefs
join public.engagements
  on engagements.id = briefs.engagement_id
where drafts.engagement_id = briefs.engagement_id
  and engagements.payment_status = 'paid'
  and engagements.workflow_status = 'brief_submitted';

alter table public.brief_drafts
  add constraint brief_drafts_baseline_answers_object_check
    check (
      baseline_answers is null
      or pg_catalog.jsonb_typeof(baseline_answers) = 'object'
    ),
  add constraint brief_drafts_progress_index_check
    check (progress_index between -1 and 19);

revoke insert on table public.brief_drafts from authenticated;
grant insert (
  engagement_id,
  answers,
  current_question_id,
  progress_index
) on public.brief_drafts to authenticated;
grant update (progress_index) on public.brief_drafts to authenticated;

create or replace function private.enforce_brief_draft_server_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  answer_progress smallint;
begin
  answer_progress := private.brief_draft_answer_progress(new.answers);

  if tg_op = 'INSERT' then
    new.progress_index := answer_progress;
    if current_user not in ('postgres', 'service_role') then
      new.baseline_answers := null;
    end if;
    return new;
  end if;

  if current_user not in ('postgres', 'service_role') then
    new.baseline_answers := old.baseline_answers;
  end if;

  if answer_progress <= old.progress_index
    and new.current_question_id is distinct from old.current_question_id
  then
    new.current_question_id := old.current_question_id;
  end if;
  new.progress_index := greatest(
    old.progress_index,
    answer_progress
  );
  return new;
end;
$$;

revoke all on function private.enforce_brief_draft_server_fields()
  from public;
grant execute on function private.enforce_brief_draft_server_fields()
  to authenticated, service_role;

create trigger enforce_brief_draft_server_fields
before insert or update on public.brief_drafts
for each row execute function private.enforce_brief_draft_server_fields();

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
  v_progress_index smallint;
begin
  if p_engagement_id is null then
    raise exception 'An engagement is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_engagement_id::text, 0)
  );

  v_progress_index := case p_question_id
    when 'condition' then 0
    when 'make' then 1
    when 'model' then 2
    when 'yearMin' then 3
    when 'yearMax' then 4
    when 'trim' then 5
    when 'colors' then 6
    when 'options' then 7
    when 'dealBreakers' then 8
    when 'budgetCents' then 9
    when 'city' then 10
    when 'state' then 11
    when 'postalCode' then 12
    when 'searchRadiusMiles' then 13
    when 'timeline' then 14
    when 'hasTradeIn' then 15
    when 'tradeInDetails' then 16
    when 'financingPreference' then 17
    when 'notes' then 18
    when 'consent' then 19
    else null
  end;

  if v_progress_index is null then
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
      current_question_id,
      progress_index
    )
    select
      p_engagement_id,
      pg_catalog.jsonb_build_object(p_question_id, p_value),
      p_current_question_id,
      v_progress_index
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
      current_question_id = case
        when v_progress_index > brief_drafts.progress_index
          then excluded.current_question_id
        else brief_drafts.current_question_id
      end,
      progress_index = greatest(
        brief_drafts.progress_index,
        v_progress_index
      ),
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
  v_has_changes boolean;
  v_normalized_answers jsonb;
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

  v_normalized_answers := pg_catalog.jsonb_build_object(
    'condition', v_draft.answers ->> 'condition',
    'make', v_draft.answers ->> 'make',
    'model', v_draft.answers ->> 'model',
    'yearMin', (v_draft.answers ->> 'yearMin')::integer,
    'yearMax', (v_draft.answers ->> 'yearMax')::integer,
    'trim', v_draft.answers ->> 'trim',
    'colors', v_draft.answers -> 'colors',
    'options', v_draft.answers -> 'options',
    'dealBreakers', v_draft.answers -> 'dealBreakers',
    'budgetCents', (v_draft.answers ->> 'budgetCents')::bigint,
    'city', v_draft.answers ->> 'city',
    'state', v_draft.answers ->> 'state',
    'postalCode', v_draft.answers ->> 'postalCode',
    'searchRadiusMiles',
      (v_draft.answers ->> 'searchRadiusMiles')::integer,
    'timeline', v_draft.answers ->> 'timeline',
    'hasTradeIn', (v_draft.answers ->> 'hasTradeIn')::boolean,
    'tradeInDetails', case
      when (v_draft.answers ->> 'hasTradeIn')::boolean
        then v_draft.answers ->> 'tradeInDetails'
      else null
    end,
    'financingPreference', v_draft.answers ->> 'financingPreference',
    'notes', v_draft.answers ->> 'notes',
    'consent', (v_draft.answers ->> 'consent')::boolean
  );
  v_has_changes :=
    v_draft.baseline_answers is distinct from v_normalized_answers;

  if target_engagement.workflow_status = 'awaiting_brief'
    or v_has_changes
  then
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
      v_normalized_answers ->> 'condition',
      v_normalized_answers ->> 'make',
      v_normalized_answers ->> 'model',
      (v_normalized_answers ->> 'yearMin')::integer,
      (v_normalized_answers ->> 'yearMax')::integer,
      v_normalized_answers ->> 'trim',
      array(
        select value
        from pg_catalog.jsonb_array_elements_text(
          v_normalized_answers -> 'colors'
        ) as item(value)
      ),
      array(
        select value
        from pg_catalog.jsonb_array_elements_text(
          v_normalized_answers -> 'options'
        ) as item(value)
      ),
      array(
        select value
        from pg_catalog.jsonb_array_elements_text(
          v_normalized_answers -> 'dealBreakers'
        ) as item(value)
      ),
      (v_normalized_answers ->> 'budgetCents')::bigint,
      v_normalized_answers ->> 'city',
      v_normalized_answers ->> 'state',
      v_normalized_answers ->> 'postalCode',
      (v_normalized_answers ->> 'searchRadiusMiles')::integer,
      v_normalized_answers ->> 'timeline',
      (v_normalized_answers ->> 'hasTradeIn')::boolean,
      v_normalized_answers ->> 'tradeInDetails',
      v_normalized_answers ->> 'financingPreference',
      v_normalized_answers ->> 'notes',
      (v_normalized_answers ->> 'consent')::boolean
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

    update public.brief_drafts
    set
      baseline_answers = v_normalized_answers,
      progress_index = greatest(progress_index, 19),
      updated_at = pg_catalog.now()
    where engagement_id = p_engagement_id;

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
  end if;

  return true;
end;
$$;

revoke all on function public.finalize_vehicle_brief(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_vehicle_brief(uuid, uuid)
  to service_role;
