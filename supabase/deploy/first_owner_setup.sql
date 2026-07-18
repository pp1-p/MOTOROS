-- DealerOS first-owner setup for a fresh hosted deployment.
--
-- Run this ONCE in the Supabase SQL Editor after applying the migrations and
-- creating your first user in Authentication → Users.
--
-- It mirrors public.bootstrap_organisation(), which cannot be called from the
-- SQL Editor because it requires an authenticated session. Same inserts, same
-- guards.
--
-- EDIT THE THREE VALUES BELOW, then run the whole script.

do $$
declare
  -- Authentication → Users → click your user → copy the UUID:
  v_user_id uuid := 'PASTE-YOUR-AUTH-USER-UUID-HERE';
  -- Shown across DealerOS and the public site (editable later in Settings):
  v_name text := 'Your Dealership Name';
  -- Lowercase letters, numbers and hyphens only:
  v_slug text := 'your-dealership';

  v_org_id uuid;
  v_role_id uuid;
begin
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise exception 'No Auth user has ID %. Copy it from Authentication → Users.', v_user_id;
  end if;

  if char_length(trim(v_name)) not between 2 and 120 then
    raise exception 'Organisation name must be between 2 and 120 characters';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Organisation slug is invalid';
  end if;

  if exists (
    select 1
    from public.organisation_members
    where user_id = v_user_id
      and status = 'active'
      and deleted_at is null
  ) then
    raise exception 'This account already belongs to an active organisation';
  end if;

  insert into public.profiles (id, display_name, full_name)
  select
    u.id,
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), '')
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  select id into strict v_role_id
  from public.roles
  where code = 'owner';

  insert into public.organisations (name, slug, created_by)
  values (trim(v_name), v_slug, v_user_id)
  returning id into v_org_id;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    role_id,
    role,
    status,
    is_primary,
    joined_at,
    created_by
  )
  values (v_org_id, v_user_id, v_role_id, 'owner', 'active', true, now(), v_user_id);

  insert into public.dealership_settings (
    organisation_id,
    dealership_name,
    created_by
  )
  values (v_org_id, trim(v_name), v_user_id);
end $$;

-- Copy the organisation_id below into the DEALEROS_PUBLIC_ORGANISATION_ID
-- environment variable on Vercel.
select id as organisation_id, name, slug
from public.organisations
order by created_at desc
limit 1;
