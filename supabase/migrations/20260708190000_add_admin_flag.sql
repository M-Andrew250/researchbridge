-- Marks a profile as having admin access (enrolment management to
-- start, more admin surface area later). Defaults to false for every
-- existing and future account; flip it manually in the Table Editor
-- for whichever account(s) should have admin access — there is no
-- signup path that can set this itself.
alter table public.profiles
  add column is_admin boolean not null default false;
