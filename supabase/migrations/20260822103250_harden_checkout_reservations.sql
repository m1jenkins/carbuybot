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
  existing_reservation public.engagements%rowtype;
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

  select engagements.*
  into existing_reservation
  from public.engagements as engagements
  where engagements.customer_email = p_customer_email
    and engagements.payment_status = 'pending'
    and engagements.created_at >= pg_catalog.now() - interval '23 hours'
  order by engagements.created_at desc, engagements.id desc
  limit 1
  for update;

  if found then
    return query
    select
      existing_reservation.id,
      existing_reservation.amount_cents,
      existing_reservation.currency,
      existing_reservation.price_id,
      existing_reservation.intro_slot;
    return;
  end if;

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

create or replace function public.attach_checkout_session(
  p_engagement_id uuid,
  p_checkout_session_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  attached_count integer;
begin
  if (
    p_engagement_id is null
    or p_checkout_session_id is null
    or p_checkout_session_id <> pg_catalog.btrim(p_checkout_session_id)
    or p_checkout_session_id !~ '^cs_test_'
  ) then
    raise exception 'Test Checkout Session attachment data is invalid'
      using errcode = '22023';
  end if;

  update public.engagements
  set
    stripe_checkout_session_id = p_checkout_session_id,
    updated_at = pg_catalog.now()
  where engagements.id = p_engagement_id
    and engagements.payment_status = 'pending'
    and (
      engagements.stripe_checkout_session_id is null
      or engagements.stripe_checkout_session_id = p_checkout_session_id
    );

  get diagnostics attached_count = row_count;
  if attached_count = 1 then
    return true;
  end if;

  raise exception 'Matching unattached pending reservation was not found'
    using errcode = 'P0002';
end;
$$;

revoke all on function public.attach_checkout_session(uuid, text)
  from public, anon, authenticated;
grant execute on function public.attach_checkout_session(uuid, text)
  to service_role;

create or replace function public.fail_checkout_reservation(
  p_engagement_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failed_count integer;
begin
  if p_engagement_id is null then
    raise exception 'A Checkout reservation identity is required'
      using errcode = '22023';
  end if;

  update public.engagements
  set
    payment_status = 'failed',
    intro_slot = null,
    updated_at = pg_catalog.now()
  where engagements.id = p_engagement_id
    and engagements.payment_status = 'pending'
    and engagements.stripe_checkout_session_id is null;

  get diagnostics failed_count = row_count;
  return failed_count = 1;
end;
$$;

revoke all on function public.fail_checkout_reservation(uuid)
  from public, anon, authenticated;
grant execute on function public.fail_checkout_reservation(uuid)
  to service_role;

comment on function public.reserve_checkout_engagement(text, text, text) is
  'Atomically reuses a pending same-email reservation within Stripe idempotency retention or allocates a new Checkout price snapshot.';
comment on function public.attach_checkout_session(uuid, text) is
  'Idempotently attaches one test Checkout Session to its pending reservation.';
comment on function public.fail_checkout_reservation(uuid) is
  'Releases only an unattached pending reservation after a definitive Checkout creation failure.';
