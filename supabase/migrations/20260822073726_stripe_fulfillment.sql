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
  inserted_count integer;
  fulfilled_count integer;
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
    customer_email = p_customer_email,
    stripe_checkout_session_id = p_checkout_session_id,
    stripe_customer_id = p_customer_id,
    stripe_payment_intent_id = p_payment_intent_id,
    amount_cents = p_amount_cents,
    currency = p_currency,
    payment_status = 'paid',
    workflow_status = case
      when payment_status = 'pending' then 'awaiting_brief'
      else workflow_status
    end,
    updated_at = pg_catalog.now()
  where id = p_engagement_id
    and price_id = p_price_id
    and (
      (
        payment_status = 'pending'
        and (
          stripe_checkout_session_id is null
          or stripe_checkout_session_id = p_checkout_session_id
        )
      )
      or (
        payment_status = 'paid'
        and stripe_checkout_session_id = p_checkout_session_id
      )
    );

  get diagnostics fulfilled_count = row_count;

  if fulfilled_count <> 1 then
    raise exception 'Matching pending engagement was not found'
      using errcode = 'P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.fulfill_stripe_event(text, text, boolean, uuid, text, text, text, text, bigint, text, text)
  from public, anon, authenticated;

grant execute on function public.fulfill_stripe_event(text, text, boolean, uuid, text, text, text, text, bigint, text, text)
  to service_role;
