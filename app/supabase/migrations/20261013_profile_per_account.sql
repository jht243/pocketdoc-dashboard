-- Every account has a profile row, and that row carries the member's email.
--
-- Until now a ghai.profiles row was created by the first onboarding save, so a
-- member who signed up and stopped before step one existed only in auth.users —
-- and the email they signed up with was never in our schema at all. Account info
-- belongs in one place we own: created at signup, kept in step with the login.
--
-- The app routes on onboarding_completed_at and dob, never on whether a row
-- exists, so an empty row behaves exactly like no row did.
alter table ghai.profiles
  add column if not exists email text;

comment on column ghai.profiles.email is
  'Login email, mirrored from auth.users by ghai.sync_profile_from_auth(). Read-only from the app; members change it through Supabase Auth.';

create or replace function ghai.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into ghai.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update set email = excluded.email;
  return new;
exception when others then
  -- A missing profile row is recoverable (onboarding and the Account screen both
  -- create one); a failed signup is not. Never let this block auth.
  raise warning 'sync_profile_from_auth failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists ghai_profile_on_signup on auth.users;
create trigger ghai_profile_on_signup
  after insert on auth.users
  for each row execute function ghai.sync_profile_from_auth();

-- Email changes land here only once the member confirms the new address, which is
-- when auth.users.email itself changes.
drop trigger if exists ghai_profile_on_email_change on auth.users;
create trigger ghai_profile_on_email_change
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function ghai.sync_profile_from_auth();

-- Backfill: a row for every existing account, and every row's email.
insert into ghai.profiles (user_id, email)
select u.id, u.email from auth.users u
on conflict (user_id) do update set email = excluded.email;
