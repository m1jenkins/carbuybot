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
  v_transition_allowed boolean;
begin
  v_author_id := (select auth.uid());

  if v_author_id is null then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  if not (select private.is_admin()) then
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

  select engagements.workflow_status
  into v_current_status
  from public.engagements
  where engagements.id = p_engagement_id
  for update;

  if not found then
    raise exception 'The engagement is unavailable'
      using errcode = '42501';
  end if;

  if v_current_status = p_next_status then
    raise exception 'That workflow transition is not allowed'
      using errcode = '22023';
  end if;

  v_transition_allowed := case v_current_status
    when 'awaiting_brief'
      then p_next_status in ('brief_submitted', 'cancelled')
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
  where id = p_engagement_id
    and workflow_status = v_current_status;

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

create or replace function public.update_engagement_status(
  p_engagement_id uuid,
  p_next_status text,
  p_title text,
  p_note text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin access is required' using errcode = '42501';
  end if;

  return private.update_engagement_status(
    p_engagement_id,
    p_next_status,
    p_title,
    p_note
  );
end;
$$;

revoke all on function public.update_engagement_status(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_engagement_status(uuid, text, text, text)
  to authenticated;

revoke update (workflow_status, onboarding_completed_at, updated_at)
  on table public.engagements from authenticated;
revoke insert on table public.status_updates from authenticated;

drop policy if exists "Admins can update engagements"
  on public.engagements;
drop policy if exists "Admins can update engagements through workflow RPC"
  on public.engagements;

drop policy if exists "Admins can create status updates"
  on public.status_updates;
drop policy if exists "Admins can create status updates through workflow RPC"
  on public.status_updates;
