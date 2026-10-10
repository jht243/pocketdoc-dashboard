-- Account details on the member's profile.
--
-- The Account screen lets a member keep their own contact details: phone and
-- mailing address, next to the name, date of birth and sex that onboarding already
-- stores in this row. All optional. Owner-only access is inherited from the
-- table's existing RLS policy.
--
-- Deleting an account needs nothing here: every ghai table cascades from
-- auth.users, so removing the auth user (ghai-delete-account) removes the rows.
alter table ghai.profiles
  add column if not exists phone          text,
  add column if not exists address_line1  text,
  add column if not exists address_line2  text,
  add column if not exists city           text,
  add column if not exists state          text,
  add column if not exists postal_code    text;
