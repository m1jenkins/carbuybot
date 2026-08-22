alter table public.engagements
  add column intro_slot smallint,
  add constraint engagements_intro_slot_range_check
    check (intro_slot is null or intro_slot between 1 and 100),
  add constraint engagements_intro_slot_status_check
    check (
      intro_slot is null
      or payment_status in ('pending', 'paid', 'refunded')
    );

with eligible as (
  select
    id,
    pg_catalog.row_number() over (
      order by
        case when payment_status in ('paid', 'refunded') then 0 else 1 end,
        created_at,
        id
    ) as slot
  from public.engagements
  where payment_status in ('pending', 'paid', 'refunded')
    and amount_cents = 34900
    and currency = 'usd'
)
update public.engagements as engagements
set intro_slot = eligible.slot::smallint
from eligible
where engagements.id = eligible.id
  and eligible.slot between 1 and 100;

create unique index engagements_intro_slot_key
  on public.engagements (intro_slot)
  where intro_slot is not null;
create unique index engagements_payment_intent_key
  on public.engagements (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

drop index public.engagements_customer_email_claim_idx;
create index engagements_customer_email_claim_idx
  on public.engagements (customer_email)
  where payment_status in ('paid', 'refunded') and user_id is null;

create or replace function public.reserve_checkout_engagement(
  p_customer_email text,
  p_intro_price_id text,
  p_standard_price_id text
)
returns table (
  id uuid,
  amount_cents bigint,
  currency text,
  price_id text,
  intro_slot smallint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_amount_cents bigint;
  v_currency text := 'usd';
  v_engagement_id uuid;
  v_intro_slot smallint;
  v_price_id text;
begin
  if (
    p_customer_email is null
    or p_customer_email <> pg_catalog.lower(pg_catalog.btrim(p_customer_email))
    or pg_catalog.char_length(p_customer_email) > 320
    or p_customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'A normalized customer email is required'
      using errcode = '22023';
  end if;

  if (
    p_intro_price_id is null
    or p_intro_price_id <> pg_catalog.btrim(p_intro_price_id)
    or p_intro_price_id !~ '^price_'
    or p_standard_price_id is null
    or p_standard_price_id <> pg_catalog.btrim(p_standard_price_id)
    or p_standard_price_id !~ '^price_'
    or p_intro_price_id = p_standard_price_id
  ) then
    raise exception 'Two configured Stripe Price IDs are required'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('checkout_intro_slots', 0)
  );

  select free_slot.slot::smallint
  into v_intro_slot
  from pg_catalog.generate_series(1, 100) as free_slot(slot)
  where not exists (
    select 1
    from public.engagements
    where engagements.intro_slot = free_slot.slot
  )
  order by free_slot.slot
  limit 1;

  if v_intro_slot is null then
    v_amount_cents := 39900;
    v_price_id := p_standard_price_id;
  else
    v_amount_cents := 34900;
    v_price_id := p_intro_price_id;
  end if;

  insert into public.engagements (
    customer_email,
    price_id,
    amount_cents,
    currency,
    payment_status,
    workflow_status,
    intro_slot
  )
  values (
    p_customer_email,
    v_price_id,
    v_amount_cents,
    v_currency,
    'pending',
    'awaiting_brief',
    v_intro_slot
  )
  returning engagements.id into v_engagement_id;

  return query
  select
    v_engagement_id,
    v_amount_cents,
    v_currency,
    v_price_id,
    v_intro_slot;
end;
$$;

revoke all on function public.reserve_checkout_engagement(text, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_checkout_engagement(text, text, text)
  to service_role;

create or replace function public.fulfill_stripe_event(
  p_event_id text,
  p_event_type text,
  p_fulfill boolean,
  p_engagement_id uuid,
  p_customer_email text,
  p_checkout_session_id text,
  p_customer_id text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_price_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fulfilled_count integer;
  inserted_count integer;
begin
  if (
    p_event_id is null
    or p_event_id <> pg_catalog.btrim(p_event_id)
    or p_event_id !~ '^evt_'
    or p_event_type is null
    or p_event_type <> pg_catalog.btrim(p_event_type)
  ) then
    raise exception 'A valid Stripe event identity is required'
      using errcode = '22023';
  end if;

  insert into public.stripe_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return false;
  end if;

  if not p_fulfill then
    return true;
  end if;

  if p_event_type not in (
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded'
  ) then
    raise exception 'Only paid Checkout events can fulfill an engagement'
      using errcode = '22023';
  end if;

  if (
    p_engagement_id is null
    or p_customer_email is null
    or p_customer_email <> pg_catalog.lower(pg_catalog.btrim(p_customer_email))
    or pg_catalog.char_length(p_customer_email) > 320
    or p_customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_checkout_session_id is null
    or p_checkout_session_id !~ '^cs_test_'
    or p_customer_id is null
    or p_customer_id !~ '^cus_'
    or p_payment_intent_id is null
    or p_payment_intent_id !~ '^pi_'
    or p_amount_cents is null
    or p_amount_cents <= 0
    or p_amount_cents > 9007199254740991
    or p_currency is null
    or p_currency !~ '^[a-z]{3}$'
    or p_price_id is null
    or p_price_id !~ '^price_'
  ) then
    raise exception 'Paid Checkout fulfillment data is invalid'
      using errcode = '22023';
  end if;

  update public.engagements
  set
    user_id = coalesce(
      engagements.user_id,
      (
        select profiles.id
        from public.profiles
        where profiles.email = p_customer_email
      )
    ),
    stripe_checkout_session_id = p_checkout_session_id,
    stripe_customer_id = p_customer_id,
    stripe_payment_intent_id = p_payment_intent_id,
    payment_status = 'paid',
    workflow_status = case
      when engagements.payment_status = 'pending' then 'awaiting_brief'
      else engagements.workflow_status
    end,
    updated_at = pg_catalog.now()
  where engagements.id = p_engagement_id
    and engagements.customer_email = p_customer_email
    and engagements.price_id = p_price_id
    and engagements.amount_cents = p_amount_cents
    and engagements.currency = p_currency
    and (
      (
        engagements.payment_status = 'pending'
        and (
          engagements.stripe_checkout_session_id is null
          or engagements.stripe_checkout_session_id = p_checkout_session_id
        )
      )
      or (
        engagements.payment_status = 'paid'
        and engagements.stripe_checkout_session_id = p_checkout_session_id
        and engagements.stripe_payment_intent_id = p_payment_intent_id
      )
    );

  get diagnostics fulfilled_count = row_count;
  if fulfilled_count <> 1 then
    raise exception 'Matching pending engagement or immutable price snapshot was not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.fulfill_stripe_event(text, text, boolean, uuid, text, text, text, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.fulfill_stripe_event(text, text, boolean, uuid, text, text, text, text, bigint, text, text)
  to service_role;

create or replace function public.expire_stripe_checkout(
  p_event_id text,
  p_engagement_id uuid,
  p_checkout_session_id text,
  p_price_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expired_count integer;
  inserted_count integer;
begin
  if (
    p_event_id is null
    or p_event_id <> pg_catalog.btrim(p_event_id)
    or p_event_id !~ '^evt_'
    or p_engagement_id is null
    or p_checkout_session_id is null
    or p_checkout_session_id !~ '^cs_test_'
    or p_price_id is null
    or p_price_id !~ '^price_'
  ) then
    raise exception 'Expired Checkout data is invalid'
      using errcode = '22023';
  end if;

  insert into public.stripe_events (event_id, event_type)
  values (p_event_id, 'checkout.session.expired')
  on conflict (event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return false;
  end if;

  update public.engagements
  set
    stripe_checkout_session_id = p_checkout_session_id,
    payment_status = 'failed',
    intro_slot = null,
    updated_at = pg_catalog.now()
  where engagements.id = p_engagement_id
    and engagements.price_id = p_price_id
    and engagements.payment_status = 'pending'
    and (
      engagements.stripe_checkout_session_id is null
      or engagements.stripe_checkout_session_id = p_checkout_session_id
    );

  get diagnostics expired_count = row_count;
  if expired_count = 1 then
    return true;
  end if;

  if exists (
    select 1
    from public.engagements
    where engagements.id = p_engagement_id
      and engagements.price_id = p_price_id
      and engagements.payment_status = 'failed'
      and engagements.stripe_checkout_session_id = p_checkout_session_id
      and engagements.intro_slot is null
  ) then
    return true;
  end if;

  raise exception 'Matching pending Checkout reservation was not found'
    using errcode = 'P0002';
end;
$$;

revoke all on function public.expire_stripe_checkout(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.expire_stripe_checkout(text, uuid, text, text)
  to service_role;

create or replace function public.refund_stripe_payment(
  p_event_id text,
  p_payment_intent_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
  target_engagement public.engagements%rowtype;
begin
  if (
    p_event_id is null
    or p_event_id <> pg_catalog.btrim(p_event_id)
    or p_event_id !~ '^evt_'
    or p_payment_intent_id is null
    or p_payment_intent_id <> pg_catalog.btrim(p_payment_intent_id)
    or p_payment_intent_id !~ '^pi_'
  ) then
    raise exception 'Refund event data is invalid'
      using errcode = '22023';
  end if;

  insert into public.stripe_events (event_id, event_type)
  values (p_event_id, 'charge.refunded')
  on conflict (event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return false;
  end if;

  select engagements.*
  into target_engagement
  from public.engagements
  where engagements.stripe_payment_intent_id = p_payment_intent_id
  for update;

  if not found then
    raise exception 'Matching paid engagement was not found'
      using errcode = 'P0002';
  end if;

  if target_engagement.payment_status = 'refunded' then
    return true;
  end if;

  if target_engagement.payment_status <> 'paid' then
    raise exception 'Only a paid engagement can be refunded'
      using errcode = '22023';
  end if;

  update public.engagements
  set
    payment_status = 'refunded',
    updated_at = pg_catalog.now()
  where engagements.id = target_engagement.id
    and engagements.payment_status = 'paid';

  if not found then
    raise exception 'The payment changed before the refund was saved'
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
    target_engagement.id,
    null,
    target_engagement.workflow_status,
    'Payment refunded',
    'Your service fee was fully refunded. Work on this vehicle search has stopped.',
    true
  );

  return true;
end;
$$;

revoke all on function public.refund_stripe_payment(text, text)
  from public, anon, authenticated;
grant execute on function public.refund_stripe_payment(text, text)
  to service_role;

create or replace function public.claim_paid_engagements(
  p_user_id uuid,
  p_verified_email text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed_count integer;
begin
  if p_user_id is null then
    raise exception 'A user ID is required' using errcode = '22023';
  end if;

  if (
    p_verified_email is null
    or p_verified_email <> pg_catalog.lower(pg_catalog.btrim(p_verified_email))
    or pg_catalog.char_length(p_verified_email) > 320
    or p_verified_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'A normalized verified email is required'
      using errcode = '22023';
  end if;

  insert into public.profiles (id, email, updated_at)
  values (p_user_id, p_verified_email, pg_catalog.now())
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = excluded.updated_at;

  update public.engagements
  set
    user_id = p_user_id,
    updated_at = pg_catalog.now()
  where engagements.customer_email = p_verified_email
    and engagements.payment_status in ('paid', 'refunded')
    and engagements.user_id is null;

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

revoke all on function public.claim_paid_engagements(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_paid_engagements(uuid, text)
  to service_role;

revoke insert, update on table public.brief_drafts from authenticated;
drop policy if exists "Customers can start an editable paid vehicle brief draft"
  on public.brief_drafts;
drop policy if exists "Customers can update their editable paid vehicle brief draft"
  on public.brief_drafts;

create or replace function private.enforce_brief_draft_server_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  answer_progress smallint;
begin
  if tg_op = 'INSERT' then
    answer_progress := private.brief_draft_answer_progress(new.answers);
    new.progress_index := greatest(new.progress_index, answer_progress);
    if current_user not in ('postgres', 'service_role') then
      new.baseline_answers := null;
    end if;
    return new;
  end if;

  if current_user not in ('postgres', 'service_role') then
    new.baseline_answers := old.baseline_answers;
  end if;

  if new.baseline_answers is distinct from old.baseline_answers then
    new.current_question_id := 'condition';
    new.progress_index := -1;
    return new;
  end if;

  if (
    current_user in ('postgres', 'service_role')
    and new.current_question_id = 'condition'
    and new.progress_index = -1
  ) then
    return new;
  end if;

  if new.progress_index <= old.progress_index
    and new.current_question_id is distinct from old.current_question_id
  then
    new.current_question_id := old.current_question_id;
  end if;
  new.progress_index := greatest(old.progress_index, new.progress_index);
  return new;
end;
$$;

create or replace function private.save_brief_answer(
  p_engagement_id uuid,
  p_question_id text,
  p_value jsonb,
  p_current_question_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_answers jsonb;
  v_progress_index smallint;
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null or p_engagement_id is null then
    raise exception 'Saving requires an authenticated engagement owner'
      using errcode = '42501';
  end if;

  v_progress_index := private.brief_question_index(p_question_id);
  if v_progress_index is null then
    raise exception 'That intake question is not recognized'
      using errcode = '22023';
  end if;

  if (
    p_current_question_id is not null
    and private.brief_question_index(p_current_question_id) is null
  ) then
    raise exception 'The next intake question is not recognized'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_engagement_id::text, 0)
  );

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
      and engagements.user_id = v_user_id
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

revoke all on function private.save_brief_answer(uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function private.save_brief_answer(uuid, text, jsonb, text)
  to authenticated;

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
begin
  if (select auth.uid()) is null then
    raise exception 'Saving requires an authenticated engagement owner'
      using errcode = '42501';
  end if;

  return private.save_brief_answer(
    p_engagement_id,
    p_question_id,
    p_value,
    p_current_question_id
  );
end;
$$;

revoke all on function public.save_brief_answer(uuid, text, jsonb, text)
  from public, anon;
grant execute on function public.save_brief_answer(uuid, text, jsonb, text)
  to authenticated;

alter function public.finalize_vehicle_brief(uuid, uuid)
  set schema private;
revoke all on function private.finalize_vehicle_brief(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.finalize_vehicle_brief(uuid, uuid)
  to service_role;

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
  finalized boolean;
begin
  if p_engagement_id is null or p_user_id is null then
    raise exception 'An engagement and authenticated user are required'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_engagement_id::text, 0)
  );

  if exists (
    select 1
    from public.engagements
    join public.brief_drafts
      on brief_drafts.engagement_id = engagements.id
    where engagements.id = p_engagement_id
      and engagements.user_id = p_user_id
      and engagements.payment_status = 'paid'
      and engagements.workflow_status = 'brief_submitted'
      and brief_drafts.baseline_answers = brief_drafts.answers
      and brief_drafts.current_question_id = 'condition'
      and brief_drafts.progress_index = -1
  ) then
    finalized := true;
  else
    finalized := private.finalize_vehicle_brief(
      p_engagement_id,
      p_user_id
    );
  end if;

  update public.brief_drafts
  set
    current_question_id = 'condition',
    progress_index = -1,
    updated_at = pg_catalog.now()
  where brief_drafts.engagement_id = p_engagement_id;

  if not found then
    raise exception 'The retained revision draft is unavailable'
      using errcode = 'P0002';
  end if;

  return finalized;
end;
$$;

revoke all on function public.finalize_vehicle_brief(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_vehicle_brief(uuid, uuid)
  to service_role;

update public.brief_drafts as drafts
set
  current_question_id = 'condition',
  progress_index = -1
from public.engagements as engagements
where engagements.id = drafts.engagement_id
  and engagements.workflow_status = 'brief_submitted'
  and drafts.baseline_answers is not null;

create or replace function private.update_engagement_status(
  p_engagement_id uuid,
  p_next_status text,
  p_title text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author_id uuid;
  v_current_status text;
  v_has_brief boolean;
  v_payment_status text;
  v_transition_allowed boolean;
begin
  v_author_id := (select auth.uid());

  if v_author_id is null or not (select private.is_admin()) then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;
  if p_engagement_id is null then
    raise exception 'An engagement is required' using errcode = '22023';
  end if;
  if p_next_status is null or p_next_status not in (
    'awaiting_brief',
    'brief_submitted',
    'in_review',
    'searching',
    'negotiating',
    'offers_ready',
    'completed',
    'cancelled'
  ) then
    raise exception 'A valid next workflow status is required'
      using errcode = '22023';
  end if;
  if p_title is null
    or pg_catalog.char_length(pg_catalog.btrim(p_title)) not between 1 and 200
  then
    raise exception 'A customer-visible title is required'
      using errcode = '22023';
  end if;
  if p_note is null
    or pg_catalog.char_length(pg_catalog.btrim(p_note)) not between 1 and 5000
  then
    raise exception 'A customer-visible note is required'
      using errcode = '22023';
  end if;

  select
    engagements.workflow_status,
    engagements.payment_status,
    exists (
      select 1
      from public.vehicle_briefs
      where vehicle_briefs.engagement_id = engagements.id
    )
  into
    v_current_status,
    v_payment_status,
    v_has_brief
  from public.engagements
  where engagements.id = p_engagement_id
  for update;

  if not found then
    raise exception 'The engagement is unavailable'
      using errcode = '42501';
  end if;
  if v_payment_status <> 'paid' then
    raise exception 'Workflow updates require a paid engagement'
      using errcode = '22023';
  end if;
  if p_next_status <> 'cancelled' and not v_has_brief then
    raise exception 'A vehicle brief is required for operational transitions'
      using errcode = '22023';
  end if;
  if v_current_status = p_next_status then
    raise exception 'That workflow transition is not allowed'
      using errcode = '22023';
  end if;

  v_transition_allowed := case v_current_status
    when 'awaiting_brief'
      then p_next_status = 'cancelled'
    when 'brief_submitted'
      then p_next_status in ('in_review', 'cancelled')
    when 'in_review'
      then p_next_status in ('searching', 'cancelled')
    when 'searching'
      then p_next_status in ('negotiating', 'cancelled')
    when 'negotiating'
      then p_next_status in ('searching', 'offers_ready', 'cancelled')
    when 'offers_ready'
      then p_next_status in ('negotiating', 'completed', 'cancelled')
    else false
  end;

  if not v_transition_allowed then
    raise exception 'That workflow transition is not allowed'
      using errcode = '22023';
  end if;

  update public.engagements
  set
    workflow_status = p_next_status,
    updated_at = pg_catalog.now()
  where engagements.id = p_engagement_id
    and engagements.workflow_status = v_current_status
    and engagements.payment_status = 'paid';

  if not found then
    raise exception 'The engagement changed before the update was saved'
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
    v_author_id,
    p_next_status,
    pg_catalog.btrim(p_title),
    pg_catalog.btrim(p_note),
    true
  );

  return true;
end;
$$;

revoke all on function private.update_engagement_status(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.update_engagement_status(uuid, text, text, text)
  to authenticated;
