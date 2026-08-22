create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_valid_brief_text_array(candidate text[])
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if candidate is null or pg_catalog.cardinality(candidate) > 20 then
    return false;
  end if;

  if pg_catalog.cardinality(candidate) = 0 then
    return true;
  end if;

  if not (pg_catalog.array_ndims(candidate) = 1) then
    return false;
  end if;

  if not (pg_catalog.array_position(candidate, null) is null) then
    return false;
  end if;

  return not exists (
    select 1
    from pg_catalog.unnest(candidate) as item(value)
    where not (
      item.value = pg_catalog.btrim(item.value)
      and pg_catalog.char_length(item.value) between 1 and 100
    )
  )
  and not exists (
    select item.value
    from pg_catalog.unnest(candidate) as item(value)
    group by item.value
    having pg_catalog.count(*) > 1
  );
end;
$$;

revoke all on function private.is_valid_brief_text_array(text[]) from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_normalized_check
    check (
      email = lower(btrim(email))
      and pg_catalog.char_length(email) <= 320
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint profiles_full_name_check
    check (full_name is null or char_length(btrim(full_name)) between 1 and 200)
);

create unique index profiles_email_key on public.profiles (email);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  customer_email text not null,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  price_id text not null,
  amount_cents bigint not null,
  currency text not null default 'usd',
  payment_status text not null default 'pending',
  workflow_status text not null default 'awaiting_brief',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint engagements_customer_email_normalized_check
    check (
      customer_email = lower(btrim(customer_email))
      and pg_catalog.char_length(customer_email) <= 320
      and customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint engagements_checkout_session_id_check
    check (
      stripe_checkout_session_id is null
      or char_length(btrim(stripe_checkout_session_id)) > 0
    ),
  constraint engagements_stripe_customer_id_check
    check (
      stripe_customer_id is null
      or char_length(btrim(stripe_customer_id)) > 0
    ),
  constraint engagements_stripe_payment_intent_id_check
    check (
      stripe_payment_intent_id is null
      or char_length(btrim(stripe_payment_intent_id)) > 0
    ),
  constraint engagements_price_id_check
    check (char_length(btrim(price_id)) > 0),
  constraint engagements_amount_cents_check check (amount_cents > 0),
  constraint engagements_currency_check
    check (currency = lower(currency) and currency ~ '^[a-z]{3}$'),
  constraint engagements_payment_status_check
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  constraint engagements_workflow_status_check
    check (
      workflow_status in (
        'awaiting_brief',
        'brief_submitted',
        'in_review',
        'searching',
        'negotiating',
        'offers_ready',
        'completed',
        'cancelled'
      )
    ),
  constraint engagements_checkout_session_id_key
    unique (stripe_checkout_session_id)
);

create index engagements_user_created_idx
  on public.engagements (user_id, created_at desc);
create index engagements_customer_email_claim_idx
  on public.engagements (customer_email)
  where payment_status = 'paid' and user_id is null;
create index engagements_payment_created_idx
  on public.engagements (payment_status, created_at desc);
create index engagements_status_created_idx
  on public.engagements (workflow_status, created_at desc);
create index engagements_created_at_idx
  on public.engagements (created_at desc);

create table public.vehicle_briefs (
  engagement_id uuid primary key references public.engagements (id) on delete cascade,
  condition text not null,
  make text not null,
  model text not null,
  year_min integer,
  year_max integer,
  trim text,
  colors text[] not null default '{}',
  options text[] not null default '{}',
  deal_breakers text[] not null default '{}',
  budget_cents bigint not null,
  city text not null,
  state text not null,
  postal_code text not null,
  search_radius_miles integer not null,
  timeline text not null,
  has_trade_in boolean not null,
  trade_in_details text,
  financing_preference text not null,
  notes text,
  consent boolean not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vehicle_briefs_condition_check
    check (condition in ('new', 'used', 'either')),
  constraint vehicle_briefs_make_check
    check (char_length(btrim(make)) between 1 and 100),
  constraint vehicle_briefs_model_check
    check (char_length(btrim(model)) between 1 and 100),
  constraint vehicle_briefs_year_min_check
    check (year_min is null or year_min between 1900 and 2100),
  constraint vehicle_briefs_year_max_check
    check (year_max is null or year_max between 1900 and 2100),
  constraint vehicle_briefs_year_range_check
    check (year_min is null or year_max is null or year_min <= year_max),
  constraint vehicle_briefs_trim_check
    check (trim is null or char_length(btrim(trim)) between 1 and 100),
  constraint vehicle_briefs_colors_check
    check (private.is_valid_brief_text_array(colors)),
  constraint vehicle_briefs_options_check
    check (private.is_valid_brief_text_array(options)),
  constraint vehicle_briefs_deal_breakers_check
    check (private.is_valid_brief_text_array(deal_breakers)),
  constraint vehicle_briefs_budget_cents_check
    check (budget_cents between 1 and 9007199254740991),
  constraint vehicle_briefs_city_check
    check (char_length(btrim(city)) between 1 and 100),
  constraint vehicle_briefs_state_check
    check (
      state in (
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
        'DC'
      )
    ),
  constraint vehicle_briefs_postal_code_check
    check (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  constraint vehicle_briefs_search_radius_check
    check (search_radius_miles between 1 and 500),
  constraint vehicle_briefs_timeline_check
    check (
      timeline in (
        'immediately',
        'within_30_days',
        'within_60_days',
        'within_90_days',
        'flexible'
      )
    ),
  constraint vehicle_briefs_trade_in_details_check
    check (
      trade_in_details is null
      or char_length(btrim(trade_in_details)) between 1 and 1000
    ),
  constraint vehicle_briefs_financing_preference_check
    check (financing_preference in ('cash', 'loan', 'lease', 'undecided')),
  constraint vehicle_briefs_notes_check
    check (notes is null or char_length(notes) <= 5000),
  constraint vehicle_briefs_consent_check check (consent)
);

create index vehicle_briefs_created_at_idx
  on public.vehicle_briefs (created_at desc);

create table public.status_updates (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  status text not null,
  title text not null,
  note text not null,
  customer_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint status_updates_status_check
    check (
      status in (
        'awaiting_brief',
        'brief_submitted',
        'in_review',
        'searching',
        'negotiating',
        'offers_ready',
        'completed',
        'cancelled'
      )
    ),
  constraint status_updates_title_check
    check (char_length(btrim(title)) between 1 and 200),
  constraint status_updates_note_check
    check (char_length(btrim(note)) between 1 and 5000)
);

create index status_updates_engagement_created_idx
  on public.status_updates (engagement_id, created_at);
create index status_updates_author_id_idx
  on public.status_updates (author_id);
create index status_updates_created_at_idx
  on public.status_updates (created_at desc);

create table public.stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default timezone('utc', now()),
  constraint stripe_events_event_id_check
    check (char_length(btrim(event_id)) > 0),
  constraint stripe_events_event_type_check
    check (char_length(btrim(event_type)) > 0)
);

