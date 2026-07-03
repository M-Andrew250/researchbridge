-- ResearchBridge Consulting — initial schema
-- Tables: profiles, enrolments, contact_messages
-- Access model: RLS is enabled with no permissive policies for the
-- anon/authenticated roles. Only the Express backend (using the
-- Supabase service_role key, which bypasses RLS) reads/writes these
-- tables. The frontend talks to Supabase Auth directly for signup/
-- login, but never touches these tables directly.

create extension if not exists pgcrypto;

-- ── updated_at helper ──
-- Reused by every table below to keep an accurate last-modified time.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── PROFILES ──
-- One row per Supabase Auth user, holding the extra fields the
-- signup form collects that auth.users doesn't store (name, phone).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new user signs up via
-- Supabase Auth. full_name/phone come from the signUp() call's
-- options.data metadata set by the frontend.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── ENROLMENTS ──
-- Mirrors the fields collected by pages/enrol.html. user_id is
-- nullable because the enrolment form doesn't require login.
create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  course_slug text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  organisation text,
  category text not null
    check (category in ('Individual', 'Group (5–10 people)', 'Group (10+ people)')),
  mode text not null
    check (mode in ('Online — Live Sessions', 'Online — Self-paced', 'In-Person — Kigali')),
  level text not null
    check (level in ('Complete Beginner', 'Some Basic Knowledge', 'Intermediate')),
  comments text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.enrolments enable row level security;

create trigger enrolments_set_updated_at
  before update on public.enrolments
  for each row execute function public.set_updated_at();

create index enrolments_user_id_idx on public.enrolments (user_id);
create index enrolments_email_idx on public.enrolments (email);
create index enrolments_course_slug_idx on public.enrolments (course_slug);
create index enrolments_status_idx on public.enrolments (status);


-- ── CONTACT MESSAGES ──
-- Mirrors the contact form fields on index.html.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  category text,
  service_interest text,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'read', 'responded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create trigger contact_messages_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

create index contact_messages_status_idx on public.contact_messages (status);
create index contact_messages_email_idx on public.contact_messages (email);