create index stripe_events_processed_at_idx
  on public.stripe_events (processed_at desc);

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_users_role_check check (role in ('admin', 'operator'))
);

create index admin_users_active_role_idx
  on public.admin_users (active, role);
create index admin_users_created_at_idx
  on public.admin_users (created_at desc);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and active
      and role in ('admin', 'operator')
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_valid_brief_text_array(text[])
  to authenticated, service_role;

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
  values (
    p_user_id,
    p_verified_email,
    pg_catalog.now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = excluded.updated_at;

  update public.engagements
  set
    user_id = p_user_id,
    updated_at = pg_catalog.now()
  where customer_email = p_verified_email
    and payment_status = 'paid'
    and user_id is null;

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

revoke all on function public.claim_paid_engagements(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_paid_engagements(uuid, text)
  to service_role;

alter table public.profiles enable row level security;
alter table public.engagements enable row level security;
alter table public.vehicle_briefs enable row level security;
alter table public.status_updates enable row level security;
alter table public.stripe_events enable row level security;
alter table public.admin_users enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.engagements from anon, authenticated;
revoke all on table public.vehicle_briefs from anon, authenticated;
revoke all on table public.status_updates from anon, authenticated;
revoke all on table public.stripe_events from anon, authenticated;
revoke all on table public.admin_users from anon, authenticated;

grant all privileges on table public.profiles to service_role;
grant all privileges on table public.engagements to service_role;
grant all privileges on table public.vehicle_briefs to service_role;
grant all privileges on table public.status_updates to service_role;
grant all privileges on table public.stripe_events to service_role;
grant all privileges on table public.admin_users to service_role;

grant select on table public.profiles to authenticated;
grant select on table public.engagements to authenticated;
grant update (workflow_status, onboarding_completed_at, updated_at)
  on table public.engagements to authenticated;
grant select, insert, update on table public.vehicle_briefs to authenticated;
grant select, insert on table public.status_updates to authenticated;
grant select on table public.admin_users to authenticated;

create policy "Customers can view their profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Admins can view profiles"
on public.profiles
for select
to authenticated
using ((select private.is_admin()));

create policy "Customers can view their engagements"
on public.engagements
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can view engagements"
on public.engagements
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can update engagements"
on public.engagements
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Customers can view their vehicle briefs"
on public.vehicle_briefs
for select
to authenticated
using (
  exists (
    select 1
    from public.engagements
    where engagements.id = vehicle_briefs.engagement_id
      and engagements.user_id = (select auth.uid())
  )
);

create policy "Customers can create vehicle briefs for paid engagements"
on public.vehicle_briefs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.engagements
    where engagements.id = vehicle_briefs.engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
  )
);

create policy "Customers can update vehicle briefs for paid engagements"
on public.vehicle_briefs
for update
to authenticated
using (
  exists (
    select 1
    from public.engagements
    where engagements.id = vehicle_briefs.engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
  )
)
with check (
  exists (
    select 1
    from public.engagements
    where engagements.id = vehicle_briefs.engagement_id
      and engagements.user_id = (select auth.uid())
      and engagements.payment_status = 'paid'
  )
);

create policy "Admins can view vehicle briefs"
on public.vehicle_briefs
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can create vehicle briefs"
on public.vehicle_briefs
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update vehicle briefs"
on public.vehicle_briefs
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Customers can view visible status updates"
on public.status_updates
for select
to authenticated
using (
  customer_visible
  and exists (
    select 1
    from public.engagements
    where engagements.id = status_updates.engagement_id
      and engagements.user_id = (select auth.uid())
  )
);

create policy "Admins can view status updates"
on public.status_updates
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can create status updates"
on public.status_updates
for insert
to authenticated
with check (
  (select private.is_admin())
  and author_id = (select auth.uid())
);

create policy "Users can view their admin assignment"
on public.admin_users
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins can view admin assignments"
on public.admin_users
for select
to authenticated
using ((select private.is_admin()));